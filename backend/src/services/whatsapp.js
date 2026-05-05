const axios = require('axios');

const BASE_URL = `https://graph.facebook.com/${process.env.WA_API_VERSION || 'v19.0'}`;
const PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const TOKEN = process.env.WA_ACCESS_TOKEN;
const WABA_ID = process.env.WA_BUSINESS_ACCOUNT_ID;

function getHeaders() {
  return { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
}

// Random delay between min-max ms (anti-bot randomization)
function randomDelay(min = 1000, max = 5000) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTemplateMessage({ phone, templateName, language = 'en', variables = [] }) {
  await randomDelay(1000, 4000);

  const components = variables.length > 0
    ? [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: String(v) })) }]
    : [];

  const payload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone.slice(1) : phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components,
    },
  };

  const response = await axios.post(
    `${BASE_URL}/${PHONE_ID}/messages`,
    payload,
    { headers: getHeaders() }
  );

  return response.data;
}

async function sendTextMessage({ phone, text }) {
  await randomDelay(1000, 3000);

  const payload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone.slice(1) : phone,
    type: 'text',
    text: { body: text, preview_url: false },
  };

  const response = await axios.post(
    `${BASE_URL}/${PHONE_ID}/messages`,
    payload,
    { headers: getHeaders() }
  );

  return response.data;
}

async function uploadImageForTemplate(imageUrl) {
  // Download the image and upload to Meta to get a permanent handle
  const imgResp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const imgBuffer = Buffer.from(imgResp.data);
  const contentType = imgResp.headers['content-type'] || 'image/jpeg';
  const fileSize = imgBuffer.length;

  // Step 1: Create upload session
  const sessionResp = await axios.post(
    `https://graph.facebook.com/v19.0/${WABA_ID}/uploads`,
    null,
    {
      params: { file_length: fileSize, file_type: contentType, access_token: TOKEN },
    }
  );
  const uploadId = sessionResp.data.id;

  // Step 2: Upload binary data
  const uploadResp = await axios.post(
    `https://graph.facebook.com/v19.0/${uploadId}`,
    imgBuffer,
    {
      headers: {
        Authorization: `OAuth ${TOKEN}`,
        'Content-Type': contentType,
        file_offset: 0,
      },
    }
  );

  return uploadResp.data.h; // The handle
}

async function submitTemplateForApproval(template) {
  const components = [];

  if (template.header_image_url) {
    // IMAGE header — upload image to get handle, then use it as example
    try {
      const handle = await uploadImageForTemplate(template.header_image_url);
      components.push({
        type: 'HEADER',
        format: 'IMAGE',
        example: { header_handle: [handle] },
      });
    } catch (err) {
      console.error('[Meta] Image upload failed, falling back to text header:', err.message);
      if (template.header_text) {
        components.push({ type: 'HEADER', format: 'TEXT', text: template.header_text });
      }
    }
  } else if (template.header_text) {
    components.push({ type: 'HEADER', format: 'TEXT', text: template.header_text });
  }

  components.push({ type: 'BODY', text: template.body_text });

  if (template.footer_text) {
    components.push({ type: 'FOOTER', text: template.footer_text });
  }

  // Sanitize template name: lowercase, underscores, max 512 chars
  const metaName = template.name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60);

  // Add buttons if present
  const buttons = Array.isArray(template.buttons) ? template.buttons : [];
  if (buttons.length > 0) {
    const buttonComponents = buttons.map(btn => {
      if (btn.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.value };
      if (btn.type === 'URL') return { type: 'URL', text: btn.text, url: btn.value };
      if (btn.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: btn.text };
      return null;
    }).filter(Boolean);
    if (buttonComponents.length > 0) components.push({ type: 'BUTTONS', buttons: buttonComponents });
  }

  const payload = {
    name: metaName,
    category: template.category || 'MARKETING',
    language: template.language || 'mr',
    components,
  };

  let response;
  try {
    response = await axios.post(
      `${BASE_URL}/${WABA_ID}/message_templates`,
      payload,
      { headers: getHeaders() }
    );
  } catch (err) {
    const errData = err.response?.data?.error || {};
    const metaMsg = errData.message || err.message;
    const metaCode = errData.code || '';
    const metaSubcode = errData.error_subcode || '';
    const metaData = errData.error_data || '';
    console.error('[Meta Template] Submit error:', JSON.stringify(err.response?.data || {}));
    console.error('[Meta Template] Payload was:', JSON.stringify(payload));
    throw new Error(`Meta: ${metaMsg} (code ${metaCode}, subcode ${metaSubcode}, data: ${metaData})`);
  }

  return { ...response.data, name: metaName };
}

async function getHealthStatus() {
  if (!TOKEN || !PHONE_ID) {
    return { status: 'not_configured', api_connected: false, message: 'API credentials not set in .env' };
  }

  try {
    const [phoneInfo, wabaInfo] = await Promise.all([
      axios.get(`${BASE_URL}/${PHONE_ID}?fields=display_phone_number,quality_rating,code_verification_status,name_status`, { headers: getHeaders() }),
      axios.get(`${BASE_URL}/${WABA_ID}?fields=currency,message_template_namespace`, { headers: getHeaders() }).catch(() => ({ data: {} })),
    ]);

    return {
      status: 'ok',
      api_connected: true,
      phone_number: phoneInfo.data.display_phone_number,
      quality_rating: phoneInfo.data.quality_rating,
      name_status: phoneInfo.data.name_status,
      code_status: phoneInfo.data.code_verification_status,
      currency: wabaInfo.data.currency,
      api_version: process.env.WA_API_VERSION || 'v19.0',
    };
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    return { status: 'error', api_connected: false, message };
  }
}

async function getTemplatesFromMeta() {
  const response = await axios.get(
    `${BASE_URL}/${WABA_ID}/message_templates?fields=name,status,category,language,components`,
    { headers: getHeaders() }
  );
  return response.data.data || [];
}

module.exports = {
  sendTemplateMessage,
  sendTextMessage,
  submitTemplateForApproval,
  getHealthStatus,
  getTemplatesFromMeta,
  randomDelay,
};

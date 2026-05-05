/**
 * Test: upload ESIC banner image to Meta for use as template header
 * Usage: node scripts/test_image_upload.js
 */

const https = require('https');
const http = require('http');

const TOKEN = process.env.WA_ACCESS_TOKEN;
const WABA_ID = process.env.WA_BUSINESS_ACCOUNT_ID;
const IMAGE_URL = 'https://sunshine-connect-production.up.railway.app/images/esic_banner.png';

if (!TOKEN || !WABA_ID) {
  console.error('❌ Set WA_ACCESS_TOKEN and WA_BUSINESS_ACCOUNT_ID environment variables');
  process.exit(1);
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: res.headers['content-type'] || 'image/png',
      }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function metaRequest(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = body instanceof Buffer ? body : (body ? JSON.stringify(body) : null);
    const opts = {
      hostname: 'graph.facebook.com',
      path,
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        ...headers,
        ...(bodyStr && !(body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          if (res.statusCode >= 400) reject(new Error(JSON.stringify(data)));
          else resolve(data);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function run() {
  console.log('\n🖼️  Testing ESIC Banner image upload to Meta\n');
  console.log(`IMAGE_URL: ${IMAGE_URL}`);
  console.log(`WABA_ID: ${WABA_ID}\n`);

  // Step 1: Download image
  console.log('📥 Step 1: Downloading image...');
  const { buffer, contentType } = await downloadImage(IMAGE_URL);
  console.log(`  ✅ Downloaded: ${buffer.length} bytes, type: ${contentType}\n`);

  // Step 2: Create upload session
  console.log('📤 Step 2: Creating Meta upload session...');
  const sessionPath = `/v19.0/${WABA_ID}/uploads?file_length=${buffer.length}&file_type=${contentType}&access_token=${TOKEN}`;
  const session = await metaRequest('POST', sessionPath, null);
  console.log(`  ✅ Upload session created: ${session.id}\n`);

  // Step 3: Upload binary
  console.log('⬆️  Step 3: Uploading image binary to Meta...');
  const uploadPath = `/v19.0/${session.id}`;
  const uploadResult = await metaRequest('POST', uploadPath, buffer, {
    Authorization: `OAuth ${TOKEN}`,
    'Content-Type': contentType,
    file_offset: '0',
  });
  console.log(`  ✅ Upload complete! Handle: ${uploadResult.h}\n`);

  console.log('🎉 SUCCESS! Image handle for template submission:');
  console.log(`   ${uploadResult.h}`);
  console.log('\nThis handle will be used in template HEADER when re-submitting.\n');
}

run().catch(err => {
  console.error('\n❌ FAILED:', err.message || err);
  process.exit(1);
});

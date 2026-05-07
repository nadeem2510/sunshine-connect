/**
 * Create shimg_esic_empanelment_news template in our DB
 * (template already exists on Meta - submitted via WhatsApp Manager)
 * Usage: node scripts/create_img_template.js
 */
const https = require('https');

const BASE = 'sunshine-connect-production.up.railway.app';

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: BASE,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr, 'utf8') } : {}),
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr, 'utf8');
    req.end();
  });
}

async function run() {
  console.log('Step 1: Creating shimg_esic_empanelment_news in DB...');
  const created = await apiCall('POST', '/api/templates', {
    name: 'shimg_esic_empanelment_news',
    category: 'MARKETING',
    language: 'mr',
    body_text: '🏥✨ *अत्यंत आनंदाची बातमी!*\n\nतुमच्या सर्व कामगारांसाठी सनशाईन हॉस्पिटल आता ESIC अंतर्गत अधिकृतपणे *कॅशलेस (Empanelled)* झाले आहे.\n\nआता तुमच्या कोणत्याही ESIC लाभार्थी कामगाराला उत्तम वैद्यकीय उपचारांसाठी पैशांची चिंता करण्याची गरज नाही.\n\n✅ *सर्व उपचार मोफत!*\n\nही माहिती तुमच्या सर्व कामगारांपर्यंत पोहोचवा.',
    header_image_url: 'https://sunshine-connect-production.up.railway.app/images/esic_banner_small.jpg',
    footer_text: 'सनशाईन हॉस्पिटल',
    buttons: [
      { type: 'PHONE_NUMBER', text: 'कॉल करा', value: '+919850633786' },
      { type: 'QUICK_REPLY', text: 'हॉस्पिटल शोधा' },
    ],
  });

  if (created.error) { console.error('❌ Create failed:', created.error); process.exit(1); }
  console.log(`✅ Created template ID: ${created.id}`);
  console.log('   Body preview:', created.body_text.substring(0, 60) + '...');

  console.log('\nStep 2: Syncing with Meta to get status + meta_template_id...');
  const synced = await apiCall('POST', '/api/templates/sync-meta', {});
  console.log('✅ Sync result:', JSON.stringify(synced));

  console.log('\nStep 3: Fetching template to verify...');
  const tmpl = await apiCall('GET', `/api/templates/${created.id}`, null);
  console.log('✅ Template in DB:');
  console.log('   Status:', tmpl.status);
  console.log('   meta_template_name:', tmpl.meta_template_name);
  console.log('   meta_template_id:', tmpl.meta_template_id);
  console.log('   meta_has_image_header:', tmpl.meta_has_image_header);
  console.log('\n📋 Template DB ID:', created.id);
  console.log('   Once Meta approves, run:');
  console.log(`   curl -X PUT https://${BASE}/api/scheduled-campaigns/1 -H "Content-Type: application/json" -d '{"template_id": ${created.id}}'`);
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

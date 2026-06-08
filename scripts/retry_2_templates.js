const https = require('https');
const BASE = 'sunshine-connect-production.up.railway.app';

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: BASE, path, method,
      headers: { 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr, 'utf8') } : {}) },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr, 'utf8');
    req.end();
  });
}

const CALL_BTN = { type: 'PHONE_NUMBER', text: 'कॉल करा', value: '+919130561222' };

const TEMPLATES = [
  {
    name: 'esic_worker_health_warning',
    body_text: '⚠️ *काम करताना शरीर थकतंय?*\n\nकामगार दिवसभर कष्ट करतो, पण तपासणी टाळतो!\n\n🔸 छातीत दुखणे\n🔸 सतत थकवा\n🔸 दम लागणे\n🔸 पाठदुखी / सांधेदुखी\n\n*हे सामान्य नाही!*\n\nESIC अंतर्गत सनशाईन हॉस्पिटलमध्ये कॅशलेस उपचार उपलब्ध. आजच तपासणी करा!',
    footer_text: 'सनशाईन हॉस्पिटल — Fair With Quality Care',
  },
  {
    name: 'esic_workers_health_protection',
    body_text: '🛡️ *कामगारांसाठी आरोग्य सुरक्षा!*\n\nतुम्ही कंपनीसाठी काम करता... आम्ही तुमच्या आरोग्यासाठी!\n\nसनशाईन हॉस्पिटलमध्ये ESIC लाभार्थ्यांसाठी:\n✅ OPD सुविधा\n✅ IPD सुविधा\n✅ ICU सुविधा\n✅ सर्जरी सुविधा\n✅ Emergency Treatment (24x7)\n\nतुमच्या ESIC कार्डचा पूर्ण फायदा घ्या!',
    footer_text: 'सनशाईन हॉस्पिटल — Fair With Quality Care',
  },
];

async function run() {
  const createdIds = [];
  for (const t of TEMPLATES) {
    process.stdout.write(`${t.name} ... `);
    try {
      const created = await apiCall('POST', '/api/templates', {
        name: t.name, category: 'MARKETING', language: 'mr',
        body_text: t.body_text, footer_text: t.footer_text, buttons: [CALL_BTN],
      });
      if (created.error) { console.log(`❌ ${created.error}`); continue; }
      await new Promise(r => setTimeout(r, 1500));
      const submitted = await apiCall('POST', `/api/templates/${created.id}/submit-approval`, {});
      console.log(submitted.error ? `⚠️ created ID ${created.id}, submit: ${submitted.error}` : `✅ ID ${created.id}, status: ${submitted.status}`);
      createdIds.push(created.id);
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) { console.log(`❌ ${err.message}`); }
  }
  console.log('Created:', createdIds);
}
run();

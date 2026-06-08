/**
 * Create 5 ESIC awareness templates (based on poster designs shared) +
 * submit to Meta. These will be used for the new "ESIC Contractors May26"
 * group campaign — runs every 3 days for 1 month (10 sends, rotating).
 */
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

// 5 templates inspired by the shared poster designs (worker fatigue/ESIC awareness theme)
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
  {
    name: 'esic_dont_delay_treatment',
    body_text: '💰 *पैशांअभावी उपचार पुढे ढकलू नका!*\n\nआजारी पडल्यावर सर्वात मोठी भीती असते — खर्चाची.\n\nपण आता ESIC अंतर्गत सनशाईन हॉस्पिटलमध्ये अनेक उपचार पूर्णपणे *कॅशलेस* उपलब्ध आहेत!\n\n🔹 तज्ज्ञ डॉक्टर\n🔹 आधुनिक यंत्रणा\n🔹 जलद सेवा\n\n*आरोग्यावर खर्च नाही... उपचाराचा अधिकार!*',
    footer_text: 'सनशाईन हॉस्पिटल — Fair With Quality Care',
  },
  {
    name: 'esic_card_benefits_reminder',
    body_text: '🪪 *तुमच्याकडे ESIC कार्ड आहे?*\n\nमग उपचारासाठी पैसे का खर्च करता?\n\nअनेक कामगारांना ESIC च्या मोफत उपचार सुविधांची माहितीच नसते!\n\n✅ कॅशलेस उपचार — एकही रुपया खर्च नाही\n✅ तज्ज्ञ डॉक्टरांची सेवा\n✅ आधुनिक सुविधा व उपकरणे\n✅ भरती आणि ऑपरेशन सुविधा\n✅ कमी त्रासात जलद उपचार\n\nआजच माहिती घ्या — तुमचा हक्काचा आरोग्य लाभ वापरा!',
    footer_text: 'सनशाईन हॉस्पिटल — Fair With Quality Care',
  },
  {
    name: 'esic_family_health_secure',
    body_text: '👨‍👩‍👧 *तुमचं कुटुंब, तुमची जबाबदारी!*\n\nESIC कार्डधारक असाल, तर तुमच्या संपूर्ण कुटुंबाला मिळतो मोफत उपचाराचा हक्क.\n\n🏥 कॅशलेस उपचार\n👶 मातृत्व लाभ\n💊 मोफत औषधे\n🩺 नियमित आरोग्य तपासणी\n\nसनशाईन हॉस्पिटल — तुमच्या कुटुंबाच्या आरोग्याची संपूर्ण काळजी घेतो.\n\n*आजच भेट द्या आणि लाभ घ्या!*',
    footer_text: 'सनशाईन हॉस्पिटल — Fair With Quality Care',
  },
];

async function run() {
  console.log(`\n🚀 Creating ${TEMPLATES.length} ESIC awareness templates...\n`);
  const createdIds = [];
  const failed = [];

  for (let i = 0; i < TEMPLATES.length; i++) {
    const t = TEMPLATES[i];
    process.stdout.write(`[${i + 1}/${TEMPLATES.length}] ${t.name} ... `);
    try {
      const created = await apiCall('POST', '/api/templates', {
        name: t.name,
        category: 'MARKETING',
        language: 'mr',
        body_text: t.body_text,
        footer_text: t.footer_text,
        buttons: [CALL_BTN],
      });

      if (created.error) {
        console.log(`❌ Create: ${created.error}`);
        failed.push({ name: t.name, error: created.error });
        continue;
      }

      await new Promise(r => setTimeout(r, 1500));
      const submitted = await apiCall('POST', `/api/templates/${created.id}/submit-approval`, {});
      if (submitted.error) {
        console.log(`⚠️  Created (ID ${created.id}) but submit failed: ${submitted.error}`);
      } else {
        console.log(`✅ ID ${created.id}, Meta status: ${submitted.status}`);
      }
      createdIds.push(created.id);
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      failed.push({ name: t.name, error: err.message });
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`✅ Created IDs: [${createdIds.join(', ')}]`);
  console.log(`❌ Failed: ${failed.length}`);
  if (failed.length) failed.forEach(f => console.log(`   ${f.name}: ${f.error}`));
  console.log(`\nTemplate IDs for campaign: [${createdIds.join(', ')}]`);
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });

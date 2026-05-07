/**
 * Create 14 new Marathi templates for 15-day contractor campaign rotation
 * (Day 1 = shimg_esic_empanelment_news ID 157 already exists and approved)
 * Usage: node scripts/create_15_day_messages.js
 */
const https = require('https');
const BASE = 'sunshine-connect-production.up.railway.app';

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
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

const BANNER = 'https://sunshine-connect-production.up.railway.app/images/esic_banner_small.jpg';
const CALL_BTN = { type: 'PHONE_NUMBER', text: 'कॉल करा', value: '+919850633786' };

// 14 templates (Day 2 to Day 15)
const TEMPLATES = [
  {
    name: 'shimg_cashless_treatment_info',
    body_text: '🏥 *कॅशलेस उपचार - सोपा आणि मोफत!*\n\nसनशाईन हॉस्पिटल ESIC अंतर्गत कॅशलेस झाले आहे.\n\nतुमच्या कामगाराला उपचार हवे असल्यास, फक्त ESIC कार्ड दाखवा - एक रुपयाही लागणार नाही!\n\n🔹 OPD | IPD | सर्जरी - सर्व मोफत\n🔹 कोणत्याही वेळी यावे, आम्ही तयार आहोत',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_worker_esic_benefits',
    body_text: '✅ *ESIC अंतर्गत कामगारांना काय मिळते?*\n\nसनशाईन हॉस्पिटलमध्ये ESIC कार्डधारकांना मिळतात:\n\n🏥 सर्व रोगांवर मोफत उपचार\n💊 मोफत औषधे\n🩺 तज्ज्ञ डॉक्टरांचा सल्ला\n🏨 मोफत रुग्णालयात भर्ती\n👶 मातृत्व लाभ\n\nतुमच्या सर्व कामगारांना ही माहिती द्या!',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_emergency_services_247',
    body_text: '🚨 *आपत्कालीन परिस्थिती? आम्ही 24/7 तयार आहोत!*\n\nESIC कामगारांसाठी सनशाईन हॉस्पिटलची आपत्कालीन सेवा:\n\n⏰ 24 तास | 7 दिवस | 365 दिवस\n\nकधीही, कोणत्याही परिस्थितीत - आम्ही आहोत!\n\n🚑 रुग्णवाहिका सेवा उपलब्ध\nताबडतोब संपर्क करा.',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_esic_new_worker_enroll',
    body_text: '📋 *नवीन कामगार नोकरीवर आला? ESIC नोंदणी करा!*\n\nESIC नोंदणीचे फायदे:\n✅ कामगाराला मोफत वैद्यकीय सेवा\n✅ अपघात विमा संरक्षण\n✅ मातृत्व लाभ\n✅ अपंगत्व भत्ता\n\nनोंदणी कशी करायची? आमच्याशी संपर्क करा, आम्ही मदत करू!',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_maternity_benefits_esic',
    body_text: '👶 *ESIC अंतर्गत मातृत्व लाभ - संपूर्ण मोफत!*\n\nतुमच्या महिला कामगारांसाठी:\n\n🏥 प्रसूती (Delivery) संपूर्ण मोफत\n💊 प्रसूतीपूर्व व नंतर औषधे मोफत\n🩺 नियमित तपासणी मोफत\n🍼 बाळाचे लसीकरण मोफत\n\nसनशाईन हॉस्पिटल - तुमच्या कामगारांची काळजी घेतो!',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_specialty_departments',
    body_text: '🏥 *सनशाईन हॉस्पिटलमध्ये ESIC अंतर्गत उपलब्ध विभाग:*\n\n🫀 हृदयरोग (Cardiology)\n🦴 हाडांचे आजार (Orthopedics)\n👁️ नेत्र विभाग (Ophthalmology)\n🦷 दंत विभाग (Dentistry)\n👶 बालरोग (Pediatrics)\n🤰 स्त्रीरोग (Gynecology)\n\nसर्व सेवा ESIC कार्डधारकांसाठी मोफत!\nतुमच्या कामगारांना आज सांगा.',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_free_medicines_esic',
    body_text: '💊 *ESIC कार्डावर मोफत औषधे - सनशाईन हॉस्पिटलमध्ये!*\n\nकामगाराला कोणतेही आजारपण झाल्यास:\n\n✅ डॉक्टरांचा सल्ला मोफत\n✅ तपासण्या (Tests) मोफत\n✅ औषधे संपूर्णपणे मोफत\n✅ फॉलो-अप भेट मोफत\n\nफक्त ESIC कार्ड सोबत आणा!\nआम्ही बाकी सर्व सांभाळतो.',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_health_checkup_esic',
    body_text: '🩺 *कामगारांची आरोग्य तपासणी - ESIC अंतर्गत मोफत!*\n\nनिरोगी कामगार = उत्पादक व्यवसाय!\n\nसनशाईन हॉस्पिटलमध्ये ESIC कार्डधारकांसाठी:\n🔬 रक्त तपासणी (Blood Test)\n💓 ECG\n🫁 Chest X-Ray\n🩺 डॉक्टरांचा सल्ला\n\nसर्व मोफत! आजच अपॉइंटमेंट घ्या.',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_healthy_worker_message',
    body_text: '💪 *निरोगी कामगार - समृद्ध व्यवसाय!*\n\nएक कंत्राटदार म्हणून तुमची जबाबदारी आहे कामगारांचे आरोग्य सांभाळणे.\n\nESIC अंतर्गत सनशाईन हॉस्पिटल तुम्हाला मदत करते:\n\n🏥 वेळेवर उपचार\n💊 योग्य औषधे\n🩺 तज्ज्ञ डॉक्टर\n❤️ संपूर्ण काळजी - पूर्णपणे मोफत!\n\nतुमचे कामगार निरोगी राहतील, व्यवसाय फुलेल!',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_esic_claim_easy',
    body_text: '📝 *ESIC दावा (Claim) कसा करायचा?*\n\nसनशाईन हॉस्पिटलमध्ये ESIC कामगारांसाठी:\n\n✅ कोणताही पेपरवर्क नाही!\n✅ कोणतीही पूर्व परवानगी नाही!\n✅ थेट हॉस्पिटलमध्ये या\n\nफक्त हे सोबत आणा:\n📄 ESIC कार्ड / ESI Number\n🪪 ओळखपत्र (ID Proof)\n\nबाकी सर्व आम्ही करतो! 🏥',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_dental_optical_esic',
    body_text: '🦷👁️ *ESIC अंतर्गत दंत व नेत्र सेवा - मोफत!*\n\nतुमच्या कामगारांना आता मिळेल:\n\n🦷 दंत उपचार (Dental Treatment)\n🔍 दात तपासणी\n👁️ डोळे तपासणी (Eye Check-up)\n👓 चष्म्यासाठी सवलत\n\nसर्व ESIC कार्डधारकांसाठी मोफत!\nआजच अपॉइंटमेंट घ्या.',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_save_contact_esic',
    body_text: '📱 *सनशाईन हॉस्पिटलचा नंबर Save करा!*\n\nESIC कामगारांसाठी आपत्कालीन नंबर:\n\n📞 +91 98506 33786\n\nकधीही गरज पडल्यास - एक फोन करा!\nआम्ही 24/7 उपलब्ध आहोत.\n\nहा नंबर तुमच्या सर्व कामगारांनाही द्या.\nएक नंबर - संपूर्ण आरोग्य सेवा! 🏥',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_ambulance_free_esic',
    body_text: '🚑 *ESIC कामगारांसाठी मोफत रुग्णवाहिका सेवा!*\n\nअपघात किंवा आजारपणात:\n\n✅ ताबडतोब रुग्णवाहिका उपलब्ध\n✅ प्रशिक्षित कर्मचारी सोबत\n✅ ESIC कामगारांसाठी पूर्णपणे मोफत\n\n📞 आत्ताच नंबर Save करा: +91 98506 33786\n\nआम्ही तुमच्यासाठी नेहमी तयार आहोत! 🏥',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
  {
    name: 'shimg_thankyou_contractor',
    body_text: '🙏 *धन्यवाद! तुमच्या विश्वासाबद्दल आभार!*\n\nसनशाईन हॉस्पिटल आणि तुमचे कामगार यांचे नाते असेच घट्ट राहू द्या!\n\nESIC अंतर्गत आम्ही नेहमी तुमच्यासाठी आहोत:\n🏥 उत्तम वैद्यकीय सेवा\n💊 मोफत औषधे\n❤️ संपूर्ण काळजी\n\nकोणत्याही गरजेसाठी संपर्क करा!',
    footer_text: 'सनशाईन हॉस्पिटल',
  },
];

async function run() {
  console.log(`\n🚀 Creating ${TEMPLATES.length} templates for 15-day rotation...\n`);
  const createdIds = [157]; // Day 1 already exists
  const failed = [];

  for (let i = 0; i < TEMPLATES.length; i++) {
    const t = TEMPLATES[i];
    const dayNum = i + 2;
    process.stdout.write(`Day ${dayNum}: ${t.name} ... `);

    try {
      // Create in DB
      const created = await apiCall('POST', '/api/templates', {
        name: t.name,
        category: 'MARKETING',
        language: 'mr',
        body_text: t.body_text,
        footer_text: t.footer_text,
        header_image_url: BANNER,
        buttons: [CALL_BTN],
      });

      if (created.error) {
        console.log(`❌ Create: ${created.error}`);
        failed.push({ day: dayNum, name: t.name, error: created.error });
        continue;
      }

      // Submit for Meta approval
      const submitted = await apiCall('POST', `/api/templates/${created.id}/submit-approval`, {});
      if (submitted.error) {
        console.log(`⚠️  Created (ID ${created.id}) but submit failed: ${submitted.error}`);
        createdIds.push(created.id);
      } else {
        console.log(`✅ ID ${created.id}, Meta status: ${submitted.status}`);
        createdIds.push(created.id);
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      failed.push({ day: dayNum, name: t.name, error: err.message });
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`✅ Created IDs: [${createdIds.join(', ')}]`);
  console.log(`❌ Failed: ${failed.length}`);
  if (failed.length) failed.forEach(f => console.log(`   Day ${f.day} ${f.name}: ${f.error}`));

  console.log('\n📋 Update campaign with rotation:');
  console.log(`curl -s -X PUT "https://${BASE}/api/scheduled-campaigns/1" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"template_ids": [${createdIds.join(', ')}]}'`);

  console.log(`\nAll 15 template IDs: [${createdIds.join(', ')}]`);
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });

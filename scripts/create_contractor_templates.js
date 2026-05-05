/**
 * Bulk create all 15 Marathi contractor templates and submit for Meta approval
 * Usage: node scripts/create_contractor_templates.js
 */

const API = process.env.API_URL || 'https://sunshine-connect-production.up.railway.app';

const BUTTONS = [
  { type: 'PHONE_NUMBER', text: 'कॉल करा', value: '+919850633786' },
  { type: 'URL', text: 'हॉस्पिटल शोधा', value: 'https://maps.google.com/?q=Sunshine+Hospital+Chhatrapati+Sambhajinagar' },
];

const FOOTER = 'सनशाईन हॉस्पिटल | NABH Accredited | 📞 9130561222';

const TEMPLATES = [
  {
    name: 'contractor_health_partner',
    header_text: 'तुमचे हेल्थ पार्टनर',
    body_text: `🙏 {{1}} जी,

कामगार हा कोणत्याही कंपनीचा कणा असतो आणि तुम्ही त्यांच्या पाठीशी खंबीरपणे उभे असता.

तुमच्या या जबाबदारीत साथ देण्यासाठी *सनशाईन हॉस्पिटल, छत्रपती संभाजीनगर* आता तुमचे 'हेल्थ पार्टनर' म्हणून सोबत आहे.

कामगारांच्या आरोग्याची कोणतीही अडचण आल्यास आम्ही फक्त एका कॉलवर उपलब्ध आहोत.

_आपले आरोग्य, आमची प्राथमिकता!_`,
  },
  {
    name: 'esic_empanelment_news',
    header_text: 'ESIC कॅशलेस सुविधा',
    body_text: `🏥✨ *अत्यंत आनंदाची बातमी!*

तुमच्या सर्व कामगारांसाठी सनशाईन हॉस्पिटल आता ESIC अंतर्गत अधिकृतपणे *कॅशलेस (Empanelled)* झाले आहे.

आता तुमच्या कोणत्याही ESIC लाभार्थी कामगाराला उत्तम वैद्यकीय उपचारांसाठी पैशांची चिंता करण्याची गरज नाही.

✅ *सर्व उपचार मोफत!*

ही माहिती तुमच्या सर्व कामगारांपर्यंत पोहोचवा.`,
  },
  {
    name: 'contractor_care_message',
    header_text: 'तुमची चिंता, आमची जबाबदारी',
    body_text: `😟 {{1}} जी,

कामगार आजारी पडला की तुमची धावपळ होते, बरोबर ना?

कॉन्ट्रॅक्टर म्हणून तुमच्यावर खूप ताण असतो. पण आता कामगाराच्या उपचाराची आणि हॉस्पिटलच्या कागदपत्रांची *चिंता आमच्यावर सोडा.*

सनशाईन हॉस्पिटलमध्ये तुमचा कामगार आल्यावर त्याला *उत्तम आणि जलद उपचार* मिळतील, जेणेकरून तो लवकर बरा होऊन कामावर परतेल. 🤝`,
  },
  {
    name: 'industrial_emergency_24x7',
    header_text: '२४ तास इमर्जन्सी सेवा',
    body_text: `🚨 *औद्योगिक अपघात किंवा इमर्जन्सी?*

आम्ही *२४ तास सज्ज आहोत!*

फॅक्टरीत काम करताना अचानक अपघात झाल्यास एका सेकंदाचाही विलंब न करता आमच्या इमर्जन्सी वॉर्डशी संपर्क साधा.

सनशाईन हॉस्पिटलचा *ट्रॉमा केअर विभाग रात्रंदिवस (24x7)* कामगारांच्या सेवेसाठी उघडा आहे. 🚑`,
  },
  {
    name: 'ambulance_service_info',
    header_text: 'मोफत रुग्णवाहिका सुविधा',
    body_text: `🚑 {{1}} जी,

तातडीच्या वेळी प्रवासाचा ताण नको!

फॅक्टरीमध्ये कोणतीही मेडिकल इमर्जन्सी आल्यास फक्त आम्हाला कॉल करा.

सनशाईन हॉस्पिटलतर्फे *कंपनीपर्यंत रुग्णवाहिका (Ambulance) सुविधा* उपलब्ध करून दिली जाईल.

_वेळेवर उपचार, हेच आमचे ध्येय!_`,
  },
  {
    name: 'esic_documents_required',
    header_text: 'ESIC साठी लागणारी कागदपत्रे',
    body_text: `📄 {{1}} जी,

*ESIC अंतर्गत मोफत उपचारांसाठी काय आवश्यक आहे?*

कामगाराला ॲडमिट करताना फक्त खालील दोन गोष्टी सोबत ठेवा:

1️⃣ कामगाराचे *ई-पहचान कार्ड (E-Pehchan Card)*
2️⃣ *आधार कार्ड*

बाकीची सर्व प्रक्रियेची जबाबदारी आमची!`,
  },
  {
    name: 'multispeciality_hospital_info',
    header_text: 'NABH मान्यताप्राप्त हॉस्पिटल',
    body_text: `🏥 {{1}} जी,

*सनशाईन हॉस्पिटल का निवडावे?*

आम्ही फक्त एक क्लिनिक नसून *५०-बेडचे NABH मान्यताप्राप्त मल्टीस्पेशालिटी हॉस्पिटल* आहोत.

✅ अस्थिरोग (हाडांचे फॅक्चर)
✅ जनरल मेडिसिन
✅ आयसीयू (ICU)
✅ सर्जरी

सर्व सुविधा *एकाच छताखाली* उपलब्ध आहेत!`,
  },
  {
    name: 'family_esic_coverage',
    header_text: 'कुटुंबाचीही काळजी',
    body_text: `👨‍👩‍👧‍👦 {{1}} जी,

*फक्त कामगारच नाही, तर त्यांच्या कुटुंबाचीही काळजी!*

ESIC च्या माध्यमातून फक्त कामगारावरच नाही, तर त्यांच्या कुटुंबातील सदस्यांवरही:
• बायको
• मुले
• आई-वडील

सनशाईन हॉस्पिटलमध्ये *मोफत कॅशलेस उपचार* केले जातात.

ही माहिती नक्की तुमच्या कामगारांपर्यंत पोहोचवा! 🙏`,
  },
  {
    name: 'free_health_camp_offer',
    header_text: 'मोफत आरोग्य शिबीर',
    body_text: `🩺 {{1}} जी,

*तुमच्या कामगारांसाठी मोफत आरोग्य शिबीर!*

प्रतिबंध हा उपचारांपेक्षा चांगला असतो.

आम्ही तुमच्या कंपनीत/फॅक्टरीत कामगारांसाठी *मोफत बीपी, शुगर आणि जनरल चेकअप कॅम्प* आयोजित करू शकतो.

यामुळे आजार वेळीच ओळखून उपचार करता येतील.

_कॅम्पच्या बुकिंगसाठी आजच कॉल करा!_ 📞`,
  },
  {
    name: 'contractor_special_helpdesk',
    header_text: 'स्पेशल कॉन्ट्रॅक्टर हेल्पडेस्क',
    body_text: `📞 {{1}} जी,

*तुमच्यासाठी विशेष सुविधा!*

लेबर कॉन्ट्रॅक्टर्सचा वेळ खूप महत्त्वाचा असतो.

त्यामुळे जेव्हाही तुम्ही एखाद्या कामगाराला सनशाईन हॉस्पिटलमध्ये पाठवाल, तेव्हा आमचे *PRO (पब्लिक रिलेशन्स ऑफिसर)* स्वतः लक्ष घालून त्यांना मदत करतील.

✅ *तुम्हाला रांगेत थांबण्याची गरज नाही!* 🙏`,
  },
  {
    name: 'esic_no_hidden_charges',
    header_text: 'शून्य छुपे खर्च',
    body_text: `💡 {{1}} जी,

*ESIC कॅशलेस म्हणजे खरोखर शून्य खर्च!*

बऱ्याचदा कामगारांना वाटते की कॅशलेस उपचारातही काही छुपे खर्च असतात.

पण सनशाईन हॉस्पिटलमध्ये ESIC नियमानुसार पात्र रुग्णांवर *१००% मोफत उपचार* केले जातात.

_पारदर्शकता हाच आमचा पाया आहे._`,
  },
  {
    name: 'seasonal_health_alert',
    header_text: 'ऋतूबदल आरोग्य सतर्कता',
    body_text: `🌤️ {{1}} जी,

*ऋतू बदलत आहे, कामगारांची काळजी घ्या!*

सध्या व्हायरल फिव्हर आणि डेंग्यूचे प्रमाण वाढत आहे.

तुमच्या साईटवर कामगारांना:
• पिण्याचे स्वच्छ पाणी द्या
• मच्छरदाणी वापरण्याचा सल्ला द्या

कोणालाही ताप किंवा अशक्तपणा जाणवल्यास तात्काळ *सनशाईन हॉस्पिटलमध्ये* पाठवून द्या. 🏥`,
  },
  {
    name: 'contractor_feedback_thanks',
    header_text: 'तुमचा विश्वास, आमची ताकद',
    body_text: `🙏 {{1}} जी,

*तुमचा विश्वास, आमची ताकद!*

गेल्या काही दिवसांत अनेक कॉन्ट्रॅक्टर्सनी त्यांच्या कामगारांना सनशाईनमध्ये पाठवले आणि ते *ठणठणीत बरे होऊन* कामावर परतले.

तुमच्या या विश्वासाबद्दल धन्यवाद. 🏥

आम्ही दर्जेदार सेवा देण्यासाठी नेहमी कटिबद्ध आहोत.`,
  },
  {
    name: 'save_emergency_contact',
    header_text: 'इमर्जन्सी नंबर सेव्ह करा',
    body_text: `📱 {{1}} जी,

*हा मेसेज 'Star' करून ठेवा!*

इमर्जन्सी कधीही सांगून येत नाही.

तुमच्या मोबाईलमध्ये *"Dr. Nadim - Sunshine ESIC"* या नावाने आमचा नंबर आत्ताच सेव्ह करा.

रात्री-अपरात्री कधीही गरज पडल्यास *हक्काने कॉल करा.* 🙏`,
  },
  {
    name: 'permanent_health_partnership',
    header_text: 'कायमस्वरूपी भागीदारी',
    body_text: `🤝 {{1}} जी,

*चला, मिळून कामगारांचे भविष्य सुरक्षित करूया!*

एक निरोगी कामगारच उत्तम काम करू शकतो.

सनशाईन हॉस्पिटल तुमचा *'पर्मनंट हेल्थ पार्टनर'* म्हणून नेहमी सोबत आहे.

कधीही हॉस्पिटलला भेट द्या — चहा पिऊन आपण कामगारांच्या आरोग्याविषयी सविस्तर चर्चा करू.

_तुमचा नम्र,_
*डॉ. नदीम शेख*
सनशाईन हॉस्पिटल 🏥`,
  },
];

async function createTemplate(tmpl) {
  const res = await fetch(`${API}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: tmpl.name,
      category: 'MARKETING',
      language: 'mr',
      header_text: tmpl.header_text,
      body_text: tmpl.body_text,
      footer_text: FOOTER,
      buttons: BUTTONS,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Create failed');
  return data;
}

async function submitTemplate(id) {
  const res = await fetch(`${API}/api/templates/${id}/submit-approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Submit failed');
  return data;
}

async function run() {
  console.log(`\n🚀 Creating ${TEMPLATES.length} Marathi contractor templates...\n`);
  console.log(`API: ${API}\n`);

  const results = [];

  for (let i = 0; i < TEMPLATES.length; i++) {
    const tmpl = TEMPLATES[i];
    process.stdout.write(`[${i + 1}/${TEMPLATES.length}] ${tmpl.name} ... `);

    try {
      // Create template
      const created = await createTemplate(tmpl);
      process.stdout.write(`✅ created (id=${created.id}) ... `);

      // Small delay before submitting
      await new Promise(r => setTimeout(r, 1000));

      // Submit for Meta approval
      const submitted = await submitTemplate(created.id);
      console.log(`📤 submitted for approval`);

      results.push({ name: tmpl.name, id: created.id, status: 'submitted', meta_id: submitted.meta_template_id });
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
      results.push({ name: tmpl.name, status: 'error', error: err.message });
    }

    // Delay between templates to avoid rate limiting
    if (i < TEMPLATES.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n📊 SUMMARY:');
  console.log('─'.repeat(60));
  results.forEach(r => {
    const icon = r.status === 'submitted' ? '✅' : '❌';
    console.log(`${icon} ${r.name} ${r.error ? '→ ' + r.error : '→ pending Meta approval'}`);
  });

  const ok = results.filter(r => r.status === 'submitted').length;
  console.log(`\n✅ ${ok}/${TEMPLATES.length} templates submitted for Meta approval`);
  console.log('⏳ Meta typically approves Marathi templates within 24-48 hours\n');
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });

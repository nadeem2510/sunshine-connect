/**
 * Replace text-only Parvez ESIC templates (177-181) with image-header versions.
 * 1. Create 5 shimg_* templates with poster image headers + submit to Meta
 * 2. Update scheduled campaign 5 to rotate the new template ids
 * 3. Delete old text-only templates (DB + Meta)
 *
 * Usage: node scripts/create_parvez_image_templates.js
 */

const API = process.env.API_URL || 'https://sunshine-connect-production.up.railway.app';
const IMG_BASE = 'https://raw.githubusercontent.com/nadeem2510/sunshine-connect/parvez-esic-campaign/backend/public/images';
const CAMPAIGN_ID = 5;
const OLD_TEMPLATE_IDS = [177, 178, 179, 180, 181];

const CALL_BTN = { type: 'PHONE_NUMBER', text: 'कॉल करा', value: '+919130561222' };
const FOOTER = 'सनशाईन हॉस्पिटल — Fair With Quality Care';

const TEMPLATES = [
  {
    name: 'shimg_esic_accident_emergency',
    image: `${IMG_BASE}/esic_poster_facilities.jpg`,
    body_text: '🚨 *कामावर दुखापत झाली?*\n\nकाळजी करू नका — ESIC अंतर्गत सनशाईन हॉस्पिटलमध्ये 24x7 इमर्जन्सी उपचार पूर्णपणे कॅशलेस!\n\n🔸 अपघात उपचार\n🔸 फ्रॅक्चर / सर्जरी\n🔸 ICU सुविधा\n\n*एकही रुपया खर्च न करता उपचार — तुमचा हक्क!*',
  },
  {
    name: 'shimg_esic_monsoon_health',
    image: `${IMG_BASE}/esic_poster_dont_delay.jpg`,
    body_text: '🌧️ *पावसाळा आला — आजारांपासून सावध रहा!*\n\nताप, डेंग्यू, मलेरिया, टायफॉइड — दुर्लक्ष करू नका!\n\nESIC कार्डधारकांसाठी सनशाईन हॉस्पिटलमध्ये मोफत तपासणी व उपचार.\n\n*ताप अंगावर काढू नका — आजच या!*',
  },
  {
    name: 'shimg_esic_specialist_surgery',
    image: `${IMG_BASE}/esic_poster_card_benefits.jpg`,
    body_text: '🏥 *मोठ्या आजारांवर मोफत उपचार!*\n\nमणक्याचे आजार, किडनी, कॅन्सर — आता ESIC अंतर्गत कॅशलेस सर्जरी सनशाईन हॉस्पिटलमध्ये!\n\n✅ तज्ज्ञ सर्जन\n✅ आधुनिक ऑपरेशन थिएटर\n✅ संपूर्ण काळजी\n\n*तुमच्या ESIC कार्डचा पूर्ण फायदा घ्या!*',
  },
  {
    name: 'shimg_esic_free_checkup',
    image: `${IMG_BASE}/esic_poster_family_benefits.jpg`,
    body_text: '🩺 *मोफत आरोग्य तपासणी — फक्त ESIC कार्डधारकांसाठी!*\n\nBP, शुगर, छातीची तपासणी — सर्व काही मोफत.\n\nवर्षातून एकदा तपासणी = मोठ्या आजारापासून बचाव!\n\n*आजच अपॉइंटमेंट घ्या!*',
  },
  {
    name: 'shimg_esic_dont_ignore_pain',
    image: `${IMG_BASE}/esic_poster_symptoms.jpg`,
    body_text: '😣 *दुखणं सहन करणं = आजार वाढवणं!*\n\nपाठदुखी, गुडघेदुखी, पोटदुखी — रोज सहन करताय?\n\nESIC अंतर्गत सनशाईन हॉस्पिटलमध्ये मोफत तपासणी व उपचार उपलब्ध.\n\n*उशीर करू नका — आजच तपासणी करा!*',
  },
];

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${method} ${path} failed (${res.status})`);
  return data;
}

async function run() {
  console.log(`\n📝 Creating ${TEMPLATES.length} image-header templates ...\n`);
  const newIds = [];
  for (const t of TEMPLATES) {
    process.stdout.write(`   ${t.name} ... `);
    try {
      const created = await api('POST', '/api/templates', {
        name: t.name,
        category: 'MARKETING',
        language: 'mr',
        body_text: t.body_text,
        footer_text: FOOTER,
        buttons: [CALL_BTN],
        header_image_url: t.image,
      });
      await new Promise(r => setTimeout(r, 1500));
      try {
        const sub = await api('POST', `/api/templates/${created.id}/submit-approval`, {});
        console.log(`✅ id=${created.id}, Meta: ${sub.status || 'submitted'}`);
      } catch (subErr) {
        console.log(`⚠️  created (id=${created.id}) but submit failed: ${subErr.message}`);
      }
      newIds.push(created.id);
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  if (newIds.length !== TEMPLATES.length) {
    console.log('\n⚠️  Not all templates created — campaign NOT updated. Fix and re-run.');
    process.exit(1);
  }

  console.log(`\n📅 Updating campaign ${CAMPAIGN_ID} to use image templates [${newIds.join(', ')}] ...`);
  await api('PUT', `/api/scheduled-campaigns/${CAMPAIGN_ID}`, {
    template_id: newIds[0],
    template_ids: newIds,
  });
  console.log('   ✅ Campaign updated');

  console.log('\n🗑️  Deleting old text-only templates (DB + Meta) ...');
  for (const id of OLD_TEMPLATE_IDS) {
    process.stdout.write(`   template ${id} ... `);
    try {
      await api('DELETE', `/api/templates/${id}/meta`);
      console.log('✅ deleted');
    } catch (err) {
      console.log(`⚠️  ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '─'.repeat(60));
  console.log('🎉 DONE');
  console.log(`   New image template ids: [${newIds.join(', ')}]`);
  console.log(`   Campaign ${CAMPAIGN_ID} now rotates these (still inactive until Meta approves).`);
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });

/**
 * FINALIZE Parvez ESIC image campaign — run AFTER the whatsapp.js upload fix
 * is deployed to Railway (merge parvez-esic-campaign branch to main first).
 *
 * 1. Create image-header templates with NEW names (shimg2_*) + submit to Meta
 *    - Verifies Meta actually received the IMAGE header (aborts if old code
 *      is still deployed and silently dropped it)
 * 2. Poll sync-meta until approved (up to ~15 min)
 * 3. Update campaign 5 to rotate the new templates
 * 4. Delete old text-only shimg_esic_* templates (ids 182-186) from DB + Meta
 * 5. Activate campaign 5
 *
 * Usage: node scripts/finalize_parvez_image_campaign.js
 */

const API = process.env.API_URL || 'https://sunshine-connect-production.up.railway.app';
const IMG_BASE = 'https://raw.githubusercontent.com/nadeem2510/sunshine-connect/parvez-esic-campaign/backend/public/images';
const CAMPAIGN_ID = 5;
const OLD_TEMPLATE_IDS = [182, 183, 184, 185, 186];

const CALL_BTN = { type: 'PHONE_NUMBER', text: 'कॉल करा', value: '+919130561222' };
const FOOTER = 'सनशाईन हॉस्पिटल — Fair With Quality Care';

const TEMPLATES = [
  {
    name: 'shimg2_esic_accident_emergency',
    image: `${IMG_BASE}/esic_poster_facilities.jpg`,
    body_text: '🚨 *कामावर दुखापत झाली?*\n\nकाळजी करू नका — ESIC अंतर्गत सनशाईन हॉस्पिटलमध्ये 24x7 इमर्जन्सी उपचार पूर्णपणे कॅशलेस!\n\n🔸 अपघात उपचार\n🔸 फ्रॅक्चर / सर्जरी\n🔸 ICU सुविधा\n\n*एकही रुपया खर्च न करता उपचार — तुमचा हक्क!*',
  },
  {
    name: 'shimg2_esic_monsoon_health',
    image: `${IMG_BASE}/esic_poster_dont_delay.jpg`,
    body_text: '🌧️ *पावसाळा आला — आजारांपासून सावध रहा!*\n\nताप, डेंग्यू, मलेरिया, टायफॉइड — दुर्लक्ष करू नका!\n\nESIC कार्डधारकांसाठी सनशाईन हॉस्पिटलमध्ये मोफत तपासणी व उपचार.\n\n*ताप अंगावर काढू नका — आजच या!*',
  },
  {
    name: 'shimg2_esic_specialist_surgery',
    image: `${IMG_BASE}/esic_poster_card_benefits.jpg`,
    body_text: '🏥 *मोठ्या आजारांवर मोफत उपचार!*\n\nमणक्याचे आजार, किडनी, कॅन्सर — आता ESIC अंतर्गत कॅशलेस सर्जरी सनशाईन हॉस्पिटलमध्ये!\n\n✅ तज्ज्ञ सर्जन\n✅ आधुनिक ऑपरेशन थिएटर\n✅ संपूर्ण काळजी\n\n*तुमच्या ESIC कार्डचा पूर्ण फायदा घ्या!*',
  },
  {
    name: 'shimg2_esic_free_checkup',
    image: `${IMG_BASE}/esic_poster_family_benefits.jpg`,
    body_text: '🩺 *मोफत आरोग्य तपासणी — फक्त ESIC कार्डधारकांसाठी!*\n\nBP, शुगर, छातीची तपासणी — सर्व काही मोफत.\n\nवर्षातून एकदा तपासणी = मोठ्या आजारापासून बचाव!\n\n*आजच अपॉइंटमेंट घ्या!*',
  },
  {
    name: 'shimg2_esic_dont_ignore_pain',
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function metaHasImageHeader(metaName) {
  try {
    const mc = await api('GET', `/api/templates/meta-components/${metaName}`);
    return (mc.components || []).some(c => c.type === 'HEADER' && c.format === 'IMAGE');
  } catch { return false; }
}

async function createAndSubmit(t) {
  const created = await api('POST', '/api/templates', {
    name: t.name,
    category: 'MARKETING',
    language: 'mr',
    body_text: t.body_text,
    footer_text: FOOTER,
    buttons: [CALL_BTN],
    header_image_url: t.image,
  });
  await sleep(1500);
  await api('POST', `/api/templates/${created.id}/submit-approval`, {});
  return created.id;
}

async function run() {
  console.log('\n🔎 Step 0: Canary — create first template and verify image header reaches Meta...');
  const canary = TEMPLATES[0];
  let canaryId;
  try {
    canaryId = await createAndSubmit(canary);
  } catch (err) {
    console.error(`❌ Canary submit failed: ${err.message}`);
    console.error('   (With the fixed code this means the Upload API call itself failed —');
    console.error('    check Railway logs. Nothing was submitted to Meta without an image.)');
    // Clean up DB record if created
    if (canaryId) await api('DELETE', `/api/templates/${canaryId}`).catch(() => {});
    process.exit(1);
  }
  await sleep(4000);
  const hasImage = await metaHasImageHeader(canary.name);
  if (!hasImage) {
    console.error('❌ Meta received the canary WITHOUT an image header — old code is still');
    console.error('   deployed on Railway. Merge the parvez-esic-campaign branch, wait for');
    console.error('   the deploy to finish, then re-run this script.');
    await api('DELETE', `/api/templates/${canaryId}/meta`).catch(() => {});
    process.exit(2);
  }
  console.log(`   ✅ Canary ${canary.name} (id=${canaryId}) has IMAGE header on Meta!`);

  console.log('\n📝 Creating remaining templates...');
  const newIds = [canaryId];
  for (const t of TEMPLATES.slice(1)) {
    process.stdout.write(`   ${t.name} ... `);
    try {
      const id = await createAndSubmit(t);
      console.log(`✅ id=${id}`);
      newIds.push(id);
      await sleep(2000);
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }
  if (newIds.length !== TEMPLATES.length) {
    console.error('\n⚠️  Not all templates created — campaign NOT updated. Re-run after fixing.');
    process.exit(1);
  }

  console.log('\n⏳ Polling Meta approval (up to 15 min)...');
  let approved = 0;
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(30000);
    await api('POST', '/api/templates/sync-meta', {}).catch(() => {});
    const all = await Promise.all(newIds.map(id => api('GET', `/api/templates/${id}`)));
    approved = all.filter(t => t.status === 'approved').length;
    const rejected = all.filter(t => t.status === 'rejected');
    console.log(`   [${attempt + 1}] approved: ${approved}/${newIds.length}${rejected.length ? `, REJECTED: ${rejected.map(t => t.name).join(', ')}` : ''}`);
    if (approved === newIds.length) break;
    if (rejected.length) {
      console.error('   ⚠️  Some templates rejected — continuing with approved ones only.');
      break;
    }
  }

  console.log(`\n📅 Updating campaign ${CAMPAIGN_ID} to new template ids [${newIds.join(', ')}] ...`);
  await api('PUT', `/api/scheduled-campaigns/${CAMPAIGN_ID}`, {
    template_id: newIds[0],
    template_ids: newIds,
  });
  console.log('   ✅ Campaign updated');

  console.log('\n🗑️  Deleting old text-only templates...');
  for (const id of OLD_TEMPLATE_IDS) {
    process.stdout.write(`   template ${id} ... `);
    try {
      await api('DELETE', `/api/templates/${id}/meta`);
      console.log('✅');
    } catch (err) { console.log(`⚠️  ${err.message}`); }
    await sleep(1000);
  }

  if (approved > 0) {
    console.log(`\n🚀 Activating campaign ${CAMPAIGN_ID} (daily 21:00, ${approved} approved template(s) in rotation)...`);
    await api('PUT', `/api/scheduled-campaigns/${CAMPAIGN_ID}`, { is_active: true });
    console.log('   ✅ Campaign ACTIVE — first send at next 21:00 run.');
  } else {
    console.log('\n⏸️  No template approved yet — campaign left INACTIVE.');
    console.log('   Re-run sync-meta later and activate via:');
    console.log(`   PUT ${API}/api/scheduled-campaigns/${CAMPAIGN_ID}  {"is_active": true}`);
  }

  console.log('\n🎉 DONE');
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });

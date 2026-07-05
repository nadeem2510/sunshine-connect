/**
 * Setup: Parvez contacts ESIC campaign (July 2026)
 * 1. Create group "ESIC Parvez Contacts Jul26"
 * 2. Import contacts from Excel into the group
 * 3. Create 5 new ESIC awareness templates + submit to Meta
 * 4. Create daily 9PM scheduled campaign (rotating templates)
 *
 * Usage: node scripts/setup_parvez_esic_campaign.js
 */

const xlsx = require('xlsx');

const API = process.env.API_URL || 'https://sunshine-connect-production.up.railway.app';
const FILE = process.env.FILE || 'C:/Users/spectre/Downloads/parvez_Contacts.xlsx';
const GROUP_NAME = 'ESIC Parvez Contacts Jul26';
const CAMPAIGN_NAME = 'ESIC Awareness - Parvez Contacts (Daily 9PM)';

const CALL_BTN = { type: 'PHONE_NUMBER', text: 'कॉल करा', value: '+919130561222' };
const FOOTER = 'सनशाईन हॉस्पिटल — Fair With Quality Care';

const TEMPLATES = [
  {
    name: 'esic_accident_emergency_cover',
    body_text: '🚨 *कामावर दुखापत झाली?*\n\nकाळजी करू नका — ESIC अंतर्गत सनशाईन हॉस्पिटलमध्ये 24x7 इमर्जन्सी उपचार पूर्णपणे कॅशलेस!\n\n🔸 अपघात उपचार\n🔸 फ्रॅक्चर / सर्जरी\n🔸 ICU सुविधा\n\n*एकही रुपया खर्च न करता उपचार — तुमचा हक्क!*',
  },
  {
    name: 'esic_monsoon_health_alert',
    body_text: '🌧️ *पावसाळा आला — आजारांपासून सावध रहा!*\n\nताप, डेंग्यू, मलेरिया, टायफॉइड — दुर्लक्ष करू नका!\n\nESIC कार्डधारकांसाठी सनशाईन हॉस्पिटलमध्ये मोफत तपासणी व उपचार.\n\n*ताप अंगावर काढू नका — आजच या!*',
  },
  {
    name: 'esic_specialist_surgery_care',
    body_text: '🏥 *मोठ्या आजारांवर मोफत उपचार!*\n\nमणक्याचे आजार, किडनी, कॅन्सर — आता ESIC अंतर्गत कॅशलेस सर्जरी सनशाईन हॉस्पिटलमध्ये!\n\n✅ तज्ज्ञ सर्जन\n✅ आधुनिक ऑपरेशन थिएटर\n✅ संपूर्ण काळजी\n\n*तुमच्या ESIC कार्डचा पूर्ण फायदा घ्या!*',
  },
  {
    name: 'esic_free_checkup_drive',
    body_text: '🩺 *मोफत आरोग्य तपासणी — फक्त ESIC कार्डधारकांसाठी!*\n\nBP, शुगर, छातीची तपासणी — सर्व काही मोफत.\n\nवर्षातून एकदा तपासणी = मोठ्या आजारापासून बचाव!\n\n*आजच अपॉइंटमेंट घ्या!*',
  },
  {
    name: 'esic_dont_ignore_pain',
    body_text: '😣 *दुखणं सहन करणं = आजार वाढवणं!*\n\nपाठदुखी, गुडघेदुखी, पोटदुखी — रोज सहन करताय?\n\nESIC अंतर्गत सनशाईन हॉस्पिटलमध्ये मोफत तपासणी व उपचार उपलब्ध.\n\n*उशीर करू नका — आजच तपासणी करा!*',
  },
];

function formatPhone(mobile) {
  let phone = String(mobile).trim().replace(/\D/g, '');
  if (phone.startsWith('91') && phone.length === 12) return `+${phone}`;
  if (phone.length === 10) return `+91${phone}`;
  return `+91${phone}`;
}

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
  // ─── 1. Group ───
  console.log(`\n📁 Creating group "${GROUP_NAME}" ...`);
  const groups = await api('GET', '/api/groups');
  let group = groups.find(g => g.name === GROUP_NAME);
  if (group) {
    console.log(`   ⏭️  Group already exists (id=${group.id})`);
  } else {
    group = await api('POST', '/api/groups', {
      name: GROUP_NAME,
      description: 'Parvez contact list — ESIC awareness July 2026',
      group_type: 'contractors',
      interval_days: 1,
    });
    console.log(`   ✅ Group created (id=${group.id})`);
  }

  // ─── 2. Contacts ───
  console.log(`\n📂 Importing contacts from ${FILE}`);
  const wb = xlsx.readFile(FILE);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log(`   Found ${rows.length} rows\n`);

  let success = 0, skipped = 0, failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nameKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'name');
    const mobileKey = Object.keys(row).find(k => k.trim().toLowerCase().includes('mobile'));
    const name = String(row[nameKey] || '').trim();
    const mobile = row[mobileKey] || '';

    if (!name || !mobile) { skipped++; continue; }
    const phone = formatPhone(mobile);
    process.stdout.write(`   [${i + 1}/${rows.length}] ${name} (${phone}) ... `);
    try {
      const contact = await api('POST', '/api/contacts', {
        name, phone, specialty: 'Worker', organization: 'Parvez List',
      });
      await api('POST', `/api/groups/${group.id}/contacts`, { contact_ids: [contact.id] });
      console.log('✅');
      success++;
    } catch (err) {
      if (/duplicate|unique|exists/i.test(err.message)) {
        console.log('⏭️  already exists');
        skipped++;
      } else {
        console.log(`❌ ${err.message}`);
        failed++;
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`\n   📊 Contacts — imported: ${success}, skipped: ${skipped}, failed: ${failed}`);

  // ─── 3. Templates ───
  console.log(`\n📝 Creating ${TEMPLATES.length} templates + Meta submit ...`);
  const templateIds = [];
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
      });
      await new Promise(r => setTimeout(r, 1500));
      try {
        const sub = await api('POST', `/api/templates/${created.id}/submit-approval`, {});
        console.log(`✅ id=${created.id}, Meta: ${sub.status || 'submitted'}`);
      } catch (subErr) {
        console.log(`⚠️  created (id=${created.id}) but submit failed: ${subErr.message}`);
      }
      templateIds.push(created.id);
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  // ─── 4. Campaign ───
  console.log(`\n📅 Creating scheduled campaign "${CAMPAIGN_NAME}" ...`);
  const campaign = await api('POST', '/api/scheduled-campaigns', {
    name: CAMPAIGN_NAME,
    template_ids: templateIds,
    group_id: group.id,
    schedule_time: '21:00:00',
    is_daily: true,
    interval_days: 1,
  });
  console.log(`   ✅ Campaign created (id=${campaign.id}, is_active=${campaign.is_active})`);

  console.log('\n' + '─'.repeat(60));
  console.log('🎉 DONE');
  console.log(`   Group id:      ${group.id}`);
  console.log(`   Template ids:  [${templateIds.join(', ')}]`);
  console.log(`   Campaign id:   ${campaign.id} (inactive — activate after Meta approval)`);
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });

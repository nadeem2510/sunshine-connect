/**
 * Import contractors from Excel file into Sunshine Connect
 * Usage: node scripts/import_contractors.js
 */

const xlsx = require('xlsx');
const path = require('path');

const API = process.env.API_URL || 'https://sunshine-connect-production.up.railway.app';
const FILE = process.env.FILE || 'C:/Users/ESIC SUNSHINE/Desktop/ESIS/CONTRACTOR NAME NU.xlsx';

function formatPhone(mobile) {
  let phone = String(mobile).trim().replace(/\D/g, ''); // remove non-digits
  if (phone.startsWith('91') && phone.length === 12) return `+${phone}`;
  if (phone.length === 10) return `+91${phone}`;
  return `+91${phone}`;
}

async function getContractorsGroupId() {
  const res = await fetch(`${API}/api/groups`);
  const groups = await res.json();
  const g = groups.find(g => g.group_type === 'contractors' || g.name.toLowerCase().includes('contractor'));
  return g?.id || null;
}

async function createContact(name, phone) {
  const res = await fetch(`${API}/api/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, specialty: 'Contractor', organization: 'ESIC Contractor' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Create failed');
  return data;
}

async function addToGroup(contactId, groupId) {
  const res = await fetch(`${API}/api/groups/${groupId}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact_ids: [contactId] }),
  });
  return res.ok;
}

async function run() {
  console.log(`\n📂 Reading file: ${FILE}\n`);

  const wb = xlsx.readFile(FILE);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  console.log(`📋 Found ${rows.length} contractors\n`);

  // Get Contractors group ID
  const groupId = await getContractorsGroupId();
  if (groupId) {
    console.log(`✅ Contractors group found (id=${groupId})\n`);
  } else {
    console.log(`⚠️  Contractors group not found — contacts will be added without group\n`);
  }

  let success = 0, skipped = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Handle column names with trailing spaces
    const nameKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'NAME');
    const mobileKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'MOBILE');
    const name = String(row[nameKey] || '').trim();
    const mobile = row[mobileKey] || '';

    if (!name || !mobile) {
      console.log(`  [${i + 1}] ⚠️  Skipped — missing name or mobile`);
      skipped++;
      continue;
    }

    const phone = formatPhone(mobile);
    process.stdout.write(`  [${i + 1}/${rows.length}] ${name} (${phone}) ... `);

    try {
      const contact = await createContact(name, phone);
      if (groupId) await addToGroup(contact.id, groupId);
      console.log(`✅ imported`);
      success++;
    } catch (err) {
      if (err.message.includes('duplicate') || err.message.includes('unique') || err.message.includes('already exists') || err.message.includes('exists')) {
        console.log(`⏭️  already exists`);
        skipped++;
      } else {
        console.log(`❌ ${err.message} — retrying...`);
        // Retry once after 3 seconds
        await new Promise(r => setTimeout(r, 3000));
        try {
          const contact = await createContact(name, phone);
          if (groupId) await addToGroup(contact.id, groupId);
          console.log(`  ↩️  retry ✅ imported`);
          success++;
        } catch (err2) {
          if (err2.message.includes('already exists') || err2.message.includes('duplicate')) {
            console.log(`  ↩️  retry ⏭️  already exists`);
            skipped++;
          } else {
            console.log(`  ↩️  retry ❌ ${err2.message}`);
            failed++;
          }
        }
      }
    }

    // Small delay to avoid overwhelming the server
    if (i < rows.length - 1) await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n📊 IMPORT SUMMARY');
  console.log('─'.repeat(40));
  console.log(`✅ Imported:  ${success}`);
  console.log(`⏭️  Skipped:  ${skipped} (already exists or missing data)`);
  console.log(`❌ Failed:    ${failed}`);
  console.log(`\n🎉 Done! Check Contacts page in Sunshine Connect.\n`);
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });

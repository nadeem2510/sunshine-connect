/**
 * Fix pass: ensure ALL contacts from the Parvez Excel are in group 235
 * (setup script skipped group-add for contacts that already existed).
 * Usage: node scripts/fix_parvez_group_membership.js
 */

const xlsx = require('xlsx');

const API = process.env.API_URL || 'https://sunshine-connect-production.up.railway.app';
const FILE = process.env.FILE || 'C:/Users/spectre/Downloads/parvez_Contacts.xlsx';
const GROUP_ID = 235;

// Backend stores phones digits-only without '+' (e.g. 919511209475)
function formatPhone(mobile) {
  let phone = String(mobile).trim().replace(/\D/g, '');
  if (phone.startsWith('91') && phone.length === 12) return phone;
  if (phone.length === 10) return `91${phone}`;
  return `91${phone}`;
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
  const wb = xlsx.readFile(FILE);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log(`\n📋 ${rows.length} rows in Excel; resolving contact ids...\n`);

  const ids = [];
  const notFound = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mobileKey = Object.keys(row).find(k => k.trim().toLowerCase().includes('mobile'));
    const mobile = row[mobileKey];
    if (!mobile) continue;
    const phone = formatPhone(mobile);
    try {
      const result = await api('GET', `/api/contacts?search=${encodeURIComponent(phone)}&limit=5`);
      const list = result.contacts || [];
      const match = list.find(c => String(c.phone).replace(/\D/g, '') === phone);
      if (match) ids.push(match.id);
      else notFound.push(phone);
    } catch (err) {
      notFound.push(`${phone} (${err.message})`);
    }
    if (i % 25 === 0) process.stdout.write(`   ...${i}/${rows.length}\r`);
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n✅ Resolved ${ids.length} contact ids, ❌ not found: ${notFound.length}`);
  if (notFound.length) notFound.forEach(p => console.log(`   - ${p}`));

  console.log(`\n➕ Adding all to group ${GROUP_ID} ...`);
  await api('POST', `/api/groups/${GROUP_ID}/contacts`, { contact_ids: ids });

  const groups = await api('GET', '/api/groups');
  const g = groups.find(g => g.id === GROUP_ID);
  console.log(`\n🎉 Group ${GROUP_ID} now has ${g?.contact_count ?? '?'} contacts`);
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });

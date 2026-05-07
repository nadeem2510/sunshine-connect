/**
 * Clear header_image_url and submit templates 158-171 as text-only to Meta
 * They'll be approved without image header (Days 2-15)
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

// Templates 158-171 (Days 2-15, in draft status)
const TEMPLATE_IDS = [158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171];

async function run() {
  console.log('Submitting 14 text-only templates to Meta...\n');
  const approved = [];
  const failed = [];

  for (const id of TEMPLATE_IDS) {
    process.stdout.write(`Template ${id} ... `);
    try {
      // Step 1: Clear header_image_url so it submits without image component
      const cleared = await apiCall('PUT', `/api/templates/${id}`, { header_image_url: null });
      if (cleared.error) {
        // Already approved or something else
        console.log(`⚠️  PUT failed: ${cleared.error}, trying submit anyway`);
      }

      // Step 2: Submit to Meta
      await new Promise(r => setTimeout(r, 1500)); // rate limit delay
      const result = await apiCall('POST', `/api/templates/${id}/submit-approval`, {});

      if (result.error) {
        console.log(`❌ ${result.error}`);
        failed.push(id);
      } else {
        console.log(`✅ submitted, Meta ID: ${result.meta_template_id}, status: ${result.status}`);
        approved.push(id);
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed.push(id);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`✅ Submitted: ${approved.length} | ❌ Failed: ${failed.length}`);
  if (failed.length) console.log('Failed IDs:', failed);

  // Sync to get approval statuses
  console.log('\nSyncing with Meta...');
  const sync = await apiCall('POST', '/api/templates/sync-meta', {});
  console.log('Sync:', JSON.stringify(sync));
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });

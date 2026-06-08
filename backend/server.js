require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');

const { initDB } = require('./src/models/migrate');
const { initQueue } = require('./src/services/queue');
const db = require('./src/database');
const whatsapp = require('./src/services/whatsapp');

const contactsRouter = require('./src/routes/contacts');
const groupsRouter = require('./src/routes/groups');
const templatesRouter = require('./src/routes/templates');
const campaignsRouter = require('./src/routes/campaigns');
const messagesRouter = require('./src/routes/messages');
const webhooksRouter = require('./src/routes/webhooks');
const dashboardRouter = require('./src/routes/dashboard');
const autoRepliesRouter = require('./src/routes/autoReplies');
const scheduledCampaignsRouter = require('./src/routes/scheduledCampaigns');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));

// Webhook needs raw body for signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

// Serve public images (template headers etc.)
app.use('/images', express.static(path.join(__dirname, 'public/images')));

app.use('/api/contacts', contactsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/auto-replies', autoRepliesRouter);
app.use('/api/scheduled-campaigns', scheduledCampaignsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Sunshine Connect' });
});

// Diagnostic: test WABA Upload API (template handle) + Media API (message send)
const BANNER_URL = 'https://sunshine-connect-production.up.railway.app/images/esic_banner_small.jpg';

app.get('/api/diag-upload', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const handle = await whatsapp.uploadImageForTemplate(BANNER_URL);
    res.json({ success: true, type: 'waba_upload', handle });
  } catch (err) {
    res.status(500).json({ success: false, type: 'waba_upload', error: err.message });
  }
});

app.get('/api/diag-media', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const mediaId = await whatsapp.uploadImageAsMedia(BANNER_URL);
    res.json({ success: true, type: 'media_api', media_id: mediaId });
  } catch (err) {
    res.status(500).json({ success: false, type: 'media_api', error: err.message });
  }
});

// Diagnostic: test upload with alternate WABA ID (323867224139405 seen in WhatsApp Manager)
app.get('/api/diag-upload2', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const axios = require('axios');
  const TOKEN = process.env.WA_ACCESS_TOKEN;
  const WABA_ALT = '323867224139405';
  const API_VER = process.env.WA_API_VERSION || 'v19.0';
  const results = { current_waba: process.env.WA_BUSINESS_ACCOUNT_ID, alt_waba: WABA_ALT };
  try {
    const resp = await axios.post(
      `https://graph.facebook.com/${API_VER}/${WABA_ALT}/uploads`,
      null,
      { params: { file_length: 1000, file_type: 'image/jpeg', access_token: TOKEN }, headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    results.alt_upload = { success: true, session_id: resp.data.id };
  } catch (err) {
    const e = err.response?.data?.error || {};
    results.alt_upload = { success: false, error: e.message || err.message, code: e.code };
  }
  res.json(results);
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Daily 9 PM Scheduler (IST = UTC+5:30, so 9PM IST = 15:30 UTC) ──────────
async function runScheduledCampaigns() {
  try {
    const now = new Date();
    const istHour = (now.getUTCHours() + 5) % 24;
    const istMin = (now.getUTCMinutes() + 30) % 60;
    // Check if we rolled over the hour
    const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 330; // +330 = IST offset
    const istTotalMin = totalMinutes % (24 * 60);
    const istH = Math.floor(istTotalMin / 60);
    const istM = istTotalMin % 60;

    const timeStr = `${String(istH).padStart(2, '0')}:${String(istM).padStart(2, '0')}:00`;
    console.log(`[Scheduler] Checking campaigns for IST time: ${timeStr}`);

    // Find active campaigns scheduled for this time (within 1-min window)
    // For rotation campaigns, join on the rotated template instead of template_id
    // interval_days controls cadence: 1 = daily, 3 = every 3 days, etc.
    // Cooldown window = (interval_days * 24 - 1) hours, so a campaign never double-fires
    // on the same cycle but isn't blocked by drift.
    const campaigns = await db.query(`
      SELECT sc.*
      FROM scheduled_campaigns sc
      WHERE sc.is_active = TRUE
        AND TO_CHAR(sc.schedule_time, 'HH24:MI') = $1
        AND (sc.end_date IS NULL OR CURRENT_DATE <= sc.end_date)
        AND (
          sc.last_run_at IS NULL
          OR sc.last_run_at < NOW() - (GREATEST(COALESCE(sc.interval_days, 1), 1) * INTERVAL '24 hours' - INTERVAL '1 hour')
        )
    `, [`${String(istH).padStart(2, '0')}:${String(istM).padStart(2, '0')}`]);

    if (campaigns.rows.length === 0) return;

    console.log(`[Scheduler] Found ${campaigns.rows.length} campaign(s) to run`);

    for (const campaign of campaigns.rows) {
      console.log(`[Scheduler] Running: "${campaign.name}"`);

      // ── Template Rotation Logic ──────────────────────────────────────────
      // If template_ids array is set, rotate through them daily using run_count
      const rotationIds = Array.isArray(campaign.template_ids) && campaign.template_ids.length > 0
        ? campaign.template_ids
        : campaign.template_id ? [campaign.template_id] : [];

      if (rotationIds.length === 0) {
        console.warn(`[Scheduler] "${campaign.name}" has no templates — skipping`);
        continue;
      }

      const rotationIndex = campaign.run_count % rotationIds.length;
      const activeTemplateId = rotationIds[rotationIndex];
      console.log(`[Scheduler] Rotation: day ${campaign.run_count + 1}, using template ${activeTemplateId} (index ${rotationIndex}/${rotationIds.length})`);

      // Load the active template for today
      const tmplRes = await db.query(
        `SELECT meta_template_name, language, body_text, status, variables AS template_variables,
                header_image_url, meta_has_image_header FROM templates WHERE id = $1`,
        [activeTemplateId]
      );

      let tmpl = tmplRes.rows[0];

      // If today's template isn't approved yet, fall back to the first approved in the rotation
      if (!tmpl || tmpl.status !== 'approved') {
        console.warn(`[Scheduler] Template ${activeTemplateId} not approved — searching for fallback`);
        const fallbackRes = await db.query(
          `SELECT meta_template_name, language, body_text, status, variables AS template_variables,
                  header_image_url, meta_has_image_header FROM templates
           WHERE id = ANY($1) AND status = 'approved' LIMIT 1`,
          [rotationIds]
        );
        if (!fallbackRes.rows[0]) {
          console.warn(`[Scheduler] No approved template found in rotation — skipping campaign`);
          continue;
        }
        tmpl = fallbackRes.rows[0];
        console.log(`[Scheduler] Using fallback template: ${tmpl.meta_template_name}`);
      }

      const contacts = await db.query(`
        SELECT c.id, c.name, c.phone FROM contacts c
        JOIN contact_groups cg ON cg.contact_id = c.id
        WHERE cg.group_id = $1 AND c.opted_out = FALSE
      `, [campaign.group_id]);

      let sent = 0, failed = 0;
      const hasVars = (tmpl.template_variables || []).length > 0;
      const headerImageUrl = tmpl.meta_has_image_header ? tmpl.header_image_url : null;

      for (const contact of contacts.rows) {
        try {
          await whatsapp.sendTemplateMessage({
            phone: contact.phone,
            templateName: tmpl.meta_template_name,
            language: tmpl.language || 'mr',
            variables: hasVars ? [contact.name] : [],
            headerImageUrl,
          });

          await db.query(`
            INSERT INTO message_logs (contact_id, template_id, phone, status, sent_at)
            VALUES ($1, $2, $3, 'sent', NOW())
          `, [contact.id, campaign.template_id, contact.phone]);

          sent++;
        } catch (err) {
          failed++;
          await db.query(`
            INSERT INTO message_logs (contact_id, template_id, phone, status, error_message, failed_at)
            VALUES ($1, $2, $3, 'failed', $4, NOW())
          `, [contact.id, campaign.template_id, contact.phone, err.message]);
        }
      }

      await db.query(`
        UPDATE scheduled_campaigns SET last_run_at = NOW(), run_count = run_count + 1 WHERE id = $1
      `, [campaign.id]);

      console.log(`[Scheduler] "${campaign.name}" done — ✅ ${sent} sent, ❌ ${failed} failed`);
    }
  } catch (err) {
    console.error('[Scheduler] Error:', err.message);
  }
}

// Run every minute to check scheduled campaigns
function startScheduler() {
  cron.schedule('* * * * *', runScheduledCampaigns);
  console.log('[Scheduler] Daily campaign scheduler started (checks every minute)');
}

// ─── Meta Template Approval Sync (runs every 30 minutes) ─────────────────────
async function syncMetaTemplateApprovals() {
  try {
    const metaTemplates = await whatsapp.getTemplatesFromMeta();
    for (const mt of metaTemplates) {
      const status = mt.status === 'APPROVED' ? 'approved'
        : mt.status === 'REJECTED' ? 'rejected'
        : mt.status === 'PENDING' ? 'pending' : null;
      if (!status) continue;
      await db.query(`
        UPDATE templates SET status = $1, updated_at = NOW()
        WHERE (meta_template_name = $2 OR name = $2) AND status != 'approved'
      `, [status, mt.name]);
    }
    console.log('[MetaSync] Template approval statuses synced');
  } catch (err) {
    console.error('[MetaSync] Error:', err.message);
  }
}

async function start() {
  try {
    await initDB();
    console.log('[DB] Database initialized');
    await initQueue();
    console.log('[Queue] Job queue initialized');
    startScheduler();
    // Sync Meta template approvals on startup and every 30 min
    syncMetaTemplateApprovals().catch(() => {});
    cron.schedule('*/30 * * * *', () => syncMetaTemplateApprovals().catch(() => {}));
    app.listen(PORT, () => {
      console.log(`[Server] Sunshine Connect running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Startup] Fatal error:', err);
    process.exit(1);
  }
}

start();
// redeploy trigger Mon Jun  8 15:34:39 IST 2026
// force redeploy retry 1780914063

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
    const campaigns = await db.query(`
      SELECT sc.*, t.meta_template_name, t.language, t.body_text, t.status AS template_status
      FROM scheduled_campaigns sc
      LEFT JOIN templates t ON t.id = sc.template_id
      WHERE sc.is_active = TRUE
        AND t.status = 'approved'
        AND TO_CHAR(sc.schedule_time, 'HH24:MI') = $1
        AND (sc.last_run_at IS NULL OR sc.last_run_at < NOW() - INTERVAL '23 hours')
    `, [`${String(istH).padStart(2, '0')}:${String(istM).padStart(2, '0')}`]);

    if (campaigns.rows.length === 0) return;

    console.log(`[Scheduler] Found ${campaigns.rows.length} campaign(s) to run`);

    for (const campaign of campaigns.rows) {
      console.log(`[Scheduler] Running: "${campaign.name}"`);

      const contacts = await db.query(`
        SELECT c.id, c.name, c.phone FROM contacts c
        JOIN contact_groups cg ON cg.contact_id = c.id
        WHERE cg.group_id = $1 AND c.opted_out = FALSE
      `, [campaign.group_id]);

      let sent = 0, failed = 0;

      for (const contact of contacts.rows) {
        try {
          await whatsapp.sendTemplateMessage({
            phone: contact.phone,
            templateName: campaign.meta_template_name,
            language: campaign.language || 'mr',
            variables: [contact.name],
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

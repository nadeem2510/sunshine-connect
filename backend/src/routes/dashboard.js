const express = require('express');
const db = require('../database');
const whatsapp = require('../services/whatsapp');

const router = express.Router();

// Main dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [contacts, groups, templates, campaigns, messages, recentActivity] = await Promise.all([
      db.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE opted_out = FALSE) AS active,
        COUNT(*) FILTER (WHERE opted_out = TRUE) AS opted_out
        FROM contacts`),

      db.query(`SELECT COUNT(*) AS total FROM groups`),

      db.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'draft') AS draft
        FROM templates`),

      db.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'draft') AS draft
        FROM campaigns`),

      db.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'sent') AS sent,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE status = 'read') AS read,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed
        FROM message_logs
        WHERE queued_at >= NOW() - INTERVAL '30 days'`),

      db.query(`SELECT ml.*, c.name AS contact_name, t.name AS template_name
        FROM message_logs ml
        LEFT JOIN contacts c ON c.id = ml.contact_id
        LEFT JOIN templates t ON t.id = ml.template_id
        WHERE ml.status NOT IN ('inbound')
        ORDER BY ml.queued_at DESC LIMIT 10`),
    ]);

    res.json({
      contacts: contacts.rows[0],
      groups: groups.rows[0],
      templates: templates.rows[0],
      campaigns: campaigns.rows[0],
      messages_30d: messages.rows[0],
      recent_activity: recentActivity.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upcoming scheduled messages (next 7 days queue view)
router.get('/queue', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        de.id, de.next_send_at, de.current_step,
        c.id AS contact_id, c.name AS contact_name, c.phone,
        camp.id AS campaign_id, camp.name AS campaign_name,
        t.name AS template_name, t.body_text
       FROM drip_enrollments de
       JOIN contacts c ON c.id = de.contact_id
       JOIN campaigns camp ON camp.id = de.campaign_id
       LEFT JOIN campaign_steps cs ON cs.campaign_id = de.campaign_id AND cs.step_order = de.current_step
       LEFT JOIN templates t ON t.id = cs.template_id
       WHERE de.completed = FALSE AND de.paused = FALSE
         AND c.opted_out = FALSE
         AND de.next_send_at <= NOW() + INTERVAL '7 days'
       ORDER BY de.next_send_at ASC
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WhatsApp API health check
router.get('/health', async (req, res) => {
  try {
    const health = await whatsapp.getHealthStatus();
    res.json(health);
  } catch (err) {
    res.status(200).json({
      status: 'unknown',
      error: err.message,
      api_connected: false,
    });
  }
});

// Message delivery chart data (last N days)
router.get('/chart', async (req, res) => {
  try {
    const { days = 14 } = req.query;
    const result = await db.query(
      `SELECT
        DATE_TRUNC('day', queued_at)::date AS date,
        COUNT(*) FILTER (WHERE status IN ('sent','delivered','read')) AS sent,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE status = 'read') AS read,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed
       FROM message_logs
       WHERE queued_at >= NOW() - INTERVAL '${parseInt(days)} days'
         AND status NOT IN ('inbound', 'queued')
       GROUP BY DATE_TRUNC('day', queued_at)::date
       ORDER BY date ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

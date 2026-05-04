const express = require('express');
const db = require('../database');
const whatsapp = require('../services/whatsapp');

const router = express.Router();

// Send a single message directly
router.post('/send', async (req, res) => {
  try {
    const { contact_id, template_id, variables = {} } = req.body;
    if (!contact_id || !template_id) return res.status(400).json({ error: 'contact_id and template_id required' });

    const contact = await db.query('SELECT * FROM contacts WHERE id = $1', [contact_id]);
    if (!contact.rows[0]) return res.status(404).json({ error: 'Contact not found' });
    if (contact.rows[0].opted_out) return res.status(400).json({ error: 'Contact has opted out' });

    const template = await db.query('SELECT * FROM templates WHERE id = $1', [template_id]);
    if (!template.rows[0]) return res.status(404).json({ error: 'Template not found' });
    if (template.rows[0].status !== 'approved') return res.status(400).json({ error: 'Template not approved by Meta' });

    // Build personalized body
    let body = template.rows[0].body_text;
    const mergedVars = { '1': contact.rows[0].name, ...variables };
    Object.entries(mergedVars).forEach(([k, v]) => {
      body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    });

    // Log the message
    const logResult = await db.query(
      `INSERT INTO message_logs (contact_id, template_id, phone, message_body, status)
       VALUES ($1, $2, $3, $4, 'queued') RETURNING *`,
      [contact_id, template_id, contact.rows[0].phone, body]
    );
    const log = logResult.rows[0];

    // Send via WhatsApp
    const waResult = await whatsapp.sendTemplateMessage({
      phone: contact.rows[0].phone,
      templateName: template.rows[0].meta_template_name,
      language: template.rows[0].language,
      variables: Object.values(mergedVars),
    });

    await db.query(
      `UPDATE message_logs SET status = 'sent', wa_message_id = $1, sent_at = NOW() WHERE id = $2`,
      [waResult.messages?.[0]?.id, log.id]
    );

    res.json({ success: true, message_id: log.id, wa_message_id: waResult.messages?.[0]?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get message logs with filters
router.get('/logs', async (req, res) => {
  try {
    const { status, campaign_id, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';

    if (status) { params.push(status); where += ` AND ml.status = $${params.length}`; }
    if (campaign_id) { params.push(parseInt(campaign_id)); where += ` AND ml.campaign_id = $${params.length}`; }

    const countResult = await db.query(`SELECT COUNT(*) FROM message_logs ml ${where}`, params);
    params.push(parseInt(limit), offset);

    const result = await db.query(
      `SELECT ml.*, c.name AS contact_name, t.name AS template_name, camp.name AS campaign_name
       FROM message_logs ml
       LEFT JOIN contacts c ON c.id = ml.contact_id
       LEFT JOIN templates t ON t.id = ml.template_id
       LEFT JOIN campaigns camp ON camp.id = ml.campaign_id
       ${where}
       ORDER BY ml.queued_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      messages: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get delivery stats
router.get('/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await db.query(
      `SELECT
        status,
        COUNT(*) AS count,
        DATE_TRUNC('day', queued_at) AS date
       FROM message_logs
       WHERE queued_at >= NOW() - INTERVAL '${parseInt(days)} days'
       GROUP BY status, DATE_TRUNC('day', queued_at)
       ORDER BY date DESC`
    );

    const summary = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'sent') AS sent,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE status = 'read') AS read,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COUNT(*) AS total
       FROM message_logs
       WHERE queued_at >= NOW() - INTERVAL '${parseInt(days)} days'`
    );

    res.json({ timeline: result.rows, summary: summary.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

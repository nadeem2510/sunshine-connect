const express = require('express');
const db = require('../database');
const whatsapp = require('../services/whatsapp');

const router = express.Router();

// List all scheduled campaigns
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sc.*,
        t.name AS template_name, t.body_text, t.status AS template_status,
        t.language, t.meta_template_name,
        g.name AS group_name,
        (SELECT COUNT(*) FROM contact_groups cg WHERE cg.group_id = sc.group_id) AS contact_count
      FROM scheduled_campaigns sc
      LEFT JOIN templates t ON t.id = sc.template_id
      LEFT JOIN groups g ON g.id = sc.group_id
      ORDER BY sc.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create scheduled campaign
router.post('/', async (req, res) => {
  try {
    const { name, template_id, group_id, schedule_time = '21:00:00', is_daily = true } = req.body;
    if (!name || !template_id || !group_id) {
      return res.status(400).json({ error: 'name, template_id, group_id are required' });
    }
    const result = await db.query(`
      INSERT INTO scheduled_campaigns (name, template_id, group_id, schedule_time, is_daily, is_active)
      VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING *
    `, [name, template_id, group_id, schedule_time, is_daily]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update scheduled campaign
router.put('/:id', async (req, res) => {
  try {
    const { name, template_id, group_id, schedule_time, is_daily, is_active } = req.body;
    const result = await db.query(`
      UPDATE scheduled_campaigns SET
        name = COALESCE($1, name),
        template_id = COALESCE($2, template_id),
        group_id = COALESCE($3, group_id),
        schedule_time = COALESCE($4, schedule_time),
        is_daily = COALESCE($5, is_daily),
        is_active = COALESCE($6, is_active),
        updated_at = NOW()
      WHERE id = $7 RETURNING *
    `, [name, template_id, group_id, schedule_time, is_daily, is_active, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete scheduled campaign
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM scheduled_campaigns WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run now (send immediately to all contacts in group) — for testing
router.post('/:id/run-now', async (req, res) => {
  try {
    const sc = await db.query(`
      SELECT sc.*, t.meta_template_name, t.language, t.body_text, t.status AS template_status,
        t.variables AS template_variables
      FROM scheduled_campaigns sc
      LEFT JOIN templates t ON t.id = sc.template_id
      WHERE sc.id = $1
    `, [req.params.id]);

    if (!sc.rows[0]) return res.status(404).json({ error: 'Not found' });
    const campaign = sc.rows[0];

    if (campaign.template_status !== 'approved') {
      return res.status(400).json({ error: 'Template is not approved yet. Cannot send.' });
    }

    const hasVars = (campaign.template_variables || []).length > 0;

    const contacts = await db.query(`
      SELECT c.id, c.name, c.phone FROM contacts c
      JOIN contact_groups cg ON cg.contact_id = c.id
      WHERE cg.group_id = $1 AND c.opted_out = FALSE
    `, [campaign.group_id]);

    const results = { sent: 0, failed: 0, errors: [] };

    for (const contact of contacts.rows) {
      try {
        await whatsapp.sendTemplateMessage({
          phone: contact.phone,
          templateName: campaign.meta_template_name,
          language: campaign.language || 'mr',
          variables: hasVars ? [contact.name] : [],
        });
        results.sent++;

        await db.query(`
          INSERT INTO message_logs (contact_id, template_id, phone, status, sent_at)
          SELECT c.id, $2, $3, 'sent', NOW() FROM contacts c WHERE c.phone = $3
        `, [null, campaign.template_id, contact.phone]);
      } catch (err) {
        results.failed++;
        results.errors.push({ phone: contact.phone, error: err.message });
      }
    }

    // Update last_run_at
    await db.query(`UPDATE scheduled_campaigns SET last_run_at = NOW(), run_count = run_count + 1 WHERE id = $1`, [campaign.id]);

    res.json({ success: true, total: contacts.rows.length, ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send test message to specific phone numbers
router.post('/:id/test', async (req, res) => {
  try {
    const { phones = [] } = req.body;
    if (!phones.length) return res.status(400).json({ error: 'phones array required' });

    const sc = await db.query(`
      SELECT sc.*, t.meta_template_name, t.language, t.body_text, t.status AS template_status,
        t.variables AS template_variables
      FROM scheduled_campaigns sc
      LEFT JOIN templates t ON t.id = sc.template_id
      WHERE sc.id = $1
    `, [req.params.id]);

    if (!sc.rows[0]) return res.status(404).json({ error: 'Not found' });
    const campaign = sc.rows[0];

    if (campaign.template_status !== 'approved') {
      return res.status(400).json({ error: 'Template not approved yet. Wait for Meta approval.' });
    }

    // Only pass variables if template actually uses them
    const hasVars = (campaign.template_variables || []).length > 0;

    const results = [];
    for (const item of phones) {
      try {
        await whatsapp.sendTemplateMessage({
          phone: item.phone,
          templateName: campaign.meta_template_name,
          language: campaign.language || 'mr',
          variables: hasVars ? [item.name || 'Test User'] : [],
        });
        results.push({ phone: item.phone, status: 'sent' });
      } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message;
        results.push({ phone: item.phone, status: 'failed', error: errMsg });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

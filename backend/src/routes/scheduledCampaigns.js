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
    const {
      name, template_id, template_ids, group_id, schedule_time = '21:00:00',
      is_daily = true, interval_days = 1, end_date = null,
    } = req.body;
    if (!name || (!template_id && !(template_ids && template_ids.length)) || !group_id) {
      return res.status(400).json({ error: 'name, template_id (or template_ids), group_id are required' });
    }
    const result = await db.query(`
      INSERT INTO scheduled_campaigns
        (name, template_id, template_ids, group_id, schedule_time, is_daily, interval_days, end_date, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE) RETURNING *
    `, [name, template_id || (template_ids ? template_ids[0] : null),
        template_ids ? JSON.stringify(template_ids) : '[]',
        group_id, schedule_time, is_daily, interval_days, end_date]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update scheduled campaign
router.put('/:id', async (req, res) => {
  try {
    const {
      name, template_id, template_ids, group_id, schedule_time,
      is_daily, is_active, interval_days, end_date,
    } = req.body;
    const result = await db.query(`
      UPDATE scheduled_campaigns SET
        name = COALESCE($1, name),
        template_id = COALESCE($2, template_id),
        template_ids = COALESCE($3, template_ids),
        group_id = COALESCE($4, group_id),
        schedule_time = COALESCE($5, schedule_time),
        is_daily = COALESCE($6, is_daily),
        is_active = COALESCE($7, is_active),
        interval_days = COALESCE($8, interval_days),
        end_date = COALESCE($9, end_date),
        updated_at = NOW()
      WHERE id = $10 RETURNING *
    `, [name, template_id, template_ids ? JSON.stringify(template_ids) : null,
        group_id, schedule_time, is_daily, is_active, interval_days, end_date, req.params.id]);
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

// Run now (send immediately to all contacts in group) — supports rotation
router.post('/:id/run-now', async (req, res) => {
  try {
    const sc = await db.query('SELECT * FROM scheduled_campaigns WHERE id = $1', [req.params.id]);
    if (!sc.rows[0]) return res.status(404).json({ error: 'Not found' });
    const campaign = sc.rows[0];

    // ── Rotation logic (same as scheduler) ──────────────────────────────────
    const rotationIds = Array.isArray(campaign.template_ids) && campaign.template_ids.length > 0
      ? campaign.template_ids
      : campaign.template_id ? [campaign.template_id] : [];

    if (rotationIds.length === 0) {
      return res.status(400).json({ error: 'Campaign has no templates configured' });
    }

    const rotationIndex = campaign.run_count % rotationIds.length;
    const activeTemplateId = rotationIds[rotationIndex];

    // Load template
    let tmplRes = await db.query(
      `SELECT id, meta_template_name, language, body_text, status, variables AS template_variables,
              header_image_url, meta_has_image_header FROM templates WHERE id = $1`,
      [activeTemplateId]
    );
    let tmpl = tmplRes.rows[0];

    // Fallback to first approved in rotation if today's template isn't approved
    if (!tmpl || tmpl.status !== 'approved') {
      const fallbackRes = await db.query(
        `SELECT id, meta_template_name, language, body_text, status, variables AS template_variables,
                header_image_url, meta_has_image_header FROM templates
         WHERE id = ANY($1) AND status = 'approved' LIMIT 1`,
        [rotationIds]
      );
      if (!fallbackRes.rows[0]) {
        return res.status(400).json({ error: 'No approved template found in rotation. Cannot send.' });
      }
      tmpl = fallbackRes.rows[0];
    }

    const hasVars = (tmpl.template_variables || []).length > 0;
    const headerImageUrl = tmpl.meta_has_image_header ? tmpl.header_image_url : null;

    const contacts = await db.query(`
      SELECT c.id, c.name, c.phone FROM contacts c
      JOIN contact_groups cg ON cg.contact_id = c.id
      WHERE cg.group_id = $1 AND c.opted_out = FALSE
    `, [campaign.group_id]);

    const results = { sent: 0, failed: 0, errors: [], template_used: tmpl.meta_template_name };

    for (const contact of contacts.rows) {
      try {
        await whatsapp.sendTemplateMessage({
          phone: contact.phone,
          templateName: tmpl.meta_template_name,
          language: tmpl.language || 'mr',
          variables: hasVars ? [contact.name] : [],
          headerImageUrl,
        });
        results.sent++;

        // Direct INSERT with known contact.id — no fragile sub-SELECT
        await db.query(
          `INSERT INTO message_logs (contact_id, template_id, phone, status, sent_at)
           VALUES ($1, $2, $3, 'sent', NOW())`,
          [contact.id, tmpl.id, contact.phone]
        );
      } catch (err) {
        results.failed++;
        results.errors.push({ phone: contact.phone, error: err.message });

        // Log failures too
        await db.query(
          `INSERT INTO message_logs (contact_id, template_id, phone, status, error_message, failed_at)
           VALUES ($1, $2, $3, 'failed', $4, NOW())`,
          [contact.id, tmpl.id, contact.phone, err.message]
        ).catch(() => {}); // don't let log failure crash the loop
      }
    }

    // Update last_run_at and run_count
    await db.query(
      `UPDATE scheduled_campaigns SET last_run_at = NOW(), run_count = run_count + 1 WHERE id = $1`,
      [campaign.id]
    );

    res.json({ success: true, total: contacts.rows.length, rotation_index: rotationIndex, ...results });
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
        t.variables AS template_variables, t.header_image_url, t.meta_has_image_header
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
    // Only send image header if Meta actually approved template with image
    const headerImageUrl = campaign.meta_has_image_header ? campaign.header_image_url : null;

    const results = [];
    for (const item of phones) {
      try {
        await whatsapp.sendTemplateMessage({
          phone: item.phone,
          templateName: campaign.meta_template_name,
          language: campaign.language || 'mr',
          variables: hasVars ? [item.name || 'Test User'] : [],
          headerImageUrl,
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

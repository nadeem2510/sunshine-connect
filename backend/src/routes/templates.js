const express = require('express');
const db = require('../database');
const whatsapp = require('../services/whatsapp');

const router = express.Router();

// List templates
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    if (search) { params.push(`%${search}%`); where += ` AND (name ILIKE $${params.length} OR body_text ILIKE $${params.length})`; }

    const result = await db.query(
      `SELECT * FROM templates ${where} ORDER BY created_at DESC`, params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single template
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create template
router.post('/', async (req, res) => {
  try {
    const { name, category = 'MARKETING', language = 'mr', body_text, variables = [], header_text, footer_text, buttons = [] } = req.body;
    if (!name || !body_text) return res.status(400).json({ error: 'Name and body_text are required' });

    // Extract variables from body like {{1}}, {{2}}
    const extracted = [...new Set((body_text.match(/\{\{(\d+)\}\}/g) || []))];
    const mergedVars = variables.length > 0 ? variables : extracted;

    const result = await db.query(
      `INSERT INTO templates (name, category, language, body_text, variables, header_text, footer_text, buttons, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft') RETURNING *`,
      [name, category, language, body_text, JSON.stringify(mergedVars), header_text, footer_text, JSON.stringify(buttons)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update template (only draft/rejected can be edited)
router.put('/:id', async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Template not found' });
    if (existing.rows[0].status === 'approved') {
      return res.status(400).json({ error: 'Approved templates cannot be edited. Clone it instead.' });
    }

    const { name, category, language, body_text, variables, header_text, footer_text, buttons } = req.body;
    const extracted = body_text ? [...new Set((body_text.match(/\{\{(\d+)\}\}/g) || []))] : [];
    const mergedVars = variables ? variables : extracted;

    const result = await db.query(
      `UPDATE templates SET
        name = COALESCE($1, name), category = COALESCE($2, category),
        language = COALESCE($3, language), body_text = COALESCE($4, body_text),
        variables = COALESCE($5, variables), header_text = COALESCE($6, header_text),
        footer_text = COALESCE($7, footer_text),
        buttons = COALESCE($8, buttons),
        status = 'draft', updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [name, category, language, body_text, JSON.stringify(mergedVars), header_text, footer_text,
       buttons ? JSON.stringify(buttons) : null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete template
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM templates WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit to Meta for approval
router.post('/:id/submit-approval', async (req, res) => {
  try {
    const tmpl = await db.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (!tmpl.rows[0]) return res.status(404).json({ error: 'Template not found' });

    const template = tmpl.rows[0];
    if (template.status === 'approved') return res.status(400).json({ error: 'Already approved' });

    const result = await whatsapp.submitTemplateForApproval(template);

    await db.query(
      `UPDATE templates SET status = 'pending', meta_template_name = $1, meta_template_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [result.name, result.id, req.params.id]
    );

    res.json({ success: true, meta_template_id: result.id, status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clone template
router.post('/:id/clone', async (req, res) => {
  try {
    const result = await db.query(
      `INSERT INTO templates (name, category, language, body_text, variables, header_text, footer_text, status)
       SELECT CONCAT(name, ' (Copy)'), category, language, body_text, variables, header_text, footer_text, 'draft'
       FROM templates WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preview template with sample variables
router.post('/:id/preview', async (req, res) => {
  try {
    const tmpl = await db.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (!tmpl.rows[0]) return res.status(404).json({ error: 'Template not found' });

    const { variables = {} } = req.body;
    let preview = tmpl.rows[0].body_text;
    Object.entries(variables).forEach(([key, val]) => {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    });

    res.json({ preview, original: tmpl.rows[0].body_text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

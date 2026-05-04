const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const db = require('../database');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// List contacts with search + pagination
router.get('/', async (req, res) => {
  try {
    const { search = '', page = 1, limit = 50, group_id, opted_out } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.email ILIKE $${params.length})`;
    }
    if (opted_out !== undefined) {
      params.push(opted_out === 'true');
      where += ` AND c.opted_out = $${params.length}`;
    }
    if (group_id) {
      params.push(parseInt(group_id));
      where += ` AND EXISTS (SELECT 1 FROM contact_groups cg WHERE cg.contact_id = c.id AND cg.group_id = $${params.length})`;
    }

    const countResult = await db.query(`SELECT COUNT(*) FROM contacts c ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await db.query(
      `SELECT c.*,
        ARRAY_AGG(DISTINCT g.name) FILTER (WHERE g.name IS NOT NULL) AS group_names,
        ARRAY_AGG(DISTINCT g.id) FILTER (WHERE g.id IS NOT NULL) AS group_ids
       FROM contacts c
       LEFT JOIN contact_groups cg ON cg.contact_id = c.id
       LEFT JOIN groups g ON g.id = cg.group_id
       ${where}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ contacts: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single contact
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*,
        ARRAY_AGG(DISTINCT g.name) FILTER (WHERE g.name IS NOT NULL) AS group_names,
        ARRAY_AGG(DISTINCT g.id) FILTER (WHERE g.id IS NOT NULL) AS group_ids
       FROM contacts c
       LEFT JOIN contact_groups cg ON cg.contact_id = c.id
       LEFT JOIN groups g ON g.id = cg.group_id
       WHERE c.id = $1 GROUP BY c.id`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contact not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create contact
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, specialty, organization, notes, group_ids = [] } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

    const cleanPhone = phone.replace(/\D/g, '');
    const result = await db.query(
      `INSERT INTO contacts (name, phone, email, specialty, organization, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, cleanPhone, email, specialty, organization, notes]
    );
    const contact = result.rows[0];

    if (group_ids.length > 0) {
      for (const gid of group_ids) {
        await db.query(
          'INSERT INTO contact_groups (contact_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [contact.id, gid]
        );
      }
    }

    res.status(201).json(contact);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone number already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Update contact
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, specialty, organization, notes, group_ids } = req.body;
    const cleanPhone = phone ? phone.replace(/\D/g, '') : undefined;

    const result = await db.query(
      `UPDATE contacts SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        specialty = COALESCE($4, specialty),
        organization = COALESCE($5, organization),
        notes = COALESCE($6, notes),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [name, cleanPhone, email, specialty, organization, notes, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contact not found' });

    if (Array.isArray(group_ids)) {
      await db.query('DELETE FROM contact_groups WHERE contact_id = $1', [req.params.id]);
      for (const gid of group_ids) {
        await db.query(
          'INSERT INTO contact_groups (contact_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, gid]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete contact
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM contacts WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Contact not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk upload CSV/Excel
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let records = [];
    const ext = req.file.originalname.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
    } else if (['xlsx', 'xls'].includes(ext)) {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      records = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Use CSV or Excel.' });
    }

    const results = { imported: 0, skipped: 0, errors: [] };
    const group_id = req.body.group_id ? parseInt(req.body.group_id) : null;

    for (const row of records) {
      try {
        const name = row.name || row.Name || row.NAME || '';
        const phone = (row.phone || row.Phone || row.PHONE || row.mobile || row.Mobile || '').toString().replace(/\D/g, '');
        const email = row.email || row.Email || '';
        const specialty = row.specialty || row.Specialty || '';
        const organization = row.organization || row.Organization || row.hospital || '';

        if (!name || !phone) { results.skipped++; continue; }

        const r = await db.query(
          `INSERT INTO contacts (name, phone, email, specialty, organization)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (phone) DO UPDATE
           SET name = EXCLUDED.name, email = EXCLUDED.email, updated_at = NOW()
           RETURNING id`,
          [name, phone, email, specialty, organization]
        );

        if (group_id) {
          await db.query(
            'INSERT INTO contact_groups (contact_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [r.rows[0].id, group_id]
          );
        }
        results.imported++;
      } catch (e) {
        results.errors.push({ row: records.indexOf(row) + 1, error: e.message });
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Opt-out a contact manually
router.post('/:id/opt-out', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE contacts SET opted_out = TRUE, opted_out_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contact not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Opt-in a contact back
router.post('/:id/opt-in', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE contacts SET opted_out = FALSE, opted_out_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contact not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get message history for a contact
router.get('/:id/messages', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ml.*, t.name AS template_name, c.name AS campaign_name
       FROM message_logs ml
       LEFT JOIN templates t ON t.id = ml.template_id
       LEFT JOIN campaigns c ON c.id = ml.campaign_id
       WHERE ml.contact_id = $1
       ORDER BY ml.queued_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

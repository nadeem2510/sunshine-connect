const express = require('express');
const db = require('../database');

const router = express.Router();

// List all groups
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT g.*,
        COUNT(DISTINCT cg.contact_id) FILTER (WHERE c.opted_out = FALSE) AS active_contacts,
        COUNT(DISTINCT cg.contact_id) AS total_contacts
       FROM groups g
       LEFT JOIN contact_groups cg ON cg.group_id = g.id
       LEFT JOIN contacts c ON c.id = cg.contact_id
       GROUP BY g.id
       ORDER BY g.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single group with contacts
router.get('/:id', async (req, res) => {
  try {
    const groupResult = await db.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
    if (!groupResult.rows[0]) return res.status(404).json({ error: 'Group not found' });

    const contactsResult = await db.query(
      `SELECT c.* FROM contacts c
       JOIN contact_groups cg ON cg.contact_id = c.id
       WHERE cg.group_id = $1 ORDER BY c.name`,
      [req.params.id]
    );

    res.json({ ...groupResult.rows[0], contacts: contactsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create group
router.post('/', async (req, res) => {
  try {
    const { name, description, group_type = 'custom', interval_days = 10 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await db.query(
      `INSERT INTO groups (name, description, group_type, interval_days)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description, group_type, parseInt(interval_days)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update group
router.put('/:id', async (req, res) => {
  try {
    const { name, description, group_type, interval_days } = req.body;
    const result = await db.query(
      `UPDATE groups SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        group_type = COALESCE($3, group_type),
        interval_days = COALESCE($4, interval_days),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, description, group_type, interval_days ? parseInt(interval_days) : null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Group not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete group
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM groups WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Group not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add contacts to group
router.post('/:id/contacts', async (req, res) => {
  try {
    const { contact_ids } = req.body;
    if (!Array.isArray(contact_ids) || contact_ids.length === 0)
      return res.status(400).json({ error: 'contact_ids array required' });

    let added = 0;
    for (const cid of contact_ids) {
      const r = await db.query(
        'INSERT INTO contact_groups (contact_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [cid, req.params.id]
      );
      added += r.rowCount;
    }
    res.json({ added });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove contact from group
router.delete('/:id/contacts/:contactId', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM contact_groups WHERE group_id = $1 AND contact_id = $2',
      [req.params.id, req.params.contactId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

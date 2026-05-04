const express = require('express');
const db = require('../database');
const router = express.Router();

// Get all auto-replies
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM auto_replies ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create auto-reply
router.post('/', async (req, res) => {
  try {
    const { keyword, response_text, match_type = 'contains' } = req.body;
    if (!keyword?.trim() || !response_text?.trim())
      return res.status(400).json({ error: 'keyword and response_text required' });

    const result = await db.query(
      `INSERT INTO auto_replies (keyword, response_text, match_type)
       VALUES ($1, $2, $3) RETURNING *`,
      [keyword.trim().toLowerCase(), response_text.trim(), match_type]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update auto-reply
router.put('/:id', async (req, res) => {
  try {
    const { keyword, response_text, match_type, is_active } = req.body;
    const result = await db.query(
      `UPDATE auto_replies
       SET keyword = COALESCE($1, keyword),
           response_text = COALESCE($2, response_text),
           match_type = COALESCE($3, match_type),
           is_active = COALESCE($4, is_active)
       WHERE id = $5 RETURNING *`,
      [keyword?.trim().toLowerCase(), response_text?.trim(), match_type, is_active, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete auto-reply
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM auto_replies WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

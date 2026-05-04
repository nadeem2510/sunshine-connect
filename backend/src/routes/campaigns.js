const express = require('express');
const db = require('../database');
const { enqueueDripCampaign } = require('../services/queue');

const router = express.Router();

// List campaigns
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, g.name AS group_name,
        COUNT(DISTINCT de.id) AS enrolled_count,
        COUNT(DISTINCT cs.id) AS step_count
       FROM campaigns c
       LEFT JOIN groups g ON g.id = c.group_id
       LEFT JOIN drip_enrollments de ON de.campaign_id = c.id AND de.completed = FALSE
       LEFT JOIN campaign_steps cs ON cs.campaign_id = c.id
       GROUP BY c.id, g.name
       ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get campaign with steps
router.get('/:id', async (req, res) => {
  try {
    const campResult = await db.query(
      `SELECT c.*, g.name AS group_name FROM campaigns c
       LEFT JOIN groups g ON g.id = c.group_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!campResult.rows[0]) return res.status(404).json({ error: 'Campaign not found' });

    const stepsResult = await db.query(
      `SELECT cs.*, t.name AS template_name, t.body_text, t.status AS template_status
       FROM campaign_steps cs
       LEFT JOIN templates t ON t.id = cs.template_id
       WHERE cs.campaign_id = $1
       ORDER BY cs.step_order`,
      [req.params.id]
    );

    res.json({ ...campResult.rows[0], steps: stepsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create campaign
router.post('/', async (req, res) => {
  try {
    const { name, description, group_id, steps = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const campResult = await client.query(
        `INSERT INTO campaigns (name, description, group_id, status)
         VALUES ($1, $2, $3, 'draft') RETURNING *`,
        [name, description, group_id || null]
      );
      const campaign = campResult.rows[0];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await client.query(
          `INSERT INTO campaign_steps (campaign_id, template_id, day_offset, step_order)
           VALUES ($1, $2, $3, $4)`,
          [campaign.id, step.template_id, step.day_offset || i * 5, i]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(campaign);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update campaign
router.put('/:id', async (req, res) => {
  try {
    const { name, description, group_id, steps } = req.body;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE campaigns SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          group_id = COALESCE($3, group_id),
          updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [name, description, group_id, req.params.id]
      );
      if (!result.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Campaign not found' }); }

      if (Array.isArray(steps)) {
        await client.query('DELETE FROM campaign_steps WHERE campaign_id = $1', [req.params.id]);
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          await client.query(
            `INSERT INTO campaign_steps (campaign_id, template_id, day_offset, step_order)
             VALUES ($1, $2, $3, $4)`,
            [req.params.id, step.template_id, step.day_offset || i * 5, i]
          );
        }
      }

      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activate campaign (start drip for group)
router.post('/:id/activate', async (req, res) => {
  try {
    const camp = await db.query(
      `SELECT c.*, g.id AS gid FROM campaigns c
       LEFT JOIN groups g ON g.id = c.group_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!camp.rows[0]) return res.status(404).json({ error: 'Campaign not found' });

    const campaign = camp.rows[0];
    if (!campaign.group_id) return res.status(400).json({ error: 'Campaign needs a group assigned' });

    // Get active contacts in group
    const contacts = await db.query(
      `SELECT c.id FROM contacts c
       JOIN contact_groups cg ON cg.contact_id = c.id
       WHERE cg.group_id = $1 AND c.opted_out = FALSE`,
      [campaign.group_id]
    );

    let enrolled = 0;
    for (const contact of contacts.rows) {
      const existing = await db.query(
        'SELECT id FROM drip_enrollments WHERE contact_id = $1 AND campaign_id = $2',
        [contact.id, campaign.id]
      );
      if (!existing.rows[0]) {
        await db.query(
          `INSERT INTO drip_enrollments (contact_id, campaign_id, current_step, next_send_at)
           VALUES ($1, $2, 0, NOW())`,
          [contact.id, campaign.id]
        );
        enrolled++;
      }
    }

    await db.query(`UPDATE campaigns SET status = 'active', updated_at = NOW() WHERE id = $1`, [campaign.id]);
    await enqueueDripCampaign(campaign.id);

    res.json({ success: true, enrolled, message: `Campaign activated with ${enrolled} new enrollments` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pause campaign
router.post('/:id/pause', async (req, res) => {
  try {
    await db.query(`UPDATE campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1`, [req.params.id]);
    await db.query(`UPDATE drip_enrollments SET paused = TRUE WHERE campaign_id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resume campaign
router.post('/:id/resume', async (req, res) => {
  try {
    await db.query(`UPDATE campaigns SET status = 'active', updated_at = NOW() WHERE id = $1`, [req.params.id]);
    await db.query(`UPDATE drip_enrollments SET paused = FALSE WHERE campaign_id = $1`, [req.params.id]);
    await enqueueDripCampaign(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete campaign
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM campaigns WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get upcoming messages (queue view, next 7 days)
router.get('/:id/queue', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT de.*, c.name AS contact_name, c.phone,
        cs.day_offset, t.name AS template_name, t.body_text
       FROM drip_enrollments de
       JOIN contacts c ON c.id = de.contact_id
       JOIN campaign_steps cs ON cs.campaign_id = de.campaign_id AND cs.step_order = de.current_step
       LEFT JOIN templates t ON t.id = cs.template_id
       WHERE de.campaign_id = $1
         AND de.completed = FALSE AND de.paused = FALSE
         AND de.next_send_at <= NOW() + INTERVAL '7 days'
       ORDER BY de.next_send_at ASC
       LIMIT 100`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send now to a specific group (one-shot blast)
router.post('/send-now', async (req, res) => {
  try {
    const { template_id, group_id, variables = {} } = req.body;
    if (!template_id || !group_id) return res.status(400).json({ error: 'template_id and group_id required' });

    const tmpl = await db.query('SELECT * FROM templates WHERE id = $1', [template_id]);
    if (!tmpl.rows[0]) return res.status(404).json({ error: 'Template not found' });
    if (tmpl.rows[0].status !== 'approved') return res.status(400).json({ error: 'Template must be approved before sending' });

    const contacts = await db.query(
      `SELECT c.* FROM contacts c
       JOIN contact_groups cg ON cg.contact_id = c.id
       WHERE cg.group_id = $1 AND c.opted_out = FALSE`,
      [group_id]
    );

    const { queueImmediateBlast } = require('../services/queue');
    const jobId = await queueImmediateBlast({ template: tmpl.rows[0], contacts: contacts.rows, variables });

    res.json({ queued: contacts.rows.length, job_id: jobId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

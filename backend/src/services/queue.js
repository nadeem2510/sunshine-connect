const Bull = require('bull');
const db = require('../database');
const whatsapp = require('./whatsapp');

let messageQueue;
let dripQueue;

function initQueue() {
  const redisUrl = process.env.REDIS_URL;
  const redisConfig = redisUrl
    ? { url: redisUrl }
    : {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
      };

  if (redisUrl) {
    messageQueue = new Bull('messages', redisUrl);
    dripQueue = new Bull('drip-scheduler', redisUrl);
  } else {
    messageQueue = new Bull('messages', { redis: redisConfig });
    dripQueue = new Bull('drip-scheduler', { redis: redisConfig });
  }

  // Process outgoing messages (with concurrency 1 to respect rate limits)
  messageQueue.process(1, processMessage);

  // Drip campaign tick processor
  dripQueue.process(1, processDripTick);

  messageQueue.on('failed', (job, err) => {
    console.error(`[Queue] Message job ${job.id} failed:`, err.message);
    updateMessageStatus(job.data.log_id, 'failed', err.message);
  });

  dripQueue.on('failed', (job, err) => {
    console.error(`[Queue] Drip job ${job.id} failed:`, err.message);
  });

  // Schedule drip processor every 5 minutes
  scheduleDripPoller();

  console.log('[Queue] Bull queues initialized');
}

async function processMessage(job) {
  const { log_id, contact_id, template, phone, variables = {} } = job.data;

  try {
    const contact = await db.query('SELECT * FROM contacts WHERE id = $1 AND opted_out = FALSE', [contact_id]);
    if (!contact.rows[0]) {
      console.log(`[Queue] Skip: contact ${contact_id} opted out or not found`);
      await updateMessageStatus(log_id, 'failed', 'Contact opted out or not found');
      return;
    }

    // Personalize: inject contact name as variable 1 if not overridden
    const finalVars = { '1': contact.rows[0].name, ...variables };
    const varArray = Object.keys(finalVars).sort().map(k => finalVars[k]);

    const result = await whatsapp.sendTemplateMessage({
      phone,
      templateName: template.meta_template_name,
      language: template.language,
      variables: varArray,
    });

    const waId = result.messages?.[0]?.id;
    await db.query(
      `UPDATE message_logs SET status = 'sent', wa_message_id = $1, sent_at = NOW() WHERE id = $2`,
      [waId, log_id]
    );

    console.log(`[Queue] Sent to ${phone} | wa_id: ${waId}`);
  } catch (err) {
    await updateMessageStatus(log_id, 'failed', err.response?.data?.error?.message || err.message);
    throw err;
  }
}

async function processDripTick(job) {
  const { campaign_id } = job.data;

  const campaign = await db.query(
    `SELECT * FROM campaigns WHERE id = $1 AND status = 'active'`, [campaign_id]
  );
  if (!campaign.rows[0]) return;

  // Find all enrollments due for their next message
  const due = await db.query(
    `SELECT de.*, c.phone, c.name AS contact_name, c.opted_out
     FROM drip_enrollments de
     JOIN contacts c ON c.id = de.contact_id
     WHERE de.campaign_id = $1
       AND de.completed = FALSE
       AND de.paused = FALSE
       AND de.next_send_at <= NOW()`,
    [campaign_id]
  );

  for (const enrollment of due.rows) {
    if (enrollment.opted_out) {
      await db.query('UPDATE drip_enrollments SET completed = TRUE WHERE id = $1', [enrollment.id]);
      continue;
    }

    const step = await db.query(
      `SELECT cs.*, t.* FROM campaign_steps cs
       JOIN templates t ON t.id = cs.template_id
       WHERE cs.campaign_id = $1 AND cs.step_order = $2`,
      [campaign_id, enrollment.current_step]
    );

    if (!step.rows[0]) {
      // No more steps — mark complete
      await db.query('UPDATE drip_enrollments SET completed = TRUE WHERE id = $1', [enrollment.id]);
      continue;
    }

    const currentStep = step.rows[0];

    if (currentStep.status !== 'approved') {
      console.warn(`[Drip] Skipping step ${currentStep.step_order}: template not approved`);
      continue;
    }

    // Create message log
    let body = currentStep.body_text;
    body = body.replace(/\{\{1\}\}/g, enrollment.contact_name);

    const logResult = await db.query(
      `INSERT INTO message_logs (contact_id, template_id, campaign_id, step_id, phone, message_body, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'queued') RETURNING id`,
      [enrollment.contact_id, currentStep.template_id, campaign_id, currentStep.id, enrollment.phone, body]
    );

    // Enqueue the actual send
    await messageQueue.add({
      log_id: logResult.rows[0].id,
      contact_id: enrollment.contact_id,
      template: currentStep,
      phone: enrollment.phone,
      variables: { '1': enrollment.contact_name },
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: true,
    });

    // Advance to next step
    const nextStep = await db.query(
      `SELECT day_offset FROM campaign_steps
       WHERE campaign_id = $1 AND step_order = $2`,
      [campaign_id, enrollment.current_step + 1]
    );

    if (nextStep.rows[0]) {
      const nextSendAt = new Date();
      nextSendAt.setDate(nextSendAt.getDate() + nextStep.rows[0].day_offset - currentStep.day_offset);

      await db.query(
        `UPDATE drip_enrollments SET current_step = $1, next_send_at = $2 WHERE id = $3`,
        [enrollment.current_step + 1, nextSendAt, enrollment.id]
      );
    } else {
      await db.query('UPDATE drip_enrollments SET completed = TRUE WHERE id = $1', [enrollment.id]);
    }
  }
}

function scheduleDripPoller() {
  // Every 5 minutes, check all active campaigns
  setInterval(async () => {
    try {
      const activeCampaigns = await db.query(
        `SELECT DISTINCT de.campaign_id FROM drip_enrollments de
         JOIN campaigns c ON c.id = de.campaign_id
         WHERE c.status = 'active' AND de.completed = FALSE AND de.paused = FALSE
           AND de.next_send_at <= NOW()`
      );

      for (const row of activeCampaigns.rows) {
        await dripQueue.add({ campaign_id: row.campaign_id }, {
          attempts: 2,
          removeOnComplete: true,
          jobId: `drip-${row.campaign_id}-${Date.now()}`,
        });
      }
    } catch (err) {
      console.error('[Drip Poller]', err.message);
    }
  }, 5 * 60 * 1000);
}

async function enqueueDripCampaign(campaignId) {
  if (!dripQueue) throw new Error('Queue not initialized');
  return dripQueue.add({ campaign_id: campaignId }, { attempts: 2, removeOnComplete: true });
}

async function queueImmediateBlast({ template, contacts, variables }) {
  if (!messageQueue) throw new Error('Queue not initialized');

  for (const contact of contacts) {
    const logResult = await db.query(
      `INSERT INTO message_logs (contact_id, template_id, phone, message_body, status)
       VALUES ($1, $2, $3, $4, 'queued') RETURNING id`,
      [contact.id, template.id, contact.phone, template.body_text]
    );

    await messageQueue.add({
      log_id: logResult.rows[0].id,
      contact_id: contact.id,
      template,
      phone: contact.phone,
      variables,
    }, {
      attempts: 3,
      backoff: { type: 'fixed', delay: 5000 },
      removeOnComplete: true,
    });
  }

  return `blast-${Date.now()}`;
}

async function updateMessageStatus(logId, status, errorMessage = null) {
  if (!logId) return;
  await db.query(
    `UPDATE message_logs SET status = $1, error_message = $2,
      failed_at = CASE WHEN $1 = 'failed' THEN NOW() ELSE failed_at END
     WHERE id = $3`,
    [status, errorMessage, logId]
  ).catch(() => {});
}

module.exports = { initQueue, enqueueDripCampaign, queueImmediateBlast };

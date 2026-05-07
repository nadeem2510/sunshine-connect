const express = require('express');
const db = require('../database');
const whatsapp = require('../services/whatsapp');

const router = express.Router();
const VERIFY_TOKEN = process.env.WA_WEBHOOK_VERIFY_TOKEN || 'sunshine_webhook_secret_2024';

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'opt out', 'optout', 'cancel', 'quit', 'end', 'block'];

// Meta webhook verification (GET)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Verified successfully');
    return res.status(200).send(challenge);
  }
  res.status(403).json({ error: 'Verification failed' });
});

// Meta webhook events (POST)
router.post('/', async (req, res) => {
  try {
    // express.raw() gives a Buffer — must convert to string first
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;

    if (body.object !== 'whatsapp_business_account') {
      return res.status(400).json({ error: 'Not a WhatsApp event' });
    }

    res.status(200).send('EVENT_RECEIVED');

    // Process asynchronously so Meta doesn't timeout
    processWebhookAsync(body).catch(err => {
      console.error('[Webhook] Processing error:', err.message);
    });
  } catch (err) {
    console.error('[Webhook] Parse error:', err.message);
    res.status(200).send('EVENT_RECEIVED'); // Always return 200 to Meta
  }
});

async function processWebhookAsync(body) {
  for (const entry of (body.entry || [])) {
    for (const change of (entry.changes || [])) {
      const value = change.value;

      // Handle status updates (delivered, read, failed)
      for (const status of (value.statuses || [])) {
        await handleStatusUpdate(status);
      }

      // Handle incoming messages (opt-out, replies)
      for (const message of (value.messages || [])) {
        await handleIncomingMessage(message);
      }
    }
  }
}

async function handleStatusUpdate(status) {
  const { id: waId, status: newStatus, timestamp } = status;
  const ts = new Date(parseInt(timestamp) * 1000);

  const statusMap = {
    sent: { col: 'sent_at', status: 'sent' },
    delivered: { col: 'delivered_at', status: 'delivered' },
    read: { col: 'read_at', status: 'read' },
    failed: { col: 'failed_at', status: 'failed' },
  };

  const mapping = statusMap[newStatus];
  if (!mapping) return;

  const errorMsg = status.errors?.[0]?.message || null;

  await db.query(
    `UPDATE message_logs SET status = $1, ${mapping.col} = $2, error_message = COALESCE($3, error_message)
     WHERE wa_message_id = $4`,
    [mapping.status, ts, errorMsg, waId]
  );

  console.log(`[Webhook] Message ${waId} -> ${newStatus}`);
}

async function handleIncomingMessage(message) {
  const phone = message.from;
  const text = (message.text?.body || '').toLowerCase().trim();

  console.log(`[Webhook] Incoming from ${phone}: "${text}"`);

  // Check opt-out keywords
  if (OPT_OUT_KEYWORDS.some(kw => text === kw || text.startsWith(kw + ' '))) {
    const result = await db.query(
      `UPDATE contacts SET opted_out = TRUE, opted_out_at = NOW(), updated_at = NOW()
       WHERE phone = $1 RETURNING name`,
      [phone]
    );
    if (result.rows[0]) {
      console.log(`[Webhook] Auto opted-out: ${result.rows[0].name} (${phone})`);
    }
    return;
  }

  // Log the reply in message_logs as an inbound note (save even for unknown contacts)
  const contact = await db.query('SELECT id FROM contacts WHERE phone = $1', [phone]);
  const contactId = contact.rows[0]?.id || null;
  await db.query(
    `INSERT INTO message_logs (contact_id, phone, message_body, status, wa_message_id)
     VALUES ($1, $2, $3, 'inbound', $4)`,
    [contactId, phone, message.text?.body || '[media]', message.id]
  );

  // Check auto-replies
  await checkAutoReply(phone, text);
}

async function checkAutoReply(phone, text) {
  try {
    const rules = await db.query(
      'SELECT * FROM auto_replies WHERE is_active = TRUE ORDER BY created_at ASC'
    );

    for (const rule of rules.rows) {
      const kw = rule.keyword.toLowerCase();
      let matched = false;

      if (rule.match_type === 'exact') matched = text === kw;
      else if (rule.match_type === 'starts_with') matched = text.startsWith(kw);
      else matched = text.includes(kw); // contains (default)

      if (matched) {
        await whatsapp.sendTextMessage({ phone, text: rule.response_text });
        await db.query(
          'UPDATE auto_replies SET trigger_count = trigger_count + 1 WHERE id = $1',
          [rule.id]
        );
        console.log(`[AutoReply] Matched "${rule.keyword}" for ${phone}`);
        break; // Only first match fires
      }
    }
  } catch (err) {
    console.error('[AutoReply] Error:', err.message);
  }
}

module.exports = router;

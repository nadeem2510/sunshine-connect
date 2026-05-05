const db = require('../database');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  specialty VARCHAR(255),
  organization VARCHAR(255),
  notes TEXT,
  opted_out BOOLEAN DEFAULT FALSE,
  opted_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  group_type VARCHAR(50) DEFAULT 'custom',
  interval_days INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_groups (
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (contact_id, group_id)
);

CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'MARKETING',
  language VARCHAR(20) DEFAULT 'en',
  body_text TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  header_text VARCHAR(255),
  footer_text VARCHAR(255),
  status VARCHAR(50) DEFAULT 'draft',
  meta_template_name VARCHAR(255),
  meta_template_id VARCHAR(255),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_steps (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
  day_offset INTEGER NOT NULL DEFAULT 0,
  step_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drip_enrollments (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 0,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  next_send_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE,
  paused BOOLEAN DEFAULT FALSE,
  UNIQUE(contact_id, campaign_id)
);

CREATE TABLE IF NOT EXISTS message_logs (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  step_id INTEGER REFERENCES campaign_steps(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  message_body TEXT,
  wa_message_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'queued',
  error_message TEXT,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_opted_out ON contacts(opted_out);
CREATE INDEX IF NOT EXISTS idx_message_logs_wa_id ON message_logs(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);
CREATE INDEX IF NOT EXISTS idx_drip_next_send ON drip_enrollments(next_send_at) WHERE completed = FALSE AND paused = FALSE;

CREATE TABLE IF NOT EXISTS auto_replies (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL,
  response_text TEXT NOT NULL,
  match_type VARCHAR(20) DEFAULT 'contains',
  is_active BOOLEAN DEFAULT TRUE,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function initDB() {
  const client = await db.getClient();
  try {
    await client.query(SCHEMA);
    await runMigrations(client);
    await seedDefaultGroups(client);
  } finally {
    client.release();
  }
}

async function runMigrations(client) {
  // Add buttons column to templates if not exists
  await client.query(`
    ALTER TABLE templates ADD COLUMN IF NOT EXISTS buttons JSONB DEFAULT '[]'
  `);
  // Add header_image_url column to templates if not exists
  await client.query(`
    ALTER TABLE templates ADD COLUMN IF NOT EXISTS header_image_url TEXT
  `);
  // Add scheduled_campaigns table
  await client.query(`
    CREATE TABLE IF NOT EXISTS scheduled_campaigns (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
      group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
      schedule_time TIME NOT NULL DEFAULT '21:00:00',
      timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
      is_daily BOOLEAN DEFAULT TRUE,
      is_active BOOLEAN DEFAULT FALSE,
      last_run_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ,
      run_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function seedDefaultGroups(client) {
  const defaults = [
    { name: 'Referral Doctors', description: 'Referring physicians and specialists', group_type: 'referral_doctors', interval_days: 10 },
    { name: 'Social Workers', description: 'Hospital social workers and case managers', group_type: 'social_workers', interval_days: 5 },
    { name: 'Chronic Patients', description: 'Patients with chronic conditions needing follow-up', group_type: 'chronic_patients', interval_days: 15 },
    { name: 'Contractors', description: 'Industrial contractors for health checkups', group_type: 'contractors', interval_days: 3 },
  ];

  for (const g of defaults) {
    await client.query(
      `INSERT INTO groups (name, description, group_type, interval_days)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [g.name, g.description, g.group_type, g.interval_days]
    );
  }
}

if (require.main === module) {
  require('dotenv').config({ path: '../../.env' });
  initDB().then(() => { console.log('Migration complete'); process.exit(0); })
           .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { initDB };

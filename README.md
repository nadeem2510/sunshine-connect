# Sunshine Connect — WhatsApp Marketing Automation Suite

A full-stack WhatsApp marketing and drip campaign automation tool for Sunshine Hospital, built on the official Meta WhatsApp Business Cloud API.

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Meta WhatsApp Business API credentials

### 1. Clone & Install

```bash
# Backend
cd backend
cp .env.example .env     # Fill in your credentials
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Backend `.env`

```
WA_PHONE_NUMBER_ID=your_phone_number_id
WA_ACCESS_TOKEN=your_permanent_system_user_token
WA_BUSINESS_ACCOUNT_ID=your_waba_id
WA_WEBHOOK_VERIFY_TOKEN=sunshine_webhook_secret_2024

DB_HOST=localhost
DB_NAME=sunshine_connect
DB_USER=postgres
DB_PASSWORD=yourpassword

REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Run

```bash
# Terminal 1 — Backend (auto-migrates DB on start)
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open http://localhost:5173

---

## Docker (Production)

```bash
cp backend/.env.example backend/.env   # Fill credentials
docker-compose up -d
```

App runs on http://localhost:80

---

## Architecture

```
sunshine-connect/
├── backend/                   Node.js + Express API
│   ├── server.js              Entry point
│   ├── src/
│   │   ├── database.js        PostgreSQL pool
│   │   ├── models/migrate.js  Schema + default groups
│   │   ├── routes/
│   │   │   ├── contacts.js    CRUD + CSV upload + opt-out
│   │   │   ├── groups.js      Group management
│   │   │   ├── templates.js   Template CRUD + Meta approval
│   │   │   ├── campaigns.js   Drip campaigns + send-now
│   │   │   ├── messages.js    Single send + logs
│   │   │   ├── webhooks.js    Meta webhook (delivery + opt-out)
│   │   │   └── dashboard.js   Stats + queue + health
│   │   └── services/
│   │       ├── whatsapp.js    Meta Cloud API client
│   │       └── queue.js       Bull queue + drip scheduler
└── frontend/                  React + Vite + TailwindCSS
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx  Stats, chart, queue view
        │   ├── Contacts.jsx   Contact list + CSV import
        │   ├── Groups.jsx     Segment management
        │   ├── Templates.jsx  Template editor + approval
        │   ├── Campaigns.jsx  Drip builder + send-now
        │   ├── MessageLogs.jsx Delivery tracking
        │   └── Settings.jsx   API config + safety docs
        └── services/api.js    Axios API client
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `contacts` | Patients, doctors, contractors with opt-out |
| `groups` | Referral Doctors, Social Workers, Chronic Patients, Contractors |
| `contact_groups` | Many-to-many contacts ↔ groups |
| `templates` | Message templates with Meta approval status |
| `campaigns` | Named drip sequences |
| `campaign_steps` | Template + day_offset per step |
| `drip_enrollments` | Per-contact drip progress tracking |
| `message_logs` | Full delivery audit trail |

---

## Safety Gates

| Gate | How it works |
|---|---|
| Variable delays | 1–5s random delay between sends |
| Template approval | Only Meta-approved templates can be sent |
| Personalization | `{{1}}` auto-filled with contact name |
| Opt-out detection | Webhook auto-opts-out on STOP/UNSUBSCRIBE |
| Delivery tracking | Full status trail via Meta webhooks |

---

## Webhook Setup (Required for delivery tracking)

1. Expose your backend with a public URL (use ngrok for testing):
   ```bash
   ngrok http 3001
   ```

2. In Meta Developer Console → WhatsApp → Configuration:
   - **Webhook URL**: `https://your-domain.com/api/webhooks`
   - **Verify Token**: `sunshine_webhook_secret_2024` (match your `.env`)
   - Subscribe to: `messages`, `message_status_updates`

---

## Automation Pathways

| Group | Interval | Strategy |
|---|---|---|
| Referral Doctors | Every 10 days | Medical updates, CME invites, new equipment |
| Social Workers | Every 5 days | MJPJY/ESIC updates, patient stories |
| Chronic Patients | Every 15 days | Health tips, follow-up reminders |
| Contractors | Every 3 days | Active campaign updates, health checkup drives |

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { initDB } = require('./src/models/migrate');
const { initQueue } = require('./src/services/queue');

const contactsRouter = require('./src/routes/contacts');
const groupsRouter = require('./src/routes/groups');
const templatesRouter = require('./src/routes/templates');
const campaignsRouter = require('./src/routes/campaigns');
const messagesRouter = require('./src/routes/messages');
const webhooksRouter = require('./src/routes/webhooks');
const dashboardRouter = require('./src/routes/dashboard');
const autoRepliesRouter = require('./src/routes/autoReplies');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));

// Webhook needs raw body for signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

app.use('/api/contacts', contactsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/auto-replies', autoRepliesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Sunshine Connect' });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  try {
    await initDB();
    console.log('[DB] Database initialized');
    await initQueue();
    console.log('[Queue] Job queue initialized');
    app.listen(PORT, () => {
      console.log(`[Server] Sunshine Connect running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Startup] Fatal error:', err);
    process.exit(1);
  }
}

start();

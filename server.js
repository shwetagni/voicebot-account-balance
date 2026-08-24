require('dotenv').config();
const express = require('express');
const { authenticate } = require('./tools/authenticate');
const { getBalance } = require('./tools/getBalance');
const { blockCard } = require('./tools/blockCard');
const { sendNotification } = require('./tools/sendNotification');

const app = express();
app.use(express.json());

// Simple request logger so tool-call usage is verifiable, per the evaluation checklist.
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${JSON.stringify(req.body || {})}`);
  next();
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ---- Tool endpoints -------------------------------------------------
// Each returns a flat JSON object the LLM can read back in natural language.
// Wrap in try/catch so a bug never crashes the call — the bot always gets
// *some* structured response back to react to (per requirement #8).

app.post('/tools/authenticate', async (req, res) => {
  try {
    res.json(await authenticate(req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Authentication service is temporarily unavailable.' });
  }
});

app.post('/tools/get_balance', async (req, res) => {
  try {
    res.json(await getBalance(req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Balance service is temporarily unavailable.' });
  }
});

app.post('/tools/block_card', async (req, res) => {
  try {
    res.json(await blockCard(req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Card block service is temporarily unavailable.' });
  }
});

app.post('/tools/send_notification', async (req, res) => {
  try {
    res.json(await sendNotification(req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Notification service is temporarily unavailable.' });
  }
});

// ---- Tool schema (for registering with AIDA / any LLM function-calling UI) ----
app.get('/tools/schema', (req, res) => {
  res.json([
    {
      name: 'authenticate',
      description: "Verify a caller's identity using their account number and PIN before any account information is shared.",
      url: '/tools/authenticate',
      parameters: {
        type: 'object',
        properties: {
          account_number: { type: 'string', description: 'The customer\'s account number.' },
          pin: { type: 'string', description: "The customer's 4-digit PIN." },
        },
        required: ['account_number', 'pin'],
      },
    },
    {
      name: 'get_balance',
      description: "Fetch the authenticated caller's account balance. Requires a valid session_id from authenticate.",
      url: '/tools/get_balance',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'Session id returned by the authenticate tool.' },
        },
        required: ['session_id'],
      },
    },
    {
      name: 'block_card',
      description: "Block the authenticated caller's card and open a ticket. Requires a valid session_id from authenticate and a reason.",
      url: '/tools/block_card',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'Session id returned by the authenticate tool.' },
          reason: { type: 'string', description: 'Why the card is being blocked (lost, stolen, suspected fraud, etc).' },
        },
        required: ['session_id', 'reason'],
      },
    },
    {
      name: 'send_notification',
      description: 'Send an out-of-band SMS or email confirming the card block, including name and ticket number.',
      url: '/tools/send_notification',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'Session id returned by the authenticate tool.' },
          ticket_number: { type: 'string', description: 'Ticket number returned by block_card.' },
          channel: { type: 'string', enum: ['sms', 'email'], description: 'Which channel to notify on.' },
        },
        required: ['session_id', 'ticket_number', 'channel'],
      },
    },
  ]);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Voice bot tool server listening on :${PORT}`));

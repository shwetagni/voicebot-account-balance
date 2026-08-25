# Voice Bot – Account Balance Lookup & Card Block

Built for the Enterprise Bot AIDA platform. This repo contains the **tool/backend layer** the AIDA agent calls into — the conversational/voice logic itself lives in the AIDA bot builder (system prompt + registered tools), since AIDA owns speech-to-text, text-to-speech, and telephony.

## Architecture

```
Caller (phone) → AIDA voice platform (STT/TTS + LLM agent)
                        │  agent decides when to call a tool
                        ▼
                 Node.js tool server (this repo)
                        │
                 SQLite database (accounts / tickets / sessions)
                        │
                 Twilio (SMS) / SMTP (email) for out-of-band confirmation
```

The LLM inside AIDA is given a system prompt (see `PROMPT.md`) and four tool
definitions (see `GET /tools/schema`). It decides on its own, from the
conversation, when to authenticate, when to fetch a balance, when to block a
card, and when to notify — nothing is a hardcoded IVR menu.

## Tools exposed

| Tool | Endpoint | Purpose |
|---|---|---|
| `authenticate` | `POST /tools/authenticate` | Verify account number + PIN, issue a `session_id` |
| `get_balance` | `POST /tools/get_balance` | Return balance for the authenticated session |
| `block_card` | `POST /tools/block_card` | Block the card, write a ticket row, return `ticket_number` |
| `send_notification` | `POST /tools/send_notification` | Send SMS/email with name + ticket number + confirmation |

> Note: tools are registered in AIDA with a `_snk` suffix (e.g. `authenticate_snk`) to avoid name collisions in the shared demo team.

Full JSON schema for registering these with AIDA: `GET /tools/schema`.

### Design choices

- **Auth method:** Account Number + PIN. Simplest to demo reliably over a
  voice call (no external OTP delivery dependency in the demo path), and the
  brief explicitly lists it as an accepted option.
- **Session gating:** `get_balance` and `block_card` never trust a bare
  `account_number` from the LLM — they require a `session_id` minted by
  `authenticate`. This is what actually enforces "authenticated before any
  balance is revealed," rather than relying on the LLM to behave.
- **Generic auth errors:** wrong PIN and unknown account return the same
  `AUTH_FAILED` message, to avoid leaking which accounts exist.
- - **SQLite via `sql.js`:** chosen over `better-sqlite3` specifically to avoid
  native compilation (no Python/C++ build tools needed), which makes setup
  painless on Windows. Zero external services to stand up in 24 hours;
  trivial to swap for Postgres/Supabase later (see "What I'd improve").
- **Notification fallback:** if `TWILIO_*` / `SMTP_*` env vars aren't set,
  `send_notification` logs a `[MOCK SMS]` / `[MOCK EMAIL]` line to the
  console instead of failing — so the demo runs end-to-end even without live
  Twilio/SMTP credentials, while the tool call itself is still real and
  visible in logs.

## Setup

## Setup

Local run:

```bash
npm install
cp .env.example .env      # fill in Twilio/SMTP creds if you want real sends
node db/init.js           # creates + seeds db/bank.sqlite with 3 demo accounts
node server.js            # starts the tool server on :3000
```

## Deployment

The demo runs on **Render** (free tier), giving a stable public HTTPS URL —
this replaced an initial local-tunnel approach, which proved unreliable
(random URL changes on restart, intermittent tunnel drops). Deployed URL:
`https://voicebot-account-balance.onrender.com`.

To redeploy: connect this repo on Render as a Web Service, build command
`npm install`, start command `npm start` (which runs `db/init.js` then
`server.js` on every boot, so the DB is always freshly seeded).

Then in AIDA: register the four tools from `GET /tools/schema` (or paste
`PROMPT.md` + the schema into the "Tool(s)" section of AIDA's bot builder),
pointing each tool's URL at `https://<your-render-url>/tools/<name>`.

Note: Render's free tier sleeps after 15 minutes of inactivity; the first
request after sleeping can take 30–60 seconds to respond, so the demo
video briefly "wakes" the service (via a `/health` check) before the call.

## Demo accounts

| Account # | Name | PIN | Balance |
|---|---|---|---|
| 1001 | Asha Rao | 4321 | ₹125,430.50 |
| 1002 | Rahul Mehta | 1122 | ₹8,420.00 |
| 1003 | Priya Nair | 7788 | ₹998,765.10 |

## What I'd improve with more time

With more time I'd move the PIN to a hashed/salted store instead of plaintext
(fine for a demo seed, not for anything real), swap SQLite for Postgres so
multiple AIDA instances can share state, add rate-limiting/lockout after
repeated failed PIN attempts to prevent brute-forcing, add a proper OTP-based
second factor as an alternative auth path, and add structured tracing
(request IDs correlated across the authenticate → get_balance → block_card →
notify chain) so a failed call can be debugged end-to-end from logs alone
rather than by re-reading console output.
 I'd also move off Render's free tier (or add a keep-alive ping) to eliminate
the cold-start delay on the first request after idling.

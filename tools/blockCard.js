const { randomUUID } = require('crypto');
const { getDb } = require('../db/connection');
const { resolveSession } = require('./authenticate');

async function blockCard({ session_id, reason }) {
  if (!session_id) {
    return {
      success: false,
      error: 'MISSING_SESSION',
      message: 'Authentication is required before blocking the card.'
    };
  }

  const session = await resolveSession(session_id);

  if (!session) {
    return {
      success: false,
      error: 'NOT_AUTHENTICATED',
      message: 'Please verify your identity before I can block a card.'
    };
  }

  if (!reason || !reason.trim()) {
    return {
      success: false,
      error: 'MISSING_REASON',
      message: 'Please provide a reason for blocking the card.'
    };
  }

  const db = await getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      account_number TEXT NOT NULL,
      type TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  const account = db.get(
    `SELECT account_number, card_status
     FROM accounts
     WHERE account_number = ?`,
    [session.account_number]
  );

  if (!account) {
    return {
      success: false,
      error: 'ACCOUNT_NOT_FOUND',
      message: 'We could not locate this account.'
    };
  }

  if (String(account.card_status).toUpperCase() === 'BLOCKED') {
    return {
      success: false,
      error: 'ALREADY_BLOCKED',
      message: 'This card is already blocked.'
    };
  }

  const ticket_number = 'TCK-' + randomUUID().slice(0, 8).toUpperCase();
  const created_at = new Date().toISOString();

  try {
    db.run(
      `UPDATE accounts
       SET card_status = ?, ticket_number = ?
       WHERE account_number = ?`,
      ['BLOCKED', ticket_number, account.account_number]
    );

    db.run(
      `INSERT INTO tickets
       (ticket_number, account_number, type, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        ticket_number,
        account.account_number,
        'card_block',
        reason.trim(),
        'closed',
        created_at
      ]
    );
  } catch (err) {
    console.error('CARD BLOCK ERROR:', err);

    return {
      success: false,
      error: 'TICKET_CREATION_FAILED',
      message: 'Something went wrong while blocking the card.'
    };
  }

  return {
    success: true,
    ticket_number,
    status: 'BLOCKED',
    message: `Card successfully blocked. Your ticket number is ${ticket_number}.`
  };
}

module.exports = { blockCard };



// const { randomUUID } = require('crypto');
// const { getDb } = require('../db/connection');
// const { resolveSession } = require('./authenticate');

// /**
//  * Tool: block_card
//  * Input:  { session_id: string, reason: string }
//  * Output: { success: boolean, ticket_number?: string, error?: string }
//  */
// async function blockCard({ session_id, reason }) {
//   const session = await resolveSession(session_id);
//   if (!session) {
//     return { success: false, error: 'NOT_AUTHENTICATED', message: 'Please verify your identity before I can block a card.' };
//   }
//   if (!reason || !reason.trim()) {
//     return { success: false, error: 'MISSING_REASON', message: 'Could you tell me briefly why the card needs to be blocked — lost, stolen, or suspected fraud?' };
//   }

//   const db = await getDb();
//   const account = db.get('SELECT account_number, card_status FROM accounts WHERE account_number = ?', [session.account_number]);

//   if (!account) {
//     return { success: false, error: 'ACCOUNT_NOT_FOUND', message: 'We could not locate this account.' };
//   }
//   if (account.card_status === 'blocked') {
//     return { success: false, error: 'ALREADY_BLOCKED', message: 'This card is already blocked.' };
//   }

//   const ticket_number = 'TCK-' + randomUUID().slice(0, 8).toUpperCase();
//   const created_at = new Date().toISOString();

//   try {
//     db.run('UPDATE accounts SET card_status = ? WHERE account_number = ?', ['blocked', account.account_number]);
//     db.run(
//       'INSERT INTO tickets (ticket_number, account_number, type, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
//       [ticket_number, account.account_number, 'card_block', reason.trim(), 'closed', created_at]
//     );
//   } catch (err) {
//     return { success: false, error: 'TICKET_CREATION_FAILED', message: 'Something went wrong while blocking the card. Please try again shortly.' };
//   }

//   return {
//     success: true,
//     ticket_number,
//     message: `Card successfully blocked. Your ticket number is ${ticket_number}.`,
//   };
// }

// module.exports = { blockCard };

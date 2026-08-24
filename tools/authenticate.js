const { randomUUID } = require('crypto');
const { getDb } = require('../db/connection');

/**
 * Tool: authenticate
 * Input:  { account_number: string, pin: string }
 * Output: { success: boolean, session_id?: string, name?: string, error?: string }
 */
async function authenticate({ account_number, pin }) {
  if (!account_number || !pin) {
    return { success: false, error: 'MISSING_FIELDS', message: 'Account number and PIN are both required.' };
  }

  const db = await getDb();
  const account = db.get('SELECT account_number, name, pin FROM accounts WHERE account_number = ?', [
    String(account_number).trim(),
  ]);

  if (!account || account.pin !== String(pin).trim()) {
    return { success: false, error: 'AUTH_FAILED', message: 'We could not verify those details. Please check your account number and PIN and try again.' };
  }

  const session_id = randomUUID();
  db.run('INSERT INTO sessions (session_id, account_number, authenticated_at) VALUES (?, ?, ?)', [
    session_id,
    account.account_number,
    new Date().toISOString(),
  ]);

  return {
    success: true,
    session_id,
    name: account.name,
    message: `Identity verified for ${account.name}.`,
  };
}

/** Helper other tools use to resolve+trust a session_id */
async function resolveSession(session_id) {
  if (!session_id) return null;
  const db = await getDb();
  const session = db.get('SELECT session_id, account_number FROM sessions WHERE session_id = ?', [session_id]);
  if (!session) return null;
  const account = db.get('SELECT name FROM accounts WHERE account_number = ?', [session.account_number]);
  return { ...session, name: account ? account.name : undefined };
}

module.exports = { authenticate, resolveSession };

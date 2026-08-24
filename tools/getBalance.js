const { getDb } = require('../db/connection');
const { resolveSession } = require('./authenticate');

/**
 * Tool: get_balance
 * Input:  { session_id: string }
 * Output: { success: boolean, balance?: number, currency?: string, error?: string }
 */
async function getBalance({ session_id }) {
  const session = await resolveSession(session_id);
  if (!session) {
    return { success: false, error: 'NOT_AUTHENTICATED', message: 'Please verify your identity before requesting your balance.' };
  }

  const db = await getDb();
  const account = db.get('SELECT balance FROM accounts WHERE account_number = ?', [session.account_number]);

  if (!account) {
    return { success: false, error: 'ACCOUNT_NOT_FOUND', message: 'We could not locate this account.' };
  }

  return {
    success: true,
    balance: account.balance,
    currency: 'INR',
    message: `${session.name}'s current balance is ₹${Number(account.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`,
  };
}

module.exports = { getBalance };

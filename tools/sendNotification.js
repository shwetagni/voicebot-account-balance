const { getDb } = require('../db/connection');
const { resolveSession } = require('./authenticate');
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

async function sendNotification({ session_id, ticket_number, channel }) {
  const session = await resolveSession(session_id);

  if (!session) {
    return {
      success: false,
      error: 'NOT_AUTHENTICATED',
      message: 'Please verify your identity first.'
    };
  }

  if (!ticket_number) {
    return {
      success: false,
      error: 'MISSING_TICKET',
      message: 'No ticket number was provided.'
    };
  }

  if (channel !== 'email') {
    return {
      success: false,
      error: 'INVALID_CHANNEL',
      message: 'Only email notification is configured.'
    };
  }

  if (!resend) {
    console.error('RESEND_API_KEY is missing');

    return {
      success: false,
      error: 'EMAIL_NOT_CONFIGURED',
      message: 'Email notification service is not configured.'
    };
  }

  const db = await getDb();

  const account = db.get(
    `SELECT name, email
     FROM accounts
     WHERE account_number = ?`,
    [session.account_number]
  );

  if (!account) {
    return {
      success: false,
      error: 'ACCOUNT_NOT_FOUND',
      message: 'Customer account could not be found.'
    };
  }

  if (!account.email) {
    return {
      success: false,
      error: 'EMAIL_NOT_FOUND',
      message: 'No email address is registered for this account.'
    };
  }

  const body = `Hello ${account.name},

Your card has been successfully blocked.

Ticket Number: ${ticket_number}

If you did not request this card block, please contact customer support immediately.

Thank you,
Enterprise Bot Banking`;

  try {
    console.log(`[EMAIL] Sending to ${account.email}`);

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: account.email,
      subject: 'Card Block Confirmation',
      text: body
    });

    

    if (result.error) {

      return {
        success: false,
        error: 'NOTIFICATION_FAILED',
        message: 'The card was blocked, but we could not send the confirmation email.'
      };
    }

    console.log(
      `[EMAIL SENT] to=${account.email} ticket=${ticket_number}`
    );

    return {
      success: true,
      channel: 'email',
      ticket_number,
      message: 'Email confirmation sent successfully.'
    };

  } catch (err) {

    return {
      success: false,
      error: 'NOTIFICATION_FAILED',
      message: 'The card was blocked, but we could not send the confirmation email.'
    };
  }
}

module.exports = { sendNotification };

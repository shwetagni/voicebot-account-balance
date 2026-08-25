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






// const { getDb } = require('../db/connection');
// const { resolveSession } = require('./authenticate');

// let twilioClient = null;
// if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
//   twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
// }

// let mailTransport = null;
// if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
//   const nodemailer = require('nodemailer');
//   mailTransport = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: Number(process.env.SMTP_PORT || 587),
//     secure: false,
//     auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
//   });
// }

// /**
//  * Tool: send_notification
//  * Input:  { session_id: string, ticket_number: string, channel: 'sms' | 'email' }
//  * Output: { success: boolean, channel?: string, error?: string }
//  */
// async function sendNotification({ session_id, ticket_number, channel }) {
//   const session = await resolveSession(session_id);
//   if (!session) {
//     return { success: false, error: 'NOT_AUTHENTICATED', message: 'Please verify your identity first.' };
//   }
//   if (!ticket_number) {
//     return { success: false, error: 'MISSING_TICKET', message: 'No ticket number was provided to send.' };
//   }

//   const db = await getDb();
//   const account = db.get('SELECT name, phone, email FROM accounts WHERE account_number = ?', [session.account_number]);

//   const body = `Hi ${account.name}, your card has been successfully blocked. Reference/Ticket number: ${ticket_number}. If you did not request this, please contact us immediately.`;

//   try {
//     if (channel === 'sms') {
//       if (twilioClient && process.env.TWILIO_FROM_NUMBER) {
//         await twilioClient.messages.create({ body, from: process.env.TWILIO_FROM_NUMBER, to: account.phone });
//       } else {
//         console.log(`[MOCK SMS] to=${account.phone} :: ${body}`);
//       }
//       return { success: true, channel: 'sms', message: 'SMS confirmation sent.' };
//     }

//     if (channel === 'email') {
//       if (mailTransport) {
//         await mailTransport.sendMail({
//           from: process.env.SMTP_FROM || 'no-reply@demo-bank.example',
//           to: account.email,
//           subject: 'Card Block Confirmation',
//           text: body,
//         });
//       } else {
//         console.log(`[MOCK EMAIL] to=${account.email} :: ${body}`);
//       }
//       return { success: true, channel: 'email', message: 'Email confirmation sent.' };
//     }

//     return { success: false, error: 'INVALID_CHANNEL', message: "channel must be 'sms' or 'email'." };
//   } catch (err) {
//     console.error('Notification failure:', err.message);
//     return { success: false, error: 'NOTIFICATION_FAILED', message: 'The card is blocked, but we could not send the confirmation message. Please note your ticket number.' };
//   }
// }

// module.exports = { sendNotification };

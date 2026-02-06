const nodemailer = require('nodemailer');
const mailConfig = require('../config/mail');

const transporter = nodemailer.createTransport(mailConfig);

exports.sendEmail = async (to, subject, html) => {
  try {
    const from = String(process.env.EMAIL_USER || '').trim();
    const pass = String(process.env.EMAIL_PASS || '').trim();

    // If email isn't configured, don't crash checkout flows.
    const looksLikePlaceholder =
      from === 'your_email@gmail.com' ||
      pass === 'your_app_password';

    if (!from || !pass || looksLikePlaceholder) {
      console.warn('[email] Skipping send: EMAIL_USER/EMAIL_PASS not configured');
      return { ok: false, skipped: true, reason: 'not_configured' };
    }

    const mailOptions = { from, to, subject, html };
    const info = await transporter.sendMail(mailOptions);
    console.log('[email] Sent successfully:', info.messageId);
    return { ok: true, info };
  } catch (err) {
    // CRITICAL: Catch all errors so we don't block the checkout response!
    console.error('[email] Send failed (non-fatal):', err.message);
    return { ok: false, error: err.message };
  }
};
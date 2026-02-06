const nodemailer = require('nodemailer');
const mailConfig = require('../config/mail');

const transporter = nodemailer.createTransport(mailConfig);

exports.sendEmail = async (to, subject, html) => {
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

  try {
    const mailOptions = { from, to, subject, html };
    const info = await transporter.sendMail(mailOptions);
    return { ok: true, info };
  } catch (err) {
    // Very common in dev: Gmail rejects non-app-passwords.
    console.error('[email] Send failed:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
};
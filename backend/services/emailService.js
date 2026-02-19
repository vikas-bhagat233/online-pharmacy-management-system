const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const mailConfig = require('../config/mail');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport(mailConfig);

exports.sendEmail = async (to, subject, html) => {
  try {
    let sent = false;
    let errorMsg = '';

    // 1. Try Resend if API key is present
    if (resend) {
      try {
        const { data, error } = await resend.emails.send({
          from: 'MediCare <onboarding@resend.dev>',
          to: [to],
          subject: subject,
          html: html,
        });

        if (error) {
          console.warn('[email] Resend API Error:', error);
          errorMsg += `Resend Error: ${error.message}; `;
        } else {
          console.log('[email] Sent successfully via Resend:', data?.id);
          sent = true;
          return { ok: true, info: data, provider: 'resend' };
        }
      } catch (err) {
        console.warn('[email] Resend failed:', err.message);
        errorMsg += `Resend Exception: ${err.message}; `;
      }
    }

    // 2. Fallback to Nodemailer (Gmail/SMTP) if Resend failed or is not configured
    if (!sent) {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
          const info = await transporter.sendMail({
            from: `"MediCare" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html,
          });
          console.log('[email] Sent successfully via Nodemailer:', info.messageId);
          sent = true;
          return { ok: true, info: info, provider: 'nodemailer' };
        } catch (err) {
          console.error('[email] Nodemailer failed:', err.message);
          errorMsg += `Nodemailer Exception: ${err.message}; `;
        }
      } else {
        console.warn('[email] Nodemailer skipped: EMAIL_USER/EMAIL_PASS not configured.');
      }
    }

    // 3. Last Resort: Log to console for development
    if (!sent) {
      console.log('================ EMAIL PREVIEW ================');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('--- Body ---');
      console.log(html);
      console.log('================================================');
      return { ok: false, error: errorMsg || 'No email provider configured correctly.', skipped: true };
    }

  } catch (err) {
    console.error('[email] Send failed (non-fatal):', err.message);
    return { ok: false, error: err.message };
  }
};
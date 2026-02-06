const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.sendEmail = async (to, subject, html) => {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.warn('[email] Skipping send: RESEND_API_KEY not configured');
      return { ok: false, skipped: true, reason: 'not_configured' };
    }

    console.log(`[email] Sending to: ${to}, Subject: ${subject}`);

    // Free tier must send FROM 'onboarding@resend.dev'
    const { data, error } = await resend.emails.send({
      from: 'MediCare <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('[email] Resend API Error:', error);
      return { ok: false, error: error };
    }

    console.log('[email] Sent successfully:', data?.id);
    return { ok: true, info: data };
  } catch (err) {
    console.error('[email] Send failed (non-fatal):', err.message);
    return { ok: false, error: err.message };
  }
};
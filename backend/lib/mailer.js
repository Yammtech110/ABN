'use strict';

/**
 * Brevo / SMTP mailer for OTP emails.
 * Production: codes go to the user's inbox only — never rely on in-app display.
 */
let transporter = null;

function smtpConfigured() {
  const host = (process.env.SMTP_HOST || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  if (!host) return false;
  if (!pass || /^replace/i.test(pass) || pass === 'REPLACE_BREVO_SMTP_KEY') return false;
  return true;
}

function getTransporter() {
  if (transporter) return transporter;
  if (!smtpConfigured()) return null;
  try {
    // eslint-disable-next-line global-require
    const nodemailer = require('nodemailer');
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST.trim(),
      port,
      secure,
      requireTLS: !secure && port === 587,
      auth: {
        user: (process.env.SMTP_USER || '').trim(),
        pass: (process.env.SMTP_PASS || '').trim(),
      },
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 30_000,
    });
    return transporter;
  } catch (err) {
    console.warn('[mail] nodemailer unavailable:', err.message);
    return null;
  }
}

/**
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendOtpEmail({ to, code, purpose = 'verify' }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'ABN <noreply@ahlebaitnetwork.com>';
  const subject =
    purpose === 'reset'
      ? 'ABN password reset code'
      : 'ABN email verification code';
  const intro =
    purpose === 'reset'
      ? 'Use this code to reset your Ahle Bait Network password:'
      : 'Use this code to verify your Ahle Bait Network account:';

  const text = `${intro}\n\n${code}\n\nThis code expires in 15 minutes.\nIf you did not request this, you can ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222">
      <h2 style="margin:0 0 12px;color:#1a1a1a">Ahle Bait Network</h2>
      <p style="margin:0 0 16px">${intro}</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 16px">${code}</p>
      <p style="margin:0;color:#666;font-size:13px">This code expires in 15 minutes. If you did not request this, ignore this email.</p>
    </div>`;

  if (!smtpConfigured()) {
    console.error(`[mail] SMTP not configured — cannot email OTP to ${to}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const tx = getTransporter();
  if (!tx) {
    return { sent: false, reason: 'smtp_transporter_unavailable' };
  }

  try {
    const info = await tx.sendMail({
      from,
      to,
      subject,
      text,
      html,
      headers: {
        'X-ABN-Purpose': purpose,
      },
    });
    console.log(`[mail] OTP emailed to ${to} (${purpose}) id=${info.messageId || 'n/a'}`);
    return { sent: true };
  } catch (err) {
    console.error(`[mail] failed to send to ${to}:`, err.message);
    transporter = null;
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendOtpEmail, getTransporter, smtpConfigured };

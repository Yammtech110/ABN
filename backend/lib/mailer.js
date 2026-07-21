'use strict';

/**
 * Optional SMTP mailer (nodemailer).
 * Without SMTP_HOST, callers should still log / expose OTP for QA.
 */
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  try {
    // eslint-disable-next-line global-require
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
        : undefined,
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
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@ahlebaitnetwork.com';
  const subject =
    purpose === 'reset'
      ? 'ABN password reset code'
      : 'ABN email verification code';
  const intro =
    purpose === 'reset'
      ? 'Use this code to reset your Ahle Bait Network password:'
      : 'Use this code to verify your Ahle Bait Network account:';

  const text = `${intro}\n\n${code}\n\nThis code expires in 15 minutes.\nIf you did not request this, you can ignore this email.`;
  const html = `<p>${intro}</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>This code expires in 15 minutes.</p>`;

  const tx = getTransporter();
  if (!tx) {
    console.log(`[mail] SMTP not configured — OTP for ${to} (${purpose}): ${code}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  try {
    await tx.sendMail({ from, to, subject, text, html });
    console.log(`[mail] OTP emailed to ${to} (${purpose})`);
    return { sent: true };
  } catch (err) {
    console.error(`[mail] failed to send to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendOtpEmail, getTransporter };

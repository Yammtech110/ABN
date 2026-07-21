'use strict';

/**
 * In-memory OTP codes by purpose (verify | reset).
 * Until SMTP is configured, codes are logged and may be returned to the client.
 */
const codes = new Map(); // `${purpose}:${email}` -> { code, expiresAt }

function keyFor(purpose, email) {
  return `${purpose}:${String(email).toLowerCase().trim()}`;
}

function createCode(email, purpose = 'verify') {
  const key = keyFor(purpose, email);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  codes.set(key, { code, expiresAt: Date.now() + 15 * 60 * 1000 });
  console.log(`[otp:${purpose}] code for ${email}: ${code} (valid 15m)`);
  return code;
}

/** Peek without consuming (optional). */
function peekCode(email, purpose = 'verify') {
  const entry = codes.get(keyFor(purpose, email));
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.code;
}

function verifyCode(email, code, purpose = 'verify', { consume = true } = {}) {
  const key = keyFor(purpose, email);
  const entry = codes.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    codes.delete(key);
    return false;
  }
  if (String(code).trim() !== entry.code) return false;
  if (consume) codes.delete(key);
  return true;
}

function clearCode(email, purpose = 'verify') {
  codes.delete(keyFor(purpose, email));
}

function shouldExposeOtp() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.EXPOSE_VERIFY_CODE === 'true' ||
    !process.env.SMTP_HOST
  );
}

module.exports = {
  createCode,
  peekCode,
  verifyCode,
  clearCode,
  shouldExposeOtp,
};

'use strict';

/** In-memory email OTP codes (dev + production until SMTP is wired). */
const codes = new Map(); // email -> { code, expiresAt }

function createCode(email) {
  const key = email.toLowerCase().trim();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  codes.set(key, { code, expiresAt: Date.now() + 15 * 60 * 1000 });
  console.log(`[email-verify] code for ${key}: ${code} (valid 15m)`);
  return code;
}

function verifyCode(email, code) {
  const key = email.toLowerCase().trim();
  const entry = codes.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    codes.delete(key);
    return false;
  }
  if (String(code).trim() !== entry.code) return false;
  codes.delete(key);
  return true;
}

module.exports = { createCode, verifyCode };

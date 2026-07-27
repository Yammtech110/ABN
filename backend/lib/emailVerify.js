'use strict';

/**
 * OTP codes by purpose (verify | reset).
 * Memory cache + optional Supabase persistence so Render restarts don't lose codes.
 * Codes are stored hashed (SHA-256). Plaintext is returned only to the email sender.
 * Codes are NEVER returned to the client unless EXPOSE_VERIFY_CODE=true AND not production.
 */
const crypto = require('crypto');

const codes = new Map(); // `${purpose}:${email}` -> { codeHash, expiresAt }

const OTP_TTL_MS = 15 * 60 * 1000;

function keyFor(purpose, email) {
  return `${purpose}:${String(email).toLowerCase().trim()}`;
}

function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function shouldExposeOtp() {
  // Explicit QA flag only — never in production even if mis-set
  return process.env.EXPOSE_VERIFY_CODE === 'true' && process.env.NODE_ENV !== 'production';
}

function getAdmin() {
  try {
    const { isSupabaseStorage } = require('../config/storage');
    if (!isSupabaseStorage()) return null;
    return require('../supabase').supabaseAdmin;
  } catch {
    return null;
  }
}

async function persistVerifyOtp(email, codeHash, expiresAt) {
  const admin = getAdmin();
  if (!admin) return;
  const key = String(email).toLowerCase().trim();
  const { error } = await admin
    .from('app_users')
    .update({
      email_otp: codeHash,
      email_otp_expires: new Date(expiresAt).toISOString(),
    })
    .eq('email', key);
  if (error) {
    // Column may not exist until migration 012 — keep memory fallback
    console.warn('[otp] persist failed (run 012_email_otp.sql if needed):', error.message);
  }
}

async function clearPersistedVerifyOtp(email) {
  const admin = getAdmin();
  if (!admin) return;
  const key = String(email).toLowerCase().trim();
  await admin
    .from('app_users')
    .update({ email_otp: null, email_otp_expires: null })
    .eq('email', key)
    .then(() => {})
    .catch(() => {});
}

async function readPersistedVerifyOtp(email) {
  const admin = getAdmin();
  if (!admin) return null;
  const key = String(email).toLowerCase().trim();
  const { data, error } = await admin
    .from('app_users')
    .select('email_otp, email_otp_expires')
    .eq('email', key)
    .maybeSingle();
  if (error || !data?.email_otp) return null;
  const expiresAt = data.email_otp_expires ? new Date(data.email_otp_expires).getTime() : 0;
  if (!expiresAt || Date.now() > expiresAt) return null;
  return { codeHash: String(data.email_otp), expiresAt };
}

async function createCode(email, purpose = 'verify') {
  const key = keyFor(purpose, email);
  const code = generateOtp();
  const codeHash = hashOtp(code);
  const expiresAt = Date.now() + OTP_TTL_MS;
  codes.set(key, { codeHash, expiresAt });
  if (purpose === 'verify') {
    await persistVerifyOtp(email, codeHash, expiresAt);
  }
  if (shouldExposeOtp()) {
    console.log(`[otp:${purpose}] QA code for ${email}: ${code} (valid 15m)`);
  } else {
    console.log(`[otp:${purpose}] code created for ${email} (email delivery only)`);
  }
  return code;
}

function peekCode() {
  // Intentionally disabled — never return plaintext OTP from storage
  return null;
}

async function verifyCode(email, code, purpose = 'verify', { consume = true } = {}) {
  const mapKey = keyFor(purpose, email);
  let entry = codes.get(mapKey);

  if ((!entry || Date.now() > entry.expiresAt) && purpose === 'verify') {
    entry = await readPersistedVerifyOtp(email);
    if (entry) codes.set(mapKey, entry);
  }

  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    codes.delete(mapKey);
    if (purpose === 'verify') await clearPersistedVerifyOtp(email);
    return false;
  }

  const incoming = String(code).trim();
  const stored = entry.codeHash || entry.code || '';
  let ok = false;
  if (/^\d{6}$/.test(stored)) {
    // Legacy plaintext rows (pre-hash migration)
    ok = stored === incoming;
  } else {
    ok = stored === hashOtp(incoming);
  }
  if (!ok) return false;

  if (consume) {
    codes.delete(mapKey);
    if (purpose === 'verify') await clearPersistedVerifyOtp(email);
  }
  return true;
}

async function clearCode(email, purpose = 'verify') {
  codes.delete(keyFor(purpose, email));
  if (purpose === 'verify') await clearPersistedVerifyOtp(email);
}

module.exports = {
  createCode,
  peekCode,
  verifyCode,
  clearCode,
  shouldExposeOtp,
};

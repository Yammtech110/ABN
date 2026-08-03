'use strict';

/**
 * OTP codes by purpose (verify | reset).
 * Memory cache + Supabase persistence so Render restarts don't lose codes.
 * Codes are stored hashed (SHA-256). Plaintext is returned only to the email sender.
 * Codes are NEVER returned to the client unless EXPOSE_VERIFY_CODE=true AND not production.
 */
const crypto = require('crypto');

const codes = new Map(); // `${purpose}:${email}` -> { codeHash, expiresAt, purpose }

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

function smtpMissing() {
  const host = (process.env.SMTP_HOST || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  if (!host) return true;
  if (!pass || /^replace/i.test(pass) || pass === 'REPLACE_BREVO_SMTP_KEY') return true;
  return false;
}

function shouldExposeOtp() {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.EXPOSE_VERIFY_CODE === 'true' || smtpMissing();
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

/** Store as "purpose:hash" so verify + reset can share email_otp columns safely */
function packPersisted(purpose, codeHash) {
  return `${purpose}:${codeHash}`;
}

function unpackPersisted(raw) {
  const value = String(raw || '');
  const idx = value.indexOf(':');
  if (idx <= 0) {
    // Legacy rows were verify-only plain hashes
    return { purpose: 'verify', codeHash: value };
  }
  return {
    purpose: value.slice(0, idx),
    codeHash: value.slice(idx + 1),
  };
}

async function persistOtp(email, purpose, codeHash, expiresAt) {
  const admin = getAdmin();
  if (!admin) return;
  const key = String(email).toLowerCase().trim();
  const { error } = await admin
    .from('app_users')
    .update({
      email_otp: packPersisted(purpose, codeHash),
      email_otp_expires: new Date(expiresAt).toISOString(),
    })
    .eq('email', key);
  if (error) {
    console.warn('[otp] persist failed (run 012_email_otp.sql if needed):', error.message);
  }
}

async function clearPersistedOtp(email) {
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

async function readPersistedOtp(email, purpose) {
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
  const unpacked = unpackPersisted(data.email_otp);
  if (unpacked.purpose !== purpose) return null;
  if (!unpacked.codeHash) return null;
  return { codeHash: String(unpacked.codeHash), expiresAt };
}

async function createCode(email, purpose = 'verify') {
  const key = keyFor(purpose, email);
  const code = generateOtp();
  const codeHash = hashOtp(code);
  const expiresAt = Date.now() + OTP_TTL_MS;
  codes.set(key, { codeHash, expiresAt, purpose });
  // Persist verify AND reset so Render restarts / multi-instance keep working
  await persistOtp(email, purpose, codeHash, expiresAt);
  if (shouldExposeOtp()) {
    console.log(`[otp:${purpose}] QA code for ${email}: ${code} (valid 15m)`);
  } else {
    console.log(`[otp:${purpose}] code created for ${email} (email delivery only)`);
  }
  return code;
}

function peekCode() {
  return null;
}

async function verifyCode(email, code, purpose = 'verify', { consume = true } = {}) {
  const mapKey = keyFor(purpose, email);
  let entry = codes.get(mapKey);

  if (!entry || Date.now() > entry.expiresAt) {
    entry = await readPersistedOtp(email, purpose);
    if (entry) codes.set(mapKey, entry);
  }

  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    codes.delete(mapKey);
    await clearPersistedOtp(email);
    return false;
  }

  const incoming = String(code).trim();
  const stored = entry.codeHash || entry.code || '';
  let ok = false;
  if (/^\d{6}$/.test(stored)) {
    ok = stored === incoming;
  } else {
    ok = stored === hashOtp(incoming);
  }
  if (!ok) return false;

  if (consume) {
    codes.delete(mapKey);
    await clearPersistedOtp(email);
  }
  return true;
}

async function clearCode(email, purpose = 'verify') {
  codes.delete(keyFor(purpose, email));
  await clearPersistedOtp(email);
}

module.exports = {
  createCode,
  peekCode,
  verifyCode,
  clearCode,
  shouldExposeOtp,
};

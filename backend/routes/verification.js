/**
 * routes/verification.js
 *
 * POST /api/verification/send-otp   — issue a 6-digit SMS-style code (in-memory)
 * POST /api/verification/verify-otp — validate code before business registration
 */

'use strict';

const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

/** @type {Map<string, { code: string, expiresAt: number, verified: boolean, userEmail: string }>} */
const otpStore = new Map();

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `1${digits}`;
  return digits;
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// ── POST /api/verification/send-otp ───────────────────────────────────────
router.post('/send-otp', authenticate, (req, res) => {
  const normalized = normalizePhone(req.body.phone);

  if (normalized.length !== 11 || !normalized.startsWith('1')) {
    return res.status(400).json({ error: 'Phone number must be exactly 11 digits in US format (+1 followed by 10 digits).' });
  }

  const existing = otpStore.get(normalized);
  if (existing && existing.lastSentAt && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${waitSec}s before requesting another code.` });
  }

  const code = generateOtp();
  otpStore.set(normalized, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    verified: false,
    userEmail: req.user.email,
    lastSentAt: Date.now(),
  });

  console.log(`[OTP] Phone +${normalized} → code ${code} (user: ${req.user.email})`);

  const payload = {
    success: true,
    message: 'Verification code sent to your phone number.',
    expiresInSeconds: OTP_TTL_MS / 1000,
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.demoOtp = code;
  }

  res.json(payload);
});

// ── POST /api/verification/verify-otp ─────────────────────────────────────
router.post('/verify-otp', authenticate, (req, res) => {
  const normalized = normalizePhone(req.body.phone);
  const submitted = String(req.body.code || '').trim();

  if (normalized.length !== 11 || !normalized.startsWith('1')) {
    return res.status(400).json({ error: 'Invalid phone number.' });
  }
  if (!/^\d{6}$/.test(submitted)) {
    return res.status(400).json({ error: 'Verification code must be 6 digits.' });
  }

  const record = otpStore.get(normalized);
  if (!record) {
    return res.status(400).json({ error: 'No verification code found. Tap Send OTP first.' });
  }
  if (record.userEmail !== req.user.email) {
    return res.status(403).json({ error: 'This verification code belongs to another session.' });
  }
  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalized);
    return res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
  }
  if (record.code !== submitted) {
    return res.status(400).json({ error: 'Invalid verification code. Please try again.' });
  }

  record.verified = true;
  record.verifiedAt = Date.now();

  res.json({ success: true, verified: true, phone: `+${normalized}` });
});

/** Used by directory route guard if needed */
const isPhoneVerified = (phone, userEmail) => {
  const record = otpStore.get(normalizePhone(phone));
  return Boolean(record?.verified && record.userEmail === userEmail && Date.now() <= record.expiresAt + 60000);
};

const consumePhoneVerification = (phone) => {
  otpStore.delete(normalizePhone(phone));
};

module.exports = router;
module.exports.isPhoneVerified = isPhoneVerified;
module.exports.consumePhoneVerification = consumePhoneVerification;
module.exports.normalizePhone = normalizePhone;

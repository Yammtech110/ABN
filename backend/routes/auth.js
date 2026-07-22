/**
 * routes/auth.js — JWT auth with Supabase-persisted users (app_users table)
 */

'use strict';

const crypto = require('crypto');
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { stableId } = require('../lib/memoryStore');
const { findByEmail, findById, createUser, updateUser, deleteUser, listAllUsers, setUserBlocked } = require('../lib/userStore');
const { createNotification } = require('../lib/notificationStore');
const { userOwnsDirectoryProfile, findProfileForUser, findProfileByEmail } = require('../lib/profileStore');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { createCode, verifyCode, clearCode, shouldExposeOtp } = require('../lib/emailVerify');
const { sendOtpEmail } = require('../lib/mailer');
const { listBlockedUserIds, blockUser, unblockUser } = require('../lib/blockStore');

const router         = express.Router();
const { JWT_SECRET } = require('../config/security');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const HASH_ROUNDS    = 12;
const SUPPORT_EMAIL  = process.env.SUPPORT_EMAIL || 'support@ahlebaitnetwork.com';

const VALID_ROLES = ['customer', 'business', 'service_provider', 'admin'];

// Roles a user may pick for themselves at registration.
// 'admin' is deliberately excluded — admin accounts are provisioned server-side only.
const SELF_REGISTER_ROLES = ['customer', 'business', 'service_provider'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LEN = 200;

const mapUser = (u) => ({
  id:                u.id,
  email:             u.email,
  phone:             u.phone,
  name:              u.name,
  role:              u.role,
  preferredLanguage: u.preferredLanguage,
  isBlocked:         Boolean(u.isBlocked),
  emailVerified:     u.emailVerified !== false,
});

const ROLE_LABELS = {
  admin:             'Admin',
  customer:          'Customer',
  business:          'Business Owner',
  service_provider:  'Service Provider',
};

/** Build login/register payload — only business/service_provider users hit profiles_directory. */
async function buildAuthResponse(user, token) {
  const body = { token, user: mapUser(user) };

  if (userOwnsDirectoryProfile(user.role)) {
    const profile = await findProfileForUser(user);
    body.profile = profile ?? null;
  }

  return body;
}

// ── POST /api/auth/register ───────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { email, phone, name, role = 'customer', password } = req.body;

    if (!email || !name || !phone || !password) {
      return res.status(400).json({ error: 'name, email, phone and password are required.' });
    }
    if (typeof email !== 'string' || typeof name !== 'string' || typeof password !== 'string' || typeof phone !== 'string') {
      return res.status(400).json({ error: 'name, email, phone and password must be strings.' });
    }

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedEmail || !trimmedName || !trimmedPhone) {
      return res.status(400).json({ error: 'name, email and phone cannot be empty.' });
    }
    if (!EMAIL_RE.test(trimmedEmail) || trimmedEmail.length > MAX_FIELD_LEN) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (trimmedName.length > MAX_FIELD_LEN || trimmedPhone.length > MAX_FIELD_LEN) {
      return res.status(400).json({ error: 'name and phone must be at most 200 characters.' });
    }
    if (!SELF_REGISTER_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${SELF_REGISTER_ROLES.join(', ')}` });
    }
    if (password.length < 6 || password.length > MAX_FIELD_LEN) {
      return res.status(400).json({ error: 'Password must be between 6 and 200 characters.' });
    }

    const key = trimmedEmail.toLowerCase();

    if (await findByEmail(key)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, HASH_ROUNDS);
    const id = stableId(role, key);

    const record = await createUser({
      id,
      email: key,
      phone: trimmedPhone,
      name: trimmedName,
      role,
      passwordHash,
      preferredLanguage: 'en',
      emailVerified: false,
    });

    const demoCode = createCode(key, 'verify');
    await sendOtpEmail({ to: key, code: demoCode, purpose: 'verify' });

    try {
      await createNotification({
        userId: id,
        receiverRole: role,
        title: 'Verify your email',
        message: `Assalamu Alaykum, ${trimmedName}. Enter the 6-digit code to verify your ABN account.`,
      });
    } catch {
      // non-fatal
    }

    // No session token until email is verified
    const payload = {
      needsEmailVerification: true,
      email: key,
      message: `We sent a verification code. If you do not receive email, contact ${SUPPORT_EMAIL}.`,
    };
    // Expose code when SMTP is not configured (common on free Render) so QA / reviewers can finish signup
    if (shouldExposeOtp()) {
      payload.verificationCode = demoCode;
    }

    res.status(201).json(payload);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/verify-email ───────────────────────────────────────────
router.post('/verify-email', async (req, res, next) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'email and code are required.' });
    }
    const key = String(email).toLowerCase().trim();
    const user = await findByEmail(key);
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    if (user.emailVerified !== false) {
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );
      return res.json(await buildAuthResponse(user, token));
    }

    if (!verifyCode(key, code, 'verify')) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    const updated = await updateUser(user.id, { emailVerified: true });
    const token = jwt.sign(
      { id: updated.id, email: updated.email, role: updated.role, name: updated.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );
    res.json(await buildAuthResponse(updated, token));
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/resend-verification ────────────────────────────────────
router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required.' });
    const key = String(email).toLowerCase().trim();
    const user = await findByEmail(key);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    if (user.emailVerified !== false) {
      return res.json({ message: 'Email already verified.' });
    }
    const demoCode = createCode(key, 'verify');
    await sendOtpEmail({ to: key, code: demoCode, purpose: 'verify' });
    const body = { message: `Verification code resent. Contact ${SUPPORT_EMAIL} if needed.` };
    if (shouldExposeOtp()) {
      body.verificationCode = demoCode;
    }
    res.json(body);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/oauth-sync ─────────────────────────────────────────────
// Links a Supabase Google/Apple OAuth session to app_users (first sign-in creates the row).
router.post('/oauth-sync', authenticate, async (req, res, next) => {
  try {
    const email = req.user.email?.toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ error: 'OAuth account has no email address.' });
    }

    let user = await findByEmail(email);
    const isNewUser = !user;

    if (!user) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), HASH_ROUNDS);
      user = await createUser({
        id: req.user.id || stableId('customer', email),
        email,
        phone: '',
        name: req.user.name || email.split('@')[0],
        role: 'customer',
        passwordHash,
        preferredLanguage: 'en',
        emailVerified: true,
      });
    }

    res.json({ user: mapUser(user), isNewUser });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    const key  = email.toLowerCase().trim();
    const user = await findByEmail(key);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: `This account has been blocked. Contact ${SUPPORT_EMAIL}.` });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.emailVerified === false) {
      const demoCode = createCode(key, 'verify');
      await sendOtpEmail({ to: key, code: demoCode, purpose: 'verify' });
      const body = {
        needsEmailVerification: true,
        email: key,
        error: 'Email not verified. Enter the code sent to your email.',
      };
      if (shouldExposeOtp()) {
        body.verificationCode = demoCode;
      }
      return res.status(403).json(body);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.json(await buildAuthResponse(user, token));
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required.' });
    }
    const key = email.toLowerCase().trim();
    if (!EMAIL_RE.test(key)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const user = await findByEmail(key);
    // Always respond similarly to avoid account enumeration, but only send when user exists
    const payload = {
      message: `If an account exists for that email, a reset code was sent. Contact ${SUPPORT_EMAIL} if needed.`,
      email: key,
    };

    if (user && !user.isBlocked) {
      const code = createCode(key, 'reset');
      await sendOtpEmail({ to: key, code, purpose: 'reset' });
      try {
        await createNotification({
          userId: user.id,
          receiverRole: user.role,
          title: 'Password reset code',
          message: 'A password reset code was requested for your ABN account.',
        });
      } catch {
        // non-fatal
      }
      if (shouldExposeOtp()) {
        payload.resetCode = code;
      }
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/verify-reset-code ──────────────────────────────────────
router.post('/verify-reset-code', async (req, res, next) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'email and code are required.' });
    }
    const key = String(email).toLowerCase().trim();
    const user = await findByEmail(key);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ error: `This account has been blocked. Contact ${SUPPORT_EMAIL}.` });
    }

    // Do not consume yet — final step (reset-password) consumes the code
    if (!verifyCode(key, code, 'reset', { consume: false })) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }

    const resetToken = jwt.sign(
      { id: user.id, email: user.email, purpose: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '15m' },
    );

    res.json({
      verified: true,
      resetToken,
      email: key,
      message: 'Code verified. Choose a new password or keep your current one.',
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────
// After OTP: either set a new password or keep the current one, then sign in.
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, code, resetToken, action, newPassword } = req.body || {};
    const keepCurrent = action === 'keep';

    if (!keepCurrent && action !== 'change') {
      return res.status(400).json({ error: 'action must be "change" or "keep".' });
    }
    if (!keepCurrent) {
      if (!newPassword || typeof newPassword !== 'string') {
        return res.status(400).json({ error: 'newPassword is required when changing password.' });
      }
      if (newPassword.length < 6 || newPassword.length > MAX_FIELD_LEN) {
        return res.status(400).json({ error: 'Password must be between 6 and 200 characters.' });
      }
    }

    let user = null;

    if (resetToken && typeof resetToken === 'string') {
      let payload;
      try {
        payload = jwt.verify(resetToken, JWT_SECRET);
      } catch {
        return res.status(400).json({ error: 'Reset session expired. Request a new code.' });
      }
      if (payload.purpose !== 'password_reset' || !payload.id) {
        return res.status(400).json({ error: 'Invalid reset session.' });
      }
      user = await findById(payload.id);
      if (!user) return res.status(404).json({ error: 'Account not found.' });

      if (code) {
        if (!verifyCode(user.email, code, 'reset', { consume: true })) {
          return res.status(400).json({ error: 'Invalid or expired reset code.' });
        }
      } else {
        clearCode(user.email, 'reset');
      }
    } else {
      if (!email || !code) {
        return res.status(400).json({ error: 'email and code (or resetToken) are required.' });
      }
      const key = String(email).toLowerCase().trim();
      user = await findByEmail(key);
      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired reset code.' });
      }
      if (!verifyCode(key, code, 'reset', { consume: true })) {
        return res.status(400).json({ error: 'Invalid or expired reset code.' });
      }
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: `This account has been blocked. Contact ${SUPPORT_EMAIL}.` });
    }

    let updated = user;
    if (!keepCurrent) {
      updated = await updateUser(user.id, {
        passwordHash: await bcrypt.hash(newPassword, HASH_ROUNDS),
      });
      if (!updated) return res.status(404).json({ error: 'Account not found.' });
    }

    const token = jwt.sign(
      { id: updated.id, email: updated.email, role: updated.role, name: updated.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.json(await buildAuthResponse(updated, token));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/users — admin directory member list ─────────────────────
router.get('/users', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    const allUsers = await listAllUsers();
    const rows = await Promise.all(allUsers.map(async (user) => {
      // Customers can own a directory listing after "Register as Business/Service"
      const profile = await findProfileByEmail(user.email);

      const roleLabel = ROLE_LABELS[user.role] || user.role;
      const listingName = profile?.businessName?.trim() || null;

      return {
        ...mapUser(user),
        roleLabel,
        listingName,
        listingStatus: listingName
          ? `${roleLabel} • ${listingName} linked`
          : `${roleLabel} • No active business listings`,
      };
    }));

    res.json({ users: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/auth/users/:id/block — admin block / unblock ───────────────
router.patch('/users/:id/block', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { blocked } = req.body;

    if (typeof blocked !== 'boolean') {
      return res.status(400).json({ error: 'blocked (boolean) is required.' });
    }

    if (req.user.id === id) {
      return res.status(400).json({ error: 'You cannot block your own admin account.' });
    }

    const user = await setUserBlocked(id, blocked);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({ user: mapUser(user) });
  } catch (err) {
    next(err);
  }
});

// ── Peer block list ───────────────────────────────────────────────────────
router.get('/blocks', authenticate, async (req, res, next) => {
  try {
    const ids = await listBlockedUserIds(req.user.id);
    res.json({ blockedUserIds: ids });
  } catch (err) {
    next(err);
  }
});

router.post('/blocks', authenticate, async (req, res, next) => {
  try {
    const { userId, email } = req.body || {};
    let targetId = typeof userId === 'string' ? userId : '';
    if (!targetId && typeof email === 'string' && email.trim()) {
      const u = await findByEmail(email.trim().toLowerCase());
      if (!u) return res.status(404).json({ error: 'User not found for that listing owner.' });
      targetId = u.id;
    }
    if (!targetId) {
      return res.status(400).json({ error: 'userId or email is required.' });
    }
    const ids = await blockUser(req.user.id, targetId);
    res.status(201).json({ blockedUserIds: ids, blockedUserId: targetId });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.delete('/blocks/:userId', authenticate, async (req, res, next) => {
  try {
    const ids = await unblockUser(req.user.id, req.params.userId);
    res.json({ blockedUserIds: ids });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(mapUser(user));
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/auth/me ──────────────────────────────────────────────────────
router.put('/me', authenticate, async (req, res, next) => {
  try {
    const { name, phone, preferredLanguage } = req.body;
    const user = await updateUser(req.user.id, { name, phone, preferredLanguage });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(mapUser(user));
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/auth/me — self-serve account deletion (Apple 5.1.1v) ───────
router.delete('/me', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(400).json({ error: 'Admin accounts cannot be self-deleted. Contact operations.' });
    }
    const ok = await deleteUser(req.user.id);
    if (!ok) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, message: 'Account deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

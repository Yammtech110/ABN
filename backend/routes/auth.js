/**
 * routes/auth.js — JWT auth with Supabase-persisted users (app_users table)
 */

'use strict';

const crypto = require('crypto');
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { stableId } = require('../lib/memoryStore');
const { findByEmail, findById, createUser, updateUser, listAllUsers, setUserBlocked } = require('../lib/userStore');
const { createNotification } = require('../lib/notificationStore');
const { userOwnsDirectoryProfile, findProfileForUser, findProfileByEmail } = require('../lib/profileStore');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router         = express.Router();
const { JWT_SECRET } = require('../config/security');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const HASH_ROUNDS    = 12;

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
    });

    const token = jwt.sign({ id, email: key, role, name: trimmedName }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    try {
      await createNotification({
        userId: id,
        receiverRole: role,
        title: 'Welcome to ABN',
        message: `Assalamu Alaykum, ${trimmedName}. Your account was created successfully.`,
      });
    } catch {
      // non-fatal
    }

    res.status(201).json(await buildAuthResponse(record, token));
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
      return res.status(403).json({ error: 'This account has been blocked. Contact support for assistance.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
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

// ── GET /api/auth/users — admin directory member list ─────────────────────
router.get('/users', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    const allUsers = await listAllUsers();
    const rows = await Promise.all(allUsers.map(async (user) => {
      const profile = userOwnsDirectoryProfile(user.role)
        ? await findProfileByEmail(user.email)
        : null;

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

module.exports = router;

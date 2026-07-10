/**
 * routes/auth.js — JWT auth with Supabase-persisted users (app_users table)
 */

'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { stableId } = require('../lib/memoryStore');
const { findByEmail, findById, createUser, updateUser } = require('../lib/userStore');
const { userOwnsDirectoryProfile, findProfileForUser } = require('../lib/profileStore');
const { authenticate } = require('../middleware/authMiddleware');

const router         = express.Router();
const JWT_SECRET     = process.env.JWT_SECRET     || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const HASH_ROUNDS    = 12;

const VALID_ROLES = ['customer', 'business', 'service_provider', 'admin'];

const mapUser = (u) => ({
  id:                u.id,
  email:             u.email,
  phone:             u.phone,
  name:              u.name,
  role:              u.role,
  preferredLanguage: u.preferredLanguage,
});

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
    const { email, phone = '', name, role = 'customer', password } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'email, name and password are required.' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const key = email.toLowerCase().trim();
    if (await findByEmail(key)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, HASH_ROUNDS);
    const id = stableId(role, key);

    const record = await createUser({
      id,
      email: key,
      phone,
      name,
      role,
      passwordHash,
      preferredLanguage: 'en',
    });

    const token = jwt.sign({ id, email: key, role, name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json(await buildAuthResponse(record, token));
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    const key  = email.toLowerCase().trim();
    const user = await findByEmail(key);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
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

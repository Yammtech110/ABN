/**
 * server.js — ABN Community Backend
 *
 * Stack:  Node.js · Express · Supabase (PostgreSQL) · JWT
 *         STORAGE_MODE=supabase persists auth, directory, jobs, reviews
 *
 * Run:    node server.js          (production)
 *         npx nodemon server.js   (development with auto-reload)
 */

'use strict';

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');

const { STORAGE_MODE, isSupabaseStorage, storageMeta, verifySupabaseConnection } = require('./config/storage');
const { supabaseAdmin } = require('./supabase');
const { applyMigrations } = require('./scripts/apply-migrations');
const { seedDemoAccounts } = require('./lib/userStore');

const app = express();

// ── Rate limiting ──────────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP. Please try again after 15 minutes.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes before trying again.' },
  skipSuccessfulRequests: true,
});

app.use(globalLimiter);

// ── Security & middleware ──────────────────────────────────────────────────

app.use(helmet());

// Global mobile + web — JWT in Authorization header (no cookies), so origin * is safe
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Allow up to 10 MB JSON bodies so base64 images from the image picker work
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Routes ─────────────────────────────────────────────────────────────────

// Strict rate limit on auth mutation endpoints
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/verification/send-otp', authLimiter);

// Auth — JWT + bcrypt, persisted in Supabase app_users (or memory fallback)
app.use('/api/auth',      require('./routes/auth'));

// Directory & Jobs — Supabase-backed (profiles_directory + jobs_board tables)
app.use('/api/directory', require('./routes/directory'));
app.use('/api/jobsboard', require('./routes/jobsBoard'));

// Reviews — Supabase business_reviews (or memory fallback)
app.use('/api/reviews', require('./routes/reviews'));

// Phone OTP — in-memory verification before business registration
app.use('/api/verification', require('./routes/verification'));

// ── Health check ───────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  let supabaseStatus = 'unchecked';
  try {
    const { error } = await supabaseAdmin
      .from('profiles_directory')
      .select('*')
      .limit(1);
    supabaseStatus = error ? `error: ${error.message}` : 'connected';
  } catch (e) {
    supabaseStatus = `error: ${e.message}`;
  }

  res.json({
    status:    'ok',
    service:   'ABN Community API',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
    storage:   STORAGE_MODE,
    supabase:  supabaseStatus,
  });
});

// ── API overview ───────────────────────────────────────────────────────────

app.get('/api', (_req, res) => {
  const meta = storageMeta();
  res.json({
    message: 'ABN Community Directory API',
    version: '2.0.0',
    storageMode: meta.mode,
    storage: {
      auth:      meta.auth,
      directory: meta.directory,
      jobs:      meta.jobs,
      reviews:   meta.reviews,
    },
    endpoints: {
      auth:      '/api/auth      — POST /register  POST /login  GET /me  PUT /me',
      directory: '/api/directory — GET /  GET /mine  GET /:id  POST /  PUT /:id  DELETE /:id  PUT /:id/hiring',
      jobsboard: '/api/jobsboard — GET /  GET /mine  GET /:id  POST /  PUT /:id  DELETE /:id',
      reviews:   '/api/reviews   — GET /?businessId=  POST /',
      verification: '/api/verification — POST /send-otp  POST /verify-otp',
      health:    '/api/health    — GET /',
    },
    demoAccounts: [
      'admin@shiadirectory.com     / admin123     (role: admin)',
    ],
  });
});

// ── 404 handler ────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// ── Global error handler ───────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    console.error(`[ERROR] ${err.status || 500} — ${err.message}`);
  } else {
    console.error('[ERROR]', err.stack || err.message);
  }

  const status = typeof err.status === 'number' ? err.status : 500;
  res.status(status).json({
    error: isProd
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'Internal server error',
    ...(isProd ? {} : { detail: err.code || undefined }),
  });
});

// ── Start ──────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3001', 10);
const LAN_HOST = process.env.LAN_HOST || '192.168.100.13';

// Wait for Supabase verify, optional migrate, auth seed, then listen
(async () => {
  try {
    if (isSupabaseStorage()) {
      const migrateResult = await applyMigrations();
      if (!migrateResult.applied) {
        console.warn(`[storage] ${migrateResult.message}`);
      }
      await verifySupabaseConnection(supabaseAdmin);
      console.log(`[storage] Supabase persistent mode active (${STORAGE_MODE})`);
    } else {
      console.warn('[storage] In-memory mode — data will NOT persist across restarts.');
      console.warn('[storage] Set STORAGE_MODE=supabase and Supabase env vars to enable persistence.');
    }

    await seedDemoAccounts();

    app.listen(PORT, '0.0.0.0', () => {
      const publicUrl = process.env.RENDER_EXTERNAL_URL
        || process.env.API_PUBLIC_URL
        || `http://${LAN_HOST}:${PORT}`;
      console.log(`\n🚀  ABN Community API  →  ${publicUrl}/api`);
      console.log(`    Storage mode       →  ${STORAGE_MODE}`);
      console.log(`    Health check       →  ${publicUrl}/api/health`);
      console.log(`    Environment        →  ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (err) {
    console.error('\n❌  Server failed to start:', err.message);
    process.exit(1);
  }
})();

module.exports = app;

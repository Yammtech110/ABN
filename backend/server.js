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

// ── Last-resort crash guards ───────────────────────────────────────────────
// Keep the process alive on programmer errors that escape route handlers.
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception (process kept alive):', err.stack || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection (process kept alive):', reason);
});

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');

const { STORAGE_MODE, isSupabaseStorage, storageMeta, verifySupabaseConnection } = require('./config/storage');
const { supabaseAdmin } = require('./supabase');
const { applyMigrations } = require('./scripts/apply-migrations');
const { seedDemoAccounts } = require('./lib/userStore');
const { seedDefaultCategories } = require('./lib/categoryStore');

const app = express();

// Behind Render/Vercel/other proxies the client IP is in X-Forwarded-For.
// Without this, express-rate-limit sees every request as coming from the proxy
// and either rate-limits all users together or not at all. Trust one hop.
app.set('trust proxy', 1);

// ── Rate limiting ──────────────────────────────────────────────────────────
// Relaxed in local development so repeated login/testing is not blocked.

const isProduction = process.env.NODE_ENV === 'production';
const skipRateLimitInDev = () => !isProduction;

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 10_000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimitInDev,
  message: { error: 'Too many requests from this IP. Please try again after 15 minutes.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 10 : 1_000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimitInDev,
  message: { error: 'Too many login attempts. Please wait 15 minutes before trying again.' },
  skipSuccessfulRequests: true,
});

app.use(globalLimiter);

// ── Security & middleware ──────────────────────────────────────────────────

// cross-origin so Capacitor / separate API hosts can load streamed listing images in <img>
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Global mobile + web — JWT in Authorization header (no cookies), so origin * is safe
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Allow up to 10 MB JSON bodies so base64 images from the image picker work
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Routes ─────────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    message: 'ABN Community API is running.',
    app: 'Open the web app at http://localhost:3000',
    health: '/api/health',
    docs: '/api',
  });
});

// Strict rate limit on auth mutation endpoints
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/verify-reset-code', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
// Auth — JWT + bcrypt, persisted in Supabase app_users (or memory fallback)
app.use('/api/auth',      require('./routes/auth'));

// Directory & Jobs — Supabase-backed (profiles_directory + jobs_board tables)
app.use('/api/directory', require('./routes/directory'));
app.use('/api/jobsboard', require('./routes/jobsBoard'));

// Reviews — Supabase business_reviews (or memory fallback)
app.use('/api/reviews', require('./routes/reviews'));

// Membership payments — Supabase membership_payments (or memory fallback)
app.use('/api/payments', require('./routes/payments'));

// Saved favorites — Supabase user_favorites (or memory fallback)
app.use('/api/favorites', require('./routes/favorites'));

// Community integrity reports — flagged listings
app.use('/api/reports', require('./routes/reports'));

// Categories + notifications + device push tokens
app.use('/api/categories', require('./routes/categories'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/devices', require('./routes/devices'));

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
      favorites: meta.favorites,
    },
    endpoints: {
      auth:      '/api/auth      — POST /register  POST /login  POST /oauth-sync  GET /me  PUT /me',
      directory: '/api/directory — GET /  GET /mine  GET /:id  POST /  PUT /:id  DELETE /:id  PUT /:id/hiring',
      jobsboard: '/api/jobsboard — GET /  GET /mine  GET /:id  POST /  PUT /:id  DELETE /:id',
      reviews:   '/api/reviews   — GET /?businessId=  POST /',
      payments:  '/api/payments  — GET /  GET /ledger  GET /mine  POST /renew',
      favorites: '/api/favorites — GET /  POST /:businessId  DELETE /:businessId',
      reports:   '/api/reports   — GET /  POST /  PATCH /:id/resolve',
      notifications: '/api/notifications — GET /  POST /  PATCH /read-all  DELETE /',
      devices:   '/api/devices   — POST /register  DELETE /register (FCM push tokens)',
      health:    '/api/health    — GET /',
    },
  });
});

// ── 404 handler ────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, _req, res, next) => {
  // If a response is already streaming, delegate to Express's default handler
  if (res.headersSent) return next(err);

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

// Wait for Supabase verify, optional migrate, auth seed, then listen.
// Every startup step is individually guarded so one failure never prevents
// the server from listening — degraded mode beats a dead process.
(async () => {
  if (isSupabaseStorage()) {
    try {
      const migrateResult = await applyMigrations();
      if (!migrateResult.applied) {
        console.warn(`[storage] ${migrateResult.message}`);
      }
      await verifySupabaseConnection(supabaseAdmin);
      console.log(`[storage] Supabase persistent mode active (${STORAGE_MODE})`);
    } catch (err) {
      console.error('[storage] Supabase setup failed — continuing in degraded mode:', err.message);
    }
  } else {
    console.warn('[storage] In-memory mode — data will NOT persist across restarts.');
    console.warn('[storage] Set STORAGE_MODE=supabase and Supabase env vars to enable persistence.');
  }

  try {
    await seedDemoAccounts();
  } catch (err) {
    console.error('[db] Demo account seeding failed — continuing without seeds:', err.message);
  }

  try {
    await seedDefaultCategories();
  } catch (err) {
    console.error('[db] Category seed failed:', err.message);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    const publicUrl = process.env.RENDER_EXTERNAL_URL
      || process.env.API_PUBLIC_URL
      || `http://${LAN_HOST}:${PORT}`;
    console.log(`\n🚀  ABN Community API  →  ${publicUrl}/api`);
    console.log(`    Storage mode       →  ${STORAGE_MODE}`);
    console.log(`    Health check       →  ${publicUrl}/api/health`);
    console.log(`    Environment        →  ${process.env.NODE_ENV || 'development'}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[FATAL] Port ${PORT} is already in use. Stop the other process or set PORT to a free port.`);
    } else {
      console.error('[FATAL] Server error:', err.message);
    }
    process.exit(1);
  });
})();

module.exports = app;

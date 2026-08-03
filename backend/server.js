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
// Fail fast on missing/weak secrets before mounting routes
require('./config/security');

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
// Important: many phones on the same Wi‑Fi share one public IP. With auto-refresh
// + listing images, a low per-IP cap makes the app look like it "crashes" after
// a few concurrent users. Keep abuse protection, but allow real community load.

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
const isTest = process.env.NODE_ENV === 'test';
// Always rate-limit outside automated tests (including local / mis-set NODE_ENV on Render).
const skipGlobalRateLimit = () => isTest;
const skipAuthRateLimit = () => isTest;

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // ~3–5k req / 15 min per IP covers shared Wi‑Fi + images + polling
  max: isProduction ? Number(process.env.RATE_LIMIT_MAX || 3000) : 10_000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (skipGlobalRateLimit()) return true;
    const path = String(req.originalUrl || req.url || req.path || '').split('?')[0];
    // Health + static listing images should never trip the shared-IP limiter
    if (path === '/api/health' || path === '/health') return true;
    if (/^\/api\/directory\/[^/]+\/(logo|cover)$/.test(path)) return true;
    return false;
  },
  message: { error: 'Too many requests from this network. Please wait a minute and try again.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Several people logging in from the same cafe/office Wi‑Fi
  max: isProduction ? Number(process.env.AUTH_RATE_LIMIT_MAX || 60) : 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipAuthRateLimit,
  message: { error: 'Too many login attempts from this network. Please wait a few minutes.' },
  skipSuccessfulRequests: true,
});

app.use(globalLimiter);

// ── Security & middleware ──────────────────────────────────────────────────

// cross-origin so Capacitor / separate API hosts can load streamed listing images in <img>
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — allowlist production web + Capacitor origins (JWT Bearer, credentials: false)
const defaultCorsOrigins = [
  'https://abn-1.onrender.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
];
const corsOrigins = String(process.env.CORS_ORIGINS || defaultCorsOrigins.join(','))
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Native apps and same-origin tools often omit Origin
    if (!origin) return callback(null, true);
    if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Cap JSON bodies — listing images should stay under a few MB each
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '5mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '5mb' }));

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

// Listing name / photo change requests (owner → admin approval)
app.use('/api/change-requests', require('./routes/changeRequests'));

// Admin activity / audit log
app.use('/api/admin/activity', require('./routes/adminActivity'));

// Categories + notifications + device push tokens
app.use('/api/categories', require('./routes/categories'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/devices', require('./routes/devices'));

// ── Health check ───────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  const meta = storageMeta();
  let supabaseOk = false;
  let supabaseError = null;
  try {
    const { error } = await supabaseAdmin
      .from('profiles_directory')
      .select('id')
      .limit(1);
    supabaseOk = !error;
    if (error) supabaseError = error.message;
  } catch (err) {
    supabaseOk = false;
    supabaseError = err.message || String(err);
  }

  // Config readiness (no secrets) — OTP/push fail loudly in ops if these are false in prod.
  const { smtpConfigured } = require('./lib/mailer');
  const firebaseConfigured = Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim() ||
    (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim() ||
    (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim() ||
    (
      (process.env.FIREBASE_PROJECT_ID || '').trim() &&
      (process.env.FIREBASE_CLIENT_EMAIL || '').trim() &&
      (process.env.FIREBASE_PRIVATE_KEY || '').trim()
    ),
  );
  const exposeVerifyCode = process.env.EXPOSE_VERIFY_CODE === 'true';

  res.json({
    status: meta.mode === 'memory' ? 'ok' : (supabaseOk ? 'ok' : 'degraded'),
    service: 'ABN Community API',
    timestamp: new Date().toISOString(),
    storageMode: meta.mode,
    database: {
      connected: meta.mode === 'memory' ? true : supabaseOk,
      provider: meta.mode === 'supabase' ? 'supabase' : 'memory',
      error: supabaseOk ? null : supabaseError,
    },
    email: {
      smtpConfigured: smtpConfigured(),
      exposeVerifyCode: isProduction ? false : exposeVerifyCode,
      // In production EXPOSE_VERIFY_CODE is ignored by mailer/OTP logic; flag if mis-set.
      exposeVerifyCodeEnvSet: exposeVerifyCode,
    },
    push: {
      firebaseConfigured,
    },
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
      reviews:   '/api/reviews   — GET /?businessId=  POST /  POST /:id/reply',
      payments:  '/api/payments  — GET /  GET /ledger  GET /mine  POST /renew',
      favorites: '/api/favorites — GET /  POST /:businessId  DELETE /:businessId',
      reports:   '/api/reports   — GET /  POST /  PATCH /:id/resolve',
      changeRequests: '/api/change-requests — GET /  GET /mine  POST /  POST /:id/approve  POST /:id/reject',
      adminActivity: '/api/admin/activity — GET / (admin audit log)',
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

  try {
    const { startPaymentReminderScheduler } = require('./lib/paymentReminders');
    startPaymentReminderScheduler();
  } catch (err) {
    console.warn('[paymentReminders] Could not start scheduler:', err.message);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    const publicUrl = process.env.RENDER_EXTERNAL_URL
      || process.env.API_PUBLIC_URL
      || `http://${LAN_HOST}:${PORT}`;
    console.log(`\n🚀  ABN Community API  →  ${publicUrl}/api`);
    console.log(`    Storage mode       →  ${STORAGE_MODE}`);
    console.log(`    Health check       →  ${publicUrl}/api/health`);
    console.log(`    Environment        →  ${process.env.NODE_ENV || 'development'}\n`);

    if (isProduction) {
      const { smtpConfigured } = require('./lib/mailer');
      if (!smtpConfigured()) {
        console.warn('[config] SMTP not set — OTP/reset emails will fail. Set SMTP_HOST/SMTP_USER/SMTP_PASS (Brevo) on Render.');
      } else {
        console.log('[config] SMTP configured — OTP email ready.');
      }
      const firebaseConfigured = Boolean(
        (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim() ||
        (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim() ||
        (
          (process.env.FIREBASE_PROJECT_ID || '').trim() &&
          (process.env.FIREBASE_CLIENT_EMAIL || '').trim() &&
          (process.env.FIREBASE_PRIVATE_KEY || '').trim()
        ),
      );
      if (!firebaseConfigured) {
        console.warn('[config] FIREBASE_SERVICE_ACCOUNT_JSON missing — device push disabled.');
      } else {
        console.log('[config] Firebase credentials present — FCM can initialize on first push.');
      }
      if (process.env.EXPOSE_VERIFY_CODE === 'true') {
        console.warn('[config] EXPOSE_VERIFY_CODE=true is set — remove it in production (OTP must stay email-only).');
      }
    }
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

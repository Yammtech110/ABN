'use strict';

/**
 * security.js — centralised secret resolution.
 *
 * The JWT signing secret is the single most sensitive value in the app: anyone
 * who knows it can forge tokens for any user (including admin). We therefore:
 *   - REQUIRE it in production and refuse to boot without it, and
 *   - allow a clearly-labelled development fallback locally so `npm run dev`
 *     still works out of the box.
 */

const isProduction = process.env.NODE_ENV === 'production';

const DEV_FALLBACK_SECRET = 'dev-secret-change-in-production';

let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.trim().length === 0) {
  if (isProduction) {
    // Fail fast — never sign tokens with a public, well-known secret in prod.
    console.error('[FATAL] JWT_SECRET is not set. Refusing to start in production without a strong secret.');
    process.exit(1);
  }
  console.warn('[security] JWT_SECRET not set — using an insecure development fallback. Set JWT_SECRET before deploying.');
  JWT_SECRET = DEV_FALLBACK_SECRET;
} else if (isProduction && JWT_SECRET === DEV_FALLBACK_SECRET) {
  console.error('[FATAL] JWT_SECRET is set to the well-known development value. Use a strong, unique secret in production.');
  process.exit(1);
} else if (isProduction && JWT_SECRET.length < 32) {
  console.warn('[security] JWT_SECRET is shorter than 32 characters — consider a longer, high-entropy secret.');
}

module.exports = { JWT_SECRET };

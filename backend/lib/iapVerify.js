'use strict';

/**
 * Store purchase checks before membership activation.
 *
 * Modes (IAP_VERIFY_MODE):
 *   off         — owners cannot self-activate (admin Mark-as-Paid only). Default in production.
 *   trust-txid  — require a unique store transactionId (replay-protected). Not cryptographic proof;
 *                 use only until Apple/Google receipt APIs are wired.
 *   apple/google— reserved for real receipt APIs (falls back to "not configured" until implemented).
 *
 * ALLOW_UNVERIFIED_IAP=true is ignored in production / on Render.
 */

const crypto = require('crypto');

const isProduction =
  process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);

function getMode() {
  const raw = String(process.env.IAP_VERIFY_MODE || '').trim().toLowerCase();
  if (raw) return raw;
  // Local/dev convenience — production stays closed by default
  return isProduction ? 'off' : 'trust-txid';
}

function allowDevUnverified() {
  return (
    !isProduction &&
    process.env.ALLOW_UNVERIFIED_IAP === 'true'
  );
}

/**
 * @returns {{ ok: true, refNo: string, mode: string } | { ok: false, status: number, error: string }}
 */
function evaluateOwnerPurchase({ transactionId, productId, platform }) {
  const mode = getMode();
  const tx = String(transactionId || '').trim();
  const product = String(productId || '').trim();
  const plat = String(platform || '').trim().toLowerCase();

  if (allowDevUnverified()) {
    const ref = tx
      ? `DEV-${tx}`.slice(0, 80)
      : `DEV-${crypto.randomBytes(8).toString('hex')}`;
    return { ok: true, refNo: ref, mode: 'dev-unverified' };
  }

  if (mode === 'off') {
    return {
      ok: false,
      status: 403,
      error:
        'Membership activation requires a verified store purchase or an admin. Contact support after paying in the app store.',
    };
  }

  if (!tx || tx.length < 8) {
    return {
      ok: false,
      status: 400,
      error: 'A store transactionId is required to activate membership.',
    };
  }

  if (isProduction && /^WEB-SIM-/i.test(tx)) {
    return {
      ok: false,
      status: 400,
      error: 'Simulated web purchases cannot activate membership in production.',
    };
  }

  if (mode === 'trust-txid') {
    if (product && !/^abn_(business|service)_monthly$/i.test(product)) {
      return { ok: false, status: 400, error: 'Invalid subscription productId.' };
    }
    if (plat && !['ios', 'android', 'web'].includes(plat)) {
      return { ok: false, status: 400, error: 'platform must be ios, android, or web.' };
    }
    // Stable, unique ref for replay protection (membership_payments.ref_no)
    const digest = crypto.createHash('sha256').update(tx).digest('hex').slice(0, 24);
    return { ok: true, refNo: `IAP-${digest}`, mode: 'trust-txid' };
  }

  // apple / google / unknown — real verifiers not wired yet
  return {
    ok: false,
    status: 503,
    error:
      'Store receipt verification is not configured on the server yet. An admin can activate your membership after purchase.',
  };
}

module.exports = {
  evaluateOwnerPurchase,
  getMode,
  isProduction,
};

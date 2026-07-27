'use strict';

/**
 * smoke-auth.js — verify auth/security changes did not break login/session/OTP.
 * Run: node scripts/smoke-auth.js
 * Uses MEMORY storage so it never depends on live Supabase for the core checks.
 */

process.env.NODE_ENV = 'test';
process.env.STORAGE_MODE = 'memory';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-test-secret-at-least-32-chars-long!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.IAP_VERIFY_MODE = 'trust-txid';
delete process.env.RENDER;
delete process.env.EXPOSE_VERIFY_CODE;
delete process.env.ALLOW_UNVERIFIED_IAP;
delete process.env.ADMIN_PASSWORD; // local/dev path

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function main() {
  const jwt = require('jsonwebtoken');
  const bcrypt = require('bcryptjs');
  const { JWT_SECRET } = require('../config/security');
  const { createUser, findByEmail, findById, seedDemoAccounts, setUserBlocked } = require('../lib/userStore');
  const { createCode, verifyCode, shouldExposeOtp } = require('../lib/emailVerify');
  const { evaluateOwnerPurchase } = require('../lib/iapVerify');
  const { authenticate } = require('../middleware/authMiddleware');

  console.log('[smoke] seeding demo admin (memory)…');
  await seedDemoAccounts();

  const admin = await findByEmail('admin@shiadirectory.com');
  assert(admin, 'admin seed missing');
  assert(admin.role === 'admin', 'admin role wrong');

  const email = `smoke_${Date.now()}@example.com`;
  const password = 'SmokeTestPass1';
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await createUser({
    id: `user-smoke-${Date.now()}`,
    email,
    phone: '+10000000000',
    name: 'Smoke User',
    role: 'customer',
    passwordHash,
    preferredLanguage: 'en',
    emailVerified: true,
  });

  // OTP round-trip (hashed storage)
  assert(shouldExposeOtp() === false, 'OTP must not expose in test/prod-like');
  const code = await createCode(email, 'verify');
  assert(/^\d{6}$/.test(code), 'OTP not 6 digits');
  assert(await verifyCode(email, code, 'verify') === true, 'OTP verify failed');
  assert(await verifyCode(email, code, 'verify') === false, 'OTP should be single-use');

  const resetCode = await createCode(email, 'reset');
  assert(await verifyCode(email, resetCode, 'reset', { consume: false }) === true, 'reset peek failed');
  assert(await verifyCode(email, resetCode, 'reset', { consume: true }) === true, 'reset consume failed');

  // Login-equivalent: password + JWT
  const found = await findByEmail(email);
  assert(await bcrypt.compare(password, found.passwordHash), 'password compare failed');
  const token = jwt.sign(
    { id: found.id, email: found.email, role: found.role, name: found.name },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  // authenticate middleware must accept app JWT and reload role from DB
  const runAuth = (bearer) =>
    new Promise((resolve) => {
      const req = { headers: { authorization: bearer } };
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          resolve({ req, res: this });
          return this;
        },
      };
      authenticate(req, res, () => resolve({ req, res })).catch((err) => {
        resolve({ req, res, err });
      });
    });

  const ok = await runAuth(`Bearer ${token}`);
  assert(!ok.err, `authenticate threw: ${ok.err}`);
  assert(ok.res.statusCode === 200 || ok.req.user, 'authenticate did not attach user');
  assert(ok.req.user?.email === email, 'authenticate.user email mismatch');
  assert(ok.req.user?.role === 'customer', 'req.user role mismatch');

  // Role change in DB must be reflected on next authenticate (not JWT claim)
  found.role = 'business';
  // memory store: update via createUser overwrite path — use findById + users map
  const { users } = require('../lib/memoryStore');
  users.set(email, { ...found, role: 'business' });
  const afterRole = await runAuth(`Bearer ${token}`);
  assert(afterRole.req.user?.role === 'business', 'DB role not reloaded on authenticate');

  // Blocked user must be rejected
  await setUserBlocked(user.id, true);
  const blocked = await runAuth(`Bearer ${token}`);
  assert(blocked.res.statusCode === 403, `expected 403 for blocked, got ${blocked.res.statusCode}`);

  // IAP gate: owner without tx id blocked in trust-txid
  const noTx = evaluateOwnerPurchase({ transactionId: '', productId: 'abn_business_monthly', platform: 'android' });
  assert(noTx.ok === false, 'empty tx should fail');
  const withTx = evaluateOwnerPurchase({
    transactionId: 'GPA.1234-5678-9012',
    productId: 'abn_business_monthly',
    platform: 'android',
  });
  assert(withTx.ok === true && withTx.refNo.startsWith('IAP-'), 'trust-txid should accept store tx');

  // Idempotent ref for same tx
  const again = evaluateOwnerPurchase({
    transactionId: 'GPA.1234-5678-9012',
    productId: 'abn_business_monthly',
    platform: 'android',
  });
  assert(again.refNo === withTx.refNo, 'refNo must be stable for replay protection');

  console.log('[smoke] ALL PASSED');
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err.message);
  process.exit(1);
});

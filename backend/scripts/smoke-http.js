'use strict';

/**
 * smoke-http.js — boot an isolated memory server and exercise real HTTP auth routes.
 * Run: node scripts/smoke-http.js
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3011;
const BASE = `http://127.0.0.1:${PORT}`;

function req(method, urlPath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { json = { raw }; }
          resolve({ status: res.statusCode, json });
        });
      },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function waitHealthy(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const h = await req('GET', '/api/health');
      if (h.status === 200) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Server did not become healthy in time');
}

async function main() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'development',
      STORAGE_MODE: 'memory',
      JWT_SECRET: 'smoke-http-secret-at-least-32-characters!!',
      JWT_EXPIRES_IN: '1h',
      IAP_VERIFY_MODE: 'trust-txid',
      ADMIN_PASSWORD: 'LocalSmokeAdminPass1',
      ADMIN_EMAIL: 'admin@shiadirectory.com',
      EXPOSE_VERIFY_CODE: 'true', // QA only — assert verify path works end-to-end
      RATE_LIMIT_MAX: '10000',
      AUTH_RATE_LIMIT_MAX: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let bootLog = '';
  child.stdout.on('data', (d) => { bootLog += d.toString(); });
  child.stderr.on('data', (d) => { bootLog += d.toString(); });

  try {
    await waitHealthy();

    // Admin login (seeded)
    const login = await req('POST', '/api/auth/login', {
      body: { email: 'admin@shiadirectory.com', password: 'LocalSmokeAdminPass1' },
    });
    if (login.status !== 200 || !login.json?.token) {
      throw new Error(`admin login failed: ${login.status} ${JSON.stringify(login.json)}`);
    }
    const adminToken = login.json.token;

    const me = await req('GET', '/api/auth/me', { token: adminToken });
    if (me.status !== 200 || me.json?.role !== 'admin') {
      throw new Error(`/me failed: ${me.status} ${JSON.stringify(me.json)}`);
    }

    // Register + verify OTP (EXPOSE_VERIFY_CODE so we can read code without SMTP)
    const email = `http_smoke_${Date.now()}@example.com`;
    const password = 'HttpSmokePass1';
    const reg = await req('POST', '/api/auth/register', {
      body: {
        email,
        password,
        name: 'HTTP Smoke',
        phone: '+15551234567',
        role: 'customer',
      },
    });
    // Without SMTP this may be 503 with needsEmailVerification — still OK if user was created
    if (![201, 503].includes(reg.status)) {
      throw new Error(`register unexpected: ${reg.status} ${JSON.stringify(reg.json)}`);
    }

    // If SMTP failed, user may still exist and need verify — use resend with exposed code
    let code = reg.json?.verificationCode;
    if (!code) {
      const resend = await req('POST', '/api/auth/resend-verification', { body: { email } });
      code = resend.json?.verificationCode;
      if (!code) {
        // Memory + no SMTP: create path may 503 before expose — try login to trigger code
        const earlyLogin = await req('POST', '/api/auth/login', { body: { email, password } });
        code = earlyLogin.json?.verificationCode;
        if (!code && earlyLogin.status !== 403) {
          throw new Error(`could not obtain OTP: reg=${JSON.stringify(reg.json)} login=${JSON.stringify(earlyLogin.json)}`);
        }
      }
    }

    if (code) {
      const verify = await req('POST', '/api/auth/verify-email', { body: { email, code } });
      if (verify.status !== 200 || !verify.json?.token) {
        throw new Error(`verify-email failed: ${verify.status} ${JSON.stringify(verify.json)}`);
      }
      const userToken = verify.json.token;
      const meUser = await req('GET', '/api/auth/me', { token: userToken });
      if (meUser.status !== 200 || meUser.json?.email !== email) {
        throw new Error(`user /me failed: ${meUser.status} ${JSON.stringify(meUser.json)}`);
      }

      // Owner renew without tx must fail
      const renewBad = await req('POST', '/api/payments/renew', {
        token: userToken,
        body: { businessId: 'nope', amount: 50 },
      });
      // 404 listing or 400/403 tx — must not be 201 free success
      if (renewBad.status === 201) {
        throw new Error('renew without listing/tx must not succeed');
      }
    }

    // Duplicate register must be 409 (not fake 201 OTP screen)
    const dup = await req('POST', '/api/auth/register', {
      body: {
        email: 'admin@shiadirectory.com',
        password: 'AnotherPass12',
        name: 'Dup',
        phone: '+15550001111',
        role: 'customer',
      },
    });
    if (dup.status !== 409) {
      throw new Error(`duplicate register expected 409, got ${dup.status}`);
    }

    // Short password rejected
    const short = await req('POST', '/api/auth/register', {
      body: {
        email: `short_${Date.now()}@example.com`,
        password: 'short1',
        name: 'Short',
        phone: '+15550002222',
        role: 'customer',
      },
    });
    if (short.status !== 400) {
      throw new Error(`short password expected 400, got ${short.status}`);
    }

    console.log('[smoke-http] ALL PASSED');
  } catch (err) {
    console.error('[smoke-http] FAILED:', err.message);
    console.error('--- boot log ---');
    console.error(bootLog.slice(-4000));
    process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* */ }
      process.exit(process.exitCode || 0);
    }, 1000);
  }
}

main();

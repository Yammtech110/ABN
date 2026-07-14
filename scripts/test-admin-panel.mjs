/**
 * Admin panel API workflow tests
 */
const BASE = 'http://localhost:3001/api';
const ADMIN = { email: 'admin@shiadirectory.com', password: 'admin123' };

const results = [];
const pass = (n, d = '') => { results.push({ s: 'PASS', n, d }); console.log(`✅ ${n}${d ? ' — ' + d : ''}`); };
const fail = (n, d = '') => { results.push({ s: 'FAIL', n, d }); console.log(`❌ ${n}${d ? ' — ' + d : ''}`); };
const warn = (n, d = '') => { results.push({ s: 'WARN', n, d }); console.log(`⚠️  ${n}${d ? ' — ' + d : ''}`); };

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, ok: res.ok };
}

async function run() {
  console.log('\n=== Admin Panel Workflow Tests ===\n');

  let token;
  try {
    const login = await req('POST', '/auth/login', ADMIN);
    if (login.ok && login.data?.token) {
      token = login.data.token;
      login.data.user?.role === 'admin' ? pass('Admin login', login.data.user.role) : fail('Admin login role', login.data.user?.role);
    } else fail('Admin login', JSON.stringify(login.data));
  } catch (e) { fail('Admin login', e.message); return; }

  // Non-admin blocked from /directory/all
  try {
    const pub = await req('GET', '/directory/all');
    pub.status === 401 ? pass('Non-admin blocked from /directory/all') : fail('Non-admin blocked', `status ${pub.status}`);
  } catch (e) { fail('Non-admin blocked', e.message); }

  // Admin sees all listings
  let listings = [];
  try {
    const all = await req('GET', '/directory/all', null, token);
    if (all.ok && Array.isArray(all.data)) {
      listings = all.data;
      pass('GET /directory/all (admin)', `${listings.length} listing(s)`);
    } else fail('GET /directory/all', JSON.stringify(all.data));
  } catch (e) { fail('GET /directory/all', e.message); }

  const pending = listings.filter((l) => !l.isVerified && l.subscriptionStatus === 'pending');
  pending.length > 0 ? pass('Pending submissions exist for vetting', pending[0].businessName) : warn('Pending submissions', 'none in DB');

  if (pending.length > 0) {
    const biz = pending[0];
    // Approve
    const approve = await req('PUT', `/directory/${biz.id}`, { isVerified: true, subscriptionStatus: 'active' }, token);
    approve.ok ? pass('Approve listing (vetting)') : fail('Approve listing', JSON.stringify(approve.data));

    // Verify public directory shows it
    const pub = await req('GET', '/directory');
    const found = pub.data?.find?.((l) => l.id === biz.id);
    found ? pass('Approved listing in public directory') : fail('Approved listing public', 'not found');

    // Suspend
    const susp = await req('PUT', `/directory/${biz.id}`, { subscriptionStatus: 'suspended' }, token);
    susp.ok ? pass('Suspend listing') : fail('Suspend listing', JSON.stringify(susp.data));

    // Re-activate
    const react = await req('PUT', `/directory/${biz.id}`, { subscriptionStatus: 'active' }, token);
    react.ok ? pass('Re-activate listing') : fail('Re-activate listing', JSON.stringify(react.data));
  }

  // Payments admin
  try {
    const pays = await req('GET', '/payments', null, token);
    if (pays.ok && Array.isArray(pays.data)) pass('GET /payments (admin dues)', `${pays.data.length} record(s)`);
    else if (pays.data?.error?.includes('membership_payments')) warn('GET /payments', 'membership_payments table missing — run migration 004');
    else fail('GET /payments', JSON.stringify(pays.data));
  } catch (e) { fail('GET /payments', e.message); }

  const summary = { pass: results.filter(r => r.s === 'PASS').length, fail: results.filter(r => r.s === 'FAIL').length, warn: results.filter(r => r.s === 'WARN').length };
  console.log(`\n=== SUMMARY: ${summary.pass} passed, ${summary.fail} failed, ${summary.warn} warnings ===\n`);
  process.exit(summary.fail > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });

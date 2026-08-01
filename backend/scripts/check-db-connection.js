/**
 * End-to-end DB / API connectivity check for ABN.
 * Run: node scripts/check-db-connection.js
 */
'use strict';

const dns = require('dns').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const LIVE_API = process.env.CHECK_API_BASE || 'https://abn-my4f.onrender.com';
const LIVE_WEB = process.env.CHECK_WEB_BASE || 'https://abn-1.onrender.com';
const LOCAL_SB_URL = process.env.SUPABASE_URL || '';
const LOCAL_SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const results = [];

const ok = (name, detail) => {
  results.push({ name, status: 'OK', detail });
  console.log(`✅ ${name}: ${detail}`);
};
const bad = (name, detail) => {
  results.push({ name, status: 'FAIL', detail });
  console.log(`❌ ${name}: ${detail}`);
};
const warn = (name, detail) => {
  results.push({ name, status: 'WARN', detail });
  console.log(`⚠️  ${name}: ${detail}`);
};

async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 25000);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    return { res, text, json };
  } finally {
    clearTimeout(t);
  }
}

async function checkDns(hostname, label) {
  try {
    const addrs = await dns.lookup(hostname, { all: true });
    ok(label, `${hostname} → ${addrs.map((a) => a.address).join(', ')}`);
    return true;
  } catch (e) {
    bad(label, `${hostname} DNS failed: ${e.code || e.message}`);
    return false;
  }
}

async function checkLocalSupabase() {
  console.log('\n── Local backend/.env Supabase ──');
  if (!LOCAL_SB_URL) {
    bad('Local SUPABASE_URL', 'missing');
    return;
  }
  let host = '';
  try {
    host = new URL(LOCAL_SB_URL).hostname;
  } catch {
    bad('Local SUPABASE_URL', `invalid URL: ${LOCAL_SB_URL}`);
    return;
  }
  const dnsOk = await checkDns(host, 'Local Supabase DNS');
  if (!dnsOk || !LOCAL_SB_KEY) {
    if (!LOCAL_SB_KEY) bad('Local SERVICE_ROLE_KEY', 'missing');
    return;
  }
  try {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(LOCAL_SB_URL, LOCAL_SB_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const tables = [
      'app_users',
      'profiles_directory',
      'jobs_board',
      'directory_categories',
      'app_notifications',
      'business_reviews',
    ];
    for (const table of tables) {
      const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
      if (error) bad(`Local table ${table}`, error.message);
      else ok(`Local table ${table}`, `count=${count}`);
    }
    // gallery_urls column probe
    const { error: galErr } = await sb.from('profiles_directory').select('gallery_urls').limit(1);
    if (galErr) warn('gallery_urls column', galErr.message);
    else ok('gallery_urls column', 'present');
  } catch (e) {
    bad('Local Supabase client', e.message);
  }
}

async function checkLiveApi() {
  console.log('\n── Live API (Render) ──');
  await checkDns('abn-my4f.onrender.com', 'Live API DNS');

  const health = await fetchJson(`${LIVE_API}/api/health`);
  if (!health.res.ok) {
    bad('Live /api/health', `HTTP ${health.res.status}`);
    return;
  }
  ok('Live /api/health', JSON.stringify(health.json));

  // Optional status endpoints if present
  for (const p of ['/api/health/db', '/api/status', '/api/ready']) {
    const r = await fetchJson(`${LIVE_API}${p}`);
    if (r.res.status === 404) continue;
    if (r.res.ok) ok(`Live ${p}`, JSON.stringify(r.json).slice(0, 200));
    else warn(`Live ${p}`, `HTTP ${r.res.status}`);
  }

  const dir = await fetchJson(`${LIVE_API}/api/directory`);
  if (!dir.res.ok) bad('Live /api/directory', `HTTP ${dir.res.status} ${dir.text.slice(0, 120)}`);
  else {
    const list = Array.isArray(dir.json) ? dir.json : [];
    ok('Live /api/directory', `${list.length} public listing(s)`);
    if (list[0]) {
      const id = list[0].id;
      const logo = await fetch(`${LIVE_API}/api/directory/${id}/logo`);
      const ct = logo.headers.get('content-type') || '';
      const bytes = (await logo.arrayBuffer()).byteLength;
      if (logo.ok && ct.startsWith('image/') && bytes > 500) {
        ok('Live listing logo stream', `${ct}, ${bytes} bytes`);
      } else {
        warn('Live listing logo stream', `HTTP ${logo.status} ${ct} ${bytes}b (may be placeholder)`);
      }
    }
  }

  const cats = await fetchJson(`${LIVE_API}/api/categories`);
  if (!cats.res.ok) bad('Live /api/categories', `HTTP ${cats.res.status}`);
  else {
    const n = Array.isArray(cats.json?.categories)
      ? cats.json.categories.length
      : Array.isArray(cats.json)
        ? cats.json.length
        : 0;
    ok('Live /api/categories', `${n} categories`);
  }

  const jobs = await fetchJson(`${LIVE_API}/api/jobsboard`);
  if (!jobs.res.ok) warn('Live /api/jobsboard', `HTTP ${jobs.res.status} ${jobs.text.slice(0, 80)}`);
  else {
    const n = Array.isArray(jobs.json) ? jobs.json.length : 0;
    ok('Live /api/jobsboard', `${n} job(s)`);
  }

  // Auth register validation (expect 400 without body — proves route + DB path reachable)
  const authProbe = await fetchJson(`${LIVE_API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (authProbe.res.status === 400 || authProbe.res.status === 409) {
    ok('Live /api/auth/register', `reachable (HTTP ${authProbe.res.status})`);
  } else if (authProbe.res.status >= 500) {
    bad('Live /api/auth/register', `HTTP ${authProbe.res.status} ${JSON.stringify(authProbe.json)}`);
  } else {
    warn('Live /api/auth/register', `HTTP ${authProbe.res.status}`);
  }
}

async function checkLiveWeb() {
  console.log('\n── Live Web (Static) ──');
  await checkDns('abn-1.onrender.com', 'Live Web DNS');
  const home = await fetchJson(LIVE_WEB + '/');
  if (!home.res.ok) bad('Live web home', `HTTP ${home.res.status}`);
  else ok('Live web home', `HTTP ${home.res.status}`);

  const apiOnWeb = await fetchJson(`${LIVE_WEB}/api/directory`);
  if (apiOnWeb.res.status === 404) {
    ok('Web has no /api (expected)', 'Static site correctly has no API routes');
  } else {
    warn('Web /api/directory', `HTTP ${apiOnWeb.res.status} — unexpected`);
  }
}

(async () => {
  console.log('ABN database / connectivity check');
  console.log('Time:', new Date().toISOString());
  await checkLocalSupabase();
  await checkLiveApi();
  await checkLiveWeb();

  console.log('\n── Summary ──');
  const fails = results.filter((r) => r.status === 'FAIL');
  const warns = results.filter((r) => r.status === 'WARN');
  console.log(`OK=${results.filter((r) => r.status === 'OK').length} WARN=${warns.length} FAIL=${fails.length}`);
  if (fails.length) {
    console.log('\nFailures:');
    fails.forEach((f) => console.log(` - ${f.name}: ${f.detail}`));
    process.exitCode = 1;
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

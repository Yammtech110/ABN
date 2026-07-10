/**
 * supabase.js — Supabase client singletons
 *
 * Two clients are exported:
 *
 *  supabaseAnon
 *    Uses the ANON key. Respects Row Level Security (RLS) policies.
 *    Safe to mirror what a frontend client would do.
 *
 *  supabaseAdmin
 *    Uses the SERVICE ROLE key. Bypasses RLS completely.
 *    Use ONLY inside backend route handlers — never send this key to the browser.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY         = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STORAGE_MODE = (process.env.STORAGE_MODE || '').toLowerCase();
const needsSupabase = STORAGE_MODE !== 'memory' && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY;

// ── Validate on startup (only when Supabase storage is actually needed) ────
if (STORAGE_MODE !== 'memory') {
  if (!SUPABASE_URL) {
    throw new Error('Missing env var: SUPABASE_URL');
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Missing env var: SUPABASE_ANON_KEY');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY');
  }
  if (SUPABASE_ANON_KEY === SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      '\n⚠️  WARNING: SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are identical.\n' +
      '   The service_role key must be different from the anon key.\n' +
      '   Get the correct key from: Dashboard → Project Settings → API → service_role secret\n'
    );
  }
}

// ── Clients — created only when keys are present ───────────────────────────
const supabaseAnon = needsSupabase
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const supabaseAdmin = needsSupabase
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

module.exports = { supabaseAnon, supabaseAdmin };

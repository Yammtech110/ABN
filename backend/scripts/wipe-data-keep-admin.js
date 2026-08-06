'use strict';
/**
 * Wipe all app data in Supabase, keep only admin account(s) + category taxonomy.
 *
 * Usage (from backend/):
 *   node scripts/wipe-data-keep-admin.js
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 * Optional: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_PHONE
 *            (re-seeds admin after wipe via ensure-admin logic)
 *
 * WARNING: Irreversible. Do not run against the wrong project.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = (process.env.ADMIN_EMAIL || 'yammtech80@gmail.com').toLowerCase().trim();
const adminPassword = process.env.ADMIN_PASSWORD || '';
const adminName = process.env.ADMIN_NAME || 'ABN Admin';
const adminPhone = process.env.ADMIN_PHONE || '+1 000 000 0000';

if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (process.argv.includes('--dry-run')) {
  console.log('Dry run only — no deletes. Admin email would be kept:', adminEmail);
  process.exit(0);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stableId = (role, em) =>
  `${role}-${em.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;

/** Delete every row in a table (ignore missing-table errors). */
async function wipeTable(table) {
  const { error, count } = await sb
    .from(table)
    .delete({ count: 'exact' })
    .not('id', 'is', null);

  if (error) {
    const msg = String(error.message || error).toLowerCase();
    if (
      msg.includes('does not exist') ||
      msg.includes('schema cache') ||
      msg.includes('could not find the table')
    ) {
      console.log(`  skip ${table} (missing)`);
      return;
    }
    throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  wiped ${table}${count != null ? ` (${count} rows)` : ''}`);
}

async function ensureAdmin() {
  if (!adminPassword || adminPassword.length < 6) {
    console.warn(
      'ADMIN_PASSWORD missing/short — keeping any existing admin rows, not recreating password.',
    );
    const { data, error } = await sb
      .from('app_users')
      .select('id,email,role')
      .eq('role', 'admin');
    if (error) throw new Error(error.message);
    console.log('  remaining admins:', (data || []).map((u) => u.email).join(', ') || '(none)');
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const id = stableId('admin', adminEmail);

  const { data: existing, error: findErr } = await sb
    .from('app_users')
    .select('id,email,role')
    .eq('email', adminEmail)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);

  if (existing) {
    const { error } = await sb
      .from('app_users')
      .update({
        role: 'admin',
        password_hash: passwordHash,
        email_verified: true,
        name: adminName,
        phone: adminPhone,
      })
      .eq('email', adminEmail);
    if (error) throw new Error(error.message);
    console.log('  UPDATED admin:', adminEmail);
  } else {
    const { error } = await sb.from('app_users').insert({
      id,
      email: adminEmail,
      phone: adminPhone,
      name: adminName,
      role: 'admin',
      password_hash: passwordHash,
      preferred_language: 'en',
      email_verified: true,
    });
    if (error) throw new Error(error.message);
    console.log('  CREATED admin:', adminEmail);
  }
}

(async () => {
  console.log('Supabase project:', url);
  console.log('Keeping admin email:', adminEmail);
  console.log('Wiping data tables…');

  // Child / satellite tables first (FK-safe order)
  const tables = [
    'jobs_board',
    'business_reviews',
    'user_favorites',
    'listing_reports',
    'listing_change_requests',
    'membership_payments',
    'user_blocks',
    'device_tokens',
    'app_notifications',
    'admin_activity_log',
    'profiles_directory',
  ];

  for (const t of tables) {
    await wipeTable(t);
  }

  // Remove all non-admin users
  console.log('Removing non-admin app_users…');
  const { data: users, error: listErr } = await sb
    .from('app_users')
    .select('id,email,role');
  if (listErr) throw new Error(listErr.message);

  const toDelete = (users || []).filter(
    (u) => u.role !== 'admin' && String(u.email || '').toLowerCase() !== adminEmail,
  );
  for (const u of toDelete) {
    const { error } = await sb.from('app_users').delete().eq('id', u.id);
    if (error) throw new Error(`delete user ${u.email}: ${error.message}`);
    console.log('  deleted user:', u.email);
  }

  // Drop any leftover non-admin rows by role (belt + suspenders)
  const { error: delRoleErr } = await sb
    .from('app_users')
    .delete()
    .neq('role', 'admin');
  if (delRoleErr) {
    console.warn('  note: bulk non-admin delete:', delRoleErr.message);
  }

  console.log('Ensuring admin credential…');
  await ensureAdmin();

  // Keep directory_categories — taxonomy for registration/search
  const { count: catCount } = await sb
    .from('directory_categories')
    .select('id', { count: 'exact', head: true });
  console.log(`Kept directory_categories (${catCount ?? '?'} rows)`);

  const { data: leftUsers } = await sb.from('app_users').select('email,role');
  console.log('Done. Remaining users:', leftUsers);
  console.log('You can now register fresh accounts. Admin can sign in with ADMIN_EMAIL / ADMIN_PASSWORD.');
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

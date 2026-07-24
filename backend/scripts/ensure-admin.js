'use strict';
/**
 * Ensure a production admin exists in app_users (Supabase).
 * Usage (from backend/): node scripts/ensure-admin.js
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 * Optional: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_PHONE
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.ADMIN_EMAIL || 'yammtech80@gmail.com').toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || 'ChangeThisAdminPass123!';
const name = process.env.ADMIN_NAME || 'ABN Admin';
const phone = process.env.ADMIN_PHONE || '+1 000 000 0000';

if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key);
const stableId = (role, em) =>
  `${role}-${em.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;

(async () => {
  const passwordHash = await bcrypt.hash(password, 10);
  const id = stableId('admin', email);

  const { data: existing, error: findErr } = await sb
    .from('app_users')
    .select('id,email,role,email_verified')
    .eq('email', email)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);

  if (existing) {
    const { error } = await sb
      .from('app_users')
      .update({
        role: 'admin',
        password_hash: passwordHash,
        email_verified: true,
        name,
        phone,
      })
      .eq('email', email);
    if (error) throw new Error(error.message);
    console.log('UPDATED admin:', email, 'role=admin email_verified=true');
  } else {
    const { error } = await sb.from('app_users').insert({
      id,
      email,
      phone,
      name,
      role: 'admin',
      password_hash: passwordHash,
      preferred_language: 'en',
      email_verified: true,
    });
    if (error) throw new Error(error.message);
    console.log('CREATED admin:', email, 'role=admin');
  }
  console.log('Sign in on web with that email/password. Admin tab appears after login.');
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

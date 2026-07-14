'use strict';

/**
 * Storage mode for the ABN backend.
 *
 * STORAGE_MODE=supabase  → persist auth, directory, jobs, reviews in Supabase
 * STORAGE_MODE=memory  → volatile in-process stores (dev fallback only)
 *
 * Defaults to supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
 */

const STORAGE_MODE = (process.env.STORAGE_MODE || '').toLowerCase() === 'memory'
  ? 'memory'
  : (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    ? 'supabase'
    : 'memory';

const isSupabaseStorage = () => STORAGE_MODE === 'supabase';

const storageMeta = () => (isSupabaseStorage()
  ? {
      mode: 'supabase',
      auth: 'Supabase table app_users',
      directory: 'Supabase table profiles_directory',
      jobs: 'Supabase table jobs_board',
      reviews: 'Supabase table business_reviews',
      payments: 'Supabase table membership_payments',
      favorites: 'Supabase table user_favorites',
      reports: 'Supabase table listing_reports',
      categories: 'Supabase table directory_categories',
      notifications: 'Supabase table app_notifications',
    }
  : {
      mode: 'memory',
      auth: 'In-memory user store (demo accounts only)',
      directory: 'In-memory profiles (lost on restart)',
      jobs: 'In-memory jobs board (lost on restart)',
      reviews: 'In-memory reviews (lost on restart)',
      payments: 'In-memory payments (lost on restart)',
      favorites: 'In-memory favorites (lost on restart)',
      reports: 'In-memory listing reports (lost on restart)',
      categories: 'In-memory categories (lost on restart)',
      notifications: 'In-memory notifications (lost on restart)',
    });

/** Ping Supabase on startup — throws if required tables are missing. */
async function verifySupabaseConnection(supabaseAdmin) {
  const required = [
    { table: 'profiles_directory', migration: '001_init_supabase.sql' },
    { table: 'jobs_board', migration: '001_init_supabase.sql' },
    { table: 'app_users', migration: '003_persistence_extras.sql' },
  ];
  const optional = [
    { table: 'business_reviews', migration: '003_persistence_extras.sql' },
    { table: 'membership_payments', migration: '004_payments.sql' },
    { table: 'user_favorites', migration: '005_user_favorites.sql' },
    { table: 'listing_reports', migration: '007_listing_reports.sql' },
    { table: 'directory_categories', migration: '008_categories.sql' },
    { table: 'app_notifications', migration: '009_notifications.sql' },
  ];

  for (const { table, migration } of required) {
    const { error } = await supabaseAdmin.from(table).select('*').limit(1);
    if (error) {
      throw new Error(
        `Supabase table "${table}" is not reachable: ${error.message}. ` +
        `Run backend/migrations/${migration} in the Supabase SQL Editor.`,
      );
    }
  }

  for (const { table, migration } of optional) {
    const { error } = await supabaseAdmin.from(table).select('*').limit(1);
    if (error) {
      console.warn(
        `[storage] Optional table "${table}" missing — reviews will fail until you run ${migration}`,
      );
    }
  }

  return true;
}

module.exports = {
  STORAGE_MODE,
  isSupabaseStorage,
  storageMeta,
  verifySupabaseConnection,
};

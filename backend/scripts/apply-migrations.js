'use strict';

/**
 * Apply SQL migrations to Supabase Postgres.
 *
 * Requires one of:
 *   SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[ref].supabase.co:5432/postgres
 *   SUPABASE_DB_PASSWORD=[your database password from Supabase Dashboard → Settings → Database]
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATION_FILES = [
  '001_init_supabase.sql',
  '003_persistence_extras.sql',
];

function resolveDatabaseUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;

  const password = process.env.SUPABASE_DB_PASSWORD;
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!password || !match) return null;

  const ref = match[1];
  const host = process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`;
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const user = process.env.SUPABASE_DB_USER || 'postgres';
  const database = process.env.SUPABASE_DB_NAME || 'postgres';

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

async function applyMigrations() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    return {
      applied: false,
      reason: 'missing_db_credentials',
      message:
        'Set SUPABASE_DB_URL or SUPABASE_DB_PASSWORD in backend/.env to auto-apply migrations. ' +
        'Or run backend/migrations/003_persistence_extras.sql in Supabase Dashboard → SQL Editor.',
    };
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    for (const file of MIGRATION_FILES) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Migration file not found: ${filePath}`);
      }
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`[migrate] Applying ${file}...`);
      await client.query(sql);
      console.log(`[migrate] OK — ${file}`);
    }
    return { applied: true, files: MIGRATION_FILES };
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  applyMigrations()
    .then((result) => {
      if (!result.applied) {
        console.warn(`[migrate] Skipped: ${result.message}`);
        process.exit(1);
      }
      console.log('[migrate] All migrations applied.');
    })
    .catch((err) => {
      console.error('[migrate] Failed:', err.message);
      process.exit(1);
    });
}

module.exports = { applyMigrations, resolveDatabaseUrl };

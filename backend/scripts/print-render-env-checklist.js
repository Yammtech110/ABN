'use strict';

/**
 * Prints Render env checklist + prepares FIREBASE_SERVICE_ACCOUNT_JSON for paste.
 * Does not print private keys to stdout by default — writes a copy path instead.
 *
 *   node backend/scripts/print-render-env-checklist.js
 *   node backend/scripts/print-render-env-checklist.js --show-firebase
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const backendEnv = path.join(root, 'backend', '.env');
const prodEnv = path.join(root, '.env.production');
const firebaseOneLine = path.join(root, 'backend', 'firebase-service-account.oneline.txt');
const outPaste = path.join(root, 'backend', 'render-firebase-paste.txt');

function readKey(file, key) {
  if (!fs.existsSync(file)) return '';
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : '';
}

const showFirebase = process.argv.includes('--show-firebase');

console.log('\n=== Render STATIC (abn-1) Environment ===');
console.log('VITE_API_BASE_URL=' + (readKey(prodEnv, 'VITE_API_BASE_URL') || 'https://abn-my4f.onrender.com'));
console.log('VITE_SUPABASE_URL=' + (readKey(prodEnv, 'VITE_SUPABASE_URL') || 'https://ogawxkmjrwcujulvnahy.supabase.co'));
console.log('VITE_SUPABASE_ANON_KEY=' + (readKey(prodEnv, 'VITE_SUPABASE_ANON_KEY') || '(from .env.production)'));

console.log('\n=== Render BACKEND (abn-my4f) — SMTP (Brevo) ===');
console.log('SMTP_HOST=smtp-relay.brevo.com');
console.log('SMTP_PORT=587');
console.log('SMTP_SECURE=false');
console.log('SMTP_USER=<Brevo SMTP login>');
console.log('SMTP_PASS=<Brevo SMTP key>');
console.log('SMTP_FROM=ABN <yammtech80@gmail.com>');
console.log('Do NOT set EXPOSE_VERIFY_CODE in production.');

console.log('\n=== Render BACKEND — Firebase push ===');
if (fs.existsSync(firebaseOneLine)) {
  const raw = fs.readFileSync(firebaseOneLine, 'utf8').trim();
  fs.writeFileSync(outPaste, raw, 'utf8');
  console.log('FIREBASE_SERVICE_ACCOUNT_JSON = (paste entire contents of):');
  console.log('  ' + outPaste);
  console.log(`  (${raw.length} chars, one line)`);
  if (showFirebase) {
    console.log(raw);
  }
} else {
  console.log('MISSING backend/firebase-service-account.oneline.txt — regenerate Admin SDK key.');
}

console.log('\nAfter setting env: Manual Deploy both services, then:');
console.log('  curl https://abn-my4f.onrender.com/api/health');
console.log('Expect: email.smtpConfigured=true, push.firebaseConfigured=true\n');

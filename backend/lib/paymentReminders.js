'use strict';

/**
 * Payment / membership expiry reminders (7 / 3 / 1 days before).
 * Runs on an interval inside the API process (Render keeps it warm on Pro).
 */

const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage, directoryProfiles } = require('../db');
const { findByEmail: findUserByEmail } = require('./userStore');
const { createNotification } = require('./notificationStore');

const REMINDER_DAYS = [7, 3, 1];
/** In-memory dedupe: businessId:days → ISO date sent */
const sentKeys = new Map();

const dayDiff = (expiryIso, now = new Date()) => {
  const exp = new Date(String(expiryIso).slice(0, 10) + 'T12:00:00Z');
  if (Number.isNaN(exp.getTime())) return null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.round((exp.getTime() - today.getTime()) / 86400000);
};

async function listActiveListings() {
  if (!isSupabaseStorage()) {
    return directoryProfiles.filter(
      (p) => p.isVerified && p.subscriptionStatus === 'active' && p.membershipExpiry,
    );
  }
  const { data, error } = await supabaseAdmin
    .from('profiles_directory')
    .select('id, email, business_name, membership_expiry, subscription_status, is_verified')
    .eq('is_verified', true)
    .eq('subscription_status', 'active')
    .not('membership_expiry', 'is', null);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    email: row.email,
    businessName: row.business_name,
    membershipExpiry: row.membership_expiry,
  }));
}

async function runPaymentReminders() {
  let listings;
  try {
    listings = await listActiveListings();
  } catch (err) {
    console.warn('[paymentReminders] list failed:', err.message);
    return { sent: 0, error: err.message };
  }

  let sent = 0;
  const todayKey = new Date().toISOString().slice(0, 10);

  for (const listing of listings) {
    const days = dayDiff(listing.membershipExpiry);
    if (days == null || !REMINDER_DAYS.includes(days)) continue;

    const dedupeKey = `${listing.id}:${days}`;
    if (sentKeys.get(dedupeKey) === todayKey) continue;

    let ownerId = null;
    try {
      const owner = await findUserByEmail(listing.email);
      ownerId = owner?.id || null;
    } catch {
      /* ignore */
    }

    const name = listing.businessName || 'Your listing';
    const title =
      days === 1
        ? 'Membership expires tomorrow'
        : `Membership expires in ${days} days`;
    const message =
      `${name} membership expires on ${String(listing.membershipExpiry).slice(0, 10)}. ` +
      `Renew now to keep your listing visible in the ABN directory.`;

    try {
      await createNotification({
        userId: ownerId,
        receiverRole: 'customer',
        title,
        message,
      });
      sentKeys.set(dedupeKey, todayKey);
      sent += 1;
    } catch (err) {
      console.warn('[paymentReminders] notify failed:', err.message);
    }
  }

  if (sent > 0) {
    console.log(`[paymentReminders] Sent ${sent} reminder(s)`);
  }
  return { sent };
}

let timer = null;

function startPaymentReminderScheduler() {
  if (timer) return;
  // First run after 2 minutes (let DB settle), then every 6 hours
  const FIRST_MS = 2 * 60 * 1000;
  const EVERY_MS = 6 * 60 * 60 * 1000;
  setTimeout(() => {
    void runPaymentReminders();
    timer = setInterval(() => {
      void runPaymentReminders();
    }, EVERY_MS);
  }, FIRST_MS);
  console.log('[paymentReminders] Scheduler armed (7/3/1 day expiry alerts)');
}

module.exports = { runPaymentReminders, startPaymentReminderScheduler, REMINDER_DAYS };

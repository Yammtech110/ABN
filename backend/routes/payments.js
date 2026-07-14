/**
 * routes/payments.js — server-persisted membership payment records
 *
 * POST /api/payments/renew  — business owner renews subscription (records payment + activates listing)
 * GET  /api/payments        — admin: all payments
 * GET  /api/payments/mine   — owner: payments for their listing
 */

'use strict';

const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage } = require('../config/storage');
const { createNotification } = require('../lib/notificationStore');
const { findProfileByEmail } = require('../lib/profileStore');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

/** @type {Array<{ id: string, businessId: string, ownerEmail: string, amount: number, date: string, status: string, refNo: string }>} */
const memoryPayments = [];

const mapPayment = (row) => ({
  id:         row.id,
  businessId: row.business_id ?? row.businessId,
  amount:     Number(row.amount),
  date:       row.paid_at ?? row.date,
  status:     row.status,
  refNo:      row.ref_no ?? row.refNo,
});

const generateRefNo = () => `TXN-${Math.floor(Math.random() * 9000000 + 1000000)}`;

const TRIAL_DAYS = 60;

const isMissingPaymentsTable = (err) => {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('membership_payments') && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
};

async function listAllPayments() {
  if (!isSupabaseStorage()) {
    return memoryPayments.map(mapPayment);
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('membership_payments')
      .select('*')
      .order('paid_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapPayment);
  } catch (err) {
    if (!isMissingPaymentsTable(err)) throw err;
    console.warn('[payments] membership_payments table missing — using in-memory store until you run 004_payments.sql');
    return memoryPayments.map(mapPayment);
  }
}

const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

async function findProfileById(id) {
  if (!isSupabaseStorage()) {
    const { directoryProfiles } = require('../db');
    return directoryProfiles.find((p) => p.id === id) || null;
  }
  const { data, error } = await supabaseAdmin
    .from('profiles_directory')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { mapProfileFromDb } = require('../lib/supabaseMappers');
  return mapProfileFromDb(data);
}

async function activateListing(profile, amount) {
  const expiry = addDays(30);
  const updated = {
    ...profile,
    subscriptionStatus: 'active',
    membershipExpiry: expiry,
    subscriptionTier: amount,
  };

  if (!isSupabaseStorage()) {
    const { directoryProfiles } = require('../db');
    const idx = directoryProfiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) directoryProfiles[idx] = updated;
    return updated;
  }

  const { mapProfileToDb } = require('../lib/supabaseMappers');
  const { data, error } = await supabaseAdmin
    .from('profiles_directory')
    .update({
      subscription_status: 'active',
      membership_expiry: expiry,
      subscription_tier: amount,
    })
    .eq('id', profile.id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  const { mapProfileFromDb } = require('../lib/supabaseMappers');
  return mapProfileFromDb(data);
}

// ── POST /api/payments/renew ──────────────────────────────────────────────
router.post('/renew', authenticate, requireRole('customer', 'admin'), async (req, res, next) => {
  try {
    const { businessId, amount } = req.body;

    if (!businessId || amount === undefined) {
      return res.status(400).json({ error: 'businessId and amount are required.' });
    }

    const parsedAmount = Number(amount);
    if (![30, 50].includes(parsedAmount)) {
      return res.status(400).json({ error: 'Invalid plan amount. Must be 30 or 50.' });
    }

    const profile = await findProfileById(businessId);
    if (!profile) return res.status(404).json({ error: 'Business listing not found.' });

    if (profile.email !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You may only renew your own listing.' });
    }

    if (profile.subscriptionStatus === 'pending' && !profile.isVerified) {
      return res.status(403).json({
        error: 'Your listing is still pending admin approval. Payment is available after approval.',
      });
    }

    const refNo = generateRefNo();
    const paidAt = new Date().toISOString().split('T')[0];

    let payment;
    if (!isSupabaseStorage()) {
      payment = {
        id: `pay-${Date.now()}`,
        businessId,
        ownerEmail: req.user.email,
        amount: parsedAmount,
        date: paidAt,
        status: 'success',
        refNo,
      };
      memoryPayments.unshift(payment);
    } else {
      try {
        const { data, error } = await supabaseAdmin
          .from('membership_payments')
          .insert({
            business_id: businessId,
            owner_email: req.user.email,
            amount: parsedAmount,
            status: 'success',
            ref_no: refNo,
            paid_at: paidAt,
          })
          .select('*')
          .single();

        if (error) throw new Error(error.message);
        payment = mapPayment(data);
      } catch (err) {
        if (!isMissingPaymentsTable(err)) {
          return res.status(500).json({ error: err.message });
        }
        payment = {
          id: `pay-${Date.now()}`,
          businessId,
          ownerEmail: req.user.email,
          amount: parsedAmount,
          date: paidAt,
          status: 'success',
          refNo,
        };
        memoryPayments.unshift(payment);
      }
    }

    const activated = await activateListing(profile, parsedAmount);

    try {
      await createNotification({
        userId: req.user.id,
        receiverRole: req.user.role,
        title: 'Subscription Renewed ✓',
        message: `Membership for ${profile.businessName || 'your listing'} renewed for $${parsedAmount}/month. Ref ${refNo}. Active until ${expiry}.`,
      });
    } catch {
      // non-fatal
    }

    res.status(201).json({
      success: true,
      payment: mapPayment(payment),
      profile: activated,
      membershipExpiry: activated.membershipExpiry,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/payments/mine ──────────────────────────────────────────────────
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const profile = await findProfileByEmail(req.user.email);
    if (!profile) return res.json([]);

    if (!isSupabaseStorage()) {
      return res.json(
        memoryPayments
          .filter((p) => p.businessId === profile.id)
          .map(mapPayment),
      );
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('membership_payments')
        .select('*')
        .eq('business_id', profile.id)
        .order('paid_at', { ascending: false });

      if (error) throw new Error(error.message);
      return res.json((data || []).map(mapPayment));
    } catch (err) {
      if (!isMissingPaymentsTable(err)) throw err;
      return res.json(
        memoryPayments
          .filter((p) => p.businessId === profile.id)
          .map(mapPayment),
      );
    }
  } catch (err) {
    next(err);
  }
});

// ── GET /api/payments ───────────────────────────────────────────────────────
router.get('/', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    res.json(await listAllPayments());
  } catch (err) {
    next(err);
  }
});

// ── GET /api/payments/ledger — admin dues overview with trial rows ────────────
router.get('/ledger', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    const payments = await listAllPayments();
    const successful = payments.filter((p) => p.status === 'success');

    let profiles;
    if (!isSupabaseStorage()) {
      const { directoryProfiles } = require('../db');
      profiles = directoryProfiles;
    } else {
      const { data, error } = await supabaseAdmin.from('profiles_directory').select('*');
      if (error) throw new Error(error.message);
      const { mapProfileFromDb } = require('../lib/supabaseMappers');
      profiles = (data || []).map(mapProfileFromDb);
    }

    const paidBizIds = new Set(successful.map((p) => p.businessId));
    const rows = [];

    for (const payment of successful) {
      const profile = profiles.find((p) => p.id === payment.businessId);
      rows.push({
        id: payment.id,
        businessId: payment.businessId,
        businessName: profile?.businessName || 'Unknown listing',
        amount: Number(payment.amount),
        date: payment.date,
        expires: profile?.membershipExpiry || '—',
        refNo: payment.refNo,
        status: 'paid',
      });
    }

    for (const profile of profiles) {
      if (paidBizIds.has(profile.id)) continue;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const createdAt = profile.createdAt ? new Date(profile.createdAt) : null;
      if (createdAt) createdAt.setHours(0, 0, 0, 0);

      const trialEnds = createdAt
        ? new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
        : null;
      if (trialEnds) trialEnds.setHours(0, 0, 0, 0);

      const expiryRaw = profile.membershipExpiry;
      const expiryDate = expiryRaw ? new Date(expiryRaw) : null;
      if (expiryDate) expiryDate.setHours(0, 0, 0, 0);

      const displayExpires = trialEnds
        ? trialEnds.toISOString().split('T')[0]
        : expiryRaw || '—';

      const onTrial = trialEnds ? today <= trialEnds : (
        expiryDate
          ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) > 30
          : true
      );

      rows.push({
        id: `trial-${profile.id}`,
        businessId: profile.id,
        businessName: profile.businessName || 'Unknown listing',
        amount: 0,
        date: profile.createdAt ? String(profile.createdAt).slice(0, 10) : '—',
        expires: displayExpires,
        refNo: onTrial ? 'FREE-TRIAL' : 'UNPAID',
        status: onTrial ? 'trial' : 'unpaid',
      });
    }

    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    res.json({
      rows,
      totalRevenue: successful.reduce((sum, p) => sum + Number(p.amount || 0), 0),
      transactionCount: successful.length,
      activeListings: profiles.filter((p) => p.subscriptionStatus === 'active').length,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

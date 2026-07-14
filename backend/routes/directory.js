/**
 * routes/directory.js — Supabase-backed business directory
 */

'use strict';

const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage, directoryProfiles, jobsBoard, newId, today } = require('../db');
const { mapProfileFromDb, mapProfileToDb } = require('../lib/supabaseMappers');
const { findProfileByEmail } = require('../lib/profileStore');
const { findByEmail: findUserByEmail } = require('../lib/userStore');
const { createNotification } = require('../lib/notificationStore');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const {
  DEFAULT_LOGO,
  DEFAULT_COVER,
  mapProfileForList,
  streamStoredImage,
} = require('../lib/listingMedia');

const router = express.Router();

const TRIAL_DAYS = 60;

const mapProfile = (row) => ({ ...row });

const isPublicListing = (profile) =>
  Boolean(
    profile &&
    profile.isVerified &&
    profile.subscriptionStatus !== 'pending' &&
    profile.subscriptionStatus !== 'suspended' &&
    profile.isActive !== false,
  );

const filterProfiles = (list, { city, category, search, role, publicOnly = false, adminIncludeAll = false }) =>
  list.filter((p) => {
    if (!adminIncludeAll && p.isActive === false) return false;
    if (publicOnly) {
      if (!p.isVerified || p.subscriptionStatus === 'pending') return false;
      if (p.subscriptionStatus === 'suspended') return false;
    }
    if (city && !String(p.city || '').toLowerCase().includes(String(city).toLowerCase())) return false;
    if (category && !String(p.category || '').toLowerCase().includes(String(category).toLowerCase())) return false;
    if (role && p.role !== role) return false;
    if (search) {
      const q = String(search).toLowerCase();
      const hay = `${p.businessName} ${p.description} ${p.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

const sortProfiles = (list) =>
  [...list].sort((a, b) => {
    if (Boolean(b.isVerified) !== Boolean(a.isVerified)) return b.isVerified ? 1 : -1;
    return (b.rating || 0) - (a.rating || 0);
  });

async function syncExpiredMemberships(profiles) {
  const today = new Date().toISOString().slice(0, 10);

  for (const p of profiles) {
    if (!p.membershipExpiry || p.subscriptionStatus !== 'active') continue;
    if (String(p.membershipExpiry).slice(0, 10) >= today) continue;

    p.subscriptionStatus = 'suspended';

    if (!isSupabaseStorage()) {
      const idx = directoryProfiles.findIndex((row) => row.id === p.id);
      if (idx >= 0) directoryProfiles[idx].subscriptionStatus = 'suspended';
    } else {
      await supabaseAdmin
        .from('profiles_directory')
        .update({ subscription_status: 'suspended' })
        .eq('id', p.id);
    }

    try {
      const owner = await findUserByEmail(p.email);
      await createNotification({
        userId: owner?.id || null,
        receiverRole: 'customer',
        title: 'Subscription Expired',
        message: `${p.businessName || 'Your listing'} membership expired on ${String(p.membershipExpiry).slice(0, 10)}. Renew to restore visibility.`,
      });
    } catch {
      // non-fatal
    }
  }

  return profiles;
}

async function fetchAllProfiles() {
  let profiles;
  if (!isSupabaseStorage()) {
    profiles = directoryProfiles.map(mapProfile);
  } else {
    const { data, error } = await supabaseAdmin.from('profiles_directory').select('*');
    if (error) throw new Error(error.message);
    profiles = (data || []).map(mapProfileFromDb);
  }
  return syncExpiredMemberships(profiles);
}

async function findProfileById(id) {
  if (!isSupabaseStorage()) return directoryProfiles.find((p) => p.id === id) || null;

  const { data, error } = await supabaseAdmin
    .from('profiles_directory')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapProfileFromDb(data) : null;
}

// ── GET /api/directory ────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { city, category, search, role } = req.query;
    const results = sortProfiles(
      filterProfiles(await fetchAllProfiles(), { city, category, search, role, publicOnly: true }),
    );
    res.json(results.map((row) => mapProfile(mapProfileForList(row))));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/directory/all ────────────────────────────────────────────────
router.get('/all', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const results = sortProfiles(
      filterProfiles(await fetchAllProfiles(), { adminIncludeAll: true }),
    );
    res.json(results.map((row) => mapProfile(mapProfileForList(row))));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/directory/mine ───────────────────────────────────────────────
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const profile = await findProfileByEmail(req.user.email);
    res.json(profile ? mapProfile(mapProfileForList(profile)) : null);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/directory/:id/logo ─────────────────────────────────────────────
router.get('/:id/logo', async (req, res, next) => {
  try {
    const profile = await findProfileById(req.params.id);
    if (!profile) return res.status(404).end();
    await streamStoredImage(res, profile.imageUrl, profile.coverUrl, DEFAULT_LOGO);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/directory/:id/cover ────────────────────────────────────────────
router.get('/:id/cover', async (req, res, next) => {
  try {
    const profile = await findProfileById(req.params.id);
    if (!profile) return res.status(404).end();
    await streamStoredImage(res, profile.coverUrl, profile.imageUrl, DEFAULT_COVER);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/directory/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const profile = await findProfileById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });
    if (!profile.isVerified || profile.subscriptionStatus === 'pending') {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    res.json(mapProfile(mapProfileForList(profile)));
  } catch (err) {
    next(err);
  }
});

// ── POST /api/directory ───────────────────────────────────────────────────
router.post('/', authenticate, requireRole('customer', 'admin'), async (req, res, next) => {
  try {
    const {
      businessName, category, description,
      imageUrl = '', coverUrl = '',
      address = '', area = '', city = '',
      phone = '', whatsapp = '', website = '',
      workingHours = '', membershipExpiry,
      subscriptionTier, listingType = 'business',
    } = req.body;

    if (!businessName) return res.status(400).json({ error: 'businessName is required.' });
    if (!category) return res.status(400).json({ error: 'category is required.' });
    if (!['business', 'service'].includes(listingType)) {
      return res.status(400).json({ error: 'listingType must be business or service.' });
    }

    if (await findProfileByEmail(req.user.email)) {
      return res.status(409).json({ error: 'A directory profile already exists for your account.' });
    }

    const tier = subscriptionTier ?? (listingType === 'service' ? 30 : 50);
    const expiry = membershipExpiry ||
      new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let savedProfile = {
      id:                 newId('dir'),
      email:              req.user.email,
      listingType,
      businessName,
      category,
      subscriptionStatus: 'pending',
      subscriptionTier:   tier,
      imageUrl,
      coverUrl,
      description:        description || '',
      address,
      area,
      city:               city || 'New York',
      phone,
      whatsapp,
      website,
      workingHours,
      hiringActive:       false,
      isVerified:         false,
      isActive:           true,
      rating:             0,
      reviewsCount:       0,
      membershipExpiry:   expiry,
      createdAt:          new Date().toISOString(),
    };

    if (!isSupabaseStorage()) {
      directoryProfiles.push(savedProfile);
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles_directory')
        .insert(mapProfileToDb(savedProfile, { email: req.user.email }))
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: error.message });
      savedProfile = mapProfile(mapProfileFromDb(data));
    }

    const kindLabel = listingType === 'service' ? 'Service' : 'Business';
    try {
      await createNotification({
        receiverRole: 'admin',
        title: 'New Submission — Vetting Required',
        message: `${businessName} (${kindLabel}) is awaiting admin review.`,
      });
      await createNotification({
        userId: (await findUserByEmail(req.user.email))?.id || req.user.id,
        receiverRole: req.user.role,
        title: 'Application Submitted',
        message: `Your ${kindLabel.toLowerCase()} listing "${businessName}" was submitted and is pending admin approval.`,
      });
    } catch {
      // non-fatal
    }

    return res.status(201).json(mapProfile(savedProfile));
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/directory/:id ──────────────────────────────────────────────
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await findProfileById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Profile not found.' });
    if (existing.email !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const {
      businessName, category, description,
      imageUrl, coverUrl,
      address, area, city,
      phone, whatsapp, website,
      workingHours, membershipExpiry,
      subscriptionStatus, isVerified,
    } = req.body;

    let updated = { ...existing };
    if (businessName       !== undefined) updated.businessName       = businessName;
    if (category           !== undefined) updated.category           = category;
    if (description        !== undefined) updated.description        = description;
    if (imageUrl           !== undefined) updated.imageUrl           = imageUrl;
    if (coverUrl           !== undefined) updated.coverUrl           = coverUrl;
    if (address            !== undefined) updated.address            = address;
    if (area               !== undefined) updated.area               = area;
    if (city               !== undefined) updated.city               = city;
    if (phone              !== undefined) updated.phone              = phone;
    if (whatsapp           !== undefined) updated.whatsapp           = whatsapp;
    if (website            !== undefined) updated.website            = website;
    if (workingHours       !== undefined) updated.workingHours       = workingHours;
    if (membershipExpiry   !== undefined) updated.membershipExpiry   = membershipExpiry;
    // Only admins may change trust/billing state — non-admins silently skip these fields
    if (subscriptionStatus !== undefined && req.user.role === 'admin') updated.subscriptionStatus = subscriptionStatus;
    if (isVerified         !== undefined && req.user.role === 'admin') updated.isVerified         = isVerified;

    if (!isSupabaseStorage()) {
      const idx = directoryProfiles.findIndex((p) => p.id === req.params.id);
      directoryProfiles[idx] = updated;
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles_directory')
        .update(mapProfileToDb(updated))
        .eq('id', req.params.id)
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: error.message });
      updated = mapProfile(mapProfileFromDb(data));
    }

    if (req.user.role === 'admin') {
      const owner = await findUserByEmail(existing.email);
      const ownerId = owner?.id || null;
      const listingName = updated.businessName || existing.businessName || 'Your listing';

      try {
        if (isVerified === true && !existing.isVerified) {
          await createNotification({
            userId: ownerId,
            receiverRole: 'customer',
            title: 'Listing Approved ✓',
            message: `${listingName} passed vetting and is now live in the ABN directory.`,
          });
        } else if (isVerified === false && existing.isVerified) {
          await createNotification({
            userId: ownerId,
            receiverRole: 'customer',
            title: 'Listing Rejected',
            message: `${listingName} was not approved. Contact support if you need help.`,
          });
        }

        if (subscriptionStatus === 'active' && existing.subscriptionStatus === 'pending' && updated.isVerified) {
          await createNotification({
            userId: ownerId,
            receiverRole: 'customer',
            title: 'Listing Activated',
            message: `${listingName} is active. Your 2-month free trial has started.`,
          });
        }

        if (subscriptionStatus === 'suspended' && existing.subscriptionStatus !== 'suspended') {
          await createNotification({
            userId: ownerId,
            receiverRole: 'customer',
            title: 'Listing Suspended',
            message: `${listingName} was suspended by an administrator.`,
          });
        } else if (subscriptionStatus === 'active' && existing.subscriptionStatus === 'suspended') {
          await createNotification({
            userId: ownerId,
            receiverRole: 'customer',
            title: 'Listing Re-Activated',
            message: `${listingName} is visible again in the directory.`,
          });
        }
      } catch {
        // non-fatal
      }
    }

    return res.json(mapProfile(updated));
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/directory/:id ─────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await findProfileById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Profile not found.' });
    if (existing.email !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    if (!isSupabaseStorage()) {
      const idx = directoryProfiles.findIndex((p) => p.id === req.params.id);
      directoryProfiles.splice(idx, 1);
      for (let i = jobsBoard.length - 1; i >= 0; i -= 1) {
        if (jobsBoard[i].businessId === req.params.id) jobsBoard.splice(i, 1);
      }
      return res.status(204).end();
    }

    const { error } = await supabaseAdmin
      .from('profiles_directory')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/directory/:id/hiring ─────────────────────────────────────────
router.put('/:id/hiring', authenticate, requireRole('customer', 'admin'), async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive (boolean) is required.' });
    }

    const profile = await findProfileById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });
    if (profile.email !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    if (profile.listingType !== 'business' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Hiring is only available for registered business listings.' });
    }
    if (!profile.isVerified && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Your listing must be approved before enabling hiring.' });
    }

    if (!isSupabaseStorage()) {
      profile.hiringActive = isActive;
      jobsBoard.forEach((job) => {
        if (job.businessId === req.params.id) job.isActive = isActive;
      });
      return res.json({ businessId: req.params.id, hiringActive: isActive });
    }

    const { error: profileErr } = await supabaseAdmin
      .from('profiles_directory')
      .update({ hiring_active: isActive })
      .eq('id', req.params.id);

    if (profileErr) return res.status(500).json({ error: profileErr.message });

    const { error: jobsErr } = await supabaseAdmin
      .from('jobs_board')
      .update({ is_active: isActive })
      .eq('business_id', req.params.id);

    if (jobsErr) return res.status(500).json({ error: jobsErr.message });

    res.json({ businessId: req.params.id, hiringActive: isActive });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

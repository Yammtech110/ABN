/**
 * routes/directory.js — Supabase-backed business directory
 */

'use strict';

const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage, directoryProfiles, jobsBoard, newId, today } = require('../db');
const { mapProfileFromDb, mapProfileToDb } = require('../lib/supabaseMappers');
const { findProfileByEmail } = require('../lib/profileStore');
const { findByEmail: findUserByEmail, findById: findUserById } = require('../lib/userStore');
const { createNotification } = require('../lib/notificationStore');
const { logAdminAction } = require('../lib/activityLog');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/security');
const {
  mapProfileForList,
  streamStoredImage,
  publicMediaPath,
  normalizeIncomingImage,
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

/** Owner/admin may view logo/cover for pending listings; public only sees approved ones. */
async function mayViewListingMedia(req, profile) {
  if (isPublicListing(profile)) return true;
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return false;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    let user = null;
    if (payload.id) user = await findUserById(payload.id);
    if (!user && payload.email) user = await findUserByEmail(String(payload.email).toLowerCase().trim());
    if (!user || user.isBlocked) return false;
    return user.email === profile.email || user.role === 'admin';
  } catch {
    return false;
  }
}

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
    res.json(results.map((row) => mapProfile(mapProfileForList(row, { includeEmail: true }))));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/directory/mine ───────────────────────────────────────────────
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const profile = await findProfileByEmail(req.user.email);
    res.json(profile ? mapProfile(mapProfileForList(profile, { includeEmail: true })) : null);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/directory/:id/logo ─────────────────────────────────────────────
router.get('/:id/logo', async (req, res, next) => {
  try {
    const profile = await findProfileById(req.params.id);
    if (!profile) return res.status(404).end();
    const allow = await mayViewListingMedia(req, profile);
    await streamStoredImage(res, allow ? profile.imageUrl : '', allow ? profile.coverUrl : '', {
      name: profile.businessName,
      seed: profile.id,
      wide: false,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/directory/:id/cover ────────────────────────────────────────────
router.get('/:id/cover', async (req, res, next) => {
  try {
    const profile = await findProfileById(req.params.id);
    if (!profile) return res.status(404).end();
    const allow = await mayViewListingMedia(req, profile);
    await streamStoredImage(res, allow ? profile.coverUrl : '', allow ? profile.imageUrl : '', {
      name: profile.businessName,
      seed: profile.id,
      wide: true,
    });
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
router.post('/', authenticate, requireRole('customer', 'business', 'service_provider', 'admin'), async (req, res, next) => {
  try {
    const {
      businessName, category, description,
      imageUrl = '', coverUrl = '',
      address = '', area = '', city = '', state = '',
      phone = '', whatsapp = '', website = '',
      workingHours = '',
      listingType = 'business',
    } = req.body;

    if (!businessName) return res.status(400).json({ error: 'businessName is required.' });
    if (!category) return res.status(400).json({ error: 'category is required.' });
    if (!['business', 'service'].includes(listingType)) {
      return res.status(400).json({ error: 'listingType must be business or service.' });
    }

    if (await findProfileByEmail(req.user.email)) {
      return res.status(409).json({ error: 'A directory profile already exists for your account.' });
    }

    // Billing fields are server-owned — ignore client membershipExpiry / subscriptionTier
    const tier = listingType === 'service' ? 30 : 50;
    const expiry = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    let savedProfile = {
      id:                 newId('dir'),
      email:              req.user.email,
      listingType,
      businessName,
      category,
      subscriptionStatus: 'pending',
      subscriptionTier:   tier,
      imageUrl:           normalizeIncomingImage(imageUrl, '') || '',
      coverUrl:           normalizeIncomingImage(coverUrl, '') || '',
      description:        description || '',
      address,
      area,
      city:               city || 'New York',
      state:              String(state || '').trim().toUpperCase().slice(0, 2),
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

      if (error) return res.status(500).json({ error: 'Failed to save listing. Please try again.' });
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

    return res.status(201).json(mapProfile(mapProfileForList(savedProfile, { includeEmail: true })));
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
      address, area, city, state,
      phone, whatsapp, website,
      workingHours, membershipExpiry, subscriptionTier,
      subscriptionStatus, isVerified,
    } = req.body;

    const isAdmin = req.user.role === 'admin';
    // Owners cannot change name/logo/cover directly — use /api/change-requests
    if (!isAdmin) {
      const wantsName =
        businessName !== undefined &&
        String(businessName).trim() !== String(existing.businessName || '').trim();
      const wantsLogo = imageUrl !== undefined && typeof imageUrl === 'string' && imageUrl.startsWith('data:image/');
      const wantsCover = coverUrl !== undefined && typeof coverUrl === 'string' && coverUrl.startsWith('data:image/');
      if (wantsName || wantsLogo || wantsCover) {
        return res.status(403).json({
          error:
            'Name and photos cannot be changed directly. Submit a change request for admin approval.',
          code: 'CHANGE_REQUEST_REQUIRED',
        });
      }
    }

    let updated = { ...existing };
    if (businessName !== undefined && isAdmin) updated.businessName = businessName;
    if (category           !== undefined) updated.category           = category;
    if (description        !== undefined) updated.description        = description;
    if (imageUrl !== undefined && isAdmin) updated.imageUrl = normalizeIncomingImage(imageUrl, existing.imageUrl);
    if (coverUrl !== undefined && isAdmin) updated.coverUrl = normalizeIncomingImage(coverUrl, existing.coverUrl);
    if (address            !== undefined) updated.address            = address;
    if (area               !== undefined) updated.area               = area;
    if (city               !== undefined) updated.city               = city;
    if (state              !== undefined) {
      updated.state = String(state || '').trim().toUpperCase().slice(0, 2);
    }
    if (phone              !== undefined) updated.phone              = phone;
    if (whatsapp           !== undefined) updated.whatsapp           = whatsapp;
    if (website            !== undefined) updated.website            = website;
    if (workingHours       !== undefined) updated.workingHours       = workingHours;
    // Only admins may change billing / trust state
    if (membershipExpiry   !== undefined && isAdmin) updated.membershipExpiry   = membershipExpiry;
    if (subscriptionTier   !== undefined && isAdmin) updated.subscriptionTier   = subscriptionTier;
    if (subscriptionStatus !== undefined && isAdmin) updated.subscriptionStatus = subscriptionStatus;
    if (isVerified         !== undefined && isAdmin) updated.isVerified         = isVerified;

    const logoChanged =
      (imageUrl !== undefined && updated.imageUrl !== existing.imageUrl) ||
      (coverUrl !== undefined && updated.coverUrl !== existing.coverUrl);
    const logoForJobs = publicMediaPath(updated.id, 'logo');

    if (!isSupabaseStorage()) {
      const idx = directoryProfiles.findIndex((p) => p.id === req.params.id);
      directoryProfiles[idx] = updated;
      if (logoChanged || businessName !== undefined) {
        jobsBoard.forEach((job) => {
          if (job.businessId === req.params.id) {
            job.businessLogoUrl = logoForJobs;
            if (businessName !== undefined) job.businessName = businessName;
          }
        });
      }
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles_directory')
        .update(mapProfileToDb(updated))
        .eq('id', req.params.id)
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: 'Failed to save listing. Please try again.' });
      updated = mapProfile(mapProfileFromDb(data));

      if (logoChanged || businessName !== undefined) {
        const jobPatch = { business_logo_url: logoForJobs };
        if (businessName !== undefined) jobPatch.business_name = businessName;
        await supabaseAdmin
          .from('jobs_board')
          .update(jobPatch)
          .eq('business_id', req.params.id);
      }
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
          await logAdminAction({
            admin: req.user,
            action: 'approve_listing',
            targetType: 'listing',
            targetId: updated.id,
            targetName: listingName,
            details: `Approved listing for ${existing.email}`,
          });
        } else if (isVerified === false && existing.isVerified) {
          await createNotification({
            userId: ownerId,
            receiverRole: 'customer',
            title: 'Listing Rejected',
            message: `${listingName} was not approved. Contact support if you need help.`,
          });
          await logAdminAction({
            admin: req.user,
            action: 'reject_listing',
            targetType: 'listing',
            targetId: updated.id,
            targetName: listingName,
            details: `Rejected / unverified listing for ${existing.email}`,
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
          await logAdminAction({
            admin: req.user,
            action: 'suspend_listing',
            targetType: 'listing',
            targetId: updated.id,
            targetName: listingName,
            details: `Suspended listing for ${existing.email}`,
          });
        } else if (subscriptionStatus === 'active' && existing.subscriptionStatus === 'suspended') {
          await createNotification({
            userId: ownerId,
            receiverRole: 'customer',
            title: 'Listing Re-Activated',
            message: `${listingName} is visible again in the directory.`,
          });
          await logAdminAction({
            admin: req.user,
            action: 'reactivate_listing',
            targetType: 'listing',
            targetId: updated.id,
            targetName: listingName,
            details: `Re-activated listing for ${existing.email}`,
          });
        }
      } catch {
        // non-fatal
      }
    }

    return res.json(mapProfile(mapProfileForList(updated, { includeEmail: true })));
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

    if (error) return res.status(500).json({ error: 'Failed to save listing. Please try again.' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/directory/:id/hiring ─────────────────────────────────────────
router.put('/:id/hiring', authenticate, requireRole('customer', 'business', 'service_provider', 'admin'), async (req, res, next) => {
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

    if (profileErr) return res.status(500).json({ error: 'Failed to update hiring status. Please try again.' });

    const { error: jobsErr } = await supabaseAdmin
      .from('jobs_board')
      .update({ is_active: isActive })
      .eq('business_id', req.params.id);

    if (jobsErr) return res.status(500).json({ error: 'Failed to update related jobs. Please try again.' });

    res.json({ businessId: req.params.id, hiringActive: isActive });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

/**
 * routes/changeRequests.js — Owner requests to change listing name / photos (admin approves)
 */

'use strict';

const express = require('express');
const { findProfileById } = require('../lib/profileStore');
const { findByEmail: findUserByEmail } = require('../lib/userStore');
const { createNotification } = require('../lib/notificationStore');
const {
  normalizeIncomingImage,
  publicMediaPath,
  mapProfileForList,
} = require('../lib/listingMedia');
const { mapProfileToDb, mapProfileFromDb } = require('../lib/supabaseMappers');
const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage, directoryProfiles, jobsBoard } = require('../db');
const {
  listChangeRequests,
  findPendingForBusiness,
  findById,
  createChangeRequest,
  updateChangeRequest,
} = require('../lib/changeRequestStore');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
const mapProfile = (row) => ({ ...row });

const hasMeaningfulText = (v) => typeof v === 'string' && v.trim().length > 0;
const isDataOrHttpImage = (v) =>
  typeof v === 'string' &&
  (v.startsWith('data:image/') || /^https?:\/\//i.test(v.trim()));

async function applyListingPatch(existing, patch) {
  let updated = { ...existing, ...patch };

  const logoChanged =
    (patch.imageUrl !== undefined && updated.imageUrl !== existing.imageUrl) ||
    (patch.coverUrl !== undefined && updated.coverUrl !== existing.coverUrl);
  const nameChanged = patch.businessName !== undefined && patch.businessName !== existing.businessName;
  const logoForJobs = publicMediaPath(updated.id, 'logo');

  if (!isSupabaseStorage()) {
    const idx = directoryProfiles.findIndex((p) => p.id === existing.id);
    if (idx >= 0) directoryProfiles[idx] = updated;
    if (logoChanged || nameChanged) {
      jobsBoard.forEach((job) => {
        if (job.businessId === existing.id) {
          job.businessLogoUrl = logoForJobs;
          if (nameChanged) job.businessName = updated.businessName;
        }
      });
    }
    return updated;
  }

  const { data, error } = await supabaseAdmin
    .from('profiles_directory')
    .update(mapProfileToDb(updated))
    .eq('id', existing.id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  updated = mapProfile(mapProfileFromDb(data));

  if (logoChanged || nameChanged) {
    const jobPatch = { business_logo_url: logoForJobs };
    if (nameChanged) jobPatch.business_name = updated.businessName;
    await supabaseAdmin.from('jobs_board').update(jobPatch).eq('business_id', existing.id);
  }
  return updated;
}

// ── GET /api/change-requests — admin inbox ────────────────────────────────
router.get('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const requests = await listChangeRequests(status ? { status } : {});
    res.json({ requests, total: requests.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/change-requests/mine?businessId= — owner pending request ─────
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const businessId = String(req.query.businessId || '').trim();
    if (!businessId) return res.status(400).json({ error: 'businessId is required.' });

    const profile = await findProfileById(businessId);
    if (!profile) return res.status(404).json({ error: 'Listing not found.' });
    if (profile.email !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const pending = await findPendingForBusiness(businessId);
    res.json({ request: pending });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/change-requests — owner submits name/photo change ───────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { businessId, proposedName, proposedImageUrl, proposedCoverUrl, note } = req.body || {};

    if (!businessId || typeof businessId !== 'string') {
      return res.status(400).json({ error: 'businessId is required.' });
    }

    const profile = await findProfileById(businessId);
    if (!profile) return res.status(404).json({ error: 'Listing not found.' });
    if (profile.email !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    if (!profile.isVerified) {
      return res.status(400).json({ error: 'Listing must be approved before requesting name or photo changes.' });
    }

    const existingPending = await findPendingForBusiness(businessId);
    if (existingPending) {
      return res.status(409).json({
        error: 'You already have a pending name/photo change request. Wait for admin review.',
        request: existingPending,
      });
    }

    const nameTrim = hasMeaningfulText(proposedName) ? String(proposedName).trim() : null;
    const logoOk = isDataOrHttpImage(proposedImageUrl) ? String(proposedImageUrl) : null;
    const coverOk = isDataOrHttpImage(proposedCoverUrl) ? String(proposedCoverUrl) : null;

    if (!nameTrim && !logoOk && !coverOk) {
      return res.status(400).json({
        error: 'Provide a new name and/or new logo/cover photo to request a change.',
      });
    }

    if (nameTrim && nameTrim.length > 200) {
      return res.status(400).json({ error: 'Proposed name must be 200 characters or fewer.' });
    }

    if (nameTrim && nameTrim === (profile.businessName || '').trim() && !logoOk && !coverOk) {
      return res.status(400).json({ error: 'Proposed name is the same as your current listing name.' });
    }

    const noteTrim = String(note || '').trim().slice(0, 1000);

    const record = await createChangeRequest({
      businessId,
      ownerEmail: profile.email || req.user.email || '',
      currentName: profile.businessName || '',
      proposedName: nameTrim,
      proposedImageUrl: logoOk,
      proposedCoverUrl: coverOk,
      note: noteTrim,
    });

    try {
      await createNotification({
        userId: null,
        receiverRole: 'admin',
        title: 'Name / Photo Change Request',
        message: `${profile.businessName || 'A listing'} requested a change to ${[
          nameTrim ? 'name' : null,
          logoOk ? 'logo' : null,
          coverOk ? 'cover' : null,
        ].filter(Boolean).join(' & ')}.`,
      });
    } catch {
      // non-fatal
    }

    res.status(201).json({ success: true, request: record });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/change-requests/:id/approve — admin applies changes ─────────
router.post('/:id/approve', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const request = await findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Change request not found.' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}.` });
    }

    const profile = await findProfileById(request.businessId);
    if (!profile) return res.status(404).json({ error: 'Listing no longer exists.' });

    const patch = {};
    if (request.proposedName) patch.businessName = request.proposedName;
    if (request.proposedImageUrl) {
      patch.imageUrl = normalizeIncomingImage(request.proposedImageUrl, profile.imageUrl);
    }
    if (request.proposedCoverUrl) {
      patch.coverUrl = normalizeIncomingImage(request.proposedCoverUrl, profile.coverUrl);
    }

    const updated = Object.keys(patch).length > 0
      ? await applyListingPatch(profile, patch)
      : profile;

    const resolved = await updateChangeRequest(request.id, {
      status: 'approved',
      adminNotes: String(req.body?.adminNotes || '').trim().slice(0, 1000),
      resolvedAt: new Date().toISOString(),
    });

    try {
      const owner = await findUserByEmail(profile.email);
      await createNotification({
        userId: owner?.id || null,
        receiverRole: 'customer',
        title: 'Name / Photo Change Approved',
        message: `Your request for "${request.currentName}" was approved. The directory listing has been updated.`,
      });
    } catch {
      // non-fatal
    }

    res.json({
      success: true,
      request: resolved,
      listing: mapProfile(mapProfileForList(updated)),
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/change-requests/:id/reject — admin declines ─────────────────
router.post('/:id/reject', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const request = await findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Change request not found.' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}.` });
    }

    const resolved = await updateChangeRequest(request.id, {
      status: 'rejected',
      adminNotes: String(req.body?.adminNotes || '').trim().slice(0, 1000),
      resolvedAt: new Date().toISOString(),
    });

    try {
      const owner = await findUserByEmail(request.ownerEmail);
      await createNotification({
        userId: owner?.id || null,
        receiverRole: 'customer',
        title: 'Name / Photo Change Declined',
        message: `Your request for "${request.currentName}" was not approved.${
          resolved.adminNotes ? ` Note: ${resolved.adminNotes}` : ''
        }`,
      });
    } catch {
      // non-fatal
    }

    res.json({ success: true, request: resolved });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

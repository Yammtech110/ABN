/**
 * routes/jobsBoard.js — Supabase-backed jobs board
 */

'use strict';

const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage, directoryProfiles, jobsBoard, newId, newUuid, today } = require('../db');
const { mapJobFromDb, mapJobToDb, mapProfileFromDb } = require('../lib/supabaseMappers');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { publicMediaPath, jobLogoFromProfile, streamStoredImage, sanitizeStoredImage, normalizeIncomingImage } = require('../lib/listingMedia');
const { createNotification } = require('../lib/notificationStore');

const router = express.Router();

const JOB_OWNER_ROLES = ['customer', 'business', 'service_provider', 'admin'];

const VALID_CATEGORIES = ['IT', 'Graphic Designing', 'Developer', 'Chef', 'Maid', 'Others'];

const JOB_ELIGIBLE_LISTING_TYPES = new Set(['business', 'service']);

/** Only verified business directory profiles may post or manage jobs */
const assertJobPostingAllowed = (profile, userRole) => {
  if (userRole === 'admin') return null;

  if (!profile) {
    return {
      status: 404,
      error: 'Register as a business before posting jobs.',
    };
  }

  if (!JOB_ELIGIBLE_LISTING_TYPES.has(profile.listingType)) {
    return {
      status: 403,
      error: 'FIRST REGISTER AS BUSSINESS/SERVICE PROVIDER THEN YOU POST A JOB',
    };
  }

  if (!profile.isVerified) {
    return {
      status: 403,
      error: 'Your listing must be approved by an admin before you can post jobs.',
    };
  }

  if (profile.subscriptionStatus === 'suspended') {
    return {
      status: 403,
      error: 'Your listing is suspended. Renew membership to post jobs.',
    };
  }

  if (profile.subscriptionStatus !== 'active') {
    return {
      status: 403,
      error: 'Your listing must be active before you can post jobs.',
    };
  }

  if (!profile.hiringActive) {
    return {
      status: 403,
      error: 'Hiring is not active on your profile. Enable it first from the Account tab.',
    };
  }

  return null;
};

const mapJob = (row) => ({ ...row });

/** Public job payload: live business logo + job poster image endpoint */
const withPublicJobMedia = (job) => {
  const rawImage = sanitizeStoredImage(job.imageUrl);
  let imageUrl = '';
  if (rawImage) {
    if (/^https?:\/\//i.test(rawImage)) imageUrl = rawImage;
    else if (job.id) imageUrl = `/api/jobsboard/${job.id}/image`;
  }
  return {
    ...job,
    businessLogoUrl: job.businessId
      ? publicMediaPath(job.businessId, 'logo')
      : (job.businessLogoUrl || ''),
    imageUrl,
  };
};

async function fetchAllJobs() {
  if (!isSupabaseStorage()) return jobsBoard.map(mapJob);

  const { data, error } = await supabaseAdmin.from('jobs_board').select('*');
  if (error) throw new Error(error.message);
  return (data || []).map(mapJobFromDb);
}

async function findJobById(id) {
  if (!isSupabaseStorage()) return jobsBoard.find((j) => j.id === id) || null;

  const { data, error } = await supabaseAdmin
    .from('jobs_board')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapJobFromDb(data) : null;
}

async function findProfileByEmail(email) {
  if (!isSupabaseStorage()) return directoryProfiles.find((p) => p.email === email) || null;

  const { data, error } = await supabaseAdmin
    .from('profiles_directory')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapProfileFromDb(data) : null;
}

async function findJobProfileById(id) {
  if (!id) return null;
  if (!isSupabaseStorage()) return directoryProfiles.find((p) => p.id === id) || null;

  const { data, error } = await supabaseAdmin
    .from('profiles_directory')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapProfileFromDb(data) : null;
}

/** Mirror directory expiry sync so job routes don't bypass past-due membership. */
async function applyExpiryGate(profile) {
  if (!profile) return profile;
  const today = new Date().toISOString().slice(0, 10);
  if (!profile.membershipExpiry || profile.subscriptionStatus !== 'active') return profile;
  if (String(profile.membershipExpiry).slice(0, 10) >= today) return profile;

  profile.subscriptionStatus = 'suspended';
  if (!isSupabaseStorage()) {
    const idx = directoryProfiles.findIndex((row) => row.id === profile.id);
    if (idx >= 0) directoryProfiles[idx].subscriptionStatus = 'suspended';
  } else {
    await supabaseAdmin
      .from('profiles_directory')
      .update({ subscription_status: 'suspended' })
      .eq('id', profile.id);
  }
  return profile;
}

/** Public job board: listing must be hiring + verified + active (not pending/suspended). */
const isBusinessHiring = async (businessId) => {
  if (!isSupabaseStorage()) {
    const profile = directoryProfiles.find((p) => p.id === businessId);
    return Boolean(
      profile?.hiringActive &&
      profile?.isActive !== false &&
      profile?.isVerified &&
      profile?.subscriptionStatus === 'active',
    );
  }

  const { data, error } = await supabaseAdmin
    .from('profiles_directory')
    .select('hiring_active, is_active, is_verified, subscription_status')
    .eq('id', businessId)
    .maybeSingle();

  if (error || !data) return false;
  return Boolean(
    data.hiring_active &&
    data.is_active !== false &&
    data.is_verified &&
    data.subscription_status === 'active',
  );
};

// ── GET /api/jobsboard ────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    const allJobs = await fetchAllJobs();

    const hiringChecks = await Promise.all(
      allJobs.map(async (j) => ({ job: j, hiring: await isBusinessHiring(j.businessId) })),
    );

    let results = hiringChecks
      .filter(({ job, hiring }) => job.isActive && hiring)
      .map(({ job }) => job);

    if (category && VALID_CATEGORIES.includes(category)) {
      results = results.filter((j) => j.category === category);
    }

    results.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json(results.map((job) => withPublicJobMedia(mapJob(job))));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/jobsboard/all ────────────────────────────────────────────────
/** Admin-only: every job posting regardless of active/hiring status */
router.get('/all', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const allJobs = await fetchAllJobs();
    allJobs.sort((a, b) => String(b.createdAt || b.postedDate || '').localeCompare(String(a.createdAt || a.postedDate || '')));
    res.json(allJobs.map((job) => withPublicJobMedia(mapJob(job))));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/jobsboard/mine ───────────────────────────────────────────────
router.get('/mine', authenticate, requireRole(...JOB_OWNER_ROLES), async (req, res, next) => {
  try {
    const profile = await findProfileByEmail(req.user.email);
    if (!profile) {
      return res.status(404).json({ error: 'You do not have a directory profile yet.' });
    }
    if (!JOB_ELIGIBLE_LISTING_TYPES.has(profile.listingType)) {
      return res.status(403).json({ error: 'Only registered business or service listings can view job postings here.' });
    }

    const allJobs = await fetchAllJobs();
    const mine = allJobs
      .filter((j) => j.businessId === profile.id)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    res.json(mine.map((job) => withPublicJobMedia(mapJob(job))));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/jobsboard/:id/image ──────────────────────────────────────────
router.get('/:id/image', async (req, res, next) => {
  try {
    const job = await findJobById(req.params.id);
    if (!job) return res.status(404).end();
    if (!job.isActive || !(await isBusinessHiring(job.businessId))) {
      return res.status(404).end();
    }
    await streamStoredImage(res, job.imageUrl, '', {
      name: job.title || job.businessName,
      seed: job.id,
      wide: false,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/jobsboard/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const job = await findJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    // Same visibility as the public list — no inactive / non-hiring job leak
    if (!job.isActive || !(await isBusinessHiring(job.businessId))) {
      return res.status(404).json({ error: 'Job not found.' });
    }
    res.json(withPublicJobMedia(mapJob(job)));
  } catch (err) {
    next(err);
  }
});

// ── POST /api/jobsboard ───────────────────────────────────────────────────
router.post('/', authenticate, requireRole(...JOB_OWNER_ROLES), async (req, res, next) => {
  try {
    const {
      title, category, requirements = '',
      salaryMin, salaryMax, hiringEmail,
      imageUrl = '',
    } = req.body;

    if (!title) return res.status(400).json({ error: 'title is required.' });
    if (!hiringEmail) return res.status(400).json({ error: 'hiringEmail is required.' });
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const min = Number(salaryMin);
    const max = Number(salaryMax);
    // No fixed salary band — only require finite numbers and max > min.
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
      return res.status(400).json({ error: 'salaryMin and salaryMax must be valid numbers (0 or more).' });
    }
    if (max <= min) {
      return res.status(400).json({ error: 'salaryMax must be greater than salaryMin.' });
    }

    let profile = await findProfileByEmail(req.user.email);

    // Admin may post for another listing via businessId (they often have no own profile).
    if (!profile && req.user.role === 'admin' && req.body.businessId) {
      profile = await findJobProfileById(String(req.body.businessId).trim());
    }

    if (!profile) {
      return res.status(400).json({
        error: req.user.role === 'admin'
          ? 'Admin must provide businessId of an existing listing to post a job.'
          : 'Register as a business before posting jobs.',
      });
    }

    // Enforce expiry so suspended-by-date listings cannot keep posting.
    profile = await applyExpiryGate(profile);
    const denied = assertJobPostingAllowed(profile, req.user.role);
    if (denied) {
      return res.status(denied.status).json({ error: denied.error });
    }

    const logoForJob = jobLogoFromProfile(profile);
    const storedImage = normalizeIncomingImage(imageUrl, '') || '';

    const job = {
      id:              isSupabaseStorage() ? newUuid() : newId('job'),
      businessId:      profile.id,
      businessName:    profile.businessName,
      businessLogoUrl: logoForJob,
      imageUrl:        storedImage,
      title,
      category,
      requirements,
      salaryMin:       min,
      salaryMax:       max,
      hiringEmail,
      isActive:        true,
      postedDate:      today(),
      createdAt:       new Date().toISOString(),
    };

    if (!isSupabaseStorage()) {
      jobsBoard.unshift(job);
    } else {
      const { data, error } = await supabaseAdmin
        .from('jobs_board')
        .insert(mapJobToDb(job))
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: 'Failed to save job. Please try again.' });
      const saved = mapJob(mapJobFromDb(data));
      const memIdx = jobsBoard.findIndex((j) => j.id === saved.id);
      if (memIdx >= 0) jobsBoard[memIdx] = saved;
      else jobsBoard.unshift(saved);
      Object.assign(job, saved);
    }

    try {
      await createNotification({
        userId: null,
        receiverRole: 'all',
        title: 'New Job Opening',
        message: `${job.businessName || 'A business'} is hiring: ${job.title} (${job.category}).`,
      });
    } catch {
      // non-fatal
    }

    res.status(201).json(withPublicJobMedia(mapJob(job)));
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/jobsboard/:id ────────────────────────────────────────────────
router.put('/:id', authenticate, requireRole(...JOB_OWNER_ROLES), async (req, res, next) => {
  try {
    const job = await findJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const profile = await findProfileByEmail(req.user.email);
    if (req.user.role !== 'admin') {
      if (!profile || profile.id !== job.businessId) {
        return res.status(403).json({ error: 'You can only edit your own job postings.' });
      }
      if (!JOB_ELIGIBLE_LISTING_TYPES.has(profile.listingType)) {
        return res.status(403).json({ error: 'Only registered business or service listings can manage jobs.' });
      }
    }

    const { title, category, requirements, salaryMin, salaryMax, hiringEmail, isActive, imageUrl } = req.body;

    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const updated = { ...job };
    if (title        !== undefined) updated.title        = title;
    if (category     !== undefined) updated.category     = category;
    if (requirements !== undefined) updated.requirements = requirements;
    if (hiringEmail  !== undefined) updated.hiringEmail  = hiringEmail;
    if (salaryMin !== undefined) updated.salaryMin = Number(salaryMin);
    if (salaryMax !== undefined) updated.salaryMax = Number(salaryMax);
    if (salaryMin !== undefined || salaryMax !== undefined) {
      const min = Number(updated.salaryMin);
      const max = Number(updated.salaryMax);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
        return res.status(400).json({ error: 'salaryMin and salaryMax must be valid numbers (0 or more).' });
      }
      if (max <= min) {
        return res.status(400).json({ error: 'salaryMax must be greater than salaryMin.' });
      }
    }
    if (imageUrl     !== undefined) {
      const next = String(imageUrl ?? '').trim();
      // Empty string clears the poster; API media paths keep the stored blob
      updated.imageUrl = next
        ? (normalizeIncomingImage(next, job.imageUrl) || '')
        : '';
    }
    if (isActive     !== undefined && req.user.role === 'admin') {
      updated.isActive = Boolean(isActive);
    }

    if (!isSupabaseStorage()) {
      const idx = jobsBoard.findIndex((j) => j.id === req.params.id);
      jobsBoard[idx] = updated;
      return res.json(withPublicJobMedia(mapJob(updated)));
    }

    const { data, error } = await supabaseAdmin
      .from('jobs_board')
      .update(mapJobToDb(updated))
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to save job. Please try again.' });
    const saved = mapJob(mapJobFromDb(data));
    const memIdx = jobsBoard.findIndex((j) => j.id === saved.id);
    if (memIdx >= 0) jobsBoard[memIdx] = saved;
    res.json(withPublicJobMedia(saved));
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/jobsboard/:id/active ───────────────────────────────────────
/** Admin block / unblock a job posting */
router.patch('/:id/active', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive (boolean) is required.' });
    }

    const job = await findJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const updated = { ...job, isActive };

    if (!isSupabaseStorage()) {
      const idx = jobsBoard.findIndex((j) => j.id === req.params.id);
      if (idx >= 0) jobsBoard[idx] = updated;
      return res.json(mapJob(updated));
    }

    const { data, error } = await supabaseAdmin
      .from('jobs_board')
      .update({ is_active: isActive })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to save job. Please try again.' });
    const saved = mapJob(mapJobFromDb(data));
    const memIdx = jobsBoard.findIndex((j) => j.id === saved.id);
    if (memIdx >= 0) jobsBoard[memIdx] = saved;
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/jobsboard/:id ─────────────────────────────────────────────
router.delete('/:id', authenticate, requireRole(...JOB_OWNER_ROLES), async (req, res, next) => {
  try {
    const job = await findJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const profile = await findProfileByEmail(req.user.email);
    if (req.user.role !== 'admin') {
      if (!profile || profile.id !== job.businessId) {
        return res.status(403).json({ error: 'You can only delete your own job postings.' });
      }
      if (!JOB_ELIGIBLE_LISTING_TYPES.has(profile.listingType)) {
        return res.status(403).json({ error: 'Only registered business or service listings can manage jobs.' });
      }
    }

    if (!isSupabaseStorage()) {
      const idx = jobsBoard.findIndex((j) => j.id === req.params.id);
      jobsBoard.splice(idx, 1);
      return res.status(204).end();
    }

    const { error } = await supabaseAdmin.from('jobs_board').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: 'Failed to save job. Please try again.' });
    const memIdx = jobsBoard.findIndex((j) => j.id === req.params.id);
    if (memIdx >= 0) jobsBoard.splice(memIdx, 1);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

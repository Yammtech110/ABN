/**
 * routes/directory.js — Supabase-backed business directory
 */

'use strict';

const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage, directoryProfiles, jobsBoard, newId, today } = require('../db');
const { mapProfileFromDb, mapProfileToDb } = require('../lib/supabaseMappers');
const { userOwnsDirectoryProfile, findProfileByEmail } = require('../lib/profileStore');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

const mapProfile = (row) => ({ ...row });

const filterProfiles = (list, { city, category, search, role, publicOnly = false }) =>
  list.filter((p) => {
    if (p.isActive === false) return false;
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

async function fetchAllProfiles() {
  if (!isSupabaseStorage()) return directoryProfiles.map(mapProfile);

  const { data, error } = await supabaseAdmin.from('profiles_directory').select('*');
  if (error) throw new Error(error.message);
  return (data || []).map(mapProfileFromDb);
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
    res.json(results.map(mapProfile));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/directory/all ────────────────────────────────────────────────
router.get('/all', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const results = sortProfiles(filterProfiles(await fetchAllProfiles(), {}));
    res.json(results.map(mapProfile));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/directory/mine ───────────────────────────────────────────────
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    if (!userOwnsDirectoryProfile(req.user.role)) {
      return res.json(null);
    }

    const profile = await findProfileByEmail(req.user.email);
    res.json(profile ? mapProfile(profile) : null);
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
    res.json(mapProfile(profile));
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
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const profile = {
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
      directoryProfiles.push(profile);
      return res.status(201).json(mapProfile(profile));
    }

    const { data, error } = await supabaseAdmin
      .from('profiles_directory')
      .insert(mapProfileToDb(profile, { email: req.user.email }))
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(mapProfile(mapProfileFromDb(data)));
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

    const updated = { ...existing };
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
    if (subscriptionStatus !== undefined) updated.subscriptionStatus = subscriptionStatus;
    if (isVerified         !== undefined) updated.isVerified         = isVerified;

    if (!isSupabaseStorage()) {
      const idx = directoryProfiles.findIndex((p) => p.id === req.params.id);
      directoryProfiles[idx] = updated;
      return res.json(mapProfile(updated));
    }

    const { data, error } = await supabaseAdmin
      .from('profiles_directory')
      .update(mapProfileToDb(updated))
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(mapProfile(mapProfileFromDb(data)));
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
      return res.status(403).json({ error: 'Hiring is only available for business listings.' });
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

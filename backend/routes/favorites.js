/**
 * routes/favorites.js — per-user saved business favorites (cross-device sync)
 *
 * GET    /api/favorites              — list favorite IDs + live listing profiles
 * POST   /api/favorites/:businessId  — save a favorite
 * DELETE /api/favorites/:businessId  — remove a favorite
 */

'use strict';

const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage } = require('../db');
const { authenticate } = require('../middleware/authMiddleware');
const { findProfileById } = require('../lib/profileStore');
const { mapProfileForList } = require('../lib/listingMedia');

const router = express.Router();

/** @type {Array<{ userId: string, businessId: string, createdAt: string }>} */
const memoryFavorites = [];

let favoritesUseMemory = !isSupabaseStorage();

const isMissingFavoritesTable = (err) => {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('user_favorites') && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find')
  );
};

const enableMemoryFallback = () => {
  if (favoritesUseMemory) return;
  favoritesUseMemory = true;
  console.warn('[favorites] user_favorites table missing — using in-memory store until you run 005_user_favorites.sql');
};

async function listFavoriteIds(userId) {
  if (favoritesUseMemory) {
    return memoryFavorites
      .filter((f) => f.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((f) => f.businessId);
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_favorites')
      .select('business_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map((row) => String(row.business_id));
  } catch (err) {
    if (!isMissingFavoritesTable(err)) throw err;
    enableMemoryFallback();
    return listFavoriteIds(userId);
  }
}

async function businessExists(businessId) {
  const profile = await findProfileById(businessId);
  return Boolean(profile && profile.isActive !== false);
}

const isLiveListing = (profile) =>
  Boolean(
    profile &&
    profile.isVerified &&
    profile.subscriptionStatus !== 'pending' &&
    profile.subscriptionStatus !== 'suspended' &&
    profile.isActive !== false,
  );

async function fetchLiveListingsForIds(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];

  const listings = [];
  for (const id of unique) {
    const profile = await findProfileById(id);
    if (isLiveListing(profile)) listings.push(mapProfileForList(profile));
  }
  return listings;
}

async function saveFavorite(userId, businessId) {
  if (favoritesUseMemory) {
    if (!memoryFavorites.some((f) => f.userId === userId && f.businessId === businessId)) {
      memoryFavorites.push({
        userId,
        businessId,
        createdAt: new Date().toISOString(),
      });
    }
    return;
  }

  try {
    const { error } = await supabaseAdmin
      .from('user_favorites')
      .upsert(
        { user_id: userId, business_id: businessId },
        { onConflict: 'user_id,business_id', ignoreDuplicates: true },
      );

    if (error) throw new Error(error.message);
  } catch (err) {
    if (!isMissingFavoritesTable(err)) throw err;
    enableMemoryFallback();
    await saveFavorite(userId, businessId);
  }
}

async function removeFavorite(userId, businessId) {
  if (favoritesUseMemory) {
    const idx = memoryFavorites.findIndex(
      (f) => f.userId === userId && f.businessId === businessId,
    );
    if (idx >= 0) memoryFavorites.splice(idx, 1);
    return;
  }

  try {
    const { error } = await supabaseAdmin
      .from('user_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('business_id', businessId);

    if (error) throw new Error(error.message);
  } catch (err) {
    if (!isMissingFavoritesTable(err)) throw err;
    enableMemoryFallback();
    await removeFavorite(userId, businessId);
  }
}

// ── GET /api/favorites ──────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const businessIds = await listFavoriteIds(req.user.id);
    const listings = await fetchLiveListingsForIds(businessIds);
    res.json({ businessIds, listings });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/favorites/:businessId ───────────────────────────────────────
router.post('/:businessId', authenticate, async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required.' });
    }

    if (!(await businessExists(businessId))) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const profile = await findProfileById(businessId);
    if (!isLiveListing(profile)) {
      return res.status(400).json({ error: 'Only active directory listings can be saved.' });
    }

    await saveFavorite(userId, businessId);

    const businessIds = await listFavoriteIds(userId);
    const listings = await fetchLiveListingsForIds(businessIds);
    res.status(201).json({ businessIds, listings });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/favorites/:businessId ─────────────────────────────────────
router.delete('/:businessId', authenticate, async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required.' });
    }

    await removeFavorite(userId, businessId);

    const businessIds = await listFavoriteIds(userId);
    const listings = await fetchLiveListingsForIds(businessIds);
    res.json({ businessIds, listings });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

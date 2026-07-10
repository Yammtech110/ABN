/**
 * routes/reviews.js — Supabase-backed star ratings
 */

'use strict';

const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage, reviews, newId, today } = require('../db');
const { mapReviewFromDb } = require('../lib/supabaseMappers');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

const mapReview = (r) => ({
  id:         r.id,
  businessId: r.businessId,
  userId:     r.userId,
  userName:   r.userName,
  rating:     r.rating ?? r.ratingScore,
  comment:    r.comment,
  date:       r.date,
});

const aggregateForBusiness = (list, businessId) => {
  const bizReviews = list.filter((r) => r.businessId === businessId);
  if (bizReviews.length === 0) return { avg: 0, count: 0 };
  const avg = bizReviews.reduce((s, r) => s + (r.rating ?? r.ratingScore), 0) / bizReviews.length;
  return { avg: Math.round(avg * 10) / 10, count: bizReviews.length };
};

async function fetchReviewsForBusiness(businessId) {
  if (!isSupabaseStorage()) {
    return reviews.filter((r) => r.businessId === businessId);
  }

  const { data, error } = await supabaseAdmin
    .from('business_reviews')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(mapReviewFromDb);
}

// ── GET /api/reviews?businessId= ──────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { businessId } = req.query;
    if (!businessId) {
      return res.status(400).json({ error: 'businessId query param is required.' });
    }

    const list = (await fetchReviewsForBusiness(businessId)).map(mapReview);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/reviews ─────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { businessId, rating, comment = '' } = req.body;

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required.' });
    }

    const ratingScore = Number(rating);
    if (!Number.isInteger(ratingScore) || ratingScore < 1 || ratingScore > 5) {
      return res.status(400).json({ error: 'rating must be an integer between 1 and 5.' });
    }

    const userId = req.user.id;
    const existingList = await fetchReviewsForBusiness(businessId);
    if (existingList.some((r) => r.userId === userId)) {
      return res.status(409).json({ error: 'You have already reviewed this listing.' });
    }

    const record = {
      id:          newId('rev'),
      userId,
      businessId,
      ratingScore,
      comment:     String(comment || '').trim(),
      userName:    req.user.name || req.user.email?.split('@')[0] || 'Community Member',
      date:        today(),
      createdAt:   new Date().toISOString(),
    };

    if (!isSupabaseStorage()) {
      reviews.unshift(record);
      const stats = aggregateForBusiness(reviews, businessId);
      return res.status(201).json({ review: mapReview(record), aggregate: stats });
    }

    const { data, error } = await supabaseAdmin
      .from('business_reviews')
      .insert({
        user_id:      userId,
        business_id:  businessId,
        rating_score: ratingScore,
        comment:      record.comment,
        user_name:    record.userName,
        review_date:  record.date,
      })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const all = await fetchReviewsForBusiness(businessId);
    const stats = aggregateForBusiness(all, businessId);

    res.status(201).json({
      review: mapReview(mapReviewFromDb(data)),
      aggregate: stats,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

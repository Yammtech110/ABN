/**
 * routes/reviews.js — Supabase-backed star ratings + owner replies
 */

'use strict';

const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage, reviews, directoryProfiles, newId, today } = require('../db');
const { mapReviewFromDb, mapProfileFromDb } = require('../lib/supabaseMappers');
const { authenticate } = require('../middleware/authMiddleware');
const { createNotification } = require('../lib/notificationStore');
const { findByEmail: findUserByEmail } = require('../lib/userStore');

const router = express.Router();

const mapReview = (r) => ({
  id:           r.id,
  businessId:   r.businessId,
  userId:       r.userId,
  userName:     r.userName,
  rating:       r.rating ?? r.ratingScore,
  comment:      r.comment,
  date:         r.date,
  ownerReply:   r.ownerReply || '',
  ownerReplyAt: r.ownerReplyAt || null,
  ownerReplyBy: r.ownerReplyBy || '',
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

async function findReviewById(id) {
  if (!isSupabaseStorage()) {
    return reviews.find((r) => r.id === id) || null;
  }
  const { data, error } = await supabaseAdmin
    .from('business_reviews')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapReviewFromDb(data) : null;
}

async function findListingById(id) {
  if (!isSupabaseStorage()) {
    return directoryProfiles.find((p) => p.id === id) || null;
  }
  const { data, error } = await supabaseAdmin
    .from('profiles_directory')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapProfileFromDb(data) : null;
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
      id:           newId('rev'),
      userId,
      businessId,
      ratingScore,
      comment:      String(comment || '').trim(),
      userName:     req.user.name || req.user.email?.split('@')[0] || 'Community Member',
      date:         today(),
      createdAt:    new Date().toISOString(),
      ownerReply:   '',
      ownerReplyAt: null,
      ownerReplyBy: '',
    };

    if (!isSupabaseStorage()) {
      reviews.unshift(record);
      const stats = aggregateForBusiness(reviews, businessId);
      const profile = directoryProfiles.find((p) => p.id === businessId);
      if (profile) {
        profile.rating = stats.avg;
        profile.reviewsCount = stats.count;
      }
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

    await supabaseAdmin
      .from('profiles_directory')
      .update({ rating: stats.avg, reviews_count: stats.count })
      .eq('id', businessId);

    res.status(201).json({
      review: mapReview(mapReviewFromDb(data)),
      aggregate: stats,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/reviews/:id/reply — listing owner replies ───────────────────
router.post('/:id/reply', authenticate, async (req, res, next) => {
  try {
    const reply = String(req.body?.reply || '').trim().slice(0, 2000);
    if (!reply) {
      return res.status(400).json({ error: 'reply is required.' });
    }

    const review = await findReviewById(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found.' });

    const listing = await findListingById(review.businessId);
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });

    const isOwner = listing.email && listing.email === req.user.email;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the listing owner can reply to reviews.' });
    }

    const ownerName = req.user.name || req.user.email?.split('@')[0] || 'Owner';
    const repliedAt = new Date().toISOString();

    if (!isSupabaseStorage()) {
      const idx = reviews.findIndex((r) => r.id === review.id);
      if (idx < 0) return res.status(404).json({ error: 'Review not found.' });
      reviews[idx] = {
        ...reviews[idx],
        ownerReply: reply,
        ownerReplyAt: repliedAt,
        ownerReplyBy: ownerName,
      };
      return res.json({ review: mapReview(reviews[idx]) });
    }

    const { data, error } = await supabaseAdmin
      .from('business_reviews')
      .update({
        owner_reply: reply,
        owner_reply_at: repliedAt,
        owner_reply_by: ownerName,
      })
      .eq('id', review.id)
      .select('*')
      .single();

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('owner_reply')) {
        return res.status(503).json({
          error: 'Review replies are not enabled yet. Run migration 015_review_replies.sql in Supabase.',
        });
      }
      return res.status(500).json({ error: error.message });
    }

    try {
      if (review.userId) {
        await createNotification({
          userId: review.userId,
          receiverRole: 'customer',
          title: 'Owner replied to your review',
          message: `${listing.businessName || 'A business'} replied to your review.`,
        });
      } else {
        const reviewer = await findUserByEmail(review.userName);
        if (reviewer?.id) {
          await createNotification({
            userId: reviewer.id,
            receiverRole: 'customer',
            title: 'Owner replied to your review',
            message: `${listing.businessName || 'A business'} replied to your review.`,
          });
        }
      }
    } catch {
      // non-fatal
    }

    res.json({ review: mapReview(mapReviewFromDb(data)) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

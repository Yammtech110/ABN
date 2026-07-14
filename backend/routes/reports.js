/**
 * routes/reports.js — Community integrity / flagged listing reports
 */

'use strict';

const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage, listingReports, newId, today } = require('../db');
const { mapReportFromDb } = require('../lib/supabaseMappers');
const { findProfileById } = require('../lib/profileStore');
const { createNotification } = require('../lib/notificationStore');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

const isMissingReportsTable = (err) => {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('listing_reports') && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
};

const mapReport = (report) => ({
  id:            report.id,
  businessId:    report.businessId,
  businessName:  report.businessName,
  reporterId:    report.reporterId,
  reporterName:  report.reporterName,
  reporterEmail: report.reporterEmail,
  reason:        report.reason,
  status:        report.status,
  adminNotes:    report.adminNotes || '',
  date:          report.date || today(),
  resolvedAt:    report.resolvedAt || null,
});

async function fetchAllReports() {
  if (!isSupabaseStorage()) {
    return [...listingReports].sort(
      (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime(),
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('listing_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapReportFromDb);
  } catch (err) {
    if (isMissingReportsTable(err)) {
      console.warn('[reports] listing_reports table missing — using in-memory store until you run 007_listing_reports.sql');
      return [...listingReports].sort(
        (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime(),
      );
    }
    throw err;
  }
}

async function findOpenReportForUser(businessId, reporterId) {
  const all = await fetchAllReports();
  return all.find(
    (report) => report.businessId === businessId && report.reporterId === reporterId && report.status === 'open',
  ) || null;
}

// ── GET /api/reports — admin inbox ──────────────────────────────────────────
router.get('/', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    const reports = (await fetchAllReports()).map(mapReport);
    res.json({ reports, total: reports.length });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/reports — submit a flagged listing report ─────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { businessId, reason } = req.body;

    if (!businessId || typeof businessId !== 'string') {
      return res.status(400).json({ error: 'businessId is required.' });
    }

    const trimmedReason = String(reason || '').trim();
    if (trimmedReason.length < 10) {
      return res.status(400).json({ error: 'Please describe the issue in at least 10 characters.' });
    }
    if (trimmedReason.length > 2000) {
      return res.status(400).json({ error: 'Report details must be 2000 characters or fewer.' });
    }

    const profile = await findProfileById(businessId);
    if (!profile) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const reporterId = req.user.id;
    const existingOpen = await findOpenReportForUser(businessId, reporterId);
    if (existingOpen) {
      return res.status(409).json({ error: 'You already have an open report for this listing.' });
    }

    const record = {
      id:            newId('rep'),
      businessId,
      businessName:  profile.businessName || profile.name || 'Unknown listing',
      reporterId,
      reporterName:  req.user.name || req.user.email?.split('@')[0] || 'Community Member',
      reporterEmail: req.user.email || '',
      reason:        trimmedReason,
      status:        'open',
      adminNotes:    '',
      date:          today(),
      createdAt:     new Date().toISOString(),
      resolvedAt:    null,
    };

    if (!isSupabaseStorage()) {
      listingReports.unshift(record);
    } else {
      try {
        const { data, error } = await supabaseAdmin
          .from('listing_reports')
          .insert({
            business_id:    businessId,
            business_name:  record.businessName,
            reporter_id:    reporterId,
            reporter_name:  record.reporterName,
            reporter_email: record.reporterEmail,
            reason:         trimmedReason,
            status:         'open',
          })
          .select('*')
          .single();

        if (error) throw new Error(error.message);
        Object.assign(record, mapReportFromDb(data));
      } catch (err) {
        if (!isMissingReportsTable(err)) throw err;
        console.warn('[reports] listing_reports table missing — storing report in memory.');
        listingReports.unshift(record);
      }
    }

    try {
      await createNotification({
        receiverRole: 'admin',
        title: 'New Integrity Report',
        message: `${record.reporterName} flagged "${record.businessName}". Review in Admin → Users.`,
      });
      await createNotification({
        userId: reporterId,
        receiverRole: 'customer',
        title: 'Report Submitted',
        message: `Your report about "${record.businessName}" was received. Admins will review it soon.`,
      });
    } catch {
      // non-fatal
    }

    return res.status(201).json({ report: mapReport(record) });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/reports/:id/resolve — admin marks report handled ─────────────
router.patch('/:id/resolve', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolved = true, adminNotes = '' } = req.body;

    let updated;

    if (!isSupabaseStorage()) {
      const idx = listingReports.findIndex((report) => report.id === id);
      if (idx < 0) return res.status(404).json({ error: 'Report not found.' });

      updated = {
        ...listingReports[idx],
        status: resolved ? 'resolved' : 'open',
        adminNotes: String(adminNotes || '').trim(),
        resolvedAt: resolved ? new Date().toISOString() : null,
      };
      listingReports[idx] = updated;
    } else {
      const patch = {
        status: resolved ? 'resolved' : 'open',
        admin_notes: String(adminNotes || '').trim(),
        resolved_at: resolved ? new Date().toISOString() : null,
      };

      try {
        const { data, error } = await supabaseAdmin
          .from('listing_reports')
          .update(patch)
          .eq('id', id)
          .select('*')
          .single();

        if (error) throw new Error(error.message);
        if (!data) return res.status(404).json({ error: 'Report not found.' });
        updated = mapReportFromDb(data);
      } catch (err) {
        if (!isMissingReportsTable(err)) throw err;

        const idx = listingReports.findIndex((report) => report.id === id);
        if (idx < 0) return res.status(404).json({ error: 'Report not found.' });

        updated = {
          ...listingReports[idx],
          status: resolved ? 'resolved' : 'open',
          adminNotes: String(adminNotes || '').trim(),
          resolvedAt: resolved ? new Date().toISOString() : null,
        };
        listingReports[idx] = updated;
      }
    }

    if (resolved && updated.reporterId) {
      try {
        await createNotification({
          userId: updated.reporterId,
          receiverRole: 'customer',
          title: 'Report Resolved',
          message: `Your report about "${updated.businessName}" was reviewed and marked resolved.`,
        });
      } catch {
        // non-fatal
      }
    }

    return res.json({ report: mapReport(updated) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

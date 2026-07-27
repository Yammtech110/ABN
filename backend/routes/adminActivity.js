/**
 * routes/adminActivity.js — Admin audit log inbox
 */

'use strict';

const express = require('express');
const { listAdminActivity } = require('../lib/activityLog');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const logs = await listAdminActivity({ limit });
    res.json({ logs, total: logs.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

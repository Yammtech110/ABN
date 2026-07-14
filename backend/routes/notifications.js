'use strict';

const express = require('express');
const {
  createNotification,
  listNotificationsForUser,
  markAllReadForUser,
  clearNotificationsForUser,
} = require('../lib/notificationStore');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

const VALID_ROLES = new Set(['customer', 'business', 'service_provider', 'admin', 'all']);

const mapNotification = (n) => ({
  id:           n.id,
  title:        n.title,
  message:      n.message,
  date:         n.date,
  isRead:       Boolean(n.isRead),
  receiverRole: n.receiverRole,
  userId:       n.userId || null,
});

// ── GET /api/notifications ──────────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const notifications = (await listNotificationsForUser(req.user)).map(mapNotification);
    res.json({ notifications, total: notifications.length });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/notifications — authenticated users + admin broadcasts ────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { title, message, receiverRole = 'all', userId = null } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'title and message are required.' });
    }
    if (!VALID_ROLES.has(receiverRole)) {
      return res.status(400).json({ error: 'Invalid receiverRole.' });
    }
    if (req.user.role !== 'admin' && receiverRole !== req.user.role && receiverRole !== 'all') {
      return res.status(403).json({ error: 'You can only create notifications for your own role.' });
    }
    if (userId && req.user.role !== 'admin' && userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only create notifications for yourself.' });
    }

    const notification = await createNotification({
      userId: userId || (receiverRole === req.user.role ? req.user.id : null),
      receiverRole,
      title: String(title).trim(),
      message: String(message).trim(),
    });

    res.status(201).json({ notification: mapNotification(notification) });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/notifications/read-all ───────────────────────────────────────
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await markAllReadForUser(req.user);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/notifications — clear inbox for current user ────────────────
router.delete('/', authenticate, async (req, res, next) => {
  try {
    await clearNotificationsForUser(req.user);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

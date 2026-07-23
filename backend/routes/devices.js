'use strict';

const express = require('express');
const { upsertDeviceToken, removeDeviceToken } = require('../lib/deviceTokens');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

const VALID_PLATFORMS = new Set(['android', 'ios', 'web']);

// ── POST /api/devices/register — save FCM / APNs token for current user ─────
router.post('/register', authenticate, async (req, res, next) => {
  try {
    const { token, platform = 'android' } = req.body || {};
    if (!token || typeof token !== 'string' || token.trim().length < 20) {
      return res.status(400).json({ error: 'A valid device push token is required.' });
    }
    if (!VALID_PLATFORMS.has(platform)) {
      return res.status(400).json({ error: 'platform must be android, ios, or web.' });
    }

    const saved = await upsertDeviceToken({
      userId: req.user.id,
      userRole: req.user.role,
      token: token.trim(),
      platform,
    });

    res.status(201).json({
      success: true,
      device: {
        userId: saved.userId,
        platform: saved.platform,
        updatedAt: saved.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/devices/register — unregister this device token ─────────────
router.delete('/register', authenticate, async (req, res, next) => {
  try {
    const token = (req.body && req.body.token) || req.query.token;
    if (!token) {
      return res.status(400).json({ error: 'token is required.' });
    }
    await removeDeviceToken(String(token));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

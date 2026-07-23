'use strict';

/**
 * FCM push sender via Firebase Admin SDK.
 *
 * Env (pick one):
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — full service-account JSON as a single-line string
 *   or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *
 * Without credentials, createNotification still saves in-app rows; push is skipped.
 */

const { listTokensForNotification, removeDeviceToken } = require('./deviceTokens');

let messaging = null;
let initAttempted = false;

function initFirebase() {
  if (initAttempted) return messaging;
  initAttempted = true;

  try {
    // eslint-disable-next-line global-require
    const admin = require('firebase-admin');
    if (admin.apps.length) {
      messaging = admin.messaging();
      return messaging;
    }

    let credential;
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawJson && rawJson.trim()) {
      const parsed = JSON.parse(rawJson);
      if (parsed.private_key) {
        parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n');
      }
      credential = admin.credential.cert(parsed);
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: String(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n'),
      });
    } else {
      console.warn('[push] Firebase credentials not set — device push disabled (in-app notifications still work).');
      return null;
    }

    admin.initializeApp({ credential });
    messaging = admin.messaging();
    console.log('[push] Firebase Admin initialized — FCM ready.');
    return messaging;
  } catch (err) {
    console.warn('[push] Firebase init failed:', err.message || err);
    return null;
  }
}

async function sendPushForNotification(notification) {
  const msg = initFirebase();
  if (!msg) return { sent: 0, skipped: true };

  const tokens = await listTokensForNotification({
    userId: notification.userId || null,
    receiverRole: notification.receiverRole || 'all',
  });

  if (!tokens.length) return { sent: 0 };

  const tokenStrings = [...new Set(tokens.map((t) => t.token).filter(Boolean))];
  const title = String(notification.title || 'ABN').slice(0, 100);
  const body = String(notification.message || '').slice(0, 240);

  const response = await msg.sendEachForMulticast({
    tokens: tokenStrings,
    notification: { title, body },
    data: {
      type: 'abn_notification',
      title,
      body,
      notificationId: String(notification.id || ''),
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'abn_default',
        sound: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  });

  // Drop invalid / unregistered tokens
  const stale = [];
  response.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code || '';
    if (
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token') ||
      code.includes('invalid-argument')
    ) {
      stale.push(tokenStrings[i]);
    }
  });
  await Promise.all(stale.map((t) => removeDeviceToken(t).catch(() => {})));

  return {
    sent: response.successCount,
    failed: response.failureCount,
    removed: stale.length,
  };
}

/** Fire-and-forget wrapper used by notificationStore */
function enqueuePush(notification) {
  setImmediate(() => {
    sendPushForNotification(notification).catch((err) => {
      console.warn('[push] send failed:', err.message || err);
    });
  });
}

module.exports = {
  sendPushForNotification,
  enqueuePush,
  initFirebase,
};

'use strict';

/**
 * FCM push sender via Firebase Admin SDK.
 *
 * Env (pick one):
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — full service-account JSON as a single-line string (Render)
 *   FIREBASE_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS — path to JSON file (local)
 *   or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *
 * Without credentials, createNotification still saves in-app rows; push is skipped.
 */

const { listTokensForNotification, removeDeviceToken } = require('./deviceTokens');

let messaging = null;
let initAttempted = false;

function makeCredential(admin, parsed) {
  if (parsed.private_key) {
    parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n');
  }
  // firebase-admin v14+: admin.cert(); older: admin.credential.cert()
  if (typeof admin.cert === 'function') return admin.cert(parsed);
  return admin.credential.cert(parsed);
}

function getMessagingInstance(admin) {
  try {
    // eslint-disable-next-line global-require
    const { getMessaging } = require('firebase-admin/messaging');
    return getMessaging();
  } catch {
    return admin.messaging();
  }
}

function initFirebase() {
  if (initAttempted) return messaging;
  initAttempted = true;

  try {
    // eslint-disable-next-line global-require
    const admin = require('firebase-admin');
    const existing =
      typeof admin.getApps === 'function' ? admin.getApps() : admin.apps || [];
    if (existing.length) {
      messaging = getMessagingInstance(admin);
      return messaging;
    }

    let credential;
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const saPath =
      (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim() ||
      (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();

    if (rawJson && rawJson.trim()) {
      credential = makeCredential(admin, JSON.parse(rawJson));
    } else if (saPath) {
      // Local/dev: path to downloaded service-account JSON (never commit the file)
      // eslint-disable-next-line global-require
      const fs = require('fs');
      // eslint-disable-next-line global-require
      const path = require('path');
      const resolved = path.isAbsolute(saPath) ? saPath : path.resolve(process.cwd(), saPath);
      credential = makeCredential(admin, JSON.parse(fs.readFileSync(resolved, 'utf8')));
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      credential = makeCredential(admin, {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: String(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n'),
      });
    } else {
      console.warn('[push] Firebase credentials not set — device push disabled (in-app notifications still work).');
      return null;
    }

    admin.initializeApp({ credential });
    messaging = getMessagingInstance(admin);
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

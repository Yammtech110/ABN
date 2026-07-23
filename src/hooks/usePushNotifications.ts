// src/hooks/usePushNotifications.ts
// Registers FCM / APNs device token with the API and opens Notifications on tap.

import { useEffect, useRef } from 'react';
import { apiUrl } from '../lib/api';

const OPEN_EVENT = 'abn:open-notifications';

const isNativeApp = (): boolean => {
  try {
    const cap = (window as any).Capacitor;
    return cap != null && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
  } catch {
    return false;
  }
};

async function postToken(apiToken: string, deviceToken: string, platform: 'android' | 'ios') {
  const res = await fetch(apiUrl('/api/devices/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ token: deviceToken, platform }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Register failed (${res.status})`);
  }
}

/**
 * When signed in on a native Capacitor build, request permission, get FCM token,
 * and register it with the backend. Tapping a push opens the notifications screen.
 */
export function usePushNotifications(
  apiToken: string | null,
  enabled: boolean,
) {
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !apiToken || !isNativeApp()) return;

    let cancelled = false;
    const listeners: { remove: () => Promise<void> | void }[] = [];

    const run = async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== 'granted') {
          console.warn('[ABN Push] Permission not granted');
          return;
        }

        await PushNotifications.register();

        listeners.push(
          await PushNotifications.addListener('registration', async (token) => {
            if (cancelled || !token?.value) return;
            if (registeredRef.current === token.value) return;
            try {
              const platform =
                (window as any).Capacitor?.getPlatform?.() === 'ios' ? 'ios' : 'android';
              await postToken(apiToken, token.value, platform);
              registeredRef.current = token.value;
              console.log('[ABN Push] Device token registered');
            } catch (err) {
              console.warn('[ABN Push] Could not save token:', err);
            }
          }),
        );

        listeners.push(
          await PushNotifications.addListener('registrationError', (err) => {
            console.warn('[ABN Push] Registration error:', err);
          }),
        );

        listeners.push(
          await PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[ABN Push] Received in foreground:', notification?.title);
          }),
        );

        listeners.push(
          await PushNotifications.addListener('pushNotificationActionPerformed', () => {
            window.dispatchEvent(new CustomEvent(OPEN_EVENT));
          }),
        );
      } catch (err) {
        console.warn('[ABN Push] Init failed (need google-services.json + Firebase):', err);
      }
    };

    void run();

    return () => {
      cancelled = true;
      listeners.forEach((l) => {
        try {
          void l.remove();
        } catch {
          /* ignore */
        }
      });
    };
  }, [apiToken, enabled]);
}

/** Subscribe in App to open the notifications tab when a push is tapped. */
export function useOpenNotificationsOnPush(onOpen: () => void) {
  useEffect(() => {
    const handler = () => onOpen();
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, [onOpen]);
}

export { OPEN_EVENT };

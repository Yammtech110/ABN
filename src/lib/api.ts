import { Capacitor } from '@capacitor/core';

/**
 * API base URL resolution:
 * - Web production (Vercel Services): same-origin `/api` when VITE_API_BASE_URL is unset.
 * - Native APK: set VITE_API_BASE_URL in .env.production to your public HTTPS API.
 * - Dev browser: Vite proxy or LAN fallback below.
 */
function normalizeBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;

  if (fromEnv?.trim()) {
    return normalizeBaseUrl(fromEnv);
  }

  // Dev browser: same-origin /api via Vite proxy (localhost:3000 → backend)
  if (!import.meta.env.PROD && !Capacitor.isNativePlatform()) {
    return '';
  }

  // Production web: Vercel rewrites /api → backend on the same origin
  if (import.meta.env.PROD && !Capacitor.isNativePlatform()) {
    return '';
  }

  if (Capacitor.isNativePlatform()) {
    console.error(
      '[api] Missing VITE_API_BASE_URL. Rebuild APK with .env.production pointing to your live server.',
    );
  }

  return '';
}

export const API_BASE_URL = resolveApiBaseUrl();

export const apiUrl = (path: string): string => {
  const segment = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${segment}` : segment;
};

export const apiFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  if (!API_BASE_URL && Capacitor.isNativePlatform()) {
    throw new Error(
      'Server URL not configured. Set VITE_API_BASE_URL in .env.production before building the APK.',
    );
  }
  const url = apiUrl(path);
  try {
    return await fetch(url, init);
  } catch (err) {
    console.error(`[api] Network error for ${url}`, err);
    throw err;
  }
};

import { Capacitor } from '@capacitor/core';

/**
 * API base URL resolution:
 * - Web production: same-origin `/api` when VITE_API_BASE_URL is unset.
 * - Native APK: set VITE_API_BASE_URL in .env.production to your public HTTPS API.
 * - Dev browser: Vite proxy.
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

  if (!import.meta.env.PROD && !Capacitor.isNativePlatform()) {
    return '';
  }

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

const DEFAULT_TIMEOUT_MS = 90_000;

export const apiFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  if (!API_BASE_URL && Capacitor.isNativePlatform()) {
    throw new Error(
      'Server URL not configured. Set VITE_API_BASE_URL in .env.production before building the APK.',
    );
  }
  const url = apiUrl(path);
  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const externalSignal = init?.signal;
      if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    return await attempt();
  } catch (err) {
    console.warn(`[api] First attempt failed for ${url}, retrying…`, err);
    try {
      return await attempt();
    } catch (err2) {
      console.error(`[api] Network error for ${url}`, err2);
      throw err2;
    }
  }
};

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

  // Static site (abn-1) has no /api — fall back to proxy/API host when set at build time
  const proxyTarget = import.meta.env.VITE_API_PROXY_TARGET as string | undefined;
  if (proxyTarget?.trim() && (import.meta.env.PROD || Capacitor.isNativePlatform())) {
    return normalizeBaseUrl(proxyTarget);
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

/** Render free/cold starts often need ~30–60s; keep attempts patient. */
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [1_200, 3_000, 6_000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isRetriableStatus = (status: number) =>
  status === 408 || status === 425 || status === 429 || status === 502 || status === 503 || status === 504;

const isAbortError = (err: unknown) => {
  const name = String((err as { name?: string })?.name || '');
  const msg = String((err as { message?: string })?.message || '').toLowerCase();
  return name === 'AbortError' || msg.includes('aborted') || msg.includes('timeout');
};

const isNetworkError = (err: unknown) => {
  if (isAbortError(err)) return true;
  const msg = String((err as { message?: string })?.message || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound')
  );
};

export type ApiFetchOptions = RequestInit & {
  /** Override attempt count (default 4). Use 1 for non-critical fire-and-forget. */
  retries?: number;
};

/**
 * Fetch with automatic retries for cold starts / brief outages.
 * Does not retry 4xx business errors (wrong password, validation, etc.).
 */
export const apiFetch = async (path: string, init?: ApiFetchOptions): Promise<Response> => {
  if (!API_BASE_URL && Capacitor.isNativePlatform()) {
    throw new Error(
      'Server URL not configured. Set VITE_API_BASE_URL in .env.production before building the APK.',
    );
  }

  const { retries: retriesOpt, ...fetchInit } = init || {};
  const maxAttempts = Math.max(1, Math.min(retriesOpt ?? MAX_ATTEMPTS, 6));
  const url = apiUrl(path);

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const externalSignal = fetchInit.signal;
      if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      const res = await fetch(url, { ...fetchInit, signal: controller.signal });

      if (isRetriableStatus(res.status) && attempt < maxAttempts) {
        console.warn(`[api] ${res.status} on ${url} — retry ${attempt}/${maxAttempts}`);
        await sleep(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      const canRetry = attempt < maxAttempts && (isNetworkError(err) || isAbortError(err));
      if (!canRetry) break;
      console.warn(`[api] Network issue on ${url} — retry ${attempt}/${maxAttempts}`, err);
      await sleep(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  console.error(`[api] Gave up on ${url}`, lastError);
  throw lastError instanceof Error ? lastError : new Error('Cannot reach server');
};

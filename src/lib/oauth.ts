import { Capacitor } from '@capacitor/core';

/** Redirect URL Supabase OAuth returns to after Google/Apple sign-in. */
export const getOAuthRedirectUrl = (): string => {
  if (typeof window === 'undefined') return '';
  // Must match a URL listed in Supabase → Authentication → URL Configuration
  return `${window.location.origin}${window.location.pathname}`.replace(/\/$/, '') || window.location.origin;
};

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

const PROVIDER_LABEL: Record<'google' | 'apple', string> = {
  google: 'Google',
  apple: 'Apple',
};

/** Turn Supabase/provider errors into actionable messages for the auth screen. */
export const formatOAuthError = (
  raw: string,
  provider?: 'google' | 'apple',
  language: 'en' | 'ar' | 'fa' = 'en',
): string => {
  const lower = raw.toLowerCase();
  const name = provider ? PROVIDER_LABEL[provider] : 'Google/Apple';

  if (lower.includes('provider is not enabled') || lower.includes('unsupported provider')) {
    if (language === 'ar') {
      return `${name} غير مفعّل. افتح Supabase Dashboard → Authentication → Providers → ${name} وفعّله مع بيانات OAuth.`;
    }
    return `${name} sign-in is not enabled in Supabase yet. Open Supabase Dashboard → Authentication → Providers → ${name}, turn it ON, and add your OAuth Client ID & Secret.`;
  }

  if (lower.includes('redirect') && lower.includes('url')) {
    if (language === 'ar') {
      return 'رابط إعادة التوجيه غير مسموح. أضف http://localhost:3000 في Supabase → Authentication → URL Configuration.';
    }
    return 'Redirect URL not allowed. Add http://localhost:3000 under Supabase → Authentication → URL Configuration → Redirect URLs.';
  }

  return raw;
};

/** Parse OAuth error returned in the URL hash or query after a failed provider redirect. */
export const parseOAuthCallbackError = (): string | null => {
  if (typeof window === 'undefined') return null;

  const hashParams = new URLSearchParams(
    window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash,
  );
  const queryParams = new URLSearchParams(window.location.search);

  const raw =
    hashParams.get('error_description') ||
    hashParams.get('error') ||
    queryParams.get('error_description') ||
    queryParams.get('error') ||
    queryParams.get('msg');

  if (!raw) return null;
  const decoded = decodeURIComponent(raw.replace(/\+/g, ' '));
  return formatOAuthError(decoded);
};

/** Remove OAuth tokens/errors from the address bar after session is established. */
export const clearOAuthCallbackUrl = (): void => {
  if (typeof window === 'undefined') return;
  const { hash, search } = window.location;
  const hasOAuthHash =
    hash.includes('access_token=') ||
    hash.includes('error=') ||
    hash.includes('error_description=');
  const hasOAuthQuery =
    search.includes('code=') ||
    search.includes('error=') ||
    search.includes('error_description=');
  if (hasOAuthHash || hasOAuthQuery) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
};

/** Supabase OAuth callback URI — must match Google/Apple console redirect settings. */
export const getSupabaseOAuthCallbackUrl = (): string => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return 'https://YOUR_PROJECT.supabase.co/auth/v1/callback';
  return `${url.replace(/\/$/, '')}/auth/v1/callback`;
};

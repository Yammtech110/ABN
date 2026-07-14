import { Capacitor } from '@capacitor/core';
import { apiUrl } from '../lib/api';

export const DEFAULT_LISTING_LOGO =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200&h=200';

export const DEFAULT_LISTING_COVER =
  'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=1200&h=400';

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);
const isDataImage = (value: string) => value.startsWith('data:image/');

/** Normalize stored paths so img tags always hit the current app origin / API host. */
const toMediaPath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/api/directory/')) return trimmed;
  const apiPath = trimmed.match(/\/api\/directory\/[^?\s]+/);
  if (apiPath) return apiPath[0];
  return trimmed;
};

/** Web uses same-origin absolute URLs so img tags always load through the dev proxy / production host. */
const mediaUrl = (path: string) => {
  const normalized = toMediaPath(path);
  if (!normalized) return '';
  if (isHttpUrl(normalized)) return normalized;
  if (Capacitor.isNativePlatform()) return apiUrl(normalized);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
  }
  return apiUrl(normalized);
};

const resolveMediaUrl = (
  primary: string,
  fallback: string,
  listingId: string,
  kind: 'logo' | 'cover',
  defaultUrl: string,
): string => {
  const primaryTrimmed = primary.trim();
  const fallbackTrimmed = fallback.trim();

  if (isHttpUrl(primaryTrimmed)) return primaryTrimmed;
  if (primaryTrimmed.startsWith('/api/directory/') || primaryTrimmed.includes('/api/directory/')) {
    return mediaUrl(primaryTrimmed);
  }
  if (isDataImage(primaryTrimmed) && listingId) return mediaUrl(`/api/directory/${listingId}/${kind}`);
  if (listingId) return mediaUrl(`/api/directory/${listingId}/${kind}`);
  if (isHttpUrl(fallbackTrimmed)) return fallbackTrimmed;
  return defaultUrl;
};

export const resolveListingLogoUrl = (
  logoUrl: string,
  coverUrl: string,
  listingId: string,
): string => resolveMediaUrl(logoUrl, coverUrl, listingId, 'logo', DEFAULT_LISTING_LOGO);

export const resolveListingCoverUrl = (
  coverUrl: string,
  logoUrl: string,
  listingId: string,
): string => resolveMediaUrl(coverUrl, logoUrl, listingId, 'cover', DEFAULT_LISTING_COVER);

/** Resolve at render time so listings always get a loadable thumbnail URL */
export const businessLogoUrl = (biz: {
  id: string;
  logoUrl?: string;
  coverUrl?: string;
}): string => resolveListingLogoUrl(biz.logoUrl ?? '', biz.coverUrl ?? '', biz.id);

export const businessCoverUrl = (biz: {
  id: string;
  logoUrl?: string;
  coverUrl?: string;
}): string => resolveListingCoverUrl(biz.coverUrl ?? '', biz.logoUrl ?? '', biz.id);

/** Logo + cover (+ optional gallery) for admin / detail views */
export const businessPhotoUrls = (biz: {
  id: string;
  logoUrl?: string;
  coverUrl?: string;
  gallery?: string[];
}): string[] => {
  const logo = businessLogoUrl(biz);
  const cover = businessCoverUrl(biz);
  const fromGallery = (biz.gallery ?? [])
    .map((url) => {
      if (isDataImage(url) && biz.id) return mediaUrl(`/api/directory/${biz.id}/logo`);
      if (url.includes('/api/directory/') || url.startsWith('/api/directory/')) return mediaUrl(url);
      if (isHttpUrl(url)) return url;
      return url;
    })
    .filter(Boolean);
  return [...new Set([logo, cover, ...fromGallery].filter(Boolean))];
};

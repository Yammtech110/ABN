import { Capacitor } from '@capacitor/core';
import { apiUrl } from '../lib/api';

/** Legacy shared grocery mock — never use as a live listing thumbnail */
const LEGACY_MOCK_IMAGE_RE =
  /images\.unsplash\.com\/photo-1542838132|images\.unsplash\.com\/photo-1578916171728/i;

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);
const isDataImage = (value: string) => value.startsWith('data:image/');
const isApiMediaPath = (value: string) =>
  typeof value === 'string' && value.includes('/api/directory/');
const isLegacyMock = (value: string) => LEGACY_MOCK_IMAGE_RE.test(value);

const initialsFromName = (name: string): string => {
  const parts = String(name || 'BN')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'BN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase() || 'BN';
};

const placeholderHue = (seed: string): number => {
  let hash = 0;
  const s = seed || 'listing';
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash % 360;
};

/** Unique per-listing SVG so missing photos never all look like the same grocery mock */
export const listingPlaceholderDataUrl = (
  nameOrSeed: string,
  { wide = false }: { wide?: boolean } = {},
): string => {
  const initials = initialsFromName(nameOrSeed);
  const hue = placeholderHue(nameOrSeed);
  const w = wide ? 1200 : 200;
  const h = wide ? 400 : 200;
  const fontSize = wide ? 96 : 64;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="100%" height="100%" fill="hsl(${hue} 28% 18%)"/>` +
    `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="hsl(${hue} 70% 72%)">${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

/** @deprecated Use listingPlaceholderDataUrl — kept so older imports do not break */
export const DEFAULT_LISTING_LOGO = listingPlaceholderDataUrl('BN');
export const DEFAULT_LISTING_COVER = listingPlaceholderDataUrl('BN', { wide: true });

/** Always return an absolute, loadable URL (required for Capacitor APK). */
export const listingMediaUrl = (path: string): string => {
  const normalized = toMediaPath(path);
  if (!normalized) return '';
  if (isHttpUrl(normalized)) return normalized;
  if (Capacitor.isNativePlatform()) return apiUrl(normalized);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
  }
  return apiUrl(normalized);
};

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
const mediaUrl = (path: string) => listingMediaUrl(path);

const clean = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || isLegacyMock(trimmed)) return '';
  return trimmed;
};

const resolveMediaUrl = (
  primary: string,
  fallback: string,
  listingId: string,
  kind: 'logo' | 'cover',
  placeholderSeed: string,
  wide: boolean,
): string => {
  const primaryTrimmed = clean(primary);
  const fallbackTrimmed = clean(fallback);
  const placeholder = listingPlaceholderDataUrl(placeholderSeed || listingId || 'BN', { wide });

  if (isHttpUrl(primaryTrimmed) && !isLegacyMock(primaryTrimmed)) return primaryTrimmed;
  if (isApiMediaPath(primaryTrimmed)) return mediaUrl(primaryTrimmed);
  if (isDataImage(primaryTrimmed) && listingId) return mediaUrl(`/api/directory/${listingId}/${kind}`);
  if (listingId) return mediaUrl(`/api/directory/${listingId}/${kind}`);
  if (isHttpUrl(fallbackTrimmed) && !isLegacyMock(fallbackTrimmed)) return fallbackTrimmed;
  if (isApiMediaPath(fallbackTrimmed)) return mediaUrl(fallbackTrimmed);
  if (listingId && fallbackTrimmed) {
    return mediaUrl(`/api/directory/${listingId}/${kind === 'logo' ? 'cover' : 'logo'}`);
  }
  return placeholder;
};

export const resolveListingLogoUrl = (
  logoUrl: string,
  coverUrl: string,
  listingId: string,
  name?: string,
): string =>
  resolveMediaUrl(logoUrl, coverUrl, listingId, 'logo', name || listingId || 'BN', false);

export const resolveListingCoverUrl = (
  coverUrl: string,
  logoUrl: string,
  listingId: string,
  name?: string,
): string =>
  resolveMediaUrl(coverUrl, logoUrl, listingId, 'cover', name || listingId || 'BN', true);

/** Resolve at render time so listings always get a loadable thumbnail URL */
export const businessLogoUrl = (biz: {
  id: string;
  name?: string;
  logoUrl?: string;
  coverUrl?: string;
}): string => resolveListingLogoUrl(biz.logoUrl ?? '', biz.coverUrl ?? '', biz.id, biz.name);

export const businessCoverUrl = (biz: {
  id: string;
  name?: string;
  logoUrl?: string;
  coverUrl?: string;
}): string => resolveListingCoverUrl(biz.coverUrl ?? '', biz.logoUrl ?? '', biz.id, biz.name);

/** Job card logo — always resolves to the posting business listing image */
export const jobBusinessLogoUrl = (job: {
  businessId: string;
  businessName?: string;
  businessLogoUrl?: string;
}): string =>
  resolveListingLogoUrl(
    String(job.businessLogoUrl ?? ''),
    '',
    job.businessId,
    job.businessName || job.businessId,
  );

/** Logo + cover (+ optional gallery) for admin / detail views */
export const businessPhotoUrls = (biz: {
  id: string;
  name?: string;
  logoUrl?: string;
  coverUrl?: string;
  gallery?: string[];
}): string[] => {
  const logo = businessLogoUrl(biz);
  const cover = businessCoverUrl(biz);
  const fromGallery = (biz.gallery ?? [])
    .map((url) => {
      const cleaned = clean(url);
      if (!cleaned) return '';
      if (isDataImage(cleaned) && biz.id) return mediaUrl(`/api/directory/${biz.id}/logo`);
      if (isApiMediaPath(cleaned) || cleaned.startsWith('/api/directory/')) return mediaUrl(cleaned);
      if (isHttpUrl(cleaned)) return cleaned;
      return cleaned;
    })
    .filter(Boolean);
  return [...new Set([logo, cover, ...fromGallery].filter(Boolean))];
};

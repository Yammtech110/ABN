'use strict';

/** Neutral fallback — never reuse the old Al-Kawthar grocery Unsplash as a global mock. */
const DEFAULT_LOGO = '';
const DEFAULT_COVER = '';

const ALLOWED_DATA_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
/** Max decoded image bytes accepted from client uploads (~2 MB). */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const isDataImage = (url) => typeof url === 'string' && url.startsWith('data:image/');
const isRemoteImage = (url) => typeof url === 'string' && /^https?:\/\//i.test(url.trim());
const isApiMediaPath = (url) =>
  typeof url === 'string' &&
  (url.includes('/api/directory/') || url.includes('/api/jobsboard/'));

/** Known seed / legacy mock URLs that must not masquerade as every listing's photo */
const LEGACY_MOCK_IMAGE_RE =
  /images\.unsplash\.com\/photo-1542838132|images\.unsplash\.com\/photo-1578916171728/i;

const sanitizeStoredImage = (url) => {
  const raw = String(url ?? '').trim();
  if (!raw || isApiMediaPath(raw)) return '';
  // Treat the old shared grocery mock as "no image" so each listing can show its own photo / initials
  if (LEGACY_MOCK_IMAGE_RE.test(raw)) return '';
  return raw;
};

const hasStoredImage = (url) => Boolean(sanitizeStoredImage(url));

const publicMediaPath = (id, kind) => `/api/directory/${id}/${kind}`;

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Deterministic accent from id/name so empty listings don't all look identical */
const placeholderHue = (seed) => {
  const s = String(seed || 'listing');
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash % 360;
};

const initialsFromName = (name) => {
  const parts = String(name || 'BN')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'BN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase() || 'BN';
};

/** SVG placeholder unique per business — used when no real logo/cover is stored */
const buildPlaceholderSvg = (name, seed, { wide = false } = {}) => {
  const initials = escapeXml(initialsFromName(name));
  const hue = placeholderHue(seed || name);
  const w = wide ? 1200 : 200;
  const h = wide ? 400 : 200;
  const fontSize = wide ? 96 : 64;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="100%" height="100%" fill="hsl(${hue} 28% 18%)"/>` +
    `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="hsl(${hue} 70% 72%)">${initials}</text>` +
    `</svg>`
  );
};

const setMediaHeaders = (res, contentType) => {
  res.set('Content-Type', contentType);
  res.set('Cache-Control', 'public, max-age=3600');
  // Allow Capacitor / cross-origin web clients to display streamed images
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
};

/** Replace inline base64 with lightweight API media URLs for list responses */
const toPublicImageUrl = (profile, field, kind) => {
  const id = profile?.id;
  const raw = sanitizeStoredImage(profile?.[field]);
  if (!id) return raw;
  if (isRemoteImage(raw)) return raw;
  // Always point at the streaming endpoint so clients load the live DB image (or unique placeholder)
  return publicMediaPath(id, kind);
};

/** Normalize up to 5 gallery uploads for persistence. */
const normalizeIncomingGallery = (incoming) => {
  if (!Array.isArray(incoming)) return [];
  const out = [];
  for (const item of incoming.slice(0, 5)) {
    const normalized = normalizeIncomingImage(item, '');
    if (normalized) out.push(normalized);
  }
  return out;
};

/** Public directory responses must not expose owner email (PII). */
const mapProfileForList = (profile, { includeEmail = false } = {}) => {
  const id = profile?.id;
  const rawImg = sanitizeStoredImage(profile?.imageUrl);
  const rawCover = sanitizeStoredImage(profile?.coverUrl);
  // Owner/admin payloads may keep inline data URLs so <img> works without Bearer on /logo
  const imageUrl = includeEmail && (isDataImage(rawImg) || isRemoteImage(rawImg))
    ? rawImg
    : toPublicImageUrl(profile, 'imageUrl', 'logo');
  const coverUrl = includeEmail && (isDataImage(rawCover) || isRemoteImage(rawCover))
    ? rawCover
    : toPublicImageUrl(profile, 'coverUrl', 'cover');

  const rawGallery = Array.isArray(profile?.gallery) ? profile.gallery : [];
  const gallery = rawGallery
    .map((url, i) => {
      const raw = sanitizeStoredImage(url);
      if (!raw || !id) return '';
      if (includeEmail && (isDataImage(raw) || isRemoteImage(raw))) return raw;
      if (isRemoteImage(raw)) return raw;
      return publicMediaPath(id, `gallery/${i}`);
    })
    .filter(Boolean);

  const mapped = {
    ...profile,
    imageUrl,
    coverUrl,
    gallery,
  };
  if (!includeEmail) {
    delete mapped.email;
  }
  return mapped;
};

/** Live logo path for jobs — always the owning listing's media endpoint */
const jobLogoFromProfile = (profile) => {
  if (!profile?.id) return '';
  const raw = sanitizeStoredImage(profile.imageUrl) || sanitizeStoredImage(profile.coverUrl);
  if (isRemoteImage(raw)) return raw;
  return publicMediaPath(profile.id, 'logo');
};

/** Hosts allowed for open redirects when streaming remote listing images */
const allowedImageHosts = () =>
  String(process.env.ALLOWED_IMAGE_HOSTS || 'images.unsplash.com,lh3.googleusercontent.com')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

const isAllowedRemoteImageUrl = (url) => {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    return allowedImageHosts().some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
};

const parseDataImage = (src) => {
  const match = String(src).match(/^data:(image\/[\w.+-]+);base64,([\s\S]+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  if (!ALLOWED_DATA_MIME.has(mime) && mime !== 'image/jpg') return null;
  let buf;
  try {
    buf = Buffer.from(match[2], 'base64');
  } catch {
    return null;
  }
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
  return { mime: mime === 'image/jpg' ? 'image/jpeg' : mime, buf };
};

const streamStoredImage = async (res, primary, fallback, { name = '', seed = '', wide = false } = {}) => {
  const src = sanitizeStoredImage(primary) || sanitizeStoredImage(fallback);

  if (src && isRemoteImage(src)) {
    if (!isAllowedRemoteImageUrl(src)) {
      const svg = buildPlaceholderSvg(name, seed, { wide });
      setMediaHeaders(res, 'image/svg+xml; charset=utf-8');
      return res.send(svg);
    }
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'public, max-age=3600');
    return res.redirect(302, src);
  }

  if (src) {
    const parsed = parseDataImage(src);
    if (parsed) {
      setMediaHeaders(res, parsed.mime);
      return res.send(parsed.buf);
    }
  }

  const svg = buildPlaceholderSvg(name, seed, { wide });
  setMediaHeaders(res, 'image/svg+xml; charset=utf-8');
  return res.send(svg);
};

/** Strip API paths / legacy mocks before persisting client uploads; reject oversized / bad MIME. */
const normalizeIncomingImage = (incoming, current) => {
  if (incoming === undefined) return undefined;
  const next = String(incoming ?? '').trim();
  if (!next || isApiMediaPath(next) || LEGACY_MOCK_IMAGE_RE.test(next)) {
    return current ?? '';
  }
  if (isDataImage(next)) {
    if (!parseDataImage(next)) return current ?? '';
    return next;
  }
  if (isRemoteImage(next)) {
    // Do not persist arbitrary remote URLs (open redirect / SSRF surface)
    if (!isAllowedRemoteImageUrl(next)) return current ?? '';
    return next;
  }
  return current ?? '';
};

/** Listings that appear in the public directory may expose logo/cover bytes. */
const isPubliclyVisibleListing = (profile) =>
  Boolean(
    profile &&
      profile.isVerified &&
      profile.subscriptionStatus !== 'pending' &&
      profile.subscriptionStatus !== 'suspended' &&
      profile.isActive !== false,
  );

module.exports = {
  DEFAULT_LOGO,
  DEFAULT_COVER,
  mapProfileForList,
  streamStoredImage,
  publicMediaPath,
  jobLogoFromProfile,
  hasStoredImage,
  sanitizeStoredImage,
  normalizeIncomingImage,
  normalizeIncomingGallery,
  buildPlaceholderSvg,
  isPubliclyVisibleListing,
  MAX_IMAGE_BYTES,
};

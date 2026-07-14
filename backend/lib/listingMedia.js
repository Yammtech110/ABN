'use strict';

const DEFAULT_LOGO = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200&h=200';
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=1200&h=400';

const isDataImage = (url) => typeof url === 'string' && url.startsWith('data:image/');
const isRemoteImage = (url) => typeof url === 'string' && /^https?:\/\//i.test(url.trim());

const publicMediaPath = (id, kind) => `/api/directory/${id}/${kind}`;

/** Replace inline base64 with lightweight API media URLs for list responses */
const toPublicImageUrl = (profile, field, kind) => {
  const id = profile?.id;
  const raw = String(profile?.[field] ?? '').trim();
  if (!id) return raw;
  if (isRemoteImage(raw)) return raw;
  if (isDataImage(raw) || !raw) return publicMediaPath(id, kind);
  return raw;
};

const mapProfileForList = (profile) => ({
  ...profile,
  imageUrl: toPublicImageUrl(profile, 'imageUrl', 'logo'),
  coverUrl: toPublicImageUrl(profile, 'coverUrl', 'cover'),
});

const streamStoredImage = async (res, primary, fallback, defaultUrl) => {
  const src = String(primary ?? '').trim() || String(fallback ?? '').trim();
  if (!src) return res.redirect(302, defaultUrl);
  if (isRemoteImage(src)) return res.redirect(302, src);

  const match = src.match(/^data:(image\/[\w.+-]+);base64,([\s\S]+)$/);
  if (!match) return res.redirect(302, defaultUrl);

  try {
    const buf = Buffer.from(match[2], 'base64');
    if (!buf.length) return res.redirect(302, defaultUrl);
    res.set('Content-Type', match[1]);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(buf);
  } catch {
    return res.redirect(302, defaultUrl);
  }
};

module.exports = {
  DEFAULT_LOGO,
  DEFAULT_COVER,
  mapProfileForList,
  streamStoredImage,
  publicMediaPath,
};

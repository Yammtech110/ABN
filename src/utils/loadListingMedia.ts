import { apiFetch, apiUrl } from '../lib/api';

/** Extract `/api/directory/...` or `/api/jobsboard/...` path from an absolute or relative media URL. */
export const toApiMediaPath = (url: string): string | null => {
  const trimmed = String(url || '').trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null;
  const match = trimmed.match(/\/api\/(?:directory|jobsboard)\/[^?\s#]+/i);
  return match ? match[0] : null;
};

/** Always prefer absolute API host for directory/job image paths (static site has no /api). */
export const absoluteMediaUrl = (url: string): string => {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = toApiMediaPath(trimmed) || (trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
  return apiUrl(path);
};

/**
 * Load listing media through apiFetch (correct host + optional Bearer for pending listings).
 * Returns a blob: URL that must be revoked by the caller when done.
 */
export const fetchMediaObjectUrl = async (
  url: string,
  token?: string | null,
): Promise<string> => {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  const path = toApiMediaPath(trimmed);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = path
      ? await apiFetch(path, { headers, retries: 2 })
      : await fetch(absoluteMediaUrl(trimmed), { headers });
    if (!res.ok) return absoluteMediaUrl(trimmed);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return absoluteMediaUrl(trimmed);
    return URL.createObjectURL(blob);
  } catch {
    return absoluteMediaUrl(trimmed);
  }
};

/** Persist unfinished business/service registration forms (local draft). */

const DRAFT_VERSION = 1;
const PREFIX = 'abn_listing_reg_draft_v1:';

export type RegistrationDraft = {
  version: number;
  savedAt: string;
  registrationType: 'business' | 'service';
  regName: string;
  regCatId: string;
  regDesc: string;
  regState: string;
  regCity: string;
  regZipCode: string;
  regAddress: string;
  regPhone: string;
  regWhatsapp: string;
  regWeb: string;
  regHours: string;
  regImages: string[];
  regCoverImages: string[];
};

const draftKey = (userKey: string) => `${PREFIX}${userKey || 'guest'}`;

const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeRemove = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

/** Trim oversized image arrays so localStorage quota is less likely to fail. */
const capImages = (images: string[], max = 3): string[] =>
  (Array.isArray(images) ? images : []).filter(Boolean).slice(0, max);

export function loadRegistrationDraft(userKey: string): RegistrationDraft | null {
  const raw = safeGet(draftKey(userKey));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RegistrationDraft;
    if (!parsed || parsed.version !== DRAFT_VERSION) return null;
    if (parsed.registrationType !== 'business' && parsed.registrationType !== 'service') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRegistrationDraft(
  userKey: string,
  draft: Omit<RegistrationDraft, 'version' | 'savedAt'>,
): { ok: boolean; imagesDropped?: boolean } {
  const full: RegistrationDraft = {
    ...draft,
    version: DRAFT_VERSION,
    savedAt: new Date().toISOString(),
    regImages: capImages(draft.regImages, 4),
    regCoverImages: capImages(draft.regCoverImages, 2),
  };

  const key = draftKey(userKey);
  let payload = JSON.stringify(full);
  if (safeSet(key, payload)) return { ok: true };

  // Quota exceeded — retry without images
  const withoutImages: RegistrationDraft = {
    ...full,
    regImages: [],
    regCoverImages: [],
  };
  payload = JSON.stringify(withoutImages);
  if (safeSet(key, payload)) return { ok: true, imagesDropped: true };

  return { ok: false };
}

export function clearRegistrationDraft(userKey: string): void {
  safeRemove(draftKey(userKey));
}

/** True if draft has any meaningful user input (not just defaults). */
export function draftHasContent(draft: RegistrationDraft | null | undefined): boolean {
  if (!draft) return false;
  return Boolean(
    draft.regName.trim() ||
      draft.regDesc.trim() ||
      draft.regState.trim() ||
      draft.regCity.trim() ||
      draft.regZipCode.trim() ||
      draft.regAddress.trim() ||
      draft.regPhone.trim() ||
      draft.regWhatsapp.trim() ||
      draft.regWeb.trim() ||
      (draft.regImages && draft.regImages.length > 0) ||
      (draft.regCoverImages && draft.regCoverImages.length > 0),
  );
}

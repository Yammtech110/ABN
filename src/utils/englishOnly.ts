/** English-only UI helpers — bilingual fields always read/write the `en` value. */

export const textEn = (
  value: { en: string; ar?: string } | string | undefined | null,
): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.en || '';
};

export const bilingualEn = (text: string): { en: string; ar: string } => ({
  en: text,
  ar: text,
});

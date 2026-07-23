import { Category } from '../types';

/** Collapse spaces/dashes and trailing plural "s" for loose matching. */
const slugify = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^cat-/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const stem = (slug: string): string => slug.replace(/s$/, '');

/**
 * Map a stored listing category (id, "Accountants", "accountants", etc.)
 * onto the canonical category id from the categories list.
 */
export function resolveCategoryId(
  raw: string | undefined | null,
  categories: Category[],
): string {
  const value = String(raw || '').trim();
  if (!value) return 'cat-other';
  if (categories.some((c) => c.id === value)) return value;

  const rawSlug = slugify(value);
  const rawStem = stem(rawSlug);

  for (const cat of categories) {
    const idSlug = slugify(cat.id);
    const nameSlug = slugify(cat.name?.en || '');
    if (
      rawSlug === idSlug ||
      rawSlug === nameSlug ||
      rawStem === stem(idSlug) ||
      rawStem === stem(nameSlug)
    ) {
      return cat.id;
    }
  }

  return raw.startsWith('cat-') ? raw : `cat-${rawSlug || 'other'}`;
}

/** True when a listing belongs to the selected category chip. */
export function listingMatchesCategory(
  listing: { categoryId?: string; subcategory?: { en?: string; ar?: string } },
  selectedCategoryId: string,
  categories: Category[],
): boolean {
  if (!selectedCategoryId || selectedCategoryId === 'All') return true;

  const resolvedListing = resolveCategoryId(listing.categoryId, categories);
  if (resolvedListing === selectedCategoryId) return true;

  const selected = categories.find((c) => c.id === selectedCategoryId);
  if (!selected) return listing.categoryId === selectedCategoryId;

  const sub = String(listing.subcategory?.en || '').trim().toLowerCase();
  if (sub && sub === String(selected.name?.en || '').trim().toLowerCase()) return true;

  const listingSlug = slugify(listing.categoryId || '');
  const selectedSlug = slugify(selected.id);
  const selectedNameSlug = slugify(selected.name?.en || '');
  return (
    listingSlug === selectedSlug ||
    listingSlug === selectedNameSlug ||
    stem(listingSlug) === stem(selectedSlug) ||
    stem(listingSlug) === stem(selectedNameSlug)
  );
}

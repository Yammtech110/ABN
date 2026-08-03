import { Business, UserProfile } from '../types';

export type ListingKind = 'business' | 'service';

/** Directory listing owned by the signed-in user (if any) */
export const getUserListing = (
  user: UserProfile | null | undefined,
  listings: Business[],
): Business | null => {
  if (!user) return null;
  const email = String(user.email || '').trim().toLowerCase();
  const id = String(user.id || '').trim();
  return (
    listings.find((b) => {
      const owner = String(b.ownerId || '').trim();
      const ownerUserId = String(b.ownerUserId || '').trim();
      if (id && ownerUserId && ownerUserId === id) return true;
      if (!owner) return false;
      if (id && owner === id) return true;
      if (email && owner.toLowerCase() === email) return true;
      return false;
    }) ?? null
  );
};

/** True when the signed-in user owns this listing (email or id match). */
export const isOwnedListing = (
  user: UserProfile | null | undefined,
  listing: Business | null | undefined,
): boolean => {
  if (!user || !listing) return false;
  const owner = String(listing.ownerId || '').trim().toLowerCase();
  if (!owner) return false;
  const email = String(user.email || '').trim().toLowerCase();
  const id = String(user.id || '').trim().toLowerCase();
  return Boolean((email && owner === email) || (id && owner === id));
};

/** Owner can open Manage Business/Service unless listing is suspended */
export const canManageListing = (listing: Business | null | undefined): boolean =>
  Boolean(listing && listing.status !== 'suspended');

/** Visible in public directory search and home feeds */
export const isLiveDirectoryListing = (listing: Business): boolean =>
  listing.isVerified && listing.status === 'active';

/** Awaiting admin vetting — shows in New Submissions queue */
export const isPendingSubmission = (listing: Business): boolean =>
  !listing.isVerified && listing.status === 'pending';

export const listingKind = (listing: Business | null | undefined): ListingKind =>
  listing?.listingType === 'service' ? 'service' : 'business';

/** Registered business or service listing — required to post jobs */
export const isJobEligibleListing = (listing: Business | null | undefined): boolean =>
  Boolean(listing && (listing.listingType === 'business' || listing.listingType === 'service'));

/** Jobs / hiring only after admin approval + active non-suspended listing */
export const canPostJobs = (listing: Business | null | undefined): boolean =>
  Boolean(
    listing &&
    listing.isVerified &&
    listing.status === 'active' &&
    isJobEligibleListing(listing),
  );

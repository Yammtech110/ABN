import { Business, UserProfile } from '../types';

export type ListingKind = 'business' | 'service';

/** Directory listing owned by the signed-in user (if any) */
export const getUserListing = (
  user: UserProfile | null | undefined,
  listings: Business[],
): Business | null => {
  if (!user) return null;
  return (
    listings.find((b) => b.ownerId === user.id || b.ownerId === user.email) ?? null
  );
};

/** Approved, active listing — unlocks Manage Business / Manage Service */
export const canManageListing = (listing: Business | null | undefined): boolean =>
  Boolean(listing && listing.isVerified && listing.status === 'active');

/** Visible in public directory search and home feeds */
export const isLiveDirectoryListing = (listing: Business): boolean =>
  listing.isVerified && listing.status === 'active';

/** Awaiting admin vetting — shows in New Submissions queue */
export const isPendingSubmission = (listing: Business): boolean =>
  !listing.isVerified && listing.status === 'pending';

export const listingKind = (listing: Business | null | undefined): ListingKind =>
  listing?.listingType === 'service' ? 'service' : 'business';

/** Registered business listing approved for directory — required to post jobs */
export const isJobEligibleListing = (listing: Business | null | undefined): boolean =>
  Boolean(listing && listing.listingType === 'business');

export const canPostJobs = (listing: Business | null | undefined): boolean =>
  Boolean(
    listing &&
    listing.isVerified &&
    listing.status === 'active' &&
    isJobEligibleListing(listing),
  );

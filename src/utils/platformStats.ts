import { Business } from '../types';

const MONTHLY_FEE = {
  business: 50,
  service: 30,
} as const;

/** Monthly subscription fee for a directory listing */
export const getListingMonthlyFee = (listing: Business): number => {
  if (listing.subscriptionTier === 30 || listing.subscriptionTier === 50) {
    return listing.subscriptionTier;
  }
  return listing.listingType === 'service' ? MONTHLY_FEE.service : MONTHLY_FEE.business;
};

/** Verified + active listings count as approved paid subscriptions */
export const getActivePaidListings = (listings: Business[]): Business[] =>
  listings.filter((listing) => listing.isVerified && listing.status === 'active');

/** Total Revenue = Σ (active approved listing × monthly fee) */
export const calculatePlatformRevenue = (listings: Business[]): number =>
  getActivePaidListings(listings).reduce(
    (sum, listing) => sum + getListingMonthlyFee(listing),
    0,
  );

export const formatUsd = (amount: number): string =>
  `$${amount.toLocaleString('en-US')}`;

import { Business } from '../types';

const MONTHLY_FEE = {
  business: 50,
  service: 30,
} as const;

export const TRIAL_DAYS = 60;

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

/** Sum of recorded successful membership payments only (not estimated fees) */
export const calculateRevenueFromPayments = (
  payments: { amount: number; status: string }[],
): number =>
  payments
    .filter((p) => p.status === 'success')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

/** Listing is on 2-month free trial when no payment recorded and still within trial window */
export const isListingOnFreeTrial = (
  listing: Business,
  paymentsForListing: { status: string }[],
): boolean => {
  const hasPaid = paymentsForListing.some((p) => p.status === 'success');
  if (hasPaid) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (listing.registeredAt) {
    const created = new Date(listing.registeredAt);
    if (!Number.isNaN(created.getTime())) {
      created.setHours(0, 0, 0, 0);
      const trialEnd = new Date(created.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      return today <= trialEnd;
    }
  }

  if (!listing.membershipExpiryDate) return true;
  const expiry = new Date(listing.membershipExpiryDate);
  expiry.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return daysLeft > 0;
};

/** Verified listing that finished free trial but has no recorded payment */
export const listingNeedsPayment = (
  listing: Business,
  paymentsForListing: { status: string }[],
): boolean =>
  listing.isVerified &&
  listing.status === 'active' &&
  !paymentsForListing.some((p) => p.status === 'success') &&
  !isListingOnFreeTrial(listing, paymentsForListing);

/** @deprecated Use calculateRevenueFromPayments — estimated fees, not cash collected */
export const calculatePlatformRevenue = (listings: Business[]): number =>
  getActivePaidListings(listings).reduce(
    (sum, listing) => sum + getListingMonthlyFee(listing),
    0,
  );

export const formatUsd = (amount: number): string =>
  `$${amount.toLocaleString('en-US')}`;

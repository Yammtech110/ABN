import { Business } from '../types';

/** Canonical monthly plan prices (USD) */
export const MONTHLY_FEE = {
  business: 25,
  service: 15,
} as const;

export type PlanAmount = (typeof MONTHLY_FEE)[keyof typeof MONTHLY_FEE];

export const VALID_PLAN_AMOUNTS: readonly PlanAmount[] = [
  MONTHLY_FEE.service,
  MONTHLY_FEE.business,
];

export const TRIAL_DAYS = 60;

/** Normalize legacy 30/50 tiers (and raw amounts) onto the current 15/25 plans. */
export const normalizePlanAmount = (amount: unknown, listingType?: Business['listingType']): PlanAmount => {
  const n = Number(amount);
  if (n === MONTHLY_FEE.service || n === 30) return MONTHLY_FEE.service;
  if (n === MONTHLY_FEE.business || n === 50) return MONTHLY_FEE.business;
  return listingType === 'service' ? MONTHLY_FEE.service : MONTHLY_FEE.business;
};

/** Monthly subscription fee for a directory listing */
export const getListingMonthlyFee = (listing: Business): number =>
  normalizePlanAmount(listing.subscriptionTier, listing.listingType);

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
  (listing.status === 'active' || listing.status === 'suspended') &&
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

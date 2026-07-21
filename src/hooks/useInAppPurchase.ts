// src/hooks/useInAppPurchase.ts
// In-App Purchase hook — wires up to Google Play Billing & Apple StoreKit
// Uses ONLY web-safe code at runtime; native IAP is loaded lazily only on device.
// Money flows: User pays -> Google/Apple store -> monthly payout to your linked bank account.

export const IAP_PRODUCTS = {
  BUSINESS_MONTHLY: 'abn_business_monthly',   // $50/month
  SERVICE_MONTHLY: 'abn_service_monthly',      // $30/month
} as const;

export type IAPProductId = (typeof IAP_PRODUCTS)[keyof typeof IAP_PRODUCTS];

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  productId?: string;
  error?: string;
}

/** Returns true only when running inside a Capacitor native Android/iOS app */
const isNativeApp = (): boolean => {
  try {
    const cap = (window as any).Capacitor;
    return cap != null && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * Initiate a subscription purchase.
 * On native (Android/iOS): opens the Google Play / Apple payment sheet.
 * On web production: blocked (memberships must use store billing on device).
 * On web dev: simulates success for local testing only.
 */
export const purchaseSubscription = async (
  productId: IAPProductId
): Promise<PurchaseResult> => {
  if (!isNativeApp()) {
    if (import.meta.env.PROD) {
      return {
        success: false,
        error: 'Subscriptions must be purchased in the iOS or Android app via App Store / Google Play.',
      };
    }
    await new Promise((r) => setTimeout(r, 1500));
    return {
      success: true,
      transactionId: `WEB-SIM-${Date.now()}`,
      productId,
    };
  }

  // Native path — dynamically loaded so Vite does not try to bundle it on web
  try {
    // @ts-ignore — plugin installed only in native Capacitor build
    const mod = await (Function('return import("@capacitor-community/in-app-purchases")')() as Promise<any>);
    const { InAppPurchases } = mod;
    const result = await InAppPurchases.purchaseProduct({ productId });
    if (result?.purchase) {
      return {
        success: true,
        transactionId: result.purchase.transactionId,
        productId: result.purchase.productId,
      };
    }
    return { success: false, error: 'Purchase not completed.' };
  } catch (err: any) {
    console.error('[ABN IAP] Purchase error:', err);
    return { success: false, error: err?.message || 'Payment failed. Please try again.' };
  }
};

/**
 * Restore previous purchases — REQUIRED by Apple App Store guidelines.
 */
export const restorePurchases = async (): Promise<PurchaseResult[]> => {
  if (!isNativeApp()) return [];

  try {
    // @ts-ignore
    const mod = await (Function('return import("@capacitor-community/in-app-purchases")')() as Promise<any>);
    const { InAppPurchases } = mod;
    const result = await InAppPurchases.restoreTransactions();
    return (result?.purchases ?? []).map((p: any) => ({
      success: true,
      transactionId: p.transactionId,
      productId: p.productId,
    }));
  } catch {
    return [];
  }
};

/** Returns today + 60 days as ISO date string (2-month free trial end date) */
export const getTrialEndDate = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d.toISOString().split('T')[0];
};

/** Days remaining until the given expiry date (negative if expired) */
export const getDaysRemaining = (expiryDateStr: string): number => {
  const expiry = new Date(expiryDateStr);
  const today = new Date();
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

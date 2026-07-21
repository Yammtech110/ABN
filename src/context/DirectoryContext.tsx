import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getOAuthRedirectUrl, clearOAuthCallbackUrl, formatOAuthError, isNativeApp } from '../lib/oauth';
import { apiFetch } from '../lib/api';
import {
  UserProfile, Business, BusinessStatus, Category, Review,
  PaymentRecord, AppNotification, UserRole, Job, JobCategory,
} from '../types';
import {
  INITIAL_BUSINESSES, INITIAL_REVIEWS,
  INITIAL_PAYMENTS, INITIAL_JOBS, INITIAL_HIRING_ACTIVE,
} from '../data/mockData';
import { resolveListingCoverUrl, resolveListingLogoUrl } from '../utils/listingImages';

// ── Safe storage helpers ────────────────────────────────────────────────────
// localStorage can throw (private browsing, quota exceeded, storage disabled).
// Never let a storage failure crash the app — degrade to in-memory state.

const safeGetItem = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const safeSetItem = (key: string, value: string): void => {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable — keep state in memory only */ }
};

const safeRemoveItem = (key: string): void => {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
};

/** Bump to force-clear cached mock listings only (never user auth or notifications). */
const DATA_STORE_VERSION = '6-per-listing-images';
if (typeof window !== 'undefined') {
  const stored = safeGetItem('shia_dir_data_version');
  if (stored !== DATA_STORE_VERSION) {
    [
      'shia_dir_businesses',
      'shia_dir_jobs',
      'shia_dir_reviews',
      'shia_dir_hiring_active',
    ].forEach((key) => safeRemoveItem(key));
    safeSetItem('shia_dir_data_version', DATA_STORE_VERSION);
  }

  /** Clear legacy demo notification seed on upgrade. */
  const NOTIF_SEED_VERSION = 'real-notifs-v2';
  if (safeGetItem('shia_dir_notif_seed') !== NOTIF_SEED_VERSION) {
    safeRemoveItem('shia_dir_notifications');
    safeSetItem('shia_dir_notif_seed', NOTIF_SEED_VERSION);
  }
}

// ── API helpers ────────────────────────────────────────────────────────────

/** Map a Supabase profiles_directory row → Business shape the UI expects */
const mapDirectoryProfile = (p: Record<string, unknown>): Business => ({
  id:                   String(p.id ?? ''),
  // Use email as ownerId so it matches currentUser.email across auth systems
  ownerId:              String(p.email ?? ''),
  name:                 String(p.businessName ?? ''),
  logoUrl:              resolveListingLogoUrl(String(p.imageUrl ?? ''), String(p.coverUrl ?? ''), String(p.id ?? ''), String(p.businessName ?? '')),
  coverUrl:             resolveListingCoverUrl(String(p.coverUrl ?? ''), String(p.imageUrl ?? ''), String(p.id ?? ''), String(p.businessName ?? '')),
  description:          { en: String(p.description ?? ''), ar: '' },
  categoryId:           String(p.category ?? '').toLowerCase().replace(/ /g, '-'),
  subcategory:          { en: String(p.category ?? ''), ar: '' },
  listingType:          (p.listingType === 'service' ? 'service' : 'business') as Business['listingType'],
  address:              String(p.address ?? ''),
  city:                 (String(p.city || 'New York')) as Business['city'],
  area:                 String(p.area ?? ''),
  isVerified:           Boolean(p.isVerified),
  status:               (p.subscriptionStatus === 'suspended'
    ? 'suspended'
    : p.subscriptionStatus === 'pending'
      ? 'pending'
      : 'active') as BusinessStatus,
  phone:                String(p.phone ?? ''),
  whatsapp:             String(p.whatsapp ?? ''),
  website:              String(p.website ?? ''),
  workingHours:         { en: String(p.workingHours ?? ''), ar: '' },
  membershipExpiryDate: String(p.membershipExpiry ?? ''),
  registeredAt:         p.createdAt ? String(p.createdAt).slice(0, 10) : undefined,
  subscriptionTier:     p.subscriptionTier === 30 ? 30 : p.subscriptionTier === 50 ? 50 : undefined,
  gallery:              [],
  rating:               Number(p.rating ?? 0),
  reviewsCount:         Number(p.reviewsCount ?? 0),
});

/** Map a Supabase jobs_board row → Job shape the UI expects */
const mapApiJob = (j: Record<string, unknown>): Job => {
  const businessId = String(j.businessId ?? '');
  const rawLogo = String(j.businessLogoUrl ?? '');
  return {
    id:               String(j.id ?? ''),
    businessId,
    businessName:     String(j.businessName ?? ''),
    businessLogoUrl:  resolveListingLogoUrl(rawLogo, '', businessId, String(j.businessName ?? '')),
    title:            String(j.title ?? ''),
    category:         String(j.category ?? 'Others') as JobCategory,
    requirements:     String(j.requirements ?? ''),
    salaryMin:        Number(j.salaryMin ?? 0),
    salaryMax:        Number(j.salaryMax ?? 0),
    hiringEmail:      String(j.hiringEmail ?? ''),
    postedDate:       String(j.postedDate ?? j.createdAt ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    isActive:         Boolean(j.isActive ?? true),
  };
};

// Role name normaliser: backend may send 'business_owner'; frontend uses 'business'
const normaliseRole = (r: string): UserRole => {
  if (r === 'business_owner') return 'business';
  if (['business', 'service_provider', 'customer', 'admin'].includes(r)) return r as UserRole;
  return 'customer';
};

const AUTH_SOURCE_KEY = 'shia_dir_auth_source';
const BACKEND_AUTH_SOURCE = 'backend';

const restoreBackendSessionFromStorage = (): { token: string; user: UserProfile } | null => {
  if (safeGetItem(AUTH_SOURCE_KEY) !== BACKEND_AUTH_SOURCE) return null;
  const token = safeGetItem('shia_dir_token');
  const saved = safeGetItem('shia_dir_user');
  if (!token || !saved) return null;
  try {
    return { token, user: JSON.parse(saved) as UserProfile };
  } catch {
    return null;
  }
};

const profileFromSupabaseSession = (session: Session): UserProfile => {
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const appMeta = (u.app_metadata ?? {}) as Record<string, unknown>;
  return {
    id:                u.id,
    email:             u.email ?? '',
    phone:             String(meta.phone ?? ''),
    name:              String(meta.name ?? u.email?.split('@')[0] ?? 'User'),
    role:              normaliseRole(String(appMeta.role ?? meta.role ?? 'customer')),
    preferredLanguage: (meta.preferredLanguage as 'en') ?? 'en',
  };
};

// ── Context type ───────────────────────────────────────────────────────────

interface DirectoryContextType {
  // Auth
  authReady:        boolean;
  isAuthenticated:  boolean;
  currentUser:      UserProfile | null;
  apiToken:         string | null;
  apiLogin:         (email: string, password: string) => Promise<{ success: boolean; error?: string; needsEmailVerification?: boolean; email?: string; verificationCode?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signInWithApple:  () => Promise<{ success: boolean; error?: string }>;
  oauthAvailable:   boolean;
  registerAccount:  (payload: { name: string; email: string; password: string; phone: string }) => Promise<{ success: boolean; error?: string; needsEmailVerification?: boolean; email?: string; verificationCode?: string }>;
  verifyEmailCode:  (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resendVerificationCode: (email: string) => Promise<{ success: boolean; error?: string; verificationCode?: string }>;
  deleteAccount:    () => Promise<{ success: boolean; error?: string }>;
  blockListingOwner: (ownerEmailOrId: string) => Promise<{ success: boolean; error?: string }>;
  signOut:          () => Promise<void>;
  updateUserProfile: (updates: Partial<Pick<UserProfile, 'name' | 'phone' | 'preferredLanguage'>>) => Promise<{ success: boolean; error?: string }>;

  // i18n / theme (English-only UI)
  language:       'en';
  theme:          'light' | 'dark';
  setTheme:       (t: 'light' | 'dark') => void;

  // Directory data
  categories:     Category[];
  addCategory:    (category: Category) => Promise<{ success: boolean; error?: string }>;
  removeCategory: (id: string) => Promise<{ success: boolean; error?: string }>;
  refreshCategories: () => Promise<void>;

  businesses:     Business[];
  addBusiness:    (business: Business) => void;
  updateBusiness: (updated: Business) => void;
  removeBusiness: (id: string) => void;
  refreshDirectory: (actingUser?: UserProfile | null) => Promise<void>;

  reviews:        Review[];
  addReview:      (review: Review) => void;
  fetchReviewsForBusiness: (businessId: string) => Promise<void>;
  submitReview:   (businessId: string, rating: number, comment?: string) => Promise<{ success: boolean; error?: string }>;

  favorites:      string[];
  favoritesLoading: boolean;
  favoritesError:   string;
  refreshFavorites: (token?: string | null) => Promise<void>;
  toggleFavorite: (businessId: string) => Promise<{ success: boolean; error?: string }>;

  payments:       PaymentRecord[];
  refreshPayments: (token?: string | null, role?: UserRole) => Promise<void>;
  renewMembership: (businessId: string, amount: number) => Promise<{ success: boolean; error?: string; payment?: PaymentRecord }>;

  notifications:        AppNotification[];
  notificationsLoading: boolean;
  notificationsError:   string;
  refreshNotifications: (token?: string | null) => Promise<void>;
  addNotification:      (title: string, message: string, receiverRole: UserRole | 'all', personal?: boolean, userId?: string) => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
  clearNotifications:   () => Promise<void>;

  jobs:           Job[];
  addJob:         (job: Job) => void;
  updateJob:      (job: Job) => void;
  deleteJob:      (id: string) => void;
  refreshJobs:    (token?: string | null) => Promise<void>;

  hiringActive:   Record<string, boolean>;
  setHiringActive:(businessId: string, active: boolean) => Promise<void>;
  ensureBusinessListing: () => Promise<Business | null>;
}

// ── Context & Provider ─────────────────────────────────────────────────────

const DirectoryContext = createContext<DirectoryContextType | undefined>(undefined);

export const DirectoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  // ── Persisted preferences ────────────────────────────────────────────────
  const language = 'en' as const;
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = safeGetItem('shia_dir_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });

  // ── Auth ─────────────────────────────────────────────────────────────────
  const [apiToken, setApiToken] = useState<string | null>(() => {
    const backend = restoreBackendSessionFromStorage();
    if (backend) return backend.token;
    return isSupabaseConfigured ? null : safeGetItem('shia_dir_token');
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const backend = restoreBackendSessionFromStorage();
    if (backend) return backend.user;
    if (isSupabaseConfigured) return null;
    try {
      const saved = safeGetItem('shia_dir_user');
      if (saved) return JSON.parse(saved);
    } catch { safeRemoveItem('shia_dir_user'); }
    return null;
  });

  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const favoritesMergedRef = useRef(false);

  // ── Directory data (starts with mock; overwritten by API on mount) ────────
  const [categories, setCategories] = useState<Category[]>([]);

  const [businesses, setBusinesses] = useState<Business[]>(INITIAL_BUSINESSES);

  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);

  const [favorites, setFavorites] = useState<string[]>(() => {
    if (isSupabaseConfigured) return [];
    try { const s = localStorage.getItem('shia_dir_favorites'); if (s) return JSON.parse(s); } catch { /**/ }
    return [];
  });
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState('');

  const [payments, setPayments] = useState<PaymentRecord[]>(INITIAL_PAYMENTS);

  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);

  const [hiringActive, setHiringActiveState] = useState<Record<string, boolean>>(INITIAL_HIRING_ACTIVE);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');

  // ── localStorage sync (preferences only — data comes from API) ────────────
  useEffect(() => { safeSetItem('shia_dir_user', currentUser ? JSON.stringify(currentUser) : ''); }, [currentUser]);
  useEffect(() => { safeSetItem('shia_dir_token', apiToken || ''); }, [apiToken]);
  useEffect(() => { safeSetItem('shia_dir_theme', theme); }, [theme]);

  // ── Theme effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // ── Live API fetch — source of truth (starts empty until you add listings) ──
  const syncMyDirectoryProfile = useCallback(async (token: string, userEmail?: string, userRole?: UserRole): Promise<void> => {
    if (!token) return;

    try {
      const res = await apiFetch('/api/directory/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const profile: Record<string, unknown> | null = await res.json();
      if (!profile?.id) return;
      const mapped = mapDirectoryProfile(profile);
      setBusinesses((prev) => {
        const rest = prev.filter((b) =>
          b.ownerId !== mapped.ownerId &&
          b.ownerId !== userEmail &&
          b.id !== mapped.id
        );
        return [...rest, mapped];
      });
      if (profile.hiringActive !== undefined) {
        setHiringActiveState((p) => ({ ...p, [mapped.id]: Boolean(profile.hiringActive) }));
      }
    } catch {
      console.warn('[ABN Directory] Could not load your directory profile.');
    }
  }, []);

  const refreshJobs = useCallback(async (token?: string | null): Promise<void> => {
    const authToken = token ?? apiToken;
    try {
      const [publicRes, mineRes] = await Promise.all([
        apiFetch('/api/jobsboard'),
        authToken
          ? apiFetch('/api/jobsboard/mine', { headers: { Authorization: `Bearer ${authToken}` } })
          : Promise.resolve(null),
      ]);

      const byId = new Map<string, Job>();

      if (publicRes.ok) {
        const publicData: Record<string, unknown>[] = await publicRes.json();
        if (Array.isArray(publicData)) {
          publicData.forEach((row) => {
            const job = mapApiJob(row);
            byId.set(job.id, job);
          });
        }
      }

      if (mineRes?.ok) {
        const mineData: Record<string, unknown>[] = await mineRes.json();
        if (Array.isArray(mineData)) {
          mineData.forEach((row) => {
            const job = mapApiJob(row);
            byId.set(job.id, job);
          });
        }
      }

      setJobs(Array.from(byId.values()));
    } catch {
      setJobs([]);
      console.warn('[ABN Directory] Could not load jobs from API.');
    }
  }, [apiToken]);

  const refreshDirectory = async (actingUser?: UserProfile | null): Promise<void> => {
    try {
      const role = actingUser?.role ?? currentUser?.role;
      const token = apiToken ?? (typeof window !== 'undefined' ? localStorage.getItem('shia_dir_token') : null);
      const isAdminUser = role === 'admin';
      const shouldFetchMine = Boolean(apiToken && role);
      // Admins must use the authenticated /all endpoint — public /directory hides pending listings
      if (isAdminUser && !token) return;
      const dirPath = isAdminUser ? '/api/directory/all' : '/api/directory';
      const authHeaders: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const [dirRes, mineRes] = await Promise.all([
        apiFetch(dirPath, { headers: authHeaders }),
        shouldFetchMine
          ? apiFetch('/api/directory/mine', { headers: authHeaders })
          : Promise.resolve(null),
      ]);

      let listings: Business[] = [];
      let rawDirData: Record<string, unknown>[] = [];
      if (dirRes.ok) {
        const dirData: Record<string, unknown>[] = await dirRes.json();
        if (Array.isArray(dirData)) {
          rawDirData = dirData;
          listings = dirData.map(mapDirectoryProfile);
        }
      }

      // Keep the signed-in user's pending profile visible even when not public yet
      if (mineRes?.ok) {
        const mineData: Record<string, unknown> | null = await mineRes.json();
        if (mineData?.id) {
          const mineListing = mapDirectoryProfile(mineData);
          if (!listings.some((b) => b.id === mineListing.id)) {
            listings = [...listings, mineListing];
          }
        }
      }

      setBusinesses(listings);
      const hiring: Record<string, boolean> = {};
      rawDirData.forEach((p) => {
        hiring[String(p.id)] = Boolean(p.hiringActive);
      });
      listings.forEach((b) => {
        if (hiring[b.id] === undefined) hiring[b.id] = hiringActive[b.id] ?? false;
      });
      setHiringActiveState(hiring);

      await refreshJobs(token);
    } catch {
      setBusinesses([]);
      setJobs([]);
      setHiringActiveState({});
      console.warn('[ABN Directory] Backend not reachable — showing empty directory.');
    }
  };

  const refreshCategories = async (): Promise<void> => {
    const OTHER_CATEGORY = {
      id: 'cat-other',
      name: { en: 'Other', ar: 'Other' },
      group: 'Services',
      iconName: 'HelpCircle',
    };

    try {
      const res = await apiFetch('/api/categories');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.categories)) {
        let cats = data.categories.map((cat) => ({
          ...cat,
          name: { en: cat.name?.en || '', ar: cat.name?.en || '' },
        }));
        if (!cats.some((c) => c.id === OTHER_CATEGORY.id)) {
          cats = [...cats, OTHER_CATEGORY];
        }
        cats.sort((a, b) => {
          if (a.id === OTHER_CATEGORY.id) return 1;
          if (b.id === OTHER_CATEGORY.id) return -1;
          return (a.name.en || '').localeCompare(b.name.en || '');
        });
        setCategories(cats);
      }
    } catch {
      console.warn('[ABN Directory] Could not load categories from API.');
    }
  };

  const refreshNotifications = async (token?: string | null): Promise<void> => {
    const authToken = token ?? apiToken;
    if (!authToken) {
      setNotifications([]);
      setNotificationsError('');
      return;
    }

    setNotificationsLoading(true);
    setNotificationsError('');
    try {
      const res = await apiFetch('/api/notifications', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setNotificationsError(data.error || 'Failed to load notifications.');
        setNotifications([]);
        return;
      }
      if (Array.isArray(data.notifications)) setNotifications(data.notifications);
    } catch {
      setNotificationsError('Cannot reach server. Make sure the backend is running.');
      console.warn('[ABN Directory] Could not load notifications from API.');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const applyBackendSession = useCallback((
    token: string,
    user: { id: string; email: string; phone?: string; name: string; role: string; preferredLanguage?: string },
  ): UserProfile => {
    const profile: UserProfile = {
      id:                user.id,
      email:             user.email,
      phone:             user.phone || '',
      name:              user.name,
      role:              normaliseRole(user.role),
      preferredLanguage: (user.preferredLanguage as 'en') || 'en',
    };
    safeSetItem(AUTH_SOURCE_KEY, BACKEND_AUTH_SOURCE);
    setApiToken(token);
    setCurrentUser(profile);
    return profile;
  }, []);

  const clearAuthState = useCallback(() => {
    setCurrentUser(null);
    setApiToken(null);
    safeRemoveItem('shia_dir_token');
    safeRemoveItem('shia_dir_user');
    safeRemoveItem(AUTH_SOURCE_KEY);
    favoritesMergedRef.current = false;
    try {
      const s = safeGetItem('shia_dir_favorites');
      setFavorites(s ? JSON.parse(s) : []);
    } catch {
      setFavorites([]);
    }
  }, []);

  const applySupabaseSession = useCallback((session: Session | null): UserProfile | null => {
    const backendSession = restoreBackendSessionFromStorage();
    if (backendSession) {
      setApiToken(backendSession.token);
      setCurrentUser(backendSession.user);
      return backendSession.user;
    }

    if (!session) {
      clearAuthState();
      return null;
    }

    safeRemoveItem(AUTH_SOURCE_KEY);
    const profile = profileFromSupabaseSession(session);
    setCurrentUser(profile);
    setApiToken(session.access_token);
    safeSetItem('shia_dir_token', session.access_token);
    clearOAuthCallbackUrl();
    return profile;
  }, [clearAuthState]);

  const syncOAuthUser = useCallback(async (token: string): Promise<void> => {
    try {
      const res = await apiFetch('/api/auth/oauth-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { user: { id: string; email: string; phone: string; name: string; role: string; preferredLanguage?: string }; isNewUser?: boolean };
      setCurrentUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          id:                data.user.id || prev.id,
          name:              data.user.name || prev.name,
          phone:             data.user.phone || prev.phone,
          role:              normaliseRole(data.user.role),
          preferredLanguage: 'en',
        };
      });
      if (data.isNewUser) {
        if (token) {
          try {
            await apiFetch('/api/notifications', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                title: 'Welcome to ABN',
                message: 'Your account was created successfully.',
                receiverRole: 'customer',
              }),
            });
          } catch { /**/ }
        }
      }
      await refreshDirectory();
      await refreshPayments(token, normaliseRole(data.user.role));
      await refreshFavorites(token);
    } catch {
      console.warn('[ABN Directory] OAuth user sync failed.');
    }
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase session listener — auth gateway source of truth ───────────────
  useEffect(() => {
    // Native APK: email/password uses Render backend JWT; restore it immediately.
    if (isNativeApp()) {
      const backendSession = restoreBackendSessionFromStorage();
      if (backendSession) {
        setApiToken(backendSession.token);
        setCurrentUser(backendSession.user);
      }
      setAuthReady(true);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setAuthReady(true);
      return;
    }

    let active = true;

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!active) return;
        const backendSession = restoreBackendSessionFromStorage();
        if (backendSession) {
          setApiToken(backendSession.token);
          setCurrentUser(backendSession.user);
          setAuthReady(true);
          return;
        }
        applySupabaseSession(session);
        if (session?.access_token) {
          await syncOAuthUser(session.access_token);
        }
        setAuthReady(true);
      })
      .catch((err) => {
        // Never leave the app stuck on the session-check screen
        console.warn('[ABN Directory] Session check failed — continuing signed out.', err);
        if (!active) return;
        applySupabaseSession(null);
        setAuthReady(true);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (safeGetItem(AUTH_SOURCE_KEY) === BACKEND_AUTH_SOURCE) {
        setAuthReady(true);
        return;
      }
      applySupabaseSession(session);
      if (session?.access_token && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        await syncOAuthUser(session.access_token);
      }
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySupabaseSession, syncOAuthUser]);

  const isAuthenticated = isNativeApp()
    ? Boolean(currentUser && apiToken)
    : isSupabaseConfigured
      ? Boolean(currentUser && apiToken)
      : Boolean(currentUser);

  // Refresh directory when authenticated — re-fetch when role changes (e.g. admin login)
  const lastHydratedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!authReady) return;
    refreshCategories();
    if (!isAuthenticated || !currentUser) return;
    const hydrateKey = `${currentUser.id}:${currentUser.role}:${apiToken ? 'auth' : 'guest'}`;
    if (lastHydratedKeyRef.current === hydrateKey) return;
    lastHydratedKeyRef.current = hydrateKey;
    refreshDirectory(currentUser);
    refreshPayments(apiToken, currentUser.role);
    refreshFavorites(apiToken);
    refreshNotifications(apiToken);
  }, [authReady, isAuthenticated, currentUser?.id, currentUser?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isAuthenticated) {
      lastHydratedKeyRef.current = null;
      favoritesMergedRef.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) return;
    safeSetItem('shia_dir_favorites', JSON.stringify(favorites));
  }, [favorites, isAuthenticated]);

  useEffect(() => {
    if (apiToken) {
      syncMyDirectoryProfile(apiToken, currentUser?.email, currentUser?.role);
    }
  }, [apiToken, currentUser?.email, currentUser?.role, syncMyDirectoryProfile]);

  // ── Auth functions ────────────────────────────────────────────────────────

  const signInWithOAuth = async (provider: 'google' | 'apple'): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) {
      return { success: false, error: 'Google/Apple sign-in requires Supabase to be configured.' };
    }
    try {
      const redirectTo = getOAuthRedirectUrl();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          ...(provider === 'google'
            ? { queryParams: { prompt: 'select_account', access_type: 'offline' } }
            : { scopes: 'name email' }),
        },
      });

      if (error) {
        return { success: false, error: formatOAuthError(error.message, provider, language) };
      }

      if (!data?.url) {
        return {
          success: false,
          error: formatOAuthError('Unsupported provider: provider is not enabled', provider, language),
        };
      }

      // Detect disabled provider before leaving the app (Supabase returns JSON 400 on authorize URL)
      try {
        const probe = await fetch(data.url, { method: 'GET', redirect: 'manual', credentials: 'omit' });
        const contentType = probe.headers.get('content-type') || '';
        if (probe.status === 400 && contentType.includes('application/json')) {
          const body = (await probe.json()) as { msg?: string; error_description?: string; message?: string };
          const msg = body.msg || body.error_description || body.message || '';
          if (msg.toLowerCase().includes('not enabled') || msg.toLowerCase().includes('unsupported provider')) {
            return { success: false, error: formatOAuthError(msg, provider, language) };
          }
        }
      } catch {
        // CORS may block probe — proceed with redirect and let Supabase handle it
      }

      window.location.assign(data.url);
      return { success: true };
    } catch {
      return { success: false, error: 'Could not start sign-in. Please try again.' };
    }
  };

  const signInWithGoogle = () => signInWithOAuth('google');
  const signInWithApple = () => signInWithOAuth('apple');

  /** Sign in — backend JWT first (roles), Supabase fallback for OAuth-only accounts */
  const apiLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string; needsEmailVerification?: boolean; email?: string; verificationCode?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await res.json();

      if (data.needsEmailVerification) {
        return {
          success: false,
          needsEmailVerification: true,
          email: data.email || trimmedEmail,
          verificationCode: data.verificationCode,
          error: data.error || 'Email not verified.',
        };
      }

      if (res.ok && data.token) {
        const user = data.user as { id: string; email: string; phone: string; name: string; role: string; preferredLanguage?: string };
        const profile = applyBackendSession(data.token, user);
        void addNotification(
          'Login Successful',
          `Assalamu Alaykum, ${profile.name}. Welcome back!`,
          profile.role,
          true,
          profile.id,
        );

        await refreshDirectory(profile);
        await refreshPayments(data.token, profile.role);
        await refreshFavorites(data.token);
        await syncMyDirectoryProfile(data.token, profile.email, profile.role);

        if (supabase && !isNativeApp() && profile.role !== 'admin') {
          supabase.auth.signInWithPassword({ email: trimmedEmail, password }).catch(() => {});
        }
        return { success: true };
      }

      if (!supabase || isNativeApp()) {
        return { success: false, error: data.error || 'Login failed.' };
      }
    } catch {
      if (!supabase || isNativeApp()) {
        return {
          success: false,
          error: isNativeApp()
            ? 'Cannot reach server. Wait 60 seconds and try again — the cloud server may be waking up.'
            : 'Cannot reach server. Make sure the backend is running.',
        };
      }
    }

    if (supabase && !isNativeApp()) {
      safeRemoveItem(AUTH_SOURCE_KEY);
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      addNotification('Login Successful', 'Assalamu Alaykum. Welcome back!', 'customer', true);
      return { success: true };
    }

    return { success: false, error: 'Login failed.' };
  };

  const registerAccount = async (payload: {
    name: string;
    email: string;
    password: string;
    phone: string;
  }): Promise<{ success: boolean; error?: string; needsEmailVerification?: boolean; email?: string; verificationCode?: string }> => {
    const trimmedEmail = payload.email.trim().toLowerCase();
    const trimmedName = payload.name.trim();
    const trimmedPhone = payload.phone.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !payload.password) {
      return { success: false, error: 'All fields are required.' };
    }

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          role: 'customer',
          password: payload.password,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed.' };
      }

      if (data.needsEmailVerification) {
        return {
          success: true,
          needsEmailVerification: true,
          email: data.email || trimmedEmail,
          verificationCode: data.verificationCode,
        };
      }

      if (data.token && data.user) {
        applyBackendSession(data.token, data.user);
        await refreshDirectory();
        await refreshFavorites(data.token);
        return { success: true };
      }

      return { success: true };
    } catch {
      return {
        success: false,
        error: isNativeApp()
          ? 'Cannot reach server. Wait 60 seconds and try again — the cloud server may be waking up.'
          : 'Cannot reach server. Make sure the backend is running.',
      };
    }
  };

  const verifyEmailCode = async (email: string, code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        return { success: false, error: data.error || 'Verification failed.' };
      }
      applyBackendSession(data.token, data.user);
      await refreshDirectory();
      await refreshFavorites(data.token);
      return { success: true };
    } catch {
      return { success: false, error: 'Cannot reach server.' };
    }
  };

  const resendVerificationCode = async (email: string): Promise<{ success: boolean; error?: string; verificationCode?: string }> => {
    try {
      const res = await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Could not resend code.' };
      return { success: true, verificationCode: data.verificationCode };
    } catch {
      return { success: false, error: 'Cannot reach server.' };
    }
  };

  const deleteAccount = async (): Promise<{ success: boolean; error?: string }> => {
    if (!apiToken) return { success: false, error: 'Not signed in.' };
    try {
      const res = await apiFetch('/api/auth/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: data.error || 'Could not delete account.' };
      await signOut();
      return { success: true };
    } catch {
      return { success: false, error: 'Cannot reach server.' };
    }
  };

  const blockListingOwner = async (ownerEmailOrId: string): Promise<{ success: boolean; error?: string }> => {
    if (!apiToken) return { success: false, error: 'Sign in to block.' };
    try {
      const looksLikeEmail = ownerEmailOrId.includes('@');
      const res = await apiFetch('/api/auth/blocks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          looksLikeEmail ? { email: ownerEmailOrId } : { userId: ownerEmailOrId },
        ),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Could not block.' };
      // Hide their listings locally
      setBusinesses((prev) =>
        prev.filter((b) => b.ownerId !== ownerEmailOrId && b.ownerId !== data.blockedUserId),
      );
      return { success: true };
    } catch {
      return { success: false, error: 'Cannot reach server.' };
    }
  };

  const signOut = async (): Promise<void> => {
    safeRemoveItem(AUTH_SOURCE_KEY);
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearAuthState();
  };

  const updateUserProfile = async (
    updates: Partial<Pick<UserProfile, 'name' | 'phone' | 'preferredLanguage'>>,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'You must be signed in to update your profile.' };
    }

    if (apiToken) {
      try {
        const res = await apiFetch('/api/auth/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || 'Failed to update profile.' };
        }
        setCurrentUser({
          ...currentUser,
          name:              data.name              ?? currentUser.name,
          phone:             data.phone             ?? currentUser.phone,
          preferredLanguage: 'en',
        });
        return { success: true };
      } catch {
        return { success: false, error: 'Cannot reach server. Make sure the backend is running.' };
      }
    }

    return { success: false, error: 'You must be signed in to update your profile.' };
  };

  // ── Category helpers (server-backed) ──────────────────────────────────────
  const setTheme = (t: 'light' | 'dark') => setThemeState(t);

  const addCategory = async (cat: Category): Promise<{ success: boolean; error?: string }> => {
    if (!apiToken) return { success: false, error: 'Admin authentication required.' };
    try {
      const res = await apiFetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          id: cat.id,
          name: cat.name,
          group: cat.group,
          iconName: cat.iconName,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to create category.' };
      await refreshCategories();
      return { success: true };
    } catch {
      return { success: false, error: 'Cannot reach server.' };
    }
  };

  const removeCategory = async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!apiToken) return { success: false, error: 'Admin authentication required.' };
    try {
      const res = await apiFetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || 'Failed to delete category.' };
      }
      await refreshCategories();
      return { success: true };
    } catch {
      return { success: false, error: 'Cannot reach server.' };
    }
  };

  // ── Business helpers ──────────────────────────────────────────────────────
  const addBusiness = (biz: Business) => {
    setBusinesses((p) => [...p, biz]);
  };
  const updateBusiness = (updated: Business) =>
    setBusinesses((p) => p.map((b) => (b.id === updated.id ? updated : b)));
  const removeBusiness = (id: string) =>
    setBusinesses((p) => p.filter((b) => b.id !== id));

  // ── Review helpers ────────────────────────────────────────────────────────
  const addReview = (review: Review) => {
    setReviews((prevR) => {
      const exists = prevR.some((r) => r.id === review.id);
      const updated = exists ? prevR : [review, ...prevR];
      setBusinesses((prevB) => prevB.map((biz) => {
        if (biz.id !== review.businessId) return biz;
        const bizRevs = updated.filter((r) => r.businessId === review.businessId);
        const avg = parseFloat((bizRevs.reduce((s, r) => s + r.rating, 0) / bizRevs.length).toFixed(1));
        return { ...biz, rating: avg, reviewsCount: bizRevs.length };
      }));
      return updated;
    });
  };

  const applyBusinessAggregate = (businessId: string, avg: number, count: number) => {
    setBusinesses((prev) => prev.map((biz) =>
      biz.id === businessId ? { ...biz, rating: avg, reviewsCount: count } : biz
    ));
  };

  const fetchReviewsForBusiness = useCallback(async (businessId: string): Promise<void> => {
    try {
      const res = await apiFetch(`/api/reviews?businessId=${encodeURIComponent(businessId)}`);
      if (!res.ok) return;
      const data: Review[] = await res.json();
      if (!Array.isArray(data)) return;
      setReviews((prev) => {
        const others = prev.filter((r) => r.businessId !== businessId);
        return [...data, ...others];
      });
    } catch {
      console.warn('[ABN Directory] Could not load reviews from API.');
    }
  }, []);

  const submitReview = async (
    businessId: string,
    rating: number,
    comment = '',
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'You must be signed in to submit a review.' };
    }

    if (apiToken) {
      try {
        const res = await apiFetch('/api/reviews', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({ businessId, rating, comment: comment.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || 'Failed to submit review.' };
        }
        const review = data.review as Review;
        addReview(review);
        if (data.aggregate) {
          applyBusinessAggregate(businessId, data.aggregate.avg, data.aggregate.count);
        }
        return { success: true };
      } catch {
        return { success: false, error: 'Cannot reach server. Make sure the backend is running.' };
      }
    }

    return { success: false, error: 'You must be signed in to submit a review.' };
  };

  // ── Favorites (server-synced when signed in) ──────────────────────────────
  const readLegacyLocalFavorites = (): string[] => {
    try {
      const s = safeGetItem('shia_dir_favorites');
      if (!s) return [];
      const parsed = JSON.parse(s);
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string')
        : [];
    } catch {
      return [];
    }
  };

  const mergeFavoriteListings = (rawListings: Record<string, unknown>[]) => {
    if (!Array.isArray(rawListings) || rawListings.length === 0) return;
    const mapped = rawListings.map(mapDirectoryProfile);
    setBusinesses((prev) => {
      const byId = new Map(prev.map((b) => [b.id, b]));
      mapped.forEach((biz) => byId.set(biz.id, biz));
      return [...byId.values()];
    });
  };

  const applyFavoritesPayload = (payload: unknown): string[] => {
    if (Array.isArray(payload)) {
      return payload.filter((id): id is string => typeof id === 'string');
    }
    if (payload && typeof payload === 'object') {
      const data = payload as { businessIds?: unknown; listings?: unknown };
      if (Array.isArray(data.listings)) {
        mergeFavoriteListings(data.listings as Record<string, unknown>[]);
      }
      if (Array.isArray(data.businessIds)) {
        return data.businessIds.filter((id): id is string => typeof id === 'string');
      }
    }
    return [];
  };

  const refreshFavorites = async (token?: string | null): Promise<void> => {
    const authToken = token ?? apiToken;
    if (!authToken) {
      setFavorites(readLegacyLocalFavorites());
      setFavoritesError('');
      return;
    }

    setFavoritesLoading(true);
    setFavoritesError('');
    try {
      const res = await apiFetch('/api/favorites', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFavoritesError(data.error || 'Could not load saved favorites.');
        return;
      }

      let serverIds = applyFavoritesPayload(data);

      if (!favoritesMergedRef.current) {
        favoritesMergedRef.current = true;
        const legacy = readLegacyLocalFavorites();
        const toUpload = legacy.filter((id) => !serverIds.includes(id));
        for (const businessId of toUpload) {
          try {
            const addRes = await apiFetch(`/api/favorites/${businessId}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${authToken}` },
            });
            if (addRes.ok) {
              const addData = await addRes.json();
              serverIds = applyFavoritesPayload(addData);
            }
          } catch { /**/ }
        }
        if (legacy.length > 0) safeRemoveItem('shia_dir_favorites');
      }

      setFavorites(serverIds);
    } catch {
      setFavoritesError('Cannot reach server. Make sure the backend is running.');
      console.warn('[ABN Directory] Could not load saved favorites.');
    } finally {
      setFavoritesLoading(false);
    }
  };

  const toggleFavorite = async (businessId: string): Promise<{ success: boolean; error?: string }> => {
    if (!apiToken) {
      return { success: false, error: 'Sign in to save favorites to your account.' };
    }

    const wasFav = favorites.includes(businessId);
    setFavorites((p) => (wasFav ? p.filter((id) => id !== businessId) : [...p, businessId]));

    const method = wasFav ? 'DELETE' : 'POST';
    try {
      const res = await apiFetch(`/api/favorites/${businessId}`, {
        method,
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFavorites((p) => (wasFav ? [...p, businessId] : p.filter((id) => id !== businessId)));
        return { success: false, error: data.error || 'Could not update saved list.' };
      }
      setFavorites(applyFavoritesPayload(data));
      return { success: true };
    } catch {
      setFavorites((p) => (wasFav ? [...p, businessId] : p.filter((id) => id !== businessId)));
      return { success: false, error: 'Cannot reach server. Make sure the backend is running.' };
    }
  };

  // ── Payments (server-persisted via /api/payments) ─────────────────────────
  const refreshPayments = async (token?: string | null, role?: UserRole): Promise<void> => {
    const authToken = token ?? apiToken;
    if (!authToken) {
      setPayments([]);
      return;
    }

    const path = role === 'admin' ? '/api/payments' : '/api/payments/mine';
    try {
      const res = await apiFetch(path, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setPayments(data);
    } catch {
      console.warn('[ABN Directory] Could not load payment history.');
    }
  };

  const renewMembership = async (
    businessId: string,
    amount: number,
  ): Promise<{ success: boolean; error?: string; payment?: PaymentRecord }> => {
    if (!apiToken) {
      return { success: false, error: 'You must be signed in to renew membership.' };
    }

    try {
      const res = await apiFetch('/api/payments/renew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ businessId, amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Payment could not be recorded.' };
      }

      const payment = data.payment as PaymentRecord;
      setPayments((p) => [payment, ...p.filter((x) => x.id !== payment.id)]);

      if (data.profile) {
        const mapped = mapDirectoryProfile(data.profile as Record<string, unknown>);
        setBusinesses((prev) => {
          const rest = prev.filter((b) => b.id !== mapped.id);
          return [...rest, mapped];
        });
      } else {
        setBusinesses((p) => p.map((biz) => {
          if (biz.id !== businessId) return biz;
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + 30);
          return { ...biz, status: 'active', membershipExpiryDate: expiry.toISOString().split('T')[0] };
        }));
      }

      const biz = businesses.find((b) => b.id === businessId);
      if (biz) await refreshNotifications(apiToken);

      return { success: true, payment };
    } catch {
      return { success: false, error: 'Could not reach payment service.' };
    }
  };

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const addJob = (job: Job) => {
    setJobs((p) => {
      const rest = p.filter((j) => j.id !== job.id);
      return [job, ...rest];
    });
  };
  const updateJob = (updated: Job) => setJobs((p) => p.map((j) => (j.id === updated.id ? updated : j)));
  const deleteJob = (id: string) => setJobs((p) => p.filter((j) => j.id !== id));

  /** Auto-provision a minimal directory listing for business users who have none yet. */
  const ensureBusinessListing = async (): Promise<Business | null> => {
    if (!currentUser || currentUser.role !== 'business') return null;

    const existing = businesses.find(
      (b) => b.ownerId === currentUser.id || b.ownerId === currentUser.email,
    );
    if (existing) return existing;

    const payload = {
      businessName: currentUser.name || 'My Business',
      category:     'General',
      description:  'Business listing — customize via Edit Profile.',
      phone:        currentUser.phone || '',
      whatsapp:     currentUser.phone || '',
      city:         'New York',
      workingHours: '9:00 AM - 9:00 PM',
      subscriptionTier: 50,
    };

    if (apiToken) {
      try {
        const res = await apiFetch('/api/directory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data: Record<string, unknown> = await res.json();
          const mapped = mapDirectoryProfile(data);
          setBusinesses((prev) => {
            const rest = prev.filter((b) => b.ownerId !== mapped.ownerId);
            return [...rest, mapped];
          });
          return mapped;
        }
      } catch {
        console.warn('[ABN Directory] Could not auto-provision listing via API.');
      }
    }

    return null;
  };

  const setHiringActive = async (businessId: string, active: boolean): Promise<void> => {
    setHiringActiveState((p) => ({ ...p, [businessId]: active }));
    setJobs((p) => p.map((j) => (j.businessId === businessId ? { ...j, isActive: active } : j)));

    if (apiToken) {
      try {
        const res = await apiFetch(`/api/directory/${businessId}/hiring`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({ isActive: active }),
        });
        if (res.ok) {
          await refreshDirectory();
        }
      } catch {
        console.warn('[ABN Directory] Could not sync hiring toggle to server.');
      }
    }
  };

  // ── Notifications (server-backed) ─────────────────────────────────────────
  const addNotification = async (
    title: string,
    message: string,
    receiverRole: UserRole | 'all',
    personal = false,
    explicitUserId?: string,
  ) => {
    const token = apiToken ?? (typeof window !== 'undefined' ? localStorage.getItem('shia_dir_token') : null);
    if (!token) return;
    try {
      await apiFetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          message,
          receiverRole,
          userId: personal ? (explicitUserId ?? currentUser?.id) : undefined,
        }),
      });
      await refreshNotifications(token);
    } catch {
      console.warn('[ABN Directory] Could not persist notification.');
    }
  };

  const markNotificationsAsRead = async () => {
    if (!apiToken) return;
    try {
      await apiFetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      await refreshNotifications(apiToken);
    } catch {
      setNotifications((p) => p.map((n) => ({ ...n, isRead: true })));
    }
  };

  const clearNotifications = async () => {
    if (!apiToken) {
      setNotifications([]);
      return;
    }
    try {
      await apiFetch('/api/notifications', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      setNotifications([]);
    } catch {
      setNotifications([]);
    }
  };

  // ── Provider ──────────────────────────────────────────────────────────────
  return (
    <DirectoryContext.Provider value={{
      authReady, isAuthenticated, currentUser, apiToken, apiLogin, signInWithGoogle, signInWithApple, oauthAvailable: isSupabaseConfigured, registerAccount, verifyEmailCode, resendVerificationCode, deleteAccount, blockListingOwner, signOut, updateUserProfile,
      language, theme, setTheme,
      categories, addCategory, removeCategory, refreshCategories,
      businesses, addBusiness, updateBusiness, removeBusiness, refreshDirectory,
      reviews, addReview, fetchReviewsForBusiness, submitReview,
      favorites, favoritesLoading, favoritesError, refreshFavorites, toggleFavorite,
      payments, refreshPayments, renewMembership,
      notifications, notificationsLoading, notificationsError,
      refreshNotifications, addNotification, markNotificationsAsRead, clearNotifications,
      jobs, addJob, updateJob, deleteJob, refreshJobs,
      hiringActive, setHiringActive, ensureBusinessListing,
    }}>
      {children}
    </DirectoryContext.Provider>
  );
};

export const useDirectory = () => {
  const ctx = useContext(DirectoryContext);
  if (!ctx) throw new Error('useDirectory must be used within a DirectoryProvider');
  return ctx;
};

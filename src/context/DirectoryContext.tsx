import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import {
  UserProfile, Business, BusinessStatus, Category, Review,
  PaymentRecord, AppNotification, UserRole, Product, Order, Job, JobCategory,
} from '../types';
import {
  INITIAL_CATEGORIES, INITIAL_BUSINESSES, INITIAL_REVIEWS,
  INITIAL_PAYMENTS, INITIAL_PRODUCTS, INITIAL_ORDERS, INITIAL_JOBS, INITIAL_HIRING_ACTIVE,
  INITIAL_DEMO_NOTIFICATIONS,
} from '../data/mockData';

/** Bump to force-clear cached mock listings only (never user auth or notifications). */
const DATA_STORE_VERSION = '5-clean-slate-v2';
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('shia_dir_data_version');
  if (stored !== DATA_STORE_VERSION) {
    [
      'shia_dir_businesses',
      'shia_dir_jobs',
      'shia_dir_reviews',
      'shia_dir_hiring_active',
    ].forEach((key) => localStorage.removeItem(key));
    localStorage.setItem('shia_dir_data_version', DATA_STORE_VERSION);
  }

  /** Restore demo notification feed when upgrading (UI-only seed). */
  const NOTIF_SEED_VERSION = 'demo-26-v1';
  if (localStorage.getItem('shia_dir_notif_seed') !== NOTIF_SEED_VERSION) {
    localStorage.removeItem('shia_dir_notifications');
    localStorage.setItem('shia_dir_notif_seed', NOTIF_SEED_VERSION);
  }
}

// ── API helpers ────────────────────────────────────────────────────────────

/** Map a Supabase profiles_directory row → Business shape the UI expects */
const mapDirectoryProfile = (p: Record<string, unknown>): Business => ({
  id:                   String(p.id ?? ''),
  // Use email as ownerId so it matches currentUser.email across auth systems
  ownerId:              String(p.email ?? ''),
  name:                 String(p.businessName ?? ''),
  logoUrl:              String(p.imageUrl ?? ''),
  coverUrl:             String(p.coverUrl ?? ''),
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
  subscriptionTier:     p.subscriptionTier === 30 ? 30 : p.subscriptionTier === 50 ? 50 : undefined,
  gallery:              [],
  rating:               Number(p.rating ?? 0),
  reviewsCount:         Number(p.reviewsCount ?? 0),
});

/** Map a Supabase jobs_board row → Job shape the UI expects */
const mapApiJob = (j: Record<string, unknown>): Job => ({
  id:               String(j.id ?? ''),
  businessId:       String(j.businessId ?? ''),
  businessName:     String(j.businessName ?? ''),
  businessLogoUrl:  String(j.businessLogoUrl ?? ''),
  title:            String(j.title ?? ''),
  category:         String(j.category ?? 'Others') as JobCategory,
  requirements:     String(j.requirements ?? ''),
  salaryMin:        Number(j.salaryMin ?? 0),
  salaryMax:        Number(j.salaryMax ?? 0),
  hiringEmail:      String(j.hiringEmail ?? ''),
  postedDate:       String(j.postedDate ?? ''),
  isActive:         Boolean(j.isActive ?? true),
});

// Role name normaliser: backend may send 'business_owner'; frontend uses 'business'
const normaliseRole = (r: string): UserRole => {
  if (r === 'business_owner') return 'business';
  if (['business', 'service_provider', 'customer', 'admin'].includes(r)) return r as UserRole;
  return 'customer';
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
    preferredLanguage: (meta.preferredLanguage as 'en' | 'ar') ?? 'en',
  };
};

// ── Context type ───────────────────────────────────────────────────────────

interface DirectoryContextType {
  // Auth
  authReady:        boolean;
  isAuthenticated:  boolean;
  currentUser:      UserProfile | null;
  apiToken:         string | null;
  apiLogin:         (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerAccount:  (payload: { name: string; email: string; password: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
  signOut:          () => Promise<void>;
  updateUserProfile: (updates: Partial<Pick<UserProfile, 'name' | 'phone' | 'preferredLanguage'>>) => Promise<{ success: boolean; error?: string }>;

  // i18n / theme
  language:       'en' | 'ar' | 'fa';
  setLanguage:    (lang: 'en' | 'ar' | 'fa') => void;
  theme:          'light' | 'dark' | 'system';
  setTheme:       (t: 'light' | 'dark' | 'system') => void;

  // Directory data
  categories:     Category[];
  addCategory:    (category: Category) => void;
  removeCategory: (id: string) => void;

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
  toggleFavorite: (businessId: string) => void;

  payments:       PaymentRecord[];
  addPayment:     (payment: PaymentRecord) => void;

  products:       Product[];
  addProduct:     (product: Product) => void;

  orders:         Order[];
  updateOrderStatus: (id: string, status: Order['status']) => void;

  notifications:        AppNotification[];
  addNotification:      (title: string, message: string, receiverRole: UserRole | 'all') => void;
  markNotificationsAsRead: () => void;
  clearNotifications:   () => void;

  jobs:           Job[];
  addJob:         (jobData: Omit<Job, 'id' | 'postedDate'>) => void;
  updateJob:      (job: Job) => void;
  deleteJob:      (id: string) => void;

  hiringActive:   Record<string, boolean>;
  setHiringActive:(businessId: string, active: boolean) => Promise<void>;
  ensureBusinessListing: () => Promise<Business | null>;
}

// ── Context & Provider ─────────────────────────────────────────────────────

const DirectoryContext = createContext<DirectoryContextType | undefined>(undefined);

export const DirectoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  // ── Persisted preferences ────────────────────────────────────────────────
  const [language, setLanguageState] = useState<'en' | 'ar' | 'fa'>(() =>
    (localStorage.getItem('shia_dir_lang') as 'en' | 'ar' | 'fa') || 'en'
  );
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(() =>
    (localStorage.getItem('shia_dir_theme') as 'light' | 'dark' | 'system') || 'system'
  );

  // ── Auth ─────────────────────────────────────────────────────────────────
  const [apiToken, setApiToken] = useState<string | null>(() =>
    isSupabaseConfigured ? null : localStorage.getItem('shia_dir_token')
  );
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    if (isSupabaseConfigured) return null;
    try {
      const saved = localStorage.getItem('shia_dir_user');
      if (saved) return JSON.parse(saved);
    } catch { localStorage.removeItem('shia_dir_user'); }
    return null;
  });

  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  // ── Directory data (starts with mock; overwritten by API on mount) ────────
  const [categories, setCategories] = useState<Category[]>(() => {
    try { const s = localStorage.getItem('shia_dir_categories'); if (s) return JSON.parse(s); } catch { /**/ }
    return INITIAL_CATEGORIES;
  });

  const [businesses, setBusinesses] = useState<Business[]>(INITIAL_BUSINESSES);

  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try { const s = localStorage.getItem('shia_dir_favorites'); if (s) return JSON.parse(s); } catch { /**/ }
    return [];
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    try { const s = localStorage.getItem('shia_dir_payments'); if (s) return JSON.parse(s); } catch { /**/ }
    return INITIAL_PAYMENTS;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try { const s = localStorage.getItem('shia_dir_products'); if (s) return JSON.parse(s); } catch { /**/ }
    return INITIAL_PRODUCTS;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try { const s = localStorage.getItem('shia_dir_orders'); if (s) return JSON.parse(s); } catch { /**/ }
    return INITIAL_ORDERS;
  });

  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);

  const [hiringActive, setHiringActiveState] = useState<Record<string, boolean>>(INITIAL_HIRING_ACTIVE);

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const s = localStorage.getItem('shia_dir_notifications');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /**/ }
    return INITIAL_DEMO_NOTIFICATIONS;
  });

  // ── localStorage sync ────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('shia_dir_user', currentUser ? JSON.stringify(currentUser) : ''); }, [currentUser]);
  useEffect(() => { localStorage.setItem('shia_dir_token', apiToken || ''); }, [apiToken]);
  useEffect(() => { localStorage.setItem('shia_dir_lang',     language); }, [language]);
  useEffect(() => { localStorage.setItem('shia_dir_theme',    theme); }, [theme]);
  useEffect(() => { localStorage.setItem('shia_dir_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('shia_dir_businesses', JSON.stringify(businesses)); }, [businesses]);
  useEffect(() => { localStorage.setItem('shia_dir_reviews',  JSON.stringify(reviews)); }, [reviews]);
  useEffect(() => { localStorage.setItem('shia_dir_favorites',JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('shia_dir_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('shia_dir_notifications', JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem('shia_dir_jobs',     JSON.stringify(jobs)); }, [jobs]);
  useEffect(() => { localStorage.setItem('shia_dir_hiring_active', JSON.stringify(hiringActive)); }, [hiringActive]);

  // ── Theme effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      root.classList.add(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
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

  const refreshDirectory = async (actingUser?: UserProfile | null): Promise<void> => {
    try {
      const role = actingUser?.role ?? currentUser?.role;
      const token = apiToken ?? (typeof window !== 'undefined' ? localStorage.getItem('shia_dir_token') : null);
      const isAdminUser = role === 'admin';
      const shouldFetchMine = Boolean(apiToken && role);
      const dirPath = isAdminUser && token ? '/api/directory/all' : '/api/directory';
      const authHeaders: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const [dirRes, jobsRes, mineRes] = await Promise.all([
        apiFetch(dirPath, { headers: authHeaders }),
        apiFetch('/api/jobsboard'),
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

      if (jobsRes.ok) {
        const jobsData: Record<string, unknown>[] = await jobsRes.json();
        setJobs(Array.isArray(jobsData) ? jobsData.map(mapApiJob) : []);
      } else {
        setJobs([]);
      }
    } catch {
      setBusinesses([]);
      setJobs([]);
      setHiringActiveState({});
      console.warn('[ABN Directory] Backend not reachable — showing empty directory.');
    }
  };

  const clearAuthState = useCallback(() => {
    setCurrentUser(null);
    setApiToken(null);
    localStorage.removeItem('shia_dir_token');
    localStorage.removeItem('shia_dir_user');
  }, []);

  const applySupabaseSession = useCallback((session: Session | null): UserProfile | null => {
    if (!session) {
      clearAuthState();
      return null;
    }
    const profile = profileFromSupabaseSession(session);
    setCurrentUser(profile);
    setApiToken(session.access_token);
    localStorage.setItem('shia_dir_token', session.access_token);
    return profile;
  }, [clearAuthState]);

  // ── Supabase session listener — auth gateway source of truth ───────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthReady(true);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      applySupabaseSession(session);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySupabaseSession(session);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySupabaseSession]);

  const isAuthenticated = isSupabaseConfigured
    ? Boolean(currentUser && apiToken)
    : Boolean(currentUser);

  // Refresh directory when authenticated session is established
  const authHydratedRef = useRef(false);
  useEffect(() => {
    if (!authReady || !isAuthenticated || !currentUser) return;
    if (authHydratedRef.current) return;
    authHydratedRef.current = true;
    refreshDirectory(currentUser);
  }, [authReady, isAuthenticated, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isAuthenticated) authHydratedRef.current = false;
  }, [isAuthenticated]);

  useEffect(() => {
    if (apiToken) {
      syncMyDirectoryProfile(apiToken, currentUser?.email, currentUser?.role);
    }
  }, [apiToken, currentUser?.email, currentUser?.role, syncMyDirectoryProfile]);

  // ── Subscription expiry check ─────────────────────────────────────────────
  const expiryCheckDone = useRef(false);
  useEffect(() => {
    if (expiryCheckDone.current) return;
    expiryCheckDone.current = true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAhead = new Date(today);
    sevenDaysAhead.setDate(today.getDate() + 7);

    setBusinesses((prev) => prev.map((biz) => {
      if (!biz.membershipExpiryDate) return biz;
      const expiry = new Date(biz.membershipExpiryDate);
      expiry.setHours(0, 0, 0, 0);

      if (expiry < today && biz.status === 'active') {
        setNotifications((pn) => [{
          id: `notif-exp-${biz.id}-${Date.now()}`,
          title: 'Subscription Expired',
          message: `${biz.name} membership has expired and has been suspended.`,
          date: today.toISOString().split('T')[0],
          isRead: false,
          receiverRole: 'business' as const,
        }, ...pn]);
        return { ...biz, status: 'suspended' as const };
      }
      if (expiry >= today && expiry <= sevenDaysAhead && biz.status === 'active') {
        setNotifications((pn) => {
          if (pn.some((n) => n.title === 'Subscription Expiring Soon' && n.message.includes(biz.name))) return pn;
          return [{
            id: `notif-warn-${biz.id}-${Date.now()}`,
            title: 'Subscription Expiring Soon',
            message: `${biz.name} expires on ${biz.membershipExpiryDate}. Please renew.`,
            date: today.toISOString().split('T')[0],
            isRead: false,
            receiverRole: 'business' as const,
          }, ...pn];
        });
      }
      return biz;
    }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth functions ────────────────────────────────────────────────────────

  /** Sign in — Supabase session when configured, otherwise Express JWT */
  const apiLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();

    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        return { success: false, error: error.message };
      }

      try {
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password }),
        });
        if (res.ok) {
          const data = await res.json();
          const backendUser = data.user as { role: string; name: string; phone: string; preferredLanguage?: string };
          setCurrentUser((prev) => prev ? {
            ...prev,
            role:              normaliseRole(backendUser.role),
            name:              backendUser.name || prev.name,
            phone:             backendUser.phone || prev.phone,
            preferredLanguage: (backendUser.preferredLanguage as 'en' | 'ar') || prev.preferredLanguage,
          } : prev);
        }
      } catch {
        // Supabase session remains valid for app access
      }

      addNotification('Login Successful', `Assalamu Alaykum. Welcome back!`, 'customer');
      return { success: true };
    }

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Login failed.' };

      const token: string = data.token;
      const user = data.user as { id: string; email: string; phone: string; name: string; role: string; preferredLanguage?: string };

      localStorage.setItem('shia_dir_token', token);
      setApiToken(token);

      const profile: UserProfile = {
        id:                user.id,
        email:             user.email,
        phone:             user.phone || '',
        name:              user.name,
        role:              normaliseRole(user.role),
        preferredLanguage: (user.preferredLanguage as 'en' | 'ar') || 'en',
      };
      setCurrentUser(profile);
      addNotification('Login Successful', `Assalamu Alaykum, ${user.name}. Welcome back!`, normaliseRole(user.role));

      await refreshDirectory(profile);
      await syncMyDirectoryProfile(token, user.email, profile.role);
      return { success: true };
    } catch {
      return { success: false, error: 'Cannot reach server. Make sure the backend is running.' };
    }
  };

  const registerAccount = async (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = payload.email.trim().toLowerCase();
    const trimmedName = payload.name.trim();
    const phone = payload.phone?.trim() ?? '';

    if (supabase) {
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: payload.password,
        options: {
          data: {
            name: trimmedName,
            phone,
            role: 'customer',
            preferredLanguage: language,
          },
        },
      });
      if (error) {
        return { success: false, error: error.message };
      }
    }

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone,
          role: 'customer',
          password: payload.password,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const exists = res.status === 409;
        if (!supabase || !exists) {
          return { success: false, error: data.error || 'Registration failed.' };
        }
      } else if (!supabase) {
        localStorage.setItem('shia_dir_token', data.token);
        setApiToken(data.token);
        const user = data.user as { id: string; email: string; phone: string; name: string; role: string };
        setCurrentUser({
          id: user.id,
          email: user.email,
          phone: user.phone || '',
          name: user.name,
          role: normaliseRole(user.role),
          preferredLanguage: language as 'en' | 'ar',
        });
        await refreshDirectory();
        return { success: true };
      }
    } catch {
      if (!supabase) {
        return { success: false, error: 'Cannot reach server. Make sure the backend is running.' };
      }
    }

    if (supabase) {
      const loginResult = await apiLogin(trimmedEmail, payload.password);
      return loginResult.success
        ? { success: true }
        : { success: false, error: loginResult.error || 'Account created. Please sign in.' };
    }

    return { success: true };
  };

  const signOut = async (): Promise<void> => {
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
          preferredLanguage: data.preferredLanguage ?? currentUser.preferredLanguage,
        });
        if (updates.preferredLanguage) {
          setLanguageState(updates.preferredLanguage);
        }
        return { success: true };
      } catch {
        // fall through to offline update
      }
    }

    setCurrentUser({ ...currentUser, ...updates });
    if (updates.preferredLanguage) {
      setLanguageState(updates.preferredLanguage);
    }
    return { success: true };
  };

  // ── Category helpers ──────────────────────────────────────────────────────
  const setLanguage  = (lang: 'en' | 'ar' | 'fa') => setLanguageState(lang);
  const setTheme     = (t: 'light' | 'dark' | 'system') => setThemeState(t);
  const addCategory  = (cat: Category) => setCategories((p) => [...p, cat]);
  const removeCategory = (id: string) => setCategories((p) => p.filter((c) => c.id !== id));

  // ── Business helpers ──────────────────────────────────────────────────────
  const addBusiness = (biz: Business) => {
    setBusinesses((p) => [...p, biz]);
    const kindLabel = biz.listingType === 'service' ? 'Service' : 'Business';
    addNotification(
      'New Submission — Vetting Required',
      `${biz.name} (${kindLabel}) is awaiting admin review.`,
      'admin',
    );
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
        // fall through to offline save
      }
    }

    const offlineReview: Review = {
      id: `rev-${Date.now()}`,
      businessId,
      userId: currentUser.id,
      userName: currentUser.name || currentUser.email.split('@')[0],
      rating,
      comment: comment.trim(),
      date: new Date().toISOString().split('T')[0],
    };
    addReview(offlineReview);
    return { success: true };
  };

  // ── Favorites ─────────────────────────────────────────────────────────────
  const toggleFavorite = (businessId: string) =>
    setFavorites((p) => p.includes(businessId) ? p.filter((id) => id !== businessId) : [...p, businessId]);

  // ── Payments ──────────────────────────────────────────────────────────────
  const addPayment = (payment: PaymentRecord) => {
    setPayments((p) => [payment, ...p]);
    setBusinesses((p) => p.map((biz) => {
      if (biz.id !== payment.businessId) return biz;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      return { ...biz, status: 'active', membershipExpiryDate: expiry.toISOString().split('T')[0] };
    }));
    const biz = businesses.find((b) => b.id === payment.businessId);
    if (biz) addNotification('Subscription Renewed ✓', `Membership for ${biz.name} renewed successfully.`, 'business');
  };

  // ── Products / Orders ─────────────────────────────────────────────────────
  const addProduct = (product: Product) => setProducts((p) => [product, ...p]);
  const updateOrderStatus = (id: string, status: Order['status']) =>
    setOrders((p) => p.map((o) => (o.id === id ? { ...o, status } : o)));

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const addJob = (jobData: Omit<Job, 'id' | 'postedDate'>) => {
    const newJob: Job = { ...jobData, id: `job-${Date.now()}`, postedDate: new Date().toISOString().split('T')[0] };
    setJobs((p) => [newJob, ...p]);
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

    const localBiz: Business = {
      id:                   `biz-${Date.now()}`,
      ownerId:              currentUser.email,
      name:                 payload.businessName,
      logoUrl:              '',
      coverUrl:             '',
      description:          { en: payload.description, ar: payload.description },
      categoryId:           'cat-maintenance',
      subcategory:          { en: payload.category, ar: payload.category },
      address:              '',
      city:                 'New York',
      area:                 '',
      isVerified:           false,
      status:               'active',
      phone:                payload.phone,
      whatsapp:             payload.whatsapp,
      workingHours:         { en: payload.workingHours, ar: payload.workingHours },
      membershipExpiryDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      gallery:              [],
      rating:               0,
      reviewsCount:         0,
    };
    addBusiness(localBiz);
    return localBiz;
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

  // ── Notifications ─────────────────────────────────────────────────────────
  const addNotification = (title: string, message: string, receiverRole: UserRole | 'all') => {
    setNotifications((p) => [{
      id: `notif-${Date.now()}`,
      title, message,
      date: new Date().toISOString().split('T')[0],
      isRead: false,
      receiverRole,
    }, ...p]);
  };
  const markNotificationsAsRead = () => setNotifications((p) => p.map((n) => ({ ...n, isRead: true })));
  const clearNotifications = () => setNotifications([]);

  // ── Provider ──────────────────────────────────────────────────────────────
  return (
    <DirectoryContext.Provider value={{
      authReady, isAuthenticated, currentUser, apiToken, apiLogin, registerAccount, signOut, updateUserProfile,
      language, setLanguage, theme, setTheme,
      categories, addCategory, removeCategory,
      businesses, addBusiness, updateBusiness, removeBusiness, refreshDirectory,
      reviews, addReview, fetchReviewsForBusiness, submitReview,
      favorites, toggleFavorite,
      payments, addPayment,
      products, addProduct,
      orders, updateOrderStatus,
      notifications, addNotification, markNotificationsAsRead, clearNotifications,
      jobs, addJob, updateJob, deleteJob,
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

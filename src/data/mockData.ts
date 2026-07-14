import { Category, Business, Review, PaymentRecord, Product, Order, Job, AppNotification } from '../types';

/** Live data placeholders — all content is loaded from the backend API. */
export const INITIAL_CATEGORIES: Category[] = [];

/** Clean slate — live data comes from /api/directory (in-memory backend). */
export const INITIAL_BUSINESSES: Business[] = [];

/** Clean slate — reviews loaded from /api/reviews. */
export const INITIAL_REVIEWS: Review[] = [];

export const INITIAL_PAYMENTS: PaymentRecord[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_ORDERS: Order[] = [];

/** Clean slate — live data comes from /api/jobsboard (in-memory backend). */
export const INITIAL_JOBS: Job[] = [];

export const INITIAL_HIRING_ACTIVE: Record<string, boolean> = {};

/** Clean slate — no fake notifications; real events are added at runtime. */
export const INITIAL_DEMO_NOTIFICATIONS: AppNotification[] = [];

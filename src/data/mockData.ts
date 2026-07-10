import { Category, Business, Review, PaymentRecord, Product, Order, Job, AppNotification } from '../types';

/** Static category taxonomy — not test data; safe to keep. */
export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-clothing', name: { en: 'Clothing', ar: 'الملابس' }, group: 'Shops', iconName: 'Shirt' },
  { id: 'cat-grocery', name: { en: 'Grocery', ar: 'البقالة' }, group: 'Shops', iconName: 'ShoppingBag' },
  { id: 'cat-education', name: { en: 'Education', ar: 'التعليم' }, group: 'Shops', iconName: 'BookOpen' },
  { id: 'cat-electronics', name: { en: 'Electronics', ar: 'الإلكترونيات' }, group: 'Shops', iconName: 'Tv' },
  { id: 'cat-jewelry', name: { en: 'Jewelry', ar: 'المجوهرات' }, group: 'Shops', iconName: 'Gem' },
  { id: 'cat-books', name: { en: 'Books', ar: 'الكتب' }, group: 'Shops', iconName: 'Book' },
  { id: 'cat-plumbing', name: { en: 'Plumbing', ar: 'السباكة' }, group: 'Services', iconName: 'Wrench' },
  { id: 'cat-electrical', name: { en: 'Electrical', ar: 'الكهرباء' }, group: 'Services', iconName: 'Zap' },
  { id: 'cat-carpentry', name: { en: 'Carpentry', ar: 'النجارة' }, group: 'Services', iconName: 'Hammer' },
  { id: 'cat-cleaning', name: { en: 'Cleaning', ar: 'خدمات التنظيف' }, group: 'Services', iconName: 'Sparkles' },
  { id: 'cat-maintenance', name: { en: 'Maintenance', ar: 'الصيانة العامة' }, group: 'Services', iconName: 'Settings' },
  { id: 'cat-doctor', name: { en: 'Doctors', ar: 'الأطباء' }, group: 'Professionals', iconName: 'UserCheck' },
  { id: 'cat-lawyer', name: { en: 'Lawyers', ar: 'المحاماة' }, group: 'Professionals', iconName: 'Scale' },
  { id: 'cat-engineer', name: { en: 'Engineers', ar: 'الهندسة' }, group: 'Professionals', iconName: 'HardHat' },
  { id: 'cat-accountant', name: { en: 'Accountants', ar: 'المحاسبة' }, group: 'Professionals', iconName: 'Calculator' },
  { id: 'cat-realestate', name: { en: 'Real Estate', ar: 'العقارات' }, group: 'Professionals', iconName: 'Building' },
  { id: 'cat-restaurant', name: { en: 'Restaurants', ar: 'المطاعم' }, group: 'Food', iconName: 'Utensils' },
  { id: 'cat-bakery', name: { en: 'Bakery', ar: 'المخبز' }, group: 'Food', iconName: 'Croissant' },
  { id: 'cat-catering', name: { en: 'Catering', ar: 'التجهيزات الغذائية' }, group: 'Food', iconName: 'Soup' },
];

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

/** Demo notification feed — UI-only; not tied to directory/job listings. */
const DEMO_NOTIF_TITLES = [
  'Welcome to ABN Directory',
  'Platform Update Available',
  'New Community Member Joined',
  'Directory Maintenance Complete',
  'Security Reminder',
  'Profile Tips',
  'Jobs Board Now Live',
  'Featured Category: Services',
  'Mobile App Update',
  'Community Spotlight',
  'Verification Queue Update',
  'Payment Gateway Online',
  'Weekly Digest Ready',
  'Support Hours Extended',
  'New FAQ Published',
  'Privacy Policy Updated',
  'Ramadan Business Hours Guide',
  'Local Events This Week',
  'Refer a Business',
  'Rate Your Experience',
  'Account Security Check',
  'Subscription Reminder',
  'Portal Feature Highlight',
  'Community Guidelines',
  'Feedback Request',
  'Thank You for Using ABN',
];

export const INITIAL_DEMO_NOTIFICATIONS: AppNotification[] = DEMO_NOTIF_TITLES.map((title, i) => ({
  id:          `notif-demo-${i + 1}`,
  title,
  message:     i === 0
    ? 'Welcome to the Ahle Bait Network (ABN) Business Directory. Explore verified listings near you.'
    : `Platform notification #${i + 1} — stay connected with your local Ahle Bait business community.`,
  date:        `2026-06-${String(Math.min(28, 19 + (i % 10))).padStart(2, '0')}`,
  isRead:      false,
  receiverRole: 'all' as const,
}));

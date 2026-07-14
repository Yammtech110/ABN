'use strict';

/** Default taxonomy seeded once when the categories table is empty. */
const DEFAULT_CATEGORIES = [
  { id: 'cat-clothing', nameEn: 'Clothing', nameAr: 'الملابس', group: 'Shops', iconName: 'Shirt' },
  { id: 'cat-grocery', nameEn: 'Grocery', nameAr: 'البقالة', group: 'Shops', iconName: 'ShoppingBag' },
  { id: 'cat-education', nameEn: 'Education', nameAr: 'التعليم', group: 'Shops', iconName: 'BookOpen' },
  { id: 'cat-electronics', nameEn: 'Electronics', nameAr: 'الإلكترونيات', group: 'Shops', iconName: 'Tv' },
  { id: 'cat-jewelry', nameEn: 'Jewelry', nameAr: 'المجوهرات', group: 'Shops', iconName: 'Gem' },
  { id: 'cat-books', nameEn: 'Books', nameAr: 'الكتب', group: 'Shops', iconName: 'Book' },
  { id: 'cat-plumbing', nameEn: 'Plumbing', nameAr: 'السباكة', group: 'Services', iconName: 'Wrench' },
  { id: 'cat-electrical', nameEn: 'Electrical', nameAr: 'الكهرباء', group: 'Services', iconName: 'Zap' },
  { id: 'cat-carpentry', nameEn: 'Carpentry', nameAr: 'النجارة', group: 'Services', iconName: 'Hammer' },
  { id: 'cat-cleaning', nameEn: 'Cleaning', nameAr: 'خدمات التنظيف', group: 'Services', iconName: 'Sparkles' },
  { id: 'cat-maintenance', nameEn: 'Maintenance', nameAr: 'الصيانة العامة', group: 'Services', iconName: 'Settings' },
  { id: 'cat-doctor', nameEn: 'Doctors', nameAr: 'الأطباء', group: 'Professionals', iconName: 'UserCheck' },
  { id: 'cat-lawyer', nameEn: 'Lawyers', nameAr: 'المحاماة', group: 'Professionals', iconName: 'Scale' },
  { id: 'cat-engineer', nameEn: 'Engineers', nameAr: 'الهندسة', group: 'Professionals', iconName: 'HardHat' },
  { id: 'cat-accountant', nameEn: 'Accountants', nameAr: 'المحاسبة', group: 'Professionals', iconName: 'Calculator' },
  { id: 'cat-realestate', nameEn: 'Real Estate', nameAr: 'العقارات', group: 'Professionals', iconName: 'Building' },
  { id: 'cat-restaurant', nameEn: 'Restaurants', nameAr: 'المطاعم', group: 'Food', iconName: 'Utensils' },
  { id: 'cat-bakery', nameEn: 'Bakery', nameAr: 'المخبز', group: 'Food', iconName: 'Croissant' },
  { id: 'cat-catering', nameEn: 'Catering', nameAr: 'التجهيزات الغذائية', group: 'Food', iconName: 'Soup' },
  { id: 'cat-other', nameEn: 'Other', nameAr: 'أخرى', group: 'Services', iconName: 'HelpCircle' },
];

/** Catch-all category; kept separate so existing DBs can be upserted without re-seeding. */
const OTHER_CATEGORY = DEFAULT_CATEGORIES.find((c) => c.id === 'cat-other');

module.exports = { DEFAULT_CATEGORIES, OTHER_CATEGORY };

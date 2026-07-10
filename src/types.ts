export type UserRole = 'customer' | 'business' | 'service_provider' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: UserRole;
  preferredLanguage: 'en' | 'ar';
}

export type CategoryGroup = 'Shops' | 'Services' | 'Professionals' | 'Food';

export interface Category {
  id: string;
  name: { en: string; ar: string };
  group: CategoryGroup;
  iconName: string; // Used to dynamically map Lucide icons
}

export type BusinessStatus = 'active' | 'suspended' | 'pending';
export type ListingType = 'business' | 'service';

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  logoUrl: string;
  coverUrl: string;
  description: { en: string; ar: string };
  categoryId: string;
  subcategory: { en: string; ar: string };
  listingType?: ListingType;
  address: string;
  city: 'New York' | 'Los Angeles' | 'Chicago' | 'Houston' | 'Miami' | 'Dearborn' | 'Dallas';
  area: string;
  isVerified: boolean;
  status: BusinessStatus;
  phone: string;
  whatsapp: string;
  website?: string;
  workingHours: { en: string; ar: string };
  membershipExpiryDate: string; // ISO date string
  subscriptionTier?: 30 | 50;
  gallery: string[];
  rating: number; // calculated from reviews or static
  reviewsCount: number;
}

export interface Review {
  id: string;
  businessId: string;
  userName: string;
  userId?: string;
  rating: number;
  comment: string;
  date: string;
}

export interface PaymentRecord {
  id: string;
  businessId: string;
  amount: number;
  date: string;
  status: 'success' | 'failed';
  refNo: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  isRead: boolean;
  receiverRole: UserRole | 'all';
}

export interface Product {
  id: string;
  businessId: string;
  name: { en: string; ar: string };
  description: { en: string; ar: string };
  price: number;
  imageUrl: string;
  inStock: boolean;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  priceAtPurchase: number;
}

export interface Order {
  id: string;
  businessId: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  date: string;
}

export type JobCategory = 'IT' | 'Graphic Designing' | 'Developer' | 'Chef' | 'Maid' | 'Others';

export interface Job {
  id: string;
  businessId: string;
  businessName: string;
  businessLogoUrl: string;
  title: string;
  category: JobCategory;
  requirements: string;
  salaryMin: number;
  salaryMax: number;
  hiringEmail: string;
  postedDate: string;
  isActive: boolean;
}

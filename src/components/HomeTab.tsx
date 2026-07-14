import React, { useState, useMemo, useEffect } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { apiFetch } from '../lib/api';
import { TRANSLATIONS } from '../data/translations';
import { Job, JobCategory } from '../types';
import { textEn } from '../utils/englishOnly';
import { isLiveDirectoryListing } from '../utils/listingAccess';
import { resolveListingCoverUrl, resolveListingLogoUrl } from '../utils/listingImages';
import { BusinessThumbnail } from './BusinessThumbnail';
import { NotificationCenterModal } from './NotificationCenterModal';
import { countUnreadNotifications, filterNotificationsForUser } from '../utils/notifications';
import {
  Search,
  MapPin,
  Bell,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Shirt,
  ShoppingBag,
  BookOpen,
  Tv,
  Gem,
  Book,
  Wrench,
  Zap,
  Hammer,
  UserCheck,
  Scale,
  HardHat,
  Utensils,
  Croissant,
  Soup,
  HelpCircle,
  Clock,
  Settings,
  Calculator,
  Building2,
  Sparkles as SparklesIcon
} from 'lucide-react';
import { Business, BusinessStatus, Category } from '../types';

const JOB_CATEGORY_COLORS: Record<JobCategory, string> = {
  'IT':               'bg-blue-900/40 text-blue-300 border-blue-700/40',
  'Graphic Designing':'bg-purple-900/40 text-purple-300 border-purple-700/40',
  'Developer':        'bg-green-900/40 text-green-300 border-green-700/40',
  'Chef':             'bg-amber-900/40 text-amber-300 border-amber-700/40',
  'Maid':             'bg-pink-900/40 text-pink-300 border-pink-700/40',
  'Others':           'bg-gray-800/60 text-gray-300 border-gray-600/40',
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Shirt,
  ShoppingBag,
  BookOpen,
  Tv,
  Gem,
  Book,
  Wrench,
  Zap,
  Hammer,
  UserCheck,
  Scale,
  HardHat,
  Utensils,
  Croissant,
  Soup,
  Settings,
  Calculator,
  Building: Building2,
  Sparkles: SparklesIcon,
  HelpCircle
};

interface HomeTabProps {
  onSelectBusiness: (biz: Business) => void;
  onSwitchTab: (tabId: string) => void;
  setSearchQueryText: (query: string) => void;
}

// ── Open Now helper ───────────────────────────────────────────
function isBusinessOpenNow(workingHours: string): boolean | null {
  try {
    // Parse format like "8:00 AM - 11:00 PM" or "9:00 AM - 9:00 PM (24/7 Available for emergency)"
    const cleaned = workingHours.replace(/\(.*?\)/g, '').trim();
    const parts = cleaned.split('-').map((s) => s.trim());
    if (parts.length < 2) return null;

    const parseTime = (str: string) => {
      const m = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!m) return null;
      let h = parseInt(m[1]);
      const min = parseInt(m[2]);
      const period = m[3].toUpperCase();
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + min;
    };

    const open = parseTime(parts[0]);
    const close = parseTime(parts[1]);
    if (open === null || close === null) return null;

    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();

    if (close < open) {
      // Crosses midnight
      return cur >= open || cur <= close;
    }
    return cur >= open && cur <= close;
  } catch {
    return null;
  }
}

export const HomeTab: React.FC<HomeTabProps> = ({
  onSelectBusiness,
  onSwitchTab,
  setSearchQueryText
}) => {
  const {
    language,
    businesses,
    categories,
    currentUser,
    notifications,
    notificationsLoading,
    notificationsError,
    refreshNotifications,
    markNotificationsAsRead,
    clearNotifications,
    jobs,
    hiringActive,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  useEffect(() => {
    if (currentUser) refreshNotifications();
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeNotifs = filterNotificationsForUser(notifications, currentUser);
  const unreadCount = countUnreadNotifications(notifications, currentUser);

  const [inputSearch, setInputSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  // Live API search results — null means "use local data"
  const [apiResults, setApiResults] = useState<Business[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const CITY_KEYS = [
    { key: 'all', label: t.allCities },
    { key: 'New York', label: t.newyork },
    { key: 'Los Angeles', label: t.losangeles },
    { key: 'Chicago', label: t.chicago },
    { key: 'Houston', label: t.houston },
    { key: 'Miami', label: t.miami },
  ];

  // ── Live API search: fires when search text or city changes ──────────────
  // Falls back to local filtering silently if backend is unreachable.
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const q      = inputSearch.trim();
    const city   = selectedCity !== 'all' ? selectedCity : '';
    const hasFilter = q.length > 0 || city.length > 0;

    if (!hasFilter) { setApiResults(null); return; }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams();
        if (q)    params.set('search', q);
        if (city) params.set('city',   city);
        const res  = await apiFetch(`/api/directory?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          // Map API response shape → Business type (same mapper used in context)
          const mapped: Business[] = data.map((p: Record<string, unknown>) => ({
            id:                   String(p.id ?? ''),
            ownerId:              String(p.email ?? ''),
            name:                 String(p.businessName ?? ''),
            logoUrl:              resolveListingLogoUrl(String(p.imageUrl ?? ''), String(p.coverUrl ?? ''), String(p.id ?? '')),
            coverUrl:             resolveListingCoverUrl(String(p.coverUrl ?? ''), String(p.imageUrl ?? ''), String(p.id ?? '')),
            description:          { en: String(p.description ?? ''), ar: '' },
            categoryId:           String(p.category ?? '').toLowerCase().replace(/ /g, '-'),
            subcategory:          { en: String(p.category ?? ''), ar: '' },
            address:              String(p.address ?? ''),
            city:                 String(p.city ?? 'New York') as Business['city'],
            area:                 String(p.area ?? ''),
            isVerified:           Boolean(p.isVerified),
            status:               (p.subscriptionStatus === 'suspended' ? 'suspended' : 'active') as BusinessStatus,
            phone:                String(p.phone ?? ''),
            whatsapp:             String(p.whatsapp ?? ''),
            website:              String(p.website ?? ''),
            workingHours:         { en: String(p.workingHours ?? ''), ar: '' },
            membershipExpiryDate: String(p.membershipExpiry ?? ''),
            gallery:              [],
            rating:               Number(p.rating ?? 0),
            reviewsCount:         Number(p.reviewsCount ?? 0),
          }));
          setApiResults(mapped);
        } else {
          setApiResults(null); // fallback to local
        }
      } catch {
        setApiResults(null); // backend offline — use local filter
      } finally {
        setIsSearching(false);
      }
    }, 350); // 350ms debounce

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [inputSearch, selectedCity]);

  // Unread notifications count — shown on bell when signed in

  // Use live API results when available; otherwise filter the local businesses array
  const activeBusinesses = useMemo(() => {
    const source = apiResults ?? businesses;
    if (apiResults) return source.filter((b) => isLiveDirectoryListing(b));
    const q = inputSearch.trim().toLowerCase();
    return source.filter((b) => {
      const matchCity = selectedCity === 'all' || b.city === selectedCity;
      const matchQ    = !q || b.name.toLowerCase().includes(q) ||
                        b.subcategory.en.toLowerCase().includes(q) ||
                        b.description.en.toLowerCase().includes(q);
      return isLiveDirectoryListing(b) && matchCity && matchQ;
    });
  }, [businesses, apiResults, inputSearch, selectedCity]);

  // Featured = active + verified, sorted best rating first
  const featuredBusinesses = useMemo(
    () => businesses
      .filter((b) => isLiveDirectoryListing(b))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3),
    [businesses]
  );

  // Active job openings from Supabase-backed jobs state
  const activeJobs = useMemo(
    () => jobs.filter((j) => j.isActive && hiringActive[j.businessId] === true),
    [jobs, hiringActive]
  );

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // If the API search already returned results, we stay on home and show them inline.
    // If there's no query, forward to the Search tab as before.
    if (!inputSearch.trim()) return;
    if (apiResults !== null) return; // already showing live results inline
    setSearchQueryText(inputSearch);
    onSwitchTab('search');
  };

  const handleCategoryClick = (catId: string) => {
    setSearchQueryText(catId);
    onSwitchTab('search');
  };

  const renderCategoryIcon = (iconName: string) => {
    const iconClass = 'w-5 h-5 text-[#FFA048]';
    const IconComponent = ICON_MAP[iconName] || HelpCircle;
    return <IconComponent className={iconClass} />;
  };

  // ── Inline job detail overlay ─────────────────────────────────
  if (selectedJob) {
    return (
      <div className="space-y-5" id="home-job-detail-overlay">
        <div className="flex items-center gap-3 pb-3 border-b border-[#2D2319]">
          <button
            onClick={() => setSelectedJob(null)}
            className="p-2 rounded-full bg-[#191613] hover:bg-[#2D251C] border border-[#2D2319] transition-colors"
            aria-label="Back to home"
          >
            <ArrowRight className="w-4 h-4 text-[#FFA048] rotate-180" />
          </button>
          <h2 className="text-sm font-extrabold text-[#F4E3D7] flex-1 truncate">
            {language === 'en' ? 'Job Details' : 'تفاصيل الوظيفة'}
          </h2>
        </div>
        <div className="p-5 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#0F0E0C] border border-[#2D2319] flex-shrink-0">
              <img
                src={selectedJob.businessLogoUrl}
                alt={selectedJob.businessName}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200&h=200'; }}
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-white leading-tight">{selectedJob.title}</h3>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">{selectedJob.businessName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${JOB_CATEGORY_COLORS[selectedJob.category]}`}>
              {selectedJob.category}
            </span>
            <span className="text-[10px] font-extrabold text-green-400 bg-green-900/20 border border-green-700/30 px-2.5 py-1 rounded-full">
              ${selectedJob.salaryMin.toLocaleString()} – ${selectedJob.salaryMax.toLocaleString()}/mo
            </span>
            <span className="text-[9px] text-gray-500 ml-auto">{language === 'en' ? 'Posted' : 'نُشر'} {selectedJob.postedDate}</span>
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold text-[#FFA048] uppercase tracking-wider mb-2">
              {language === 'en' ? 'Requirements & Skills' : 'المتطلبات والمهارات'}
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
              {selectedJob.requirements || (language === 'en' ? 'No specific requirements listed.' : 'لا توجد متطلبات محددة.')}
            </p>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319]">
            <CheckCircle className="w-3.5 h-3.5 text-[#FFA048] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-gray-500">{language === 'en' ? 'Send CV to' : 'أرسل السيرة إلى'}</p>
              <p className="text-xs text-white font-bold truncate">{selectedJob.hiringEmail}</p>
            </div>
          </div>
          <a
            href={`mailto:${selectedJob.hiringEmail}?subject=Job Application: ${encodeURIComponent(selectedJob.title)} at ${encodeURIComponent(selectedJob.businessName)}&body=Assalamu Alaykum,%0A%0AI wish to apply for the ${encodeURIComponent(selectedJob.title)} position.%0A%0APlease find my CV attached.%0A%0AThank you.`}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold rounded-2xl text-sm transition-all shadow-lg active:scale-95 no-underline"
          >
            📧 {language === 'en' ? 'Apply via Email (Submit CV)' : 'التقديم بالبريد الإلكتروني'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="home-tab-container">
      
      {/* Top Navigation Banner & Search */}
      <div className="space-y-4 animate-fade-in-up" id="home-top-section">
        {/* Header — premium orange wordmark */}
        <div className="pt-1 pb-0.5 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black text-[#FFA048] tracking-widest uppercase">ABN</h1>
          {currentUser && (
            <button
              type="button"
              onClick={() => {
                setShowNotificationsModal(true);
                void refreshNotifications();
                void markNotificationsAsRead();
              }}
              className="relative p-2 rounded-xl bg-[#13110E] border border-[#2D2319] hover:border-[#FFA048]/40 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-[#FFA048]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Search Bar (Relocated) */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center" id="home-search-form">
          <div className="relative w-full">
            {isSearching
              ? <span className="absolute left-3.5 top-3.5 w-4 h-4 border-2 border-[#FFA048] border-t-transparent rounded-full animate-spin" />
              : <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
            }
            <input
              type="text"
              value={inputSearch}
              onChange={(e) => { setInputSearch(e.target.value); if (!e.target.value.trim()) setApiResults(null); }}
              placeholder={t.searchPlaceholder}
              className="w-full pl-10 pr-24 py-3 bg-[#0F0E0C] border border-[#2E2419] rounded-2xl text-xs text-[#F4E3D7] placeholder-gray-500 outline-none focus:border-[#FFA048] transition-all"
              id="home-search-input"
            />
            {inputSearch && (
              <button type="button" onClick={() => { setInputSearch(''); setApiResults(null); }}
                className="absolute right-24 top-3 text-gray-500 hover:text-[#FFA048] text-xs px-1"
                aria-label="Clear search">✕</button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const query = selectedCity !== 'all' ? selectedCity : '';
              setInputSearch(query);
              setSearchQueryText(query);
              onSwitchTab('search');
            }}
            className="absolute right-2 px-2.5 py-1.5 rounded-xl bg-[#201B15] text-[#FFA048] font-bold text-[10px] border border-[#3A2F22] flex items-center gap-1 hover:bg-[#2D251C] transition-colors"
            id="home-location-badge-btn"
          >
            <MapPin className="w-3 h-3 text-[#FFA048]" />
            {CITY_KEYS.find(c => c.key === selectedCity)?.label || t.allCities}
          </button>
        </form>
      </div>

      {/* City Quick-Filter Pills */}
      <div className="space-y-2 animate-fade-in-up" style={{animationDelay:'0.08s'}} id="home-city-filter">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
          {CITY_KEYS.map(({ key, label }) => {
            const count = key === 'all'
              ? businesses.filter((b) => isLiveDirectoryListing(b)).length
              : businesses.filter((b) => isLiveDirectoryListing(b) && b.city === key).length;
            return (
              <button
                key={key}
                onClick={() => setSelectedCity(key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all snap-start ${
                  selectedCity === key
                    ? 'bg-[#FFA048] text-black border-[#FFA048] shadow-md'
                    : 'bg-[#13110E] text-gray-400 border-[#2D2319] hover:border-[#FFA048]/40 hover:text-white'
                }`}
                id={`city-pill-${key}`}
              >
                <MapPin className="w-3 h-3" />
                {label}
                <span className={`text-[9px] px-1 py-0.5 rounded-full font-black ${
                  selectedCity === key ? 'bg-black/20 text-black' : 'bg-[#201B15] text-[#FFA048]'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>


      <div className="space-y-3 animate-fade-in-up" style={{animationDelay:'0.10s'}} id="home-categories-block">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold tracking-medium text-[#F4E3D7] uppercase">
            {t.categories}
          </h3>
          <button
            onClick={() => onSwitchTab('search')}
            className="text-[10px] text-[#FFA048] font-extrabold flex items-center gap-1 hover:underline"
            id="btn-categories-seeall"
          >
            {t.seeAll} <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Scroll grid row — shows ALL 15 categories */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x stagger-children" id="home-categories-scroll">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className="flex-shrink-0 w-24 p-2.5 rounded-2xl bg-gradient-to-b from-[#191512] to-[#0F0E0C] border border-[#2D2319] flex flex-col items-center justify-center hover:border-[#FFA048]/60 hover:from-[#201B15] hover:to-[#13110E] transition-all text-center snap-start animate-scale-up card-hover shadow-lg"
              id={`cat-card-${cat.id}`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#201B15] border border-[#3A2E22] flex items-center justify-center mb-2 shadow-inner">
                {renderCategoryIcon(cat.iconName)}
              </div>
              <span className="text-[10px] font-black text-gray-300 tracking-tight block truncate w-full">
                {cat.name.en}
              </span>
            </button>
          ))}
        </div>
      </div>



      {/* Register Banner — any signed-in user without a listing yet */}
      {currentUser &&
        !businesses.some((b) => b.ownerId === currentUser?.id || b.ownerId === currentUser?.email) && (
        <div className="animate-fade-in-up" style={{animationDelay:'0.15s'}}>
          <button
            onClick={() => onSwitchTab('business')}
            className="w-full p-4 rounded-3xl bg-gradient-to-r from-[#FFA048] to-[#D87D2E] text-black shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-between"
            id="btn-register-banner"
          >
            <div className="text-left">
              <h2 className="text-lg font-black">{language === 'en' ? 'Register as a Business' : 'سجل كصاحب عمل'}</h2>
              <p className="text-xs font-semibold opacity-80">{language === 'en' ? 'Join the community directory today' : 'انضم لدليل المجتمع اليوم'}</p>
            </div>
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* ── Active Job Openings Row — always visible; empty state when no jobs ── */}
      <div className="space-y-3 animate-fade-in-up" style={{animationDelay:'0.18s'}} id="home-jobs-row">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-[#F4E3D7] uppercase tracking-medium">
            🔥 {language === 'en' ? 'Active Job Openings' : 'الوظائف المتاحة'}
          </h3>
          <button
            onClick={() => onSwitchTab('job-board')}
            className="text-[10px] text-[#FFA048] font-extrabold flex items-center gap-1 hover:underline"
            id="btn-see-all-jobs"
          >
            {language === 'en' ? 'See All Jobs' : 'كل الوظائف'} <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {activeJobs.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[#13110E] border border-[#2D2319] text-center">
            <p className="text-xs text-gray-500">
              {language === 'en'
                ? 'No active job openings yet. Business owners: Account → turn on Hiring Active → Manage Job Postings.'
                : 'لا توجد وظائف نشطة حالياً. يمكن لأصحاب الأعمال نشر الوظائف من الحساب.'}
            </p>
          </div>
        ) : (
          /* Horizontal scrollable job cards */
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x" id="home-jobs-scroll">
            {activeJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className="flex-shrink-0 w-52 p-3.5 rounded-2xl bg-[#13110E] border border-[#2D2319] hover:border-[#FFA048]/30 transition-all text-left space-y-2 snap-start group"
                id={`home-job-card-${job.id}`}
              >
                {/* Business logo + title */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl overflow-hidden bg-[#0F0E0C] border border-[#2D2319] flex-shrink-0">
                    <img
                      src={job.businessLogoUrl}
                      alt={job.businessName}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200&h=200'; }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] text-gray-500 truncate">{job.businessName}</p>
                  </div>
                </div>

                <h4 className="text-[11px] font-extrabold text-white group-hover:text-[#FFA048] transition-colors leading-tight line-clamp-2">
                  {job.title}
                </h4>

                <span className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded-full border ${JOB_CATEGORY_COLORS[job.category]}`}>
                  {job.category}
                </span>

                <div className="text-[9px] font-extrabold text-green-400">
                  ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}/mo
                </div>

                {job.requirements && (
                  <p className="text-[9px] text-gray-500 line-clamp-2 leading-snug">{job.requirements}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* All listings directory strip */}
      <div className="space-y-3 animate-fade-in-up" style={{animationDelay:'0.20s'}} id="home-listings-block">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-extrabold text-[#F4E3D7] uppercase tracking-medium">
              {apiResults !== null ? (language === 'en' ? 'Search Results' : 'نتائج البحث') : t.allBusinesses}
            </h3>
            {apiResults !== null && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#FFA048]/15 text-[#FFA048] border border-[#FFA048]/30 flex-shrink-0">
                {activeBusinesses.length} {language === 'en' ? 'found' : 'نتيجة'}
              </span>
            )}
          </div>
          {apiResults === null && (
            <button
              onClick={() => { setSearchQueryText(''); onSwitchTab('search'); }}
              className="text-[10px] text-[#FFA048] font-bold hover:underline flex-shrink-0"
              id="btn-allbusinesses-seeall"
            >
              {t.seeAll}
            </button>
          )}
        </div>

        {/* Regular businesses list stack */}
        <div className="space-y-3.5 stagger-children" id="home-all-listings-list">
          {activeBusinesses.map((biz) => {
            const isOpen = isBusinessOpenNow(biz.workingHours.en);
            return (
              <div
                key={biz.id}
                onClick={() => onSelectBusiness(biz)}
                className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#13110E] border border-[#2D2319] hover:border-[#FFA048]/30 transition-all cursor-pointer animate-fade-in-up card-hover"
                id={`list-item-${biz.id}`}
              >
                {/* Image avatar left side */}
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-900 border border-[#2D2319] flex-shrink-0">
                  <BusinessThumbnail business={biz} />
                </div>

                {/* Center description */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-black text-white hover:text-[#FFA048] truncate transition-colors leading-snug">
                    {biz.name}
                  </h4>
                  <p className="text-[10px] text-gray-400 capitalize mt-0.5">
                    {textEn(biz.subcategory)}
                  </p>
                  <span className="text-[9px] text-gray-500 flex items-center gap-0.5 mt-1">
                    <MapPin className="w-3 h-3 text-[#FFA048]" />
                    {t[biz.city.replace(/\\s+/g, '').toLowerCase() as 'newyork' | 'losangeles' | 'chicago']} ({biz.area})
                  </span>
                </div>

                {/* Right side: Verification + Rating + Open/Closed */}
                <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                  {biz.isVerified && (
                    <CheckCircle className="w-3.5 h-3.5 text-green-400 fill-green-400/20" />
                  )}
                  <span className="text-[10px] font-black text-[#FFA048]">
                    ★ {biz.rating}
                  </span>
                  {isOpen !== null && (
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${isOpen ? 'badge-open' : 'badge-closed'}`}>
                      {isOpen ? 'Open' : 'Closed'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showNotificationsModal && (
        <NotificationCenterModal
          notifications={activeNotifs}
          loading={notificationsLoading}
          error={notificationsError}
          onClose={() => setShowNotificationsModal(false)}
          onRefresh={() => refreshNotifications()}
          onClearAll={async () => {
            if (!confirm('Clear all notifications from your inbox?')) return;
            await clearNotifications();
            await refreshNotifications();
          }}
        />
      )}

    </div>
  );
};

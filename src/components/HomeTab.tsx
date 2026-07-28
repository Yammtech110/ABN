import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { useBackHandler } from '../context/BackNavigationContext';
import { apiFetch } from '../lib/api';
import { TRANSLATIONS } from '../data/translations';
import { Job, JobCategory } from '../types';
import { textEn } from '../utils/englishOnly';
import { isLiveDirectoryListing } from '../utils/listingAccess';
import { resolveCategoryId } from '../utils/categoryMatch';
import { resolveListingCoverUrl, resolveListingLogoUrl } from '../utils/listingImages';
import { BusinessThumbnail } from './BusinessThumbnail';
import {
  Search,
  MapPin,
  RefreshCw,
  CheckCircle,
  ArrowRight,
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
  Settings,
  Calculator,
  Building2,
  Sparkles as SparklesIcon,
  Star,
  Heart,
  Briefcase,
  Users,
  Store,
  Handshake,
  Grid3X3,
  Globe,
} from 'lucide-react';
import { Business, BusinessStatus } from '../types';

const NAVY = '#0B2545';

/** Decorative network globe behind the home hero (matches mockup). */
const HeroGlobe: React.FC = () => (
  <svg
    className="pointer-events-none absolute -right-4 -top-1 w-[82%] max-w-[360px] h-auto opacity-[0.72]"
    viewBox="0 0 360 320"
    fill="none"
    aria-hidden="true"
    id="home-hero-globe"
  >
    <defs>
      <radialGradient id="globeFill" cx="48%" cy="42%" r="58%">
        <stop offset="0%" stopColor="#C5D9EC" stopOpacity="0.7" />
        <stop offset="55%" stopColor="#8FB0D0" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#0B2545" stopOpacity="0.06" />
      </radialGradient>
      <linearGradient id="globeStroke" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0B2545" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#3D6A92" stopOpacity="0.55" />
      </linearGradient>
    </defs>
    {/* Globe disc — navy-tinted */}
    <circle cx="210" cy="150" r="120" fill="url(#globeFill)" stroke="url(#globeStroke)" strokeWidth="1.6" />
    {/* Latitude */}
    <ellipse cx="210" cy="150" rx="120" ry="40" stroke="#0B2545" strokeWidth="1.1" opacity="0.28" />
    <ellipse cx="210" cy="150" rx="120" ry="74" stroke="#0B2545" strokeWidth="1" opacity="0.22" />
    <ellipse cx="210" cy="150" rx="120" ry="102" stroke="#0B2545" strokeWidth="1" opacity="0.16" />
    {/* Longitude */}
    <ellipse cx="210" cy="150" rx="44" ry="120" stroke="#0B2545" strokeWidth="1.1" opacity="0.28" />
    <ellipse cx="210" cy="150" rx="80" ry="120" stroke="#0B2545" strokeWidth="1" opacity="0.2" />
    <path d="M210 30 V270" stroke="#0B2545" strokeWidth="1.1" opacity="0.22" />
    {/* Network arcs */}
    <path d="M90 115 C140 65, 250 50, 315 105" stroke="#0B2545" strokeWidth="1.3" opacity="0.35" strokeDasharray="4 5" />
    <path d="M105 205 C165 245, 255 240, 325 170" stroke="#00A859" strokeWidth="1.3" opacity="0.45" strokeDasharray="3 5" />
    <path d="M125 88 C180 128, 245 122, 295 80" stroke="#0B2545" strokeWidth="1.1" opacity="0.3" />
    {/* Pins */}
    <circle cx="128" cy="92" r="5" fill="#00A859" />
    <circle cx="128" cy="92" r="9" stroke="#00A859" strokeWidth="1.4" opacity="0.4" />
    <circle cx="252" cy="68" r="4.5" fill="#00A859" />
    <circle cx="252" cy="68" r="8.5" stroke="#00A859" strokeWidth="1.3" opacity="0.35" />
    <circle cx="292" cy="138" r="5" fill="#0B2545" />
    <circle cx="292" cy="138" r="9" stroke="#0B2545" strokeWidth="1.3" opacity="0.3" />
    <circle cx="178" cy="198" r="4" fill="#00A859" opacity="0.9" />
    <circle cx="318" cy="182" r="4" fill="#0B2545" opacity="0.7" />
    {/* City skyline — navy */}
    <path
      d="M150 272 h20 v-26 h11 v16 h13 v-34 h15 v34 h9 v-20 h17 v20 h11 v-14 h15 v30 h24"
      stroke="#0B2545"
      strokeWidth="1.8"
      fill="none"
      opacity="0.28"
    />
  </svg>
);

const JOB_CATEGORY_COLORS: Record<JobCategory, string> = {
  'IT':               'bg-blue-100 text-blue-700 border-blue-200',
  'Graphic Designing':'bg-purple-100 text-purple-700 border-purple-200',
  'Developer':        'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Chef':             'bg-amber-100 text-amber-700 border-amber-200',
  'Maid':             'bg-pink-100 text-pink-700 border-pink-200',
  'Others':           'bg-slate-100 text-slate-600 border-slate-200',
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

function isBusinessOpenNow(workingHours: string): boolean | null {
  try {
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

    if (close < open) return cur >= open || cur <= close;
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
    refreshDirectory,
    refreshJobs,
    refreshNotifications,
    jobs,
    hiringActive,
    favorites,
    toggleFavorite,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  useEffect(() => {
    if (currentUser) refreshNotifications();
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshApp = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshDirectory(currentUser),
        refreshJobs(),
        currentUser ? refreshNotifications() : Promise.resolve(),
      ]);
    } catch (err) {
      console.warn('[ABN Home] Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshDirectory, refreshJobs, refreshNotifications, currentUser]);

  const [inputSearch, setInputSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [apiResults, setApiResults] = useState<Business[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const liveListings = useMemo(
    () => businesses.filter(isLiveDirectoryListing),
    [businesses],
  );

  const CITY_KEYS = useMemo(() => {
    const fromListings = liveListings.map((b) => b.city).filter(Boolean);
    const popular = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Dearborn', 'Dallas'];
    const cities = Array.from(new Set([...popular, ...fromListings])).sort((a, b) => a.localeCompare(b));
    return [
      { key: 'all', label: t.allCities },
      ...cities.map((city) => ({
        key: city,
        label: (t[city.replace(/\s+/g, '').toLowerCase() as keyof typeof t] as string) || city,
      })),
    ];
  }, [liveListings, t]);

  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const q = inputSearch.trim();
    const city = selectedCity !== 'all' ? selectedCity : '';
    const hasFilter = q.length > 0 || city.length > 0;

    if (!hasFilter) { setApiResults(null); return; }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set('search', q);
        if (city) params.set('city', city);
        const res = await apiFetch(`/api/directory?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const mapped: Business[] = data.map((p: Record<string, unknown>) => ({
            id:                   String(p.id ?? ''),
            ownerId:              String(p.email ?? ''),
            name:                 String(p.businessName ?? ''),
            logoUrl:              resolveListingLogoUrl(String(p.imageUrl ?? ''), String(p.coverUrl ?? ''), String(p.id ?? ''), String(p.businessName ?? '')),
            coverUrl:             resolveListingCoverUrl(String(p.coverUrl ?? ''), String(p.imageUrl ?? ''), String(p.id ?? ''), String(p.businessName ?? '')),
            description:          { en: String(p.description ?? ''), ar: '' },
            categoryId:           resolveCategoryId(String(p.category ?? ''), categories),
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
          setApiResults(null);
        }
      } catch {
        setApiResults(null);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [inputSearch, selectedCity, categories]);

  const activeBusinesses = useMemo(() => {
    const source = apiResults ?? businesses;
    if (apiResults) return source.filter((b) => isLiveDirectoryListing(b));
    const q = inputSearch.trim().toLowerCase();
    return source.filter((b) => {
      const matchCity = selectedCity === 'all' || b.city === selectedCity;
      const matchQ = !q || b.name.toLowerCase().includes(q) ||
                        b.subcategory.en.toLowerCase().includes(q) ||
                        b.description.en.toLowerCase().includes(q);
      return isLiveDirectoryListing(b) && matchCity && matchQ;
    });
  }, [businesses, apiResults, inputSearch, selectedCity]);

  const featuredBusinesses = useMemo(
    () => liveListings
      .slice()
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8),
    [liveListings]
  );

  const activeJobs = useMemo(
    () => jobs.filter((j) => j.isActive && hiringActive[j.businessId] === true),
    [jobs, hiringActive]
  );

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const cityCount = useMemo(
    () => new Set(liveListings.map((b) => b.city).filter(Boolean)).size,
    [liveListings],
  );

  const handleOverlayBack = useCallback((): boolean => {
    if (selectedJob) {
      setSelectedJob(null);
      return true;
    }
    return false;
  }, [selectedJob]);

  useBackHandler('home-tab-overlay', handleOverlayBack, Boolean(selectedJob));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSearch.trim()) return;
    if (apiResults !== null) return;
    setSearchQueryText(inputSearch);
    onSwitchTab('search');
  };

  const handleCategoryClick = (catId: string) => {
    setSearchQueryText(catId);
    onSwitchTab('search');
  };

  const renderCategoryIcon = (iconName: string, className = 'w-5 h-5 text-[#0B2545]') => {
    const IconComponent = ICON_MAP[iconName] || HelpCircle;
    return <IconComponent className={className} />;
  };

  const categoryGrid = useMemo(() => categories.slice(0, 7), [categories]);

  if (selectedJob) {
    return (
      <div className="space-y-5" id="home-job-detail-overlay">
        <div className="flex items-center gap-3 pb-3 border-b border-[#D7E0EA]">
          <button
            onClick={() => setSelectedJob(null)}
            className="p-2 rounded-full bg-white hover:bg-slate-50 border border-[#D7E0EA] transition-colors"
            aria-label="Back to home"
          >
            <ArrowRight className="w-4 h-4 text-[#00A859] rotate-180" />
          </button>
          <h2 className="text-sm font-extrabold text-[#0B2545] flex-1 truncate">Job Details</h2>
        </div>
        <div className="p-5 rounded-3xl bg-white border border-[#D7E0EA] shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border border-[#D7E0EA] flex-shrink-0">
              <BusinessThumbnail
                business={{ id: selectedJob.businessId, name: selectedJob.businessName, logoUrl: selectedJob.imageUrl || selectedJob.businessLogoUrl }}
                className="w-full h-full object-cover"
                eager
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-[#0B2545] leading-tight">{selectedJob.title}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">{selectedJob.businessName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${JOB_CATEGORY_COLORS[selectedJob.category]}`}>
              {selectedJob.category}
            </span>
            <span className="text-[10px] font-extrabold text-[#00A859] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              ${selectedJob.salaryMin.toLocaleString()} – ${selectedJob.salaryMax.toLocaleString()}/mo
            </span>
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold text-[#00A859] uppercase tracking-wider mb-2">
              Requirements & Skills
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
              {selectedJob.requirements || 'No specific requirements listed.'}
            </p>
          </div>
          <a
            href={`mailto:${selectedJob.hiringEmail}?subject=Job Application: ${encodeURIComponent(selectedJob.title)} at ${encodeURIComponent(selectedJob.businessName)}`}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#00A859] hover:bg-[#008C4A] text-white font-extrabold rounded-2xl text-sm transition-all shadow-lg active:scale-95 no-underline"
          >
            Apply via Email
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4" id="home-tab-container">

      {/* ── Hero (full-bleed) ────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6 animate-fade-in-up min-h-[300px]"
        id="home-hero"
        style={{
          background:
            'radial-gradient(90% 80% at 88% 18%, rgba(11,37,69,0.10) 0%, transparent 55%), linear-gradient(165deg, #D6E4F2 0%, #E8F0F7 38%, #EEF4F8 100%)',
        }}
      >
        <HeroGlobe />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 28%, rgba(11,37,69,0.1) 1.2px, transparent 1.8px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative flex items-center justify-end mb-4">
          <button
            type="button"
            onClick={() => void handleRefreshApp()}
            disabled={isRefreshing}
            className="p-2.5 rounded-full bg-white/80 border border-white shadow-sm text-[#0B2545] disabled:opacity-60"
            aria-label="Refresh"
            id="btn-home-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <p className="relative text-[11px] font-bold tracking-[0.18em] uppercase text-[#00A859] mb-1">
          Welcome to ABN
        </p>
        <h1 className="relative leading-[0.95] mb-2 max-w-[70%]">
          <span className="block text-[34px] sm:text-[40px] font-black tracking-tight text-[#0B2545]">AHLEBAIT</span>
          <span className="block text-[34px] sm:text-[40px] font-black tracking-tight text-[#00A859]">NETWORK</span>
        </h1>
        <p className="relative text-[13px] text-slate-600 font-medium mb-4 max-w-[240px]">
          Connecting Businesses. Empowering Our Community.
        </p>

        <div className="relative flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-[#0B2545]">
          <span className="inline-flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-[#00A859]" />
            {liveListings.length.toLocaleString()}+ Businesses
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#00A859]" />
            {Math.max(cityCount, 1)}+ Cities
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#00A859]" />
            Community Members
          </span>
        </div>
      </section>

      <div className="space-y-5 px-4 pt-4">
      {/* ── Search ───────────────────────────────────────────── */}
      <form
        onSubmit={handleSearchSubmit}
        className="relative animate-fade-in-up"
        style={{ animationDelay: '0.05s' }}
        id="home-search-form"
      >
        <div className="relative flex items-center bg-white rounded-full border border-[#D7E0EA] shadow-[0_8px_24px_rgba(11,37,69,0.08)] px-1.5 py-1.5">
          {isSearching
            ? <span className="absolute left-4 w-4 h-4 border-2 border-[#00A859] border-t-transparent rounded-full animate-spin" />
            : <Search className="absolute left-4 w-4 h-4 text-slate-400" />
          }
          <input
            type="text"
            value={inputSearch}
            onChange={(e) => { setInputSearch(e.target.value); if (!e.target.value.trim()) setApiResults(null); }}
            placeholder="Search businesses, services or professionals..."
            className="w-full pl-10 pr-[7.5rem] py-2.5 bg-transparent text-[13px] text-[#0B2545] placeholder:text-slate-400 outline-none"
            id="home-search-input"
          />
          <button
            type="button"
            onClick={() => {
              const query = selectedCity !== 'all' ? selectedCity : '';
              setInputSearch(query);
              setSearchQueryText(query);
              onSwitchTab('search');
            }}
            className="absolute right-1.5 px-3 py-2 rounded-full bg-[#00A859] text-white font-bold text-[11px] flex items-center gap-1 shadow-sm hover:bg-[#008C4A] transition-colors"
            id="home-location-badge-btn"
          >
            <MapPin className="w-3.5 h-3.5" />
            {CITY_KEYS.find((c) => c.key === selectedCity)?.label || t.allCities}
          </button>
        </div>
      </form>

      {/* ── City chips ───────────────────────────────────────── */}
      <div className="animate-fade-in-up" style={{ animationDelay: '0.08s' }} id="home-city-filter">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
          {CITY_KEYS.map(({ key, label }) => {
            const count = key === 'all'
              ? liveListings.length
              : liveListings.filter((b) => b.city === key).length;
            const active = selectedCity === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedCity(key)}
                className={`flex-shrink-0 flex items-center gap-1.5 pl-3 pr-2 py-2 rounded-full text-[11px] font-bold border transition-all snap-start ${
                  active
                    ? 'bg-[#0B2545] text-white border-[#0B2545] shadow-md'
                    : 'bg-white text-[#0B2545] border-[#D7E0EA] hover:border-[#00A859]/50'
                }`}
                id={`city-pill-${key}`}
              >
                {key === 'all'
                  ? <Globe className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#0B2545]'}`} />
                  : <MapPin className={`w-3 h-3 ${active ? 'text-[#00A859]' : 'text-[#0B2545]'}`} />}
                {label}
                <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                  active ? 'bg-[#00A859] text-white' : 'bg-[#0B2545]/10 text-[#0B2545]'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Browse by Category ───────────────────────────────── */}
      <section
        className="rounded-[24px] bg-white border border-[#D7E0EA] shadow-sm p-4 animate-fade-in-up"
        style={{ animationDelay: '0.1s' }}
        id="home-categories-block"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-extrabold text-[#0B2545]">Browse By Category</h3>
          <button
            onClick={() => onSwitchTab('search')}
            className="text-[12px] text-[#00A859] font-bold flex items-center gap-0.5 hover:underline"
            id="btn-categories-seeall"
          >
            See all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3" id="home-categories-scroll">
          {categoryGrid.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className="flex flex-col items-center gap-2 text-center"
              id={`cat-card-${cat.id}`}
            >
              <div className="w-14 h-14 rounded-full bg-[#E8EEF5] border border-[#C5D3E3] flex items-center justify-center shadow-sm">
                {renderCategoryIcon(cat.iconName, 'w-6 h-6 text-[#0B2545]')}
              </div>
              <span className="text-[10px] font-bold text-[#0B2545] leading-tight line-clamp-2 w-full">
                {cat.name.en}
              </span>
            </button>
          ))}
          <button
            onClick={() => onSwitchTab('search')}
            className="flex flex-col items-center gap-2 text-center"
            id="cat-card-more"
          >
            <div className="w-14 h-14 rounded-full bg-[#0B2545] border border-[#0B2545] flex items-center justify-center shadow-sm">
              <Grid3X3 className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-bold text-[#0B2545]">More</span>
          </button>
        </div>
      </section>

      {/* ── Looking to Hire? ─────────────────────────────────── */}
      <section
        className="rounded-[24px] bg-[#E8F7EF] border border-emerald-100 p-4 flex gap-3 items-center animate-fade-in-up"
        style={{ animationDelay: '0.12s' }}
        id="home-hire-card"
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-[16px] font-extrabold text-[#0B2545] mb-1">Looking to Hire?</h3>
          <p className="text-[12px] text-slate-600 leading-snug mb-3">
            Post a job and reach professionals across the Ahlebait community.
          </p>
          <button
            type="button"
            onClick={() => onSwitchTab(currentUser ? 'job-board' : 'account')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#00A859] text-white text-[12px] font-extrabold shadow-sm hover:bg-[#008C4A] transition-colors"
            id="btn-post-job-cta"
          >
            Post a Job <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="w-20 h-20 rounded-2xl bg-white/70 border border-emerald-100 flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-9 h-9 text-[#00A859]" />
        </div>
      </section>

      {/* ── Jobs banner ──────────────────────────────────────── */}
      <section
        className="rounded-[24px] p-4 flex items-center gap-3 animate-fade-in-up"
        style={{
          animationDelay: '0.14s',
          background: `linear-gradient(125deg, ${NAVY} 0%, #123B5D 48%, #0B2545 100%)`,
        }}
        id="home-jobs-banner"
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-extrabold text-white leading-snug mb-1">
            Find the right talent. <span className="text-[#00A859]">Grow your business.</span>
          </h3>
          <p className="text-[11px] text-white/70 mb-3">
            {activeJobs.length > 0
              ? `${activeJobs.length} active opening${activeJobs.length === 1 ? '' : 's'} right now.`
              : 'Browse community job openings and apply by email.'}
          </p>
          <button
            type="button"
            onClick={() => onSwitchTab('job-board')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white text-[#0B2545] text-[11px] font-extrabold hover:bg-emerald-50 transition-colors"
            id="btn-see-all-jobs"
          >
            See All Jobs <ArrowRight className="w-3.5 h-3.5 text-[#00A859]" />
          </button>
        </div>
        <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-7 h-7 text-white" />
        </div>
      </section>

      {activeJobs.length > 0 && (
        <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '0.15s' }} id="home-jobs-row">
          <h3 className="text-[15px] font-extrabold text-[#0B2545]">Active Job Openings</h3>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none snap-x" id="home-jobs-scroll">
            {activeJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className="flex-shrink-0 w-52 p-3.5 rounded-2xl bg-white border border-[#D7E0EA] shadow-sm hover:border-[#00A859]/40 transition-all text-left space-y-2 snap-start"
                id={`home-job-card-${job.id}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-100 border border-[#D7E0EA] flex-shrink-0">
                    <BusinessThumbnail
                      business={{ id: job.businessId, name: job.businessName, logoUrl: job.imageUrl || job.businessLogoUrl }}
                      className="w-full h-full object-cover"
                      eager
                    />
                  </div>
                  <p className="text-[9px] text-slate-500 truncate">{job.businessName}</p>
                </div>
                <h4 className="text-[12px] font-extrabold text-[#0B2545] leading-tight line-clamp-2">{job.title}</h4>
                <span className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded-full border ${JOB_CATEGORY_COLORS[job.category]}`}>
                  {job.category}
                </span>
                <div className="text-[10px] font-extrabold text-[#00A859]">
                  ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}/mo
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentUser &&
        !businesses.some((b) => b.ownerId === currentUser?.id || b.ownerId === currentUser?.email) && (
        <button
          onClick={() => onSwitchTab('business')}
          className="w-full p-4 rounded-[24px] bg-gradient-to-r from-[#00A859] to-[#008C4A] text-white shadow-lg hover:shadow-xl transition-all active:scale-[0.99] flex items-center justify-between animate-fade-in-up"
          id="btn-register-banner"
        >
          <div className="text-left">
            <h2 className="text-base font-black">Register as a Business</h2>
            <p className="text-xs font-semibold opacity-90">Join the community directory today</p>
          </div>
          <ArrowRight className="w-5 h-5" />
        </button>
      )}

      {/* ── Featured Businesses ──────────────────────────────── */}
      <section className="space-y-3 animate-fade-in-up" style={{ animationDelay: '0.16s' }} id="home-featured-block">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-extrabold text-[#0B2545]">Featured Businesses</h3>
          <button
            onClick={() => { setSearchQueryText(''); onSwitchTab('search'); }}
            className="text-[12px] text-[#00A859] font-bold flex items-center gap-0.5"
          >
            See all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none snap-x">
          {(apiResults !== null ? activeBusinesses : featuredBusinesses).slice(0, 8).map((biz) => {
            const isOpen = isBusinessOpenNow(biz.workingHours.en);
            const saved = favorites.includes(biz.id);
            return (
              <div
                key={biz.id}
                className="flex-shrink-0 w-[168px] rounded-[20px] bg-white border border-[#D7E0EA] shadow-sm overflow-hidden snap-start"
                id={`featured-card-${biz.id}`}
              >
                <div className="relative h-[110px] bg-[#0B2545]">
                  <button
                    type="button"
                    onClick={() => onSelectBusiness(biz)}
                    className="w-full h-full block relative"
                  >
                    <BusinessThumbnail business={biz} className="w-full h-full object-cover opacity-90" eager />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B2545]/55 to-transparent pointer-events-none" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleFavorite(biz.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-white/95 shadow-sm"
                    aria-label={saved ? 'Remove favorite' : 'Save'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${saved ? 'fill-red-500 text-red-500' : 'text-[#0B2545]'}`} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectBusiness(biz)}
                  className="w-full text-left p-3 space-y-1"
                >
                  <h4 className="text-[12px] font-extrabold text-[#0B2545] truncate">{biz.name}</h4>
                  <p className="text-[10px] text-slate-500 truncate capitalize">{textEn(biz.subcategory)}</p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-0.5 truncate">
                    <MapPin className="w-3 h-3 text-[#00A859] flex-shrink-0" />
                    {biz.city}
                  </p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
                      <Star className="w-3 h-3 fill-amber-400" /> {biz.rating || '—'}
                    </span>
                    {biz.reviewsCount > 0 && (
                      <span className="text-[9px] text-slate-400">({biz.reviewsCount})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {biz.isVerified && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#123B5D]">
                        <CheckCircle className="w-3 h-3 text-sky-500" /> Verified
                      </span>
                    )}
                    {isOpen !== null && (
                      <span className={`text-[9px] font-bold ${isOpen ? 'text-[#00A859]' : 'text-red-500'}`}>
                        {isOpen ? 'Open Now' : 'Closed'}
                      </span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {(apiResults !== null || inputSearch.trim() || selectedCity !== 'all') && (
        <section className="space-y-3 animate-fade-in-up" id="home-listings-block">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-extrabold text-[#0B2545]">
              {apiResults !== null ? 'Search Results' : t.allBusinesses}
            </h3>
            {apiResults !== null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#00A859] border border-emerald-200">
                {activeBusinesses.length} found
              </span>
            )}
          </div>
          <div className="space-y-3" id="home-all-listings-list">
            {activeBusinesses.map((biz) => {
              const isOpen = isBusinessOpenNow(biz.workingHours.en);
              return (
                <div
                  key={biz.id}
                  onClick={() => onSelectBusiness(biz)}
                  className="flex items-center gap-3.5 p-3 rounded-[20px] bg-white border border-[#D7E0EA] shadow-sm hover:border-[#00A859]/35 transition-all cursor-pointer"
                  id={`list-item-${biz.id}`}
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-[#D7E0EA] flex-shrink-0">
                    <BusinessThumbnail business={biz} eager />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-[#0B2545] truncate">{biz.name}</h4>
                    <p className="text-[10px] text-slate-500 capitalize mt-0.5">{textEn(biz.subcategory)}</p>
                    <span className="text-[9px] text-slate-500 flex items-center gap-0.5 mt-1">
                      <MapPin className="w-3 h-3 text-[#00A859]" />
                      {biz.city}{biz.area ? ` (${biz.area})` : ''}
                    </span>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                    {biz.isVerified && <CheckCircle className="w-3.5 h-3.5 text-sky-500" />}
                    <span className="text-[10px] font-black text-amber-500">★ {biz.rating}</span>
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
        </section>
      )}

      {/* ── Stronger Together ────────────────────────────────── */}
      <section
        className="rounded-[24px] bg-white border border-[#D7E0EA] shadow-sm p-5 animate-fade-in-up"
        style={{ animationDelay: '0.18s' }}
        id="home-community-block"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#0B2545] flex items-center justify-center">
            <Handshake className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-[15px] font-extrabold text-[#0B2545]">Stronger Together</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Store, title: 'Shop Local', body: 'Support community businesses near you.' },
            { icon: Briefcase, title: 'Create Jobs', body: 'Hire talent from within the network.' },
            { icon: Users, title: 'Build Community', body: 'Grow connections that last.' },
          ].map((item) => (
            <div key={item.title} className="text-center space-y-1.5">
              <div className="mx-auto w-10 h-10 rounded-full bg-[#E8EEF5] flex items-center justify-center">
                <item.icon className="w-4 h-4 text-[#0B2545]" />
              </div>
              <p className="text-[11px] font-extrabold text-[#0B2545]">{item.title}</p>
              <p className="text-[9px] text-slate-500 leading-snug">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
};

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
import { AbnLogo } from './AbnLogo';
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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Business, BusinessStatus } from '../types';

const NAVY = '#0A1B4A';

/** Network map graphic for navy hero (final mockup). */
const HeroNetworkMap: React.FC = () => (
  <svg
    className="pointer-events-none absolute inset-0 w-full h-full opacity-40"
    viewBox="0 0 390 280"
    fill="none"
    aria-hidden="true"
    id="home-hero-network"
    preserveAspectRatio="xMidYMid slice"
  >
    <defs>
      <radialGradient id="netGlow" cx="70%" cy="35%" r="50%">
        <stop offset="0%" stopColor="#1B5BFF" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#0A1B4A" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="390" height="280" fill="url(#netGlow)" />
    {/* Connection lines */}
    <path d="M40 80 L120 60 L200 95 L280 50 L350 90" stroke="#8EB6FF" strokeWidth="1" opacity="0.5" />
    <path d="M60 160 L140 130 L220 170 L300 120 L360 155" stroke="#8EB6FF" strokeWidth="1" opacity="0.35" strokeDasharray="4 6" />
    <path d="M90 220 L170 190 L250 230 L330 200" stroke="#5B8CFF" strokeWidth="1" opacity="0.4" />
    <path d="M120 60 L140 130 L170 190" stroke="#8EB6FF" strokeWidth="0.8" opacity="0.35" />
    <path d="M200 95 L220 170 L250 230" stroke="#8EB6FF" strokeWidth="0.8" opacity="0.3" />
    <path d="M280 50 L300 120 L330 200" stroke="#8EB6FF" strokeWidth="0.8" opacity="0.35" />
    {/* Nodes */}
    {[
      [40, 80], [120, 60], [200, 95], [280, 50], [350, 90],
      [60, 160], [140, 130], [220, 170], [300, 120], [360, 155],
      [90, 220], [170, 190], [250, 230], [330, 200], [180, 110],
    ].map(([x, y], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r="3.5" fill={i % 3 === 0 ? '#FFFFFF' : '#1B5BFF'} />
        <circle cx={x} cy={y} r="7" stroke="#8EB6FF" strokeWidth="1" opacity="0.35" />
      </g>
    ))}
  </svg>
);

const JOB_CATEGORY_COLORS: Record<JobCategory, string> = {
  'IT':               'bg-blue-100 text-blue-700 border-blue-200',
  'Graphic Designing':'bg-purple-100 text-purple-700 border-purple-200',
  'Developer':        'bg-blue-100 text-emerald-700 border-blue-200',
  'Chef':             'bg-amber-100 text-amber-700 border-amber-200',
  'Maid':             'bg-pink-100 text-pink-700 border-pink-200',
  'Others':           'bg-slate-100 text-slate-700 border-slate-300',
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
    const withListings = Array.from(
      new Set(liveListings.map((b) => b.city).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
    return [
      { key: 'all', label: t.allCities },
      ...withListings.map((city) => ({
        key: city,
        label: (t[city.replace(/\s+/g, '').toLowerCase() as keyof typeof t] as string) || city,
      })),
    ];
  }, [liveListings, t]);

  React.useEffect(() => {
    if (selectedCity === 'all') return;
    if (!CITY_KEYS.some((c) => c.key === selectedCity)) {
      setSelectedCity('all');
    }
  }, [CITY_KEYS, selectedCity]);

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

  const renderCategoryIcon = (iconName: string, className = 'w-5 h-5 text-[#1B5BFF]') => {
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
            <ArrowRight className="w-4 h-4 text-[#1B5BFF] rotate-180" />
          </button>
          <h2 className="text-sm font-extrabold text-[#0A1B4A] flex-1 truncate">Job Details</h2>
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
              <h3 className="text-sm font-extrabold text-[#0A1B4A] leading-tight">{selectedJob.title}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">{selectedJob.businessName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${JOB_CATEGORY_COLORS[selectedJob.category]}`}>
              {selectedJob.category}
            </span>
            <span className="text-[10px] font-extrabold text-[#1B5BFF] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
              ${selectedJob.salaryMin.toLocaleString()} – ${selectedJob.salaryMax.toLocaleString()}/mo
            </span>
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold text-[#1B5BFF] uppercase tracking-wider mb-2">
              Requirements & Skills
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
              {selectedJob.requirements || 'No specific requirements listed.'}
            </p>
          </div>
          <a
            href={`mailto:${selectedJob.hiringEmail}?subject=Job Application: ${encodeURIComponent(selectedJob.title)} at ${encodeURIComponent(selectedJob.businessName)}`}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#1B5BFF] hover:bg-[#0B3FCC] text-white font-extrabold rounded-2xl text-sm transition-all shadow-lg active:scale-95 no-underline"
          >
            Apply via Email
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6 bg-[#F4F7FB]" id="home-tab-container">

      {/* ── Hero (final mockup) ──────────────────────────────── */}
      <section
        className="relative overflow-hidden px-4 pt-[max(0.85rem,env(safe-area-inset-top))] pb-5"
        id="home-hero"
        style={{ background: 'linear-gradient(165deg, #061433 0%, #0A1B4A 42%, #123A7A 100%)' }}
      >
        <HeroNetworkMap />

        <div className="relative flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-[52px] h-[52px] rounded-full bg-transparent flex items-center justify-center flex-shrink-0 overflow-hidden">
              <AbnLogo size="sm" className="h-11 max-w-[44px] bg-transparent" />
            </div>
            <div className="min-w-0">
              <h1 className="leading-none flex items-baseline gap-0">
                <span className="text-[30px] font-black tracking-tight text-white">ABN</span>
              </h1>
              <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-white mt-0.5">
                Ahlebait Network
              </p>
              <p className="text-[8px] font-semibold tracking-[0.16em] uppercase text-[#8EB6FF] mt-0.5">
                Connect · Collaborate · Grow
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleRefreshApp()}
            disabled={isRefreshing}
            className="p-2.5 rounded-full border border-white/35 text-white hover:bg-white/10 disabled:opacity-60 flex-shrink-0"
            aria-label="Refresh"
            id="btn-home-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth={2} />
          </button>
        </div>

        <p className="relative text-[14px] text-white font-medium mb-5 max-w-[320px] leading-snug">
          Connecting Businesses. Building Community. Creating Opportunities.
        </p>

        <div className="relative flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold text-white/95">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#8EB6FF]" />
            {Math.max(liveListings.length, 1).toLocaleString()}+ Businesses
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#8EB6FF]" />
            {Math.max(cityCount, 1)}+ Cities
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#8EB6FF]" />
            12,000+ Members
          </span>
        </div>
      </section>

      <div className="space-y-5 px-4 pt-4 relative z-10 bg-[#F4F7FB]">

        {/* Search */}
        <form onSubmit={handleSearchSubmit} id="home-search-form">
          <div
            className="relative flex items-center bg-white rounded-2xl border border-[#D7E0EA] shadow-[0_14px_36px_rgba(10,27,74,0.14)] px-1.5 py-1.5"
            id="home-search-box"
          >
            {isSearching
              ? <span className="absolute left-3.5 w-4 h-4 border-2 border-[#1B5BFF] border-t-transparent rounded-full animate-spin" />
              : <Search className="absolute left-3.5 w-4 h-4 text-[#1B5BFF]" />
            }
            <input
              type="text"
              value={inputSearch}
              onChange={(e) => { setInputSearch(e.target.value); if (!e.target.value.trim()) setApiResults(null); }}
              placeholder="Search businesses, professionals or services..."
              className="w-full pl-10 pr-[7.8rem] py-3 bg-transparent text-[13px] text-[#0A1B4A] placeholder:text-slate-400 outline-none"
              id="home-search-input"
            />
            <button
              type="button"
              onClick={() => {
                const query = selectedCity !== 'all' ? selectedCity : '';
                setSearchQueryText(query);
                onSwitchTab('search');
              }}
              className="absolute right-1.5 px-2.5 py-2 rounded-xl bg-[#1B5BFF] text-white font-bold text-[11px] flex items-center gap-1"
              id="home-location-badge-btn"
            >
              <MapPin className="w-3 h-3" />
              <span className="max-w-[4.5rem] truncate">
                {CITY_KEYS.find((c) => c.key === selectedCity)?.label || t.allCities}
              </span>
              <ChevronDown className="w-3 h-3 opacity-90" />
            </button>
          </div>
        </form>

        {/* City chips — mockup style (no zero cities) */}
        <div id="home-city-filter">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
            {CITY_KEYS.map(({ key, label }) => {
              const active = selectedCity === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCity(key)}
                  data-active={active ? 'true' : 'false'}
                  className={`city-pill flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold border transition-all snap-start ${
                    active
                      ? 'city-pill-active bg-[#1B5BFF] text-white border-[#1B5BFF] shadow-md'
                      : 'bg-white text-[#1B5BFF] border-[#1B5BFF]/45'
                  }`}
                  id={`city-pill-${key}`}
                >
                  {key === 'all'
                    ? <Globe className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#1B5BFF]'}`} />
                    : <MapPin className={`w-3 h-3 ${active ? 'text-white' : 'text-[#1B5BFF]'}`} />}
                  <span className={active ? 'text-white' : 'text-[#1B5BFF]'}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Featured Businesses — mockup cards */}
        <section className="space-y-3" id="home-featured-block">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-extrabold text-[#0A1B4A]">Featured Businesses</h3>
            <button
              onClick={() => { setSearchQueryText(''); onSwitchTab('search'); }}
              className="text-[12px] text-[#1B5BFF] font-bold flex items-center gap-0.5"
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
                  className="flex-shrink-0 w-[210px] rounded-2xl bg-white border border-[#D7E0EA] shadow-sm p-3 snap-start relative"
                  id={`featured-card-${biz.id}`}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void toggleFavorite(biz.id); }}
                    className="absolute top-2.5 right-2.5 p-1.5 z-10"
                    aria-label={saved ? 'Remove favorite' : 'Save'}
                  >
                    <Heart className={`w-4 h-4 ${saved ? 'fill-red-500 text-red-500' : 'text-slate-300'}`} />
                  </button>
                  <button type="button" onClick={() => onSelectBusiness(biz)} className="w-full text-left space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-[#EEF3FF] border border-blue-100 overflow-hidden flex items-center justify-center">
                      <BusinessThumbnail business={biz} className="w-full h-full object-cover" eager />
                    </div>
                    <div className="flex items-center gap-1 min-w-0 pr-5">
                      <h4 className="text-[13px] font-extrabold text-[#0A1B4A] truncate">{biz.name}</h4>
                      {biz.isVerified && <CheckCircle className="w-3.5 h-3.5 text-[#1B5BFF] flex-shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 capitalize truncate">{textEn(biz.subcategory)}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-[#1B5BFF] flex-shrink-0" />
                      {biz.city}
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#0A1B4A]">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {biz.rating || '—'}
                        </span>
                        {biz.reviewsCount > 0 && (
                          <span className="text-[10px] text-slate-400">({biz.reviewsCount})</span>
                        )}
                        {isOpen !== null && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                            isOpen ? 'text-emerald-600 border-emerald-300 bg-emerald-50' : 'text-red-500 border-red-200 bg-red-50'
                          }`}>
                            {isOpen ? 'Open Now' : 'Closed'}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#1B5BFF] flex-shrink-0" />
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Register CTA — directly under Featured Businesses */}
        {currentUser &&
          !businesses.some((b) => b.ownerId === currentUser?.id || b.ownerId === currentUser?.email) && (
          <button
            onClick={() => onSwitchTab('business')}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#1B5BFF] to-[#0B3FCC] text-white shadow-lg flex items-center justify-between"
            id="btn-register-banner"
          >
            <div className="text-left">
              <h2 className="text-sm font-black text-white">Register as a Business / Service Provider</h2>
              <p className="text-[11px] font-semibold text-white/90">Join the community directory today</p>
            </div>
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
        )}

        {/* Browse Businesses */}
        <section id="home-categories-block">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-extrabold text-[#0A1B4A]">Browse Businesses</h3>
            <button
              onClick={() => onSwitchTab('search')}
              className="text-[12px] text-[#1B5BFF] font-bold flex items-center gap-0.5"
              id="btn-categories-seeall"
            >
              See all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-y-4 gap-x-2" id="home-categories-scroll">
            {categoryGrid.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className="flex flex-col items-center gap-1.5 text-center bg-transparent border-0 shadow-none p-0"
                id={`cat-card-${cat.id}`}
              >
                {renderCategoryIcon(cat.iconName, 'w-7 h-7 text-[#1B5BFF]')}
                <span className="text-[10px] font-semibold text-[#0A1B4A] leading-tight line-clamp-2 w-full">
                  {cat.name.en}
                </span>
              </button>
            ))}
            <button
              onClick={() => onSwitchTab('search')}
              className="flex flex-col items-center gap-1.5 text-center bg-transparent border-0 shadow-none p-0"
              id="cat-card-more"
            >
              <Grid3X3 className="w-7 h-7 text-[#1B5BFF]" strokeWidth={2} />
              <span className="text-[10px] font-semibold text-[#0A1B4A]">More</span>
            </button>
          </div>
        </section>

        {/* Looking to Hire */}
        <section
          className="rounded-2xl bg-white border border-[#D7E0EA] shadow-sm p-4 flex gap-3 items-center"
          id="home-hire-card"
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-extrabold text-[#0A1B4A] mb-1">Looking to Hire?</h3>
            <p className="text-[12px] text-slate-500 leading-snug mb-3">
              Post a job and reach professionals across the Ahlebait community.
            </p>
            <button
              type="button"
              onClick={() => onSwitchTab(currentUser ? 'job-board' : 'account')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1B5BFF] text-white text-[12px] font-extrabold"
              id="btn-post-job-cta"
            >
              Post a Job <ArrowRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <Briefcase className="w-9 h-9 text-[#1B5BFF] flex-shrink-0" />
        </section>

        {/* Find the Right Talent */}
        <section
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: `linear-gradient(125deg, ${NAVY} 0%, #123A7A 55%, #0A1B4A 100%)` }}
          id="home-jobs-banner"
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-extrabold text-white leading-snug mb-1">Find the Right Talent</h3>
            <p className="text-[11px] text-white/80 mb-3">
              Post jobs or discover new career opportunities.
            </p>
            <button
              type="button"
              onClick={() => onSwitchTab('job-board')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white bg-transparent text-white text-[11px] font-extrabold"
              id="btn-see-all-jobs"
            >
              Explore Jobs <ArrowRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <Search className="w-8 h-8 text-[#8EB6FF] flex-shrink-0" />
        </section>

        {activeJobs.length > 0 && (
          <div className="space-y-3" id="home-jobs-row">
            <h3 className="text-[16px] font-extrabold text-[#0A1B4A]">Active Job Openings</h3>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none snap-x" id="home-jobs-scroll">
              {activeJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="flex-shrink-0 w-52 p-3.5 rounded-2xl bg-white border border-[#D7E0EA] shadow-sm text-left space-y-2 snap-start"
                  id={`home-job-card-${job.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                      <BusinessThumbnail
                        business={{ id: job.businessId, name: job.businessName, logoUrl: job.imageUrl || job.businessLogoUrl }}
                        className="w-full h-full object-cover"
                        eager
                      />
                    </div>
                    <p className="text-[9px] font-semibold text-slate-600 truncate">{job.businessName}</p>
                  </div>
                  <h4 className="text-[12px] font-extrabold text-[#0A1B4A] leading-tight line-clamp-2">{job.title}</h4>
                  <div className="text-[10px] font-extrabold text-[#1B5BFF]">
                    ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}/mo
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stronger Together — network diagram */}
        <section
          className="rounded-2xl bg-white border border-[#D7E0EA] shadow-sm p-5"
          id="home-community-block"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-extrabold text-[#0A1B4A] mb-1">Stronger Together</h3>
              <p className="text-[11px] text-slate-500 leading-snug mb-3">
                One network connecting local businesses, professionals, and community organizations.
              </p>
              <button
                type="button"
                onClick={() => onSwitchTab('search')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#1B5BFF] text-[#1B5BFF] text-[11px] font-extrabold bg-transparent"
              >
                Learn More
              </button>
            </div>
            <div className="relative w-[132px] h-[132px] flex-shrink-0 bg-transparent" id="home-community-handshake">
              <svg viewBox="0 0 132 132" className="absolute inset-0 w-full h-full" aria-hidden>
                <circle cx="66" cy="66" r="54" fill="none" stroke="#D7E0EA" strokeWidth="1" strokeDasharray="3 4" />
                <line x1="66" y1="66" x2="66" y2="18" stroke="#B8C9E8" strokeWidth="1" />
                <line x1="66" y1="66" x2="110" y2="40" stroke="#B8C9E8" strokeWidth="1" />
                <line x1="66" y1="66" x2="110" y2="92" stroke="#B8C9E8" strokeWidth="1" />
                <line x1="66" y1="66" x2="66" y2="114" stroke="#B8C9E8" strokeWidth="1" />
                <line x1="66" y1="66" x2="22" y2="92" stroke="#B8C9E8" strokeWidth="1" />
                <line x1="66" y1="66" x2="22" y2="40" stroke="#B8C9E8" strokeWidth="1" />
              </svg>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#0A1B4A] flex items-center justify-center shadow-md">
                <Handshake className="w-5 h-5 text-white" />
              </div>
              {[
                { label: 'Networking', style: 'left-1/2 -translate-x-1/2 top-0' },
                { label: 'Professionals', style: 'right-0 top-[18%]' },
                { label: 'Hiring', style: 'right-0 bottom-[18%]' },
                { label: 'Local Biz', style: 'left-1/2 -translate-x-1/2 bottom-0' },
                { label: 'Community', style: 'left-0 bottom-[18%]' },
                { label: 'Orgs', style: 'left-0 top-[18%]' },
              ].map((n) => (
                <span
                  key={n.label}
                  className={`absolute ${n.style} text-[7px] font-bold text-[#1B5BFF] whitespace-nowrap`}
                >
                  {n.label}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

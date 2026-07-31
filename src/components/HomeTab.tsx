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
import { canPostJobs, getUserListing } from '../utils/listingAccess';
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
  Store,
  Handshake,
  Grid3X3,
  Globe,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Business, BusinessStatus } from '../types';

const NAVY = '#110E0B';
const HERO_ORANGE = '#F58220';

/** Orange/white handshake mark matching the hero mockup. */
const AbnHeroMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <img
    src="/abn-handshake-mark.png"
    alt=""
    className={`w-12 h-12 object-contain object-center ${className}`.trim()}
    draggable={false}
  />
);

/** Dotted map + network lines — right side of hero (mockup match). */
const HeroNetworkMap: React.FC = () => {
  const softDots: [number, number][] = [
    [210, 28], [222, 36], [234, 30], [246, 42], [258, 34], [270, 46], [282, 38], [294, 50],
    [306, 42], [318, 56], [330, 48], [342, 62], [354, 54], [366, 68],
    [216, 58], [228, 66], [240, 60], [252, 74], [264, 66], [276, 80], [288, 72], [300, 86],
    [312, 78], [324, 92], [336, 84], [348, 98], [360, 90],
    [222, 96], [234, 104], [246, 98], [258, 112], [270, 104], [282, 118], [294, 110],
    [306, 124], [318, 116], [330, 130], [342, 122], [354, 136],
    [228, 138], [240, 146], [252, 140], [264, 154], [276, 146], [288, 160], [300, 152],
    [312, 166], [324, 158], [336, 172], [348, 164],
    [234, 178], [246, 186], [258, 180], [270, 194], [282, 186], [294, 200], [306, 192],
    [318, 206], [330, 198],
  ];
  const nodes: [number, number][] = [
    [230, 48], [270, 36], [310, 55], [350, 45],
    [245, 90], [285, 78], [325, 100], [360, 120],
    [255, 140], [295, 130], [335, 155],
    [265, 185], [305, 175], [340, 200],
  ];
  return (
    <svg
      className="pointer-events-none absolute inset-0 w-full h-full"
      viewBox="0 0 390 320"
      fill="none"
      aria-hidden="true"
      id="home-hero-network"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="heroNetGlow" cx="78%" cy="40%" r="50%">
          <stop offset="0%" stopColor={HERO_ORANGE} stopOpacity="0.22" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="390" height="320" fill="url(#heroNetGlow)" />
      {softDots.map(([x, y], i) => (
        <circle key={`d-${i}`} cx={x} cy={y} r="1.35" fill={HERO_ORANGE} opacity={0.28 + (i % 5) * 0.07} />
      ))}
      <path d="M230 48 L270 36 L310 55 L350 45" stroke={HERO_ORANGE} strokeWidth="1.25" opacity="0.75" />
      <path d="M245 90 L285 78 L325 100 L360 120" stroke={HERO_ORANGE} strokeWidth="1.15" opacity="0.65" />
      <path d="M255 140 L295 130 L335 155" stroke="#FF9E47" strokeWidth="1.1" opacity="0.7" />
      <path d="M265 185 L305 175 L340 200" stroke={HERO_ORANGE} strokeWidth="1.1" opacity="0.6" />
      <path d="M270 36 L285 78 L295 130 L305 175" stroke="#FF9E47" strokeWidth="1" opacity="0.55" />
      <path d="M310 55 L325 100 L335 155 L340 200" stroke={HERO_ORANGE} strokeWidth="1" opacity="0.5" />
      <path d="M230 48 L245 90 L255 140 L265 185" stroke={HERO_ORANGE} strokeWidth="1" opacity="0.5" />
      {nodes.map(([x, y], i) => (
        <g key={`n-${i}`}>
          <circle cx={x} cy={y} r="7" fill={HERO_ORANGE} opacity="0.2" />
          <circle cx={x} cy={y} r="3.2" fill="#FF9E47" />
        </g>
      ))}
    </svg>
  );
};

const JOB_CATEGORY_COLORS: Record<JobCategory, string> = {
  'IT':               'bg-orange-900/40 text-orange-300 border-orange-700/40',
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

  const renderCategoryIcon = (iconName: string, className = 'w-5 h-5 text-[#F08C32]') => {
    const IconComponent = ICON_MAP[iconName] || HelpCircle;
    return <IconComponent className={className} />;
  };

  const categoryGrid = useMemo(() => categories.slice(0, 7), [categories]);

  if (selectedJob) {
    return (
      <div className="space-y-5" id="home-job-detail-overlay">
        <div className="flex items-center gap-3 pb-3 border-b border-[#2B231D]">
          <button
            onClick={() => setSelectedJob(null)}
            className="p-2 rounded-full bg-[#171310] hover:bg-[#1E1915] border border-[#2B231D] transition-colors"
            aria-label="Back to home"
          >
            <ArrowRight className="w-4 h-4 text-[#F08C32] rotate-180" />
          </button>
          <h2 className="text-sm font-extrabold text-[#FFFFFF] flex-1 truncate">Job Details</h2>
        </div>
        <div className="p-5 rounded-3xl bg-[#171310] border border-[#2B231D] shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#1E1915] border border-[#2B231D] flex-shrink-0">
              <BusinessThumbnail
                business={{ id: selectedJob.businessId, name: selectedJob.businessName, logoUrl: selectedJob.imageUrl || selectedJob.businessLogoUrl }}
                className="w-full h-full object-cover"
                eager
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-[#FFFFFF] leading-tight">{selectedJob.title}</h3>
              <p className="text-[10px] text-[#8E8E8E] mt-0.5 truncate">{selectedJob.businessName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${JOB_CATEGORY_COLORS[selectedJob.category]}`}>
              {selectedJob.category}
            </span>
            <span className="text-[10px] font-extrabold text-[#F08C32] bg-[#FF9E47]/15 border border-[#F08C32]/40 px-2.5 py-1 rounded-full">
              ${selectedJob.salaryMin.toLocaleString()} – ${selectedJob.salaryMax.toLocaleString()}/mo
            </span>
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold text-[#F08C32] uppercase tracking-wider mb-2">
              Requirements & Skills
            </h4>
            <p className="text-xs text-[#CFCFCF] leading-relaxed whitespace-pre-wrap">
              {selectedJob.requirements || 'No specific requirements listed.'}
            </p>
          </div>
          <a
            href={`mailto:${selectedJob.hiringEmail}?subject=Job Application: ${encodeURIComponent(selectedJob.title)} at ${encodeURIComponent(selectedJob.businessName)}`}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#FF9E47] hover:bg-[#D9771D] text-black font-extrabold rounded-2xl text-sm transition-all shadow-lg active:scale-95 no-underline"
          >
            Apply via Email
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6 bg-[#0D0906]" id="home-tab-container">

      {/* ── Hero: exact match to orange brand mockup ─────────── */}
      <section
        className="relative overflow-hidden px-4 pt-[max(0.85rem,env(safe-area-inset-top))] pb-4"
        id="home-hero"
        style={{ background: '#000000' }}
      >
        <HeroNetworkMap />

        <div className="relative z-10 flex items-start justify-between gap-2 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <AbnHeroMark className="flex-shrink-0 w-[52px]" />
            <div className="min-w-0 pt-0.5">
              <div
                className="text-[28px] font-black leading-none tracking-tight"
                style={{ color: HERO_ORANGE }}
              >
                ABN
              </div>
              <div className="text-[11px] font-bold text-white tracking-[0.12em] uppercase mt-1 leading-none">
                AHLEBAIT NETWORK
              </div>
              <div
                className="text-[8px] font-semibold tracking-[0.14em] uppercase mt-1.5 leading-none"
                style={{ color: HERO_ORANGE }}
              >
                CONNECT • COLLABORATE • GROW
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleRefreshApp()}
            disabled={isRefreshing}
            className="p-2 rounded-full border border-white/35 text-white/90 hover:bg-white/10 disabled:opacity-60 flex-shrink-0 mt-5"
            aria-label="Refresh"
            id="btn-home-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth={2} />
          </button>
        </div>

        <p className="relative z-10 text-[15px] text-white font-medium mb-6 max-w-[240px] leading-[1.45]">
          Connecting <span className="font-bold">Businesses</span>.<br />
          Building <span className="font-bold">Community</span>.<br />
          Creating <span className="font-bold">Opportunities</span>.
        </p>

        <div className="relative z-10 grid grid-cols-2 gap-0 mb-5 max-w-[280px]">
          <div className="flex items-center gap-2 px-1 border-r border-[#3A3A3A]">
            <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: HERO_ORANGE }} strokeWidth={1.75} />
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-white leading-none">6+</div>
              <div className="text-[10px] text-[#8E8E8E] mt-0.5">Businesses</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2">
            <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: HERO_ORANGE }} strokeWidth={1.75} />
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-white leading-none">5+</div>
              <div className="text-[10px] text-[#8E8E8E] mt-0.5">Cities</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} id="home-search-form" className="relative z-10">
          <div
            className="relative flex items-center bg-[#171310] rounded-2xl border border-[#F08C32] px-1.5 py-1.5 focus-within:border-[#FF9E47]"
            id="home-search-box"
          >
            {isSearching
              ? <span className="absolute left-3.5 w-4 h-4 border-2 border-[#F08C32] border-t-transparent rounded-full animate-spin" />
              : <Search className="absolute left-3.5 w-4 h-4 text-white" />
            }
            <input
              type="text"
              value={inputSearch}
              onChange={(e) => { setInputSearch(e.target.value); if (!e.target.value.trim()) setApiResults(null); }}
              placeholder="Search businesses, professionals or services..."
              className="w-full pl-10 pr-[7.8rem] py-3 bg-transparent text-[13px] text-white placeholder:text-[#8E8E8E] outline-none focus:outline-none focus-visible:outline-none"
              id="home-search-input"
            />
            <button
              type="button"
              onClick={() => {
                const query = selectedCity !== 'all' ? selectedCity : '';
                setSearchQueryText(query);
                onSwitchTab('search');
              }}
              className="absolute right-1.5 px-2.5 py-2 rounded-xl bg-[#FF9E47] text-black font-bold text-[11px] flex items-center gap-1 focus-visible:outline-none"
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
      </section>

      <div className="space-y-5 px-4 pt-4 relative z-10 bg-[#0D0906]">

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
                      ? 'city-pill-active bg-[#FF9E47] text-black border-[#F08C32] shadow-md'
                      : 'bg-[#171310] text-[#F08C32] border-[#F08C32]/45'
                  }`}
                  id={`city-pill-${key}`}
                >
                  {key === 'all'
                    ? <Globe className={`w-3.5 h-3.5 ${active ? 'text-black' : 'text-[#F08C32]'}`} />
                    : <MapPin className={`w-3 h-3 ${active ? 'text-black' : 'text-[#F08C32]'}`} />}
                  <span className={active ? 'text-black' : 'text-[#F08C32]'}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Featured Businesses — mockup cards */}
        <section className="space-y-3" id="home-featured-block">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-extrabold text-[#FFFFFF]">Featured Businesses</h3>
            <button
              onClick={() => { setSearchQueryText(''); onSwitchTab('search'); }}
              className="text-[12px] text-[#F08C32] font-bold flex items-center gap-0.5"
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
                  className="flex-shrink-0 w-[210px] rounded-2xl bg-[#171310] border border-[#2B231D] shadow-sm p-3 snap-start relative"
                  id={`featured-card-${biz.id}`}
                >
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const result = await toggleFavorite(biz.id);
                      if (!result.success && result.error) window.alert(result.error);
                    }}
                    className="absolute top-2.5 right-2.5 p-1.5 z-10"
                    aria-label={saved ? 'Remove favorite' : 'Save'}
                  >
                    <Heart className={`w-4 h-4 ${saved ? 'fill-red-500 text-red-500' : 'text-[#8E8E8E]'}`} />
                  </button>
                  <button type="button" onClick={() => onSelectBusiness(biz)} className="w-full text-left space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-[#1E1915] border border-orange-100 overflow-hidden flex items-center justify-center">
                      <BusinessThumbnail business={biz} className="w-full h-full object-cover" eager />
                    </div>
                    <div className="flex items-center gap-1 min-w-0 pr-5">
                      <h4 className="text-[13px] font-extrabold text-[#FFFFFF] truncate">{biz.name}</h4>
                      {biz.isVerified && <CheckCircle className="w-3.5 h-3.5 text-[#F08C32] flex-shrink-0" />}
                    </div>
                    <p className="text-[11px] text-[#8E8E8E] capitalize truncate">{textEn(biz.subcategory)}</p>
                    <p className="text-[11px] text-[#8E8E8E] flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-[#F08C32] flex-shrink-0" />
                      {biz.city}
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#FFFFFF]">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {biz.rating || '—'}
                        </span>
                        {biz.reviewsCount > 0 && (
                          <span className="text-[10px] text-[#8E8E8E]">({biz.reviewsCount})</span>
                        )}
                        {isOpen !== null && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                            isOpen ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' : 'text-red-500 border-red-500/40 bg-red-500/10'
                          }`}>
                            {isOpen ? 'Open Now' : 'Closed'}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#F08C32] flex-shrink-0" />
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
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#FF9E47] to-[#D9771D] text-black shadow-lg flex items-center justify-between"
            id="btn-register-banner"
          >
            <div className="text-left">
              <h2 className="text-sm font-black text-black">Register as a Business / Service Provider</h2>
              <p className="text-[11px] font-semibold text-black/80">Join the community directory today</p>
            </div>
            <ArrowRight className="w-5 h-5 text-black" />
          </button>
        )}

        {/* Browse Businesses */}
        <section id="home-categories-block">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-extrabold text-[#FFFFFF]">Browse Businesses</h3>
            <button
              onClick={() => onSwitchTab('search')}
              className="text-[12px] text-[#F08C32] font-bold flex items-center gap-0.5"
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
                {renderCategoryIcon(cat.iconName, 'w-7 h-7 text-[#F08C32]')}
                <span className="text-[10px] font-semibold text-[#FFFFFF] leading-tight line-clamp-2 w-full">
                  {cat.name.en}
                </span>
              </button>
            ))}
            <button
              onClick={() => onSwitchTab('search')}
              className="flex flex-col items-center gap-1.5 text-center bg-transparent border-0 shadow-none p-0"
              id="cat-card-more"
            >
              <Grid3X3 className="w-7 h-7 text-[#F08C32]" strokeWidth={2} />
              <span className="text-[10px] font-semibold text-[#FFFFFF]">More</span>
            </button>
          </div>
        </section>

        {/* Looking to Hire */}
        <section
          className="rounded-2xl bg-[#171310] border border-[#2B231D] shadow-sm p-4 flex gap-3 items-center"
          id="home-hire-card"
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-extrabold text-[#FFFFFF] mb-1">Looking to Hire?</h3>
            <p className="text-[12px] text-[#8E8E8E] leading-snug mb-3">
              Post a job and reach professionals across the Ahlebait community.
            </p>
            <button
              type="button"
              onClick={() => {
                const myListing = getUserListing(currentUser, businesses);
                if (canPostJobs(myListing)) {
                  try {
                    sessionStorage.setItem('abn-open-job-form', '1');
                  } catch {
                    /* ignore */
                  }
                  onSwitchTab('job-management');
                  return;
                }
                window.alert(
                  'FIRST REGISTER AS BUSSINESS/SERVICE PROVIDER THEN YOU POST A JOB',
                );
                if (!currentUser) {
                  onSwitchTab('account');
                } else {
                  onSwitchTab('business');
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF9E47] text-black text-[12px] font-extrabold"
              id="btn-post-job-cta"
            >
              Post a Job <ArrowRight className="w-3.5 h-3.5 text-black" />
            </button>
          </div>
          <Briefcase className="w-9 h-9 text-[#F08C32] flex-shrink-0" />
        </section>

        {/* Find the Right Talent */}
        <section
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: `linear-gradient(125deg, #171310 0%, #322820 55%, #F08C32 100%)` }}
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
          <Search className="w-8 h-8 text-[#FDBA74] flex-shrink-0" />
        </section>

        {activeJobs.length > 0 && (
          <div className="space-y-3" id="home-jobs-row">
            <h3 className="text-[16px] font-extrabold text-[#FFFFFF]">Active Job Openings</h3>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none snap-x" id="home-jobs-scroll">
              {activeJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="flex-shrink-0 w-52 p-3.5 rounded-2xl bg-[#171310] border border-[#2B231D] shadow-sm text-left space-y-2 snap-start"
                  id={`home-job-card-${job.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl overflow-hidden bg-[#1E1915] flex-shrink-0">
                      <BusinessThumbnail
                        business={{ id: job.businessId, name: job.businessName, logoUrl: job.imageUrl || job.businessLogoUrl }}
                        className="w-full h-full object-cover"
                        eager
                      />
                    </div>
                    <p className="text-[9px] font-semibold text-[#CFCFCF] truncate">{job.businessName}</p>
                  </div>
                  <h4 className="text-[12px] font-extrabold text-[#FFFFFF] leading-tight line-clamp-2">{job.title}</h4>
                  <div className="text-[10px] font-extrabold text-[#F08C32]">
                    ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}/mo
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stronger Together — network diagram */}
        <section
          className="rounded-2xl bg-[#171310] border border-[#2B231D] shadow-sm p-5"
          id="home-community-block"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-extrabold text-[#FFFFFF] mb-1">Stronger Together</h3>
              <p className="text-[11px] text-[#8E8E8E] leading-snug mb-3">
                One network connecting local businesses, professionals, and community organizations.
              </p>
              <button
                type="button"
                onClick={() => onSwitchTab('search')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#F08C32] text-[#F08C32] text-[11px] font-extrabold bg-transparent"
              >
                Learn More
              </button>
            </div>
            <div className="relative w-[132px] h-[132px] flex-shrink-0 bg-transparent" id="home-community-handshake">
              <svg viewBox="0 0 132 132" className="absolute inset-0 w-full h-full" aria-hidden>
                <circle cx="66" cy="66" r="54" fill="none" stroke="#2B231D" strokeWidth="1" strokeDasharray="3 4" />
                <line x1="66" y1="66" x2="66" y2="18" stroke="#3A3029" strokeWidth="1" />
                <line x1="66" y1="66" x2="110" y2="40" stroke="#3A3029" strokeWidth="1" />
                <line x1="66" y1="66" x2="110" y2="92" stroke="#3A3029" strokeWidth="1" />
                <line x1="66" y1="66" x2="66" y2="114" stroke="#3A3029" strokeWidth="1" />
                <line x1="66" y1="66" x2="22" y2="92" stroke="#3A3029" strokeWidth="1" />
                <line x1="66" y1="66" x2="22" y2="40" stroke="#3A3029" strokeWidth="1" />
              </svg>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#F08C32] flex items-center justify-center shadow-md">
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
                  className={`absolute ${n.style} text-[7px] font-bold text-[#F08C32] whitespace-nowrap`}
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

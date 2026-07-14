import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import { Search, MapPin, ArrowLeft, CheckCircle, Clock } from 'lucide-react';
import { Business } from '../types';
import { textEn } from '../utils/englishOnly';
import { isLiveDirectoryListing } from '../utils/listingAccess';
import { BusinessThumbnail } from './BusinessThumbnail';

interface SearchTabProps {
  initialQuery?: string;
  onClearQuery: () => void;
  onSelectBusiness: (biz: Business) => void;
  onSwitchTab: (tabId: string) => void;
}

const CITIES: ('All' | 'New York' | 'Los Angeles' | 'Chicago' | 'Houston' | 'Miami' | 'Dearborn' | 'Dallas')[] = [
  'All',
  'New York',
  'Los Angeles',
  'Chicago',
  'Houston',
  'Miami',
  'Dearborn',
  'Dallas'
];

// ── Open Now helper (shared logic) ───────────────────────────
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

// ── Skeleton Loader ───────────────────────────────────────────
const SearchSkeleton = () => (
  <div className="space-y-3.5">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#13110E] border border-[#2D2319]">
        <div className="w-14 h-14 rounded-xl skeleton flex-shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-3 skeleton rounded w-3/4"></div>
          <div className="h-2.5 skeleton rounded w-1/2"></div>
          <div className="h-2 skeleton rounded w-1/3"></div>
        </div>
      </div>
    ))}
  </div>
);

export const SearchTab: React.FC<SearchTabProps> = ({
  initialQuery = '',
  onClearQuery,
  onSelectBusiness,
  onSwitchTab
}) => {
  const { language, businesses, categories } = useDirectory();
  const t = TRANSLATIONS[language];

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCity, setSelectedCity] = useState<'All' | 'New York' | 'Los Angeles' | 'Chicago' | 'Houston' | 'Miami' | 'Dearborn' | 'Dallas'>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Debounce search input by 300ms
  useEffect(() => {
    if (searchQuery === debouncedQuery) return;
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Trigger search filters when input query is passed from Home category clicks
  useEffect(() => {
    if (initialQuery) {
      const catExists = categories.some((c) => c.id === initialQuery);
      if (catExists) {
        setSelectedCategory(initialQuery);
        setSearchQuery('');
        setDebouncedQuery('');
      } else if (['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Dearborn', 'Dallas', 'All'].includes(initialQuery)) {
        setSelectedCity(initialQuery as any);
        setSearchQuery('');
        setDebouncedQuery('');
      } else {
        setSearchQuery(initialQuery);
        setDebouncedQuery(initialQuery);
      }
      onClearQuery();
    }
  }, [initialQuery, categories, onClearQuery]);

  const handleClearAll = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setSelectedCity('All');
    setSelectedCategory('All');
  }, []);

  // Memoized filter logic — runs only when debounced query or filters change
  const filteredBusinesses = useMemo(() => {
    return businesses.filter((biz) => {
      if (!isLiveDirectoryListing(biz)) return false;

      const q = debouncedQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        biz.name.toLowerCase().includes(q) ||
        textEn(biz.subcategory).toLowerCase().includes(q) ||
        textEn(biz.description).toLowerCase().includes(q) ||
        biz.area.toLowerCase().includes(q) ||
        // Improvement #13: search by phone & WhatsApp number
        biz.phone.replace(/\s+/g, '').includes(q.replace(/\s+/g, '')) ||
        biz.whatsapp.replace(/\s+/g, '').includes(q.replace(/\s+/g, '')) ||
        biz.address.toLowerCase().includes(q);

      const matchCity = selectedCity === 'All' || biz.city === selectedCity;
      const matchCategory = selectedCategory === 'All' || biz.categoryId === selectedCategory;

      return matchQuery && matchCity && matchCategory;
    });
  }, [businesses, debouncedQuery, selectedCity, selectedCategory, language]);


  return (
    <div className="space-y-4" id="search-tab-container">
      
      {/* Top Header Card */}
      <div className="flex items-center gap-3 pb-2 animate-fade-in-up" id="search-header">
        <button
          onClick={() => onSwitchTab('home')}
          className="p-1 px-2 rounded-xl bg-[#191613] hover:bg-[#2A231C] text-[#FFA048] border border-[#2D2319] transition-colors"
          id="btn-search-back"
        >
          <ArrowLeft className="w-5 h-5 inline rounded" />
        </button>
        <h2 className="text-xl font-extrabold text-[#F4E3D7]" id="search-header-title">
          {language === 'en' ? 'Find a business' : 'ابحث عن نشاط تجاري'}
        </h2>
      </div>

      {/* Comprehensive Search Input Bar */}
      <div className="relative animate-fade-in-up" style={{animationDelay:'0.05s'}} id="search-input-wrapper">
        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={language === 'en' ? 'Plumber, restaurant, bookstore...' : 'سباك، مطعم، مكتبة كتب...'}
          className="w-full pl-10 pr-4 py-3 bg-[#13110E] border border-[#2D2319] rounded-2xl text-xs text-[#F4E3D7] placeholder-gray-500 outline-none focus:border-[#FFA048] transition-all"
          id="search-input-field"
        />
        {/* Searching indicator */}
        {isSearching && (
          <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-[#FFA048] border-t-transparent rounded-full animate-spin"></div>
        )}
      </div>

      {/* HORIZONTAL CITIES CHIPS */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x animate-fade-in-up" style={{animationDelay:'0.10s'}} id="search-cities-scroll">
        {CITIES.map((city) => {
          const isSelected = selectedCity === city;
          const label = city === 'All' ? t.allCities : (t[city.replace(/\s+/g, '').toLowerCase() as keyof typeof t] as string || city);
          return (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all snap-start border ${
                isSelected
                  ? 'bg-[#FFA048] text-black border-[#FFA048]'
                  : 'bg-[#191613]/55 text-gray-400 border-[#2D2319] hover:text-white hover:bg-white/5'
              }`}
              id={`city-chip-${city}`}
            >
              <MapPin className="w-3 h-3 inline mr-1" />
              {label}
            </button>
          );
        })}
      </div>

      {/* HORIZONTAL CATEGORIES FILTER ROW */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none animate-fade-in-up" style={{animationDelay:'0.15s'}} id="search-cats-scroll">
        <button
          onClick={() => setSelectedCategory('All')}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold uppercase border transition-all ${
            selectedCategory === 'All'
              ? 'bg-transparent text-[#FFA048] border-[#FFA048]/80'
              : 'bg-[#191613]/30 text-gray-500 border-[#2D2319]/50 hover:text-white'
          }`}
          id="cat-chip-all"
        >
          {language === 'en' ? 'All' : 'الكل'}
        </button>
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isSelected
                  ? 'bg-transparent text-[#FFA048] border-[#FFA048]'
                  : 'bg-[#191613]/30 text-gray-500 border-[#2D2319]/55 hover:text-white'
              }`}
              id={`cat-chip-${cat.id}`}
            >
              {cat.name.en}
            </button>
          );
        })}
      </div>

      {/* Result Counter & Reset filter option */}
      <div className="flex items-center justify-between text-xs py-1" id="search-counter-bar">
        <span className="font-mono text-gray-400 font-bold" id="result-counter-text">
          {isSearching ? '...' : filteredBusinesses.length} {t.resultsCount}
        </span>
        {(searchQuery || selectedCity !== 'All' || selectedCategory !== 'All') && (
          <button
            onClick={handleClearAll}
            className="text-[#FFA048]/85 hover:underline font-bold text-[11px]"
            id="search-btn-clear"
          >
            {language === 'en' ? 'Reset Filters' : 'إعادة ضبط التصفية'}
          </button>
        )}
      </div>

      {/* Search Result list layout */}
      {isSearching ? (
        <SearchSkeleton />
      ) : (
        <div className="space-y-3.5" id="search-result-list">
          {filteredBusinesses.length === 0 ? (
            <div className="text-center py-12 px-6 rounded-3xl bg-[#13110E] border border-dashed border-[#2D2319] animate-scale-up" id="search-empty-state">
              <span className="text-3xl block mb-2">🔍</span>
              <p className="text-xs text-gray-400 font-medium">{t.noResults}</p>
            </div>
          ) : (
            filteredBusinesses.map((biz) => {
              const isOpen = isBusinessOpenNow(biz.workingHours.en);
              return (
                <div
                  key={biz.id}
                  onClick={() => onSelectBusiness(biz)}
                  className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#13110E] border border-[#2D2319] hover:border-[#FFA048]/40 transition-all cursor-pointer animate-fade-in-up card-hover"
                  id={`search-item-${biz.id}`}
                >
                  {/* Image Left */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-900 border border-[#2D2319] flex-shrink-0">
                    <BusinessThumbnail business={biz} eager />
                  </div>

                  {/* Central Information */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-white hover:text-[#FFA048] truncate transition-colors leading-snug">
                      {biz.name}
                    </h4>
                    <p className="text-[10px] text-gray-400 font-medium capitalize mt-0.5">
                      {textEn(biz.subcategory)}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-500">
                      <MapPin className="w-3.5 h-3.5 text-[#FFA048]" />
                      <span>{(t[biz.city.replace(/\s+/g, '').toLowerCase() as keyof typeof t] as string) || biz.city}</span>
                      <span className="text-gray-700 font-normal">|</span>
                      <span>{biz.area}</span>
                    </div>
                  </div>

                  {/* Right indicators */}
                  <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                    {biz.isVerified && (
                      <span className="p-0.5 rounded-full bg-green-500/10 text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </span>
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
            })
          )}
        </div>
      )}

    </div>
  );
};

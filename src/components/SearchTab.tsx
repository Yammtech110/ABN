import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import { Search, MapPin, ArrowLeft, CheckCircle, Map, List, Star } from 'lucide-react';
import { Business } from '../types';
import { textEn } from '../utils/englishOnly';
import { isLiveDirectoryListing } from '../utils/listingAccess';
import { listingMatchesCategory } from '../utils/categoryMatch';
import { BusinessThumbnail } from './BusinessThumbnail';
import { US_STATES } from '../data/usStates';
import { allUsCities, citiesForState, stateCodeForCity } from '../data/usCitiesByState';
import { isBusinessOpenNow } from '../utils/openNow';
import {
  buildBusinessMapQuery,
  googleMapsEmbedUrl,
  openBusinessInMaps,
} from '../utils/maps';

interface SearchTabProps {
  initialQuery?: string;
  onClearQuery: () => void;
  onSelectBusiness: (biz: Business) => void;
  onSwitchTab: (tabId: string) => void;
}

const MIN_RATINGS = [
  { value: 0, label: 'Any rating' },
  { value: 1, label: '1★+' },
  { value: 2, label: '2★+' },
  { value: 3, label: '3★+' },
  { value: 4, label: '4★+' },
  { value: 5, label: '5★' },
];

type OpenFilter = 'all' | 'open' | 'closed';

const listingState = (biz: Business): string =>
  String(biz.state || stateCodeForCity(biz.city) || '').toUpperCase();

const SearchSkeleton = () => (
  <div className="space-y-3.5">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#171310] border border-[#2B231D]">
        <div className="w-14 h-14 rounded-xl skeleton flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 skeleton rounded w-3/4" />
          <div className="h-2.5 skeleton rounded w-1/2" />
          <div className="h-2 skeleton rounded w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

export const SearchTab: React.FC<SearchTabProps> = ({
  initialQuery = '',
  onClearQuery,
  onSelectBusiness,
  onSwitchTab,
}) => {
  const { language, businesses, categories } = useDirectory();
  const t = TRANSLATIONS[language];

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedState, setSelectedState] = useState<string>('All');
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [openFilter, setOpenFilter] = useState<OpenFilter>('all');
  const [minRating, setMinRating] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [mapFocusId, setMapFocusId] = useState<string | null>(null);

  const CITIES = useMemo(() => {
    const fromListings = businesses
      .filter(isLiveDirectoryListing)
      .filter((b) => selectedState === 'All' || listingState(b) === selectedState)
      .map((b) => b.city)
      .filter(Boolean);

    const baseCities =
      selectedState !== 'All'
        ? citiesForState(selectedState)
        : allUsCities();

    return [
      'All',
      ...Array.from(new Set([...baseCities, ...fromListings])).sort((a, b) =>
        a.localeCompare(b),
      ),
    ];
  }, [businesses, selectedState]);

  useEffect(() => {
    if (searchQuery === debouncedQuery) return;
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedQuery]);

  useEffect(() => {
    if (initialQuery) {
      const catById = categories.find((c) => c.id === initialQuery);
      const catByName = categories.find(
        (c) => c.name.en.toLowerCase() === initialQuery.toLowerCase(),
      );
      const matchedCat = catById || catByName;
      if (matchedCat) {
        setSelectedCategory(matchedCat.id);
        setSearchQuery('');
        setDebouncedQuery('');
      } else if (allUsCities().includes(initialQuery) || initialQuery === 'All') {
        setSelectedCity(initialQuery);
        setSearchQuery('');
        setDebouncedQuery('');
      } else {
        setSearchQuery(initialQuery);
        setDebouncedQuery(initialQuery);
      }
      onClearQuery();
    }
  }, [initialQuery, categories, onClearQuery]);

  useEffect(() => {
    if (selectedCity !== 'All' && !CITIES.includes(selectedCity)) {
      setSelectedCity('All');
    }
  }, [CITIES, selectedCity]);

  const handleClearAll = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setSelectedState('All');
    setSelectedCity('All');
    setSelectedCategory('All');
    setOpenFilter('all');
    setMinRating(0);
  }, []);

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
        biz.phone.replace(/\s+/g, '').includes(q.replace(/\s+/g, '')) ||
        biz.whatsapp.replace(/\s+/g, '').includes(q.replace(/\s+/g, '')) ||
        biz.address.toLowerCase().includes(q);

      const st = listingState(biz);
      const matchState = selectedState === 'All' || st === selectedState;
      const matchCity = selectedCity === 'All' || biz.city === selectedCity;
      const matchCategory = listingMatchesCategory(biz, selectedCategory, categories);
      const open = isBusinessOpenNow(biz.workingHours.en);
      const matchOpen =
        openFilter === 'all' ||
        (openFilter === 'open' && open === true) ||
        (openFilter === 'closed' && open === false);
      const matchRating = Number(biz.rating || 0) >= minRating;

      return matchQuery && matchState && matchCity && matchCategory && matchOpen && matchRating;
    });
  }, [
    businesses,
    debouncedQuery,
    selectedState,
    selectedCity,
    selectedCategory,
    openFilter,
    minRating,
    categories,
  ]);

  const mapQuery = useMemo(() => {
    if (mapFocusId) {
      const focused = filteredBusinesses.find((b) => b.id === mapFocusId);
      if (focused) return buildBusinessMapQuery(focused);
    }
    if (selectedCity !== 'All') return selectedCity;
    if (selectedState !== 'All') {
      const name = US_STATES.find((s) => s.code === selectedState)?.name;
      return name || selectedState;
    }
    if (filteredBusinesses[0]) return buildBusinessMapQuery(filteredBusinesses[0]);
    return 'United States';
  }, [mapFocusId, filteredBusinesses, selectedCity, selectedState]);

  const hasActiveFilters =
    searchQuery ||
    selectedState !== 'All' ||
    selectedCity !== 'All' ||
    selectedCategory !== 'All' ||
    openFilter !== 'all' ||
    minRating > 0;

  return (
    <div className="space-y-4" id="search-tab-container">
      <div className="flex items-center gap-3 pb-2 animate-fade-in-up" id="search-header">
        <button
          onClick={() => onSwitchTab('home')}
          className="p-1 px-2 rounded-xl bg-[#1E1915] hover:bg-[#1E1915] text-[#F08C32] border border-[#2B231D] transition-colors"
          id="btn-search-back"
        >
          <ArrowLeft className="w-5 h-5 inline rounded" />
        </button>
        <h2 className="text-xl font-extrabold text-[#FFFFFF] flex-1" id="search-header-title">
          {language === 'en' ? 'Find a business' : 'ابحث عن نشاط تجاري'}
        </h2>
        <div className="flex rounded-xl border border-[#2B231D] overflow-hidden" id="search-view-toggle">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-1.5 ${viewMode === 'list' ? 'bg-[#FF9E47] text-white' : 'bg-[#1E1915] text-gray-400'}`}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`px-2.5 py-1.5 ${viewMode === 'map' ? 'bg-[#FF9E47] text-white' : 'bg-[#1E1915] text-gray-400'}`}
            aria-label="Map view"
          >
            <Map className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative animate-fade-in-up" style={{ animationDelay: '0.05s' }} id="search-input-wrapper">
        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={language === 'en' ? 'Plumber, restaurant, bookstore...' : 'سباك، مطعم، مكتبة كتب...'}
          className="w-full pl-10 pr-4 py-3 bg-[#171310] border border-[#2B231D] rounded-2xl text-xs text-[#FFFFFF] placeholder-[#8E8E8E] outline-none focus:border-[#F08C32] transition-all"
          id="search-input-field"
        />
        {isSearching && (
          <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-[#F08C32] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* State + city + open now + rating */}
      <div className="grid grid-cols-2 gap-2 animate-fade-in-up" style={{ animationDelay: '0.08s' }} id="search-advanced-filters">
        <select
          value={selectedState}
          onChange={(e) => {
            setSelectedState(e.target.value);
            setSelectedCity('All');
            setMapFocusId(null);
          }}
          className="w-full px-3 py-2.5 rounded-xl bg-[#171310] border border-[#2B231D] text-xs text-[#FFFFFF] outline-none focus:border-[#F08C32]"
          id="search-state-select"
        >
          <option value="All">All states</option>
          {US_STATES.map(({ code, name }) => (
            <option key={code} value={code}>
              {name} ({code})
            </option>
          ))}
        </select>
        <select
          value={selectedCity}
          onChange={(e) => {
            setSelectedCity(e.target.value);
            setMapFocusId(null);
          }}
          className="w-full px-3 py-2.5 rounded-xl bg-[#171310] border border-[#2B231D] text-xs text-[#FFFFFF] outline-none focus:border-[#F08C32]"
          id="search-city-select"
        >
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city === 'All' ? 'All cities' : city}
            </option>
          ))}
        </select>
        <select
          value={openFilter}
          onChange={(e) => setOpenFilter(e.target.value as OpenFilter)}
          className="w-full px-3 py-2.5 rounded-xl bg-[#171310] border border-[#2B231D] text-xs text-[#FFFFFF] outline-none focus:border-[#F08C32]"
          id="search-open-status-select"
        >
          <option value="all">Open / Closed</option>
          <option value="open">Open now</option>
          <option value="closed">Closed now</option>
        </select>
        <select
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          className="w-full px-3 py-2.5 rounded-xl bg-[#171310] border border-[#2B231D] text-xs text-[#FFFFFF] outline-none focus:border-[#F08C32]"
          id="search-rating-select"
        >
          {MIN_RATINGS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none animate-fade-in-up" style={{ animationDelay: '0.12s' }} id="search-cats-scroll">
        <button
          onClick={() => setSelectedCategory('All')}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold uppercase border transition-all ${
            selectedCategory === 'All'
              ? 'bg-transparent text-[#F08C32] border-[#F08C32]/80'
              : 'bg-[#1E1915] text-[#8E8E8E] border-[#2B231D] hover:text-[#FFFFFF]'
          }`}
          id="cat-chip-all"
        >
          All
        </button>
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isSelected
                  ? 'bg-transparent text-[#F08C32] border-[#F08C32]'
                  : 'bg-[#1E1915]/30 text-gray-500 border-[#2B231D]/55 hover:text-[#FFFFFF]'
              }`}
              id={`cat-chip-${cat.id}`}
            >
              {cat.name.en}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs py-1" id="search-counter-bar">
        <span className="font-mono text-gray-400 font-bold" id="result-counter-text">
          {isSearching ? '...' : filteredBusinesses.length} {t.resultsCount}
        </span>
        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="text-[#F08C32]/85 hover:underline font-bold text-[11px]"
            id="search-btn-clear"
          >
            Reset Filters
          </button>
        )}
      </div>

      {viewMode === 'map' && (
        <div className="space-y-3 animate-fade-in-up" id="search-map-panel">
          <div className="rounded-2xl overflow-hidden border border-[#2B231D] bg-[#1E1915] aspect-[4/3] relative">
            <iframe
              title="ABN listings map"
              src={googleMapsEmbedUrl(mapQuery)}
              className="absolute inset-0 w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <p className="text-[10px] text-gray-500 px-1">
            Map centered on {selectedCity !== 'All' ? selectedCity : selectedState !== 'All' ? selectedState : 'your results'}.
            Tap a listing below to focus the map or open details.
          </p>
        </div>
      )}

      {isSearching ? (
        <SearchSkeleton />
      ) : (
        <div className="space-y-3.5" id="search-result-list">
          {filteredBusinesses.length === 0 ? (
            <div className="text-center py-12 px-6 rounded-3xl bg-[#171310] border border-dashed border-[#2B231D] animate-scale-up" id="search-empty-state">
              <p className="text-xs text-gray-400 font-medium">{t.noResults}</p>
            </div>
          ) : (
            filteredBusinesses.map((biz) => {
              const isOpen = isBusinessOpenNow(biz.workingHours.en);
              const focused = mapFocusId === biz.id;
              return (
                <div
                  key={biz.id}
                  onClick={() => {
                    if (viewMode === 'map') {
                      setMapFocusId(biz.id);
                    }
                    onSelectBusiness(biz);
                  }}
                  className={`flex items-center gap-3.5 p-3 rounded-2xl bg-[#171310] border transition-all cursor-pointer animate-fade-in-up card-hover ${
                    focused ? 'border-[#F08C32]' : 'border-[#2B231D] hover:border-[#F08C32]/40'
                  }`}
                  id={`search-item-${biz.id}`}
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-900 border border-[#2B231D] flex-shrink-0">
                    <BusinessThumbnail business={biz} eager />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-[#FFFFFF] hover:text-[#F08C32] truncate transition-colors leading-snug">
                      {biz.name}
                    </h4>
                    <p className="text-[10px] text-gray-400 font-medium capitalize mt-0.5">
                      {textEn(biz.subcategory)}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-500">
                      <MapPin className="w-3.5 h-3.5 text-[#F08C32]" />
                      <span>
                        {biz.city}
                        {listingState(biz) ? `, ${listingState(biz)}` : ''}
                      </span>
                    </div>
                    {viewMode === 'map' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openBusinessInMaps(buildBusinessMapQuery(biz));
                        }}
                        className="mt-1.5 text-[9px] font-bold text-[#F08C32] hover:underline"
                      >
                        Open in Maps
                      </button>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                    {biz.isVerified && (
                      <span className="p-0.5 rounded-full bg-green-500/10 text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span className="text-[10px] font-black text-[#F08C32] flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-[#F08C32]" /> {biz.rating}
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

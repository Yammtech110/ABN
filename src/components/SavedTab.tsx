import React, { useEffect, useMemo } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import { Heart, MapPin, Star, BookOpen, Loader2 } from 'lucide-react';
import { Business } from '../types';
import { textEn } from '../utils/englishOnly';
import { isLiveDirectoryListing } from '../utils/listingAccess';
import { BusinessThumbnail } from './BusinessThumbnail';

interface SavedTabProps {
  onSelectBusiness: (biz: Business) => void;
  onSwitchTab: (tabId: string) => void;
}

export const SavedTab: React.FC<SavedTabProps> = ({ onSelectBusiness, onSwitchTab }) => {
  const {
    language,
    businesses,
    favorites,
    favoritesLoading,
    favoritesError,
    refreshFavorites,
    toggleFavorite,
    apiToken,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  useEffect(() => {
    if (apiToken) refreshFavorites(apiToken);
  }, [apiToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const savedBusinesses = useMemo(
    () =>
      favorites
        .map((id) => businesses.find((b) => b.id === id))
        .filter((biz): biz is Business => Boolean(biz && isLiveDirectoryListing(biz))),
    [businesses, favorites],
  );

  const handleRemoveFavorite = async (biz: Business) => {
    const result = await toggleFavorite(biz.id);
    if (!result.success && result.error) {
      alert(result.error);
    }
  };

  return (
    <div className="space-y-4" id="saved-tab-container">

      <div className="pb-1 border-b border-[#D7E0EA] animate-fade-in-up" id="saved-header">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold text-[#7C2D12]" id="saved-header-title">
            {t.savedLists}{' '}
            <span className="text-[#F08C32]">({favoritesLoading ? '…' : savedBusinesses.length})</span>
          </h2>
          <button
            type="button"
            onClick={() => refreshFavorites()}
            className="text-[9px] font-bold text-[#F08C32] hover:underline shrink-0"
          >
            Refresh
          </button>
        </div>
        <p className="text-[10px] text-gray-500 font-medium">
          {t.savedSyncHint}
        </p>
      </div>

      {favoritesLoading && (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-500 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-[#F08C32]" />
          Loading your saved businesses…
        </div>
      )}

      {favoritesError && !favoritesLoading && (
        <div className="py-4 px-4 rounded-2xl bg-red-950/20 border border-red-900/30 space-y-2">
          <p className="text-xs text-red-400">{favoritesError}</p>
          <button
            type="button"
            onClick={() => refreshFavorites()}
            className="text-[9px] font-bold text-[#F08C32] hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!favoritesLoading && !favoritesError && savedBusinesses.length === 0 && (
        <div className="text-center py-16 px-6 rounded-3xl bg-white border border-dashed border-[#D7E0EA]" id="saved-empty-state">
          <Heart className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-xs text-gray-400 font-medium max-w-xs mx-auto leading-relaxed">
            {t.noSaved}
          </p>
          <button
            onClick={() => onSwitchTab('search')}
            className="mt-6 px-4 py-2 bg-[#FF9E47] hover:bg-opacity-95 text-white font-extrabold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1 mx-auto"
            id="saved-btn-browse"
          >
            <BookOpen className="w-4 h-4" />
            Browse Directory
          </button>
        </div>
      )}

      {!favoritesLoading && savedBusinesses.length > 0 && (
        <div className="space-y-3" id="saved-grid-list">
          {savedBusinesses.map((biz) => (
            <div
              key={biz.id}
              className="p-3 rounded-2xl bg-white border border-[#D7E0EA] hover:border-[#F08C32]/30 transition-all relative flex gap-3.5 animate-fade-in-up card-hover"
              id={`saved-card-${biz.id}`}
            >
              <div
                onClick={() => onSelectBusiness(biz)}
                className="w-14 h-14 rounded-xl overflow-hidden bg-stone-900 border border-[#D7E0EA] cursor-pointer"
                id={`saved-img-wrapper-${biz.id}`}
              >
                <BusinessThumbnail business={biz} />
              </div>

              <div
                onClick={() => onSelectBusiness(biz)}
                className="flex-1 min-w-0 cursor-pointer"
                id={`saved-info-${biz.id}`}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[8px] tracking-wider uppercase font-extrabold px-1.5 py-0.5 rounded bg-[#EEF2F6] text-[#F08C32] border border-[#D7E0EA]/80">
                    {textEn(biz.subcategory)}
                  </span>
                </div>
                <h3 className="text-xs font-black text-[#7C2D12] hover:text-[#F08C32] truncate mt-1 leading-snug">
                  {biz.name}
                </h3>
                <span className="text-[9px] text-gray-500 flex items-center gap-0.5 mt-1 font-sans">
                  <MapPin className="w-3.5 h-3.5 text-[#F08C32]" />
                  {t[biz.city.replace(/\s+/g, '').toLowerCase() as keyof typeof t] as string || biz.city} ({biz.area})
                </span>
              </div>

              <div className="flex flex-col justify-between items-end" id={`saved-actions-${biz.id}`}>
                <button
                  onClick={() => handleRemoveFavorite(biz)}
                  className="p-1.5 rounded-full hover:bg-[#EEF2F6] text-red-400 hover:text-red-300 transition-colors"
                  title="Remove bookmark"
                  id={`saved-btn-remove-${biz.id}`}
                >
                  <Heart className="w-4 h-4 fill-current text-red-500" />
                </button>
                <div className="flex items-center gap-1.5 pb-0.5">
                  <Star className="w-3 h-3 text-[#F08C32] fill-[#F08C32]" />
                  <span className="text-[10px] font-black text-[#F08C32]">{biz.rating}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

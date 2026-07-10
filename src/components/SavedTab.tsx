import React, { useMemo } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import { Heart, MapPin, Star, ArrowRight, BookOpen } from 'lucide-react';
import { Business } from '../types';

interface SavedTabProps {
  onSelectBusiness: (biz: Business) => void;
  onSwitchTab: (tabId: string) => void;
}

export const SavedTab: React.FC<SavedTabProps> = ({ onSelectBusiness, onSwitchTab }) => {
  const { language, businesses, favorites, toggleFavorite } = useDirectory();
  const t = TRANSLATIONS[language];

  // Filters businesses that exist in the favorites list
  const savedBusinesses = useMemo(
    () => businesses.filter((b) => favorites.includes(b.id)),
    [businesses, favorites]
  );

  return (
    <div className="space-y-4" id="saved-tab-container">
      
      {/* Title */}
      <div className="pb-1 border-b border-[#2D2319] animate-fade-in-up" id="saved-header">
        <h2 className="text-xl font-extrabold text-[#F4E3D7]" id="saved-header-title">
          {t.savedLists} <span className="text-[#FFA048]">({savedBusinesses.length})</span>
        </h2>
        <p className="text-[10px] text-gray-500 font-medium">
          {language === 'en' ? 'Quickly access your bookmarked community listings' : 'الوصول السريع إلى الأنشطة المحفوظة والموثقة'}
        </p>
      </div>

      {/* Grid List */}
      {savedBusinesses.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-3xl bg-[#13110E] border border-dashed border-[#2D2319]" id="saved-empty-state">
          <Heart className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-xs text-gray-400 font-medium max-w-xs mx-auto leading-relaxed">
            {t.noSaved}
          </p>
          <button
            onClick={() => onSwitchTab('search')}
            className="mt-6 px-4 py-2 bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1 mx-auto"
            id="saved-btn-browse"
          >
            <BookOpen className="w-4 h-4" />
            {language === 'en' ? 'Browse Directory' : 'تصفح الدليل الآن'}
          </button>
        </div>
      ) : (
        <div className="space-y-3" id="saved-grid-list">
          {savedBusinesses.map((biz) => (
            <div
              key={biz.id}
              className="p-3 rounded-2xl bg-[#13110E] border border-[#2D2319] hover:border-[#FFA048]/30 transition-all relative flex gap-3.5 animate-fade-in-up card-hover"
              id={`saved-card-${biz.id}`}
            >
              
              {/* Image Left */}
              <div
                onClick={() => onSelectBusiness(biz)}
                className="w-14 h-14 rounded-xl overflow-hidden bg-stone-900 border border-[#2D2319] cursor-pointer"
                id={`saved-img-wrapper-${biz.id}`}
              >
                <img
                  src={biz.logoUrl}
                  alt={biz.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200&h=200';
                  }}
                />
              </div>

              {/* Central Information */}
              <div
                onClick={() => onSelectBusiness(biz)}
                className="flex-1 min-w-0 cursor-pointer"
                id={`saved-info-${biz.id}`}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[8px] tracking-wider uppercase font-extrabold px-1.5 py-0.5 rounded bg-[#201B15] text-[#FFA048] border border-[#2D2319]/80">
                    {biz.subcategory[language] || biz.subcategory.en}
                  </span>
                </div>
                <h3 className="text-xs font-black text-white hover:text-[#FFA048] truncate mt-1 leading-snug">
                  {biz.name}
                </h3>
                <span className="text-[9px] text-gray-500 flex items-center gap-0.5 mt-1 font-sans">
                  <MapPin className="w-3.5 h-3.5 text-[#FFA048]" />
                  {t[biz.city.toLowerCase() as 'baghdad' | 'najaf' | 'karbala']} ({biz.area})
                </span>
              </div>

              {/* Action Buttons Right column */}
              <div className="flex flex-col justify-between items-end" id={`saved-actions-${biz.id}`}>
                <button
                  onClick={() => toggleFavorite(biz.id)}
                  className="p-1.5 rounded-full hover:bg-[#201B15] text-red-400 hover:text-red-300 transition-colors"
                  title="Remove bookmark"
                  id={`saved-btn-remove-${biz.id}`}
                >
                  <Heart className="w-4 h-4 fill-current text-red-500" />
                </button>
                <div className="flex items-center gap-1.5 pb-0.5">
                  <Star className="w-3 h-3 text-[#FFA048] fill-[#FFA048]" />
                  <span className="text-[10px] font-black text-[#FFA048]">{biz.rating}</span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};

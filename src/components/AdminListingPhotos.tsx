import React, { useEffect, useMemo, useState } from 'react';
import { ImageIcon, X, ZoomIn } from 'lucide-react';
import {
  businessCoverUrl,
  businessLogoUrl,
  businessPhotoUrls,
  DEFAULT_LISTING_COVER,
  DEFAULT_LISTING_LOGO,
} from '../utils/listingImages';
import { Business } from '../types';

type AdminListingPhotosProps = {
  business: Business;
  language: 'en' | 'ar';
};

const FALLBACK = DEFAULT_LISTING_LOGO;

/** Fetch listing media as blob so admin thumbnails work reliably through the API proxy. */
function useAdminImage(url: string, fallback: string = FALLBACK) {
  const [src, setSrc] = useState(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);

    if (!url) {
      setSrc(fallback);
      setLoading(false);
      return;
    }

    fetch(url)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelled) return;
        if (blob && blob.size > 0) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        } else {
          setSrc(fallback);
        }
      })
      .catch(() => {
        if (!cancelled) setSrc(fallback);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, fallback]);

  return { src, loading };
}

type PhotoTileProps = {
  url: string;
  label: string;
  onExpand: () => void;
};

const PhotoTile: React.FC<PhotoTileProps> = ({ url, label, onExpand }) => {
  const { src, loading } = useAdminImage(url);

  return (
    <button
      type="button"
      onClick={onExpand}
      className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-[#2D2319] bg-[#0F0E0C] text-left"
      title={label}
    >
      <img
        src={src}
        alt={label}
        loading="eager"
        decoding="async"
        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
          loading ? 'opacity-60' : 'opacity-100'
        }`}
      />
      <span className="absolute bottom-0 inset-x-0 px-2 py-1 text-[8px] font-bold uppercase tracking-wider bg-black/70 text-gray-300">
        {label}
      </span>
      <span className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <ZoomIn className="w-3 h-3" />
      </span>
    </button>
  );
};

export const AdminListingPhotos: React.FC<AdminListingPhotosProps> = ({ business, language }) => {
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const logoUrl = businessLogoUrl(business);
  const coverUrl = businessCoverUrl(business);
  const { src: coverSrc, loading: coverLoading } = useAdminImage(coverUrl, DEFAULT_LISTING_COVER);
  const { src: logoSrc, loading: logoLoading } = useAdminImage(logoUrl);

  const photos = useMemo(() => businessPhotoUrls(business), [business]);
  const lightboxSrc = lightboxIndex !== null ? photos[lightboxIndex] : null;
  const { src: lightboxDisplaySrc } = useAdminImage(lightboxSrc ?? '', FALLBACK);

  return (
    <div className="space-y-2" id={`admin-photos-${business.id}`}>
      {/* Cover banner with logo overlay */}
      <div className="relative h-24 rounded-xl overflow-hidden border border-[#2D2319] bg-[#0F0E0C]">
        <img
          src={coverSrc}
          alt={`${business.name} cover`}
          loading="eager"
          decoding="async"
          className={`w-full h-full object-cover ${coverLoading ? 'opacity-50' : 'opacity-100'}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-2 left-2 flex items-end gap-2">
          <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-[#FFA048]/60 bg-[#13110E] shrink-0">
            <img
              src={logoSrc}
              alt={`${business.name} logo`}
              loading="eager"
              decoding="async"
              className={`w-full h-full object-cover ${logoLoading ? 'opacity-50' : 'opacity-100'}`}
            />
          </div>
          <span className="text-[8px] font-bold uppercase tracking-wider text-gray-300 pb-0.5">
            {language === 'en' ? 'Business photos' : 'صور النشاط'}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[9px] font-bold text-[#FFA048] hover:underline"
      >
        <ImageIcon className="w-3.5 h-3.5" />
        {expanded
          ? language === 'en'
            ? 'Hide photos'
            : 'إخفاء الصور'
          : language === 'en'
            ? `View photos (${photos.length})`
            : `عرض الصور (${photos.length})`}
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-2">
          <PhotoTile
            url={logoUrl}
            label={language === 'en' ? 'Logo' : 'الشعار'}
            onExpand={() => {
              const idx = photos.indexOf(logoUrl);
              setLightboxIndex(idx >= 0 ? idx : 0);
            }}
          />
          <PhotoTile
            url={coverUrl}
            label={language === 'en' ? 'Cover' : 'الغلاف'}
            onExpand={() => {
              const idx = photos.indexOf(coverUrl);
              setLightboxIndex(idx >= 0 ? idx : 0);
            }}
          />
        </div>
      )}

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxDisplaySrc}
            alt={business.name}
            className="max-w-full max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { ImageIcon, X, ZoomIn } from 'lucide-react';
import {
  businessCoverUrl,
  businessLogoUrl,
  businessPhotoUrls,
  listingPlaceholderDataUrl,
} from '../utils/listingImages';
import { absoluteMediaUrl, fetchMediaObjectUrl } from '../utils/loadListingMedia';
import { useDirectory } from '../context/DirectoryContext';
import { Business } from '../types';

type AdminListingPhotosProps = {
  business: Business;
  language: 'en' | 'ar';
};

type PhotoTileProps = {
  url: string;
  fallback: string;
  label: string;
  onExpand: () => void;
};

/** Compact square thumb — keeps the admin list scrollable with many listings */
const PhotoTile: React.FC<PhotoTileProps> = ({ url, fallback, label, onExpand }) => {
  const [src, setSrc] = useState(url || fallback);

  useEffect(() => {
    setSrc(url || fallback);
  }, [url, fallback]);

  return (
    <button
      type="button"
      onClick={onExpand}
      className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-[#2B231D] bg-[#1E1915] text-left shrink-0"
      title={label}
    >
      <img
        src={src}
        alt={label}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
        onError={() => setSrc(fallback)}
      />
      <span className="absolute bottom-0 inset-x-0 px-0.5 py-0.5 text-[7px] font-bold uppercase tracking-wider bg-black/75 text-[#CFCFCF] truncate">
        {label}
      </span>
      <span className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <ZoomIn className="w-2.5 h-2.5" />
      </span>
    </button>
  );
};

export const AdminListingPhotos: React.FC<AdminListingPhotosProps> = ({ business, language }) => {
  const { apiToken } = useDirectory();
  // Collapsed by default so many listings fit on one screen
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [resolvedPhotos, setResolvedPhotos] = useState<string[]>([]);

  const fallbackLogo = listingPlaceholderDataUrl(business.name || business.id);
  const fallbackCover = listingPlaceholderDataUrl(business.name || business.id, { wide: true });

  const rawPhotos = useMemo(() => {
    const urls = businessPhotoUrls(business).map(absoluteMediaUrl).filter(Boolean);
    if (urls.length > 0) return urls;
    const logo = absoluteMediaUrl(businessLogoUrl(business));
    const cover = absoluteMediaUrl(businessCoverUrl(business));
    return [...new Set([logo, cover].filter(Boolean))];
  }, [business.id, business.name, business.logoUrl, business.coverUrl, business.gallery]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    (async () => {
      const loaded = await Promise.all(
        rawPhotos.map(async (url) => {
          const next = await fetchMediaObjectUrl(url, apiToken);
          if (next.startsWith('blob:')) objectUrls.push(next);
          return next || url;
        }),
      );
      if (cancelled) {
        objectUrls.forEach((u) => {
          try {
            URL.revokeObjectURL(u);
          } catch {
            /* ignore */
          }
        });
        return;
      }
      setResolvedPhotos(loaded);
    })();

    return () => {
      cancelled = true;
      objectUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
    };
  }, [rawPhotos, apiToken, business.id]);

  const photos = resolvedPhotos.length > 0 ? resolvedPhotos : rawPhotos;
  const logoUrl = photos[0] || fallbackLogo;
  const [logoSrc, setLogoSrc] = useState(logoUrl);

  useEffect(() => {
    setLogoSrc(logoUrl || fallbackLogo);
  }, [logoUrl, fallbackLogo]);

  const lightboxSrc =
    lightboxIndex !== null ? photos[lightboxIndex] || fallbackLogo : fallbackLogo;

  return (
    <div className="space-y-1.5" id={`admin-photos-${business.id}`}>
      {/* Compact strip: small logo + photo count toggle (no huge cover banner) */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="w-10 h-10 rounded-lg overflow-hidden border border-[#F08C32]/40 bg-[#1E1915] shrink-0"
          title={language === 'en' ? 'Open logo' : 'فتح الشعار'}
        >
          <img
            src={logoSrc}
            alt={`${business.name} logo`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            onError={() => setLogoSrc(fallbackLogo)}
          />
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-[9px] font-bold text-[#F08C32] hover:underline"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          {expanded
            ? language === 'en'
              ? 'Hide photos'
              : 'إخفاء الصور'
            : language === 'en'
              ? `Photos (${photos.length})`
              : `صور (${photos.length})`}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {photos.map((url, i) => {
            const isLogo = i === 0;
            const isCover = i === 1;
            const label = isLogo
              ? language === 'en'
                ? 'Logo'
                : 'الشعار'
              : isCover
                ? language === 'en'
                  ? 'Cover'
                  : 'الغلاف'
                : language === 'en'
                  ? `P${i + 1}`
                  : `${i + 1}`;
            return (
              <PhotoTile
                key={`${business.id}-photo-${i}`}
                url={url}
                fallback={isCover ? fallbackCover : fallbackLogo}
                label={label}
                onExpand={() => setLightboxIndex(i)}
              />
            );
          })}
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
            src={lightboxSrc}
            alt={business.name}
            className="max-w-full max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              (e.target as HTMLImageElement).src = fallbackLogo;
            }}
          />
        </div>
      )}
    </div>
  );
};

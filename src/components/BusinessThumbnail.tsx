import React, { useEffect, useState } from 'react';
import {
  businessCoverUrl,
  businessLogoUrl,
  listingPlaceholderDataUrl,
} from '../utils/listingImages';

type BusinessLike = {
  id: string;
  name?: string;
  logoUrl?: string;
  coverUrl?: string;
};

type BusinessThumbnailProps = {
  business: BusinessLike;
  className?: string;
  id?: string;
  alt?: string;
  /** Admin cards should load immediately — lazy loading can leave thumbnails blank in scroll views */
  eager?: boolean;
};

/** Listing thumbnail — loads logo, then cover, then a unique initials placeholder (never the old grocery mock). */
export const BusinessThumbnail: React.FC<BusinessThumbnailProps> = ({
  business,
  className = 'w-full h-full object-cover',
  id,
  alt,
  eager = false,
}) => {
  const logo = businessLogoUrl(business);
  const cover = businessCoverUrl(business);
  const placeholder = listingPlaceholderDataUrl(business.name || business.id || 'BN');
  const [src, setSrc] = useState(logo || placeholder);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setStage(0);
    setSrc(businessLogoUrl(business) || listingPlaceholderDataUrl(business.name || business.id || 'BN'));
  }, [business.id, business.name, business.logoUrl, business.coverUrl]);

  const handleError = () => {
    if (stage === 0 && cover && cover !== logo) {
      setStage(1);
      setSrc(cover);
      return;
    }
    if (stage === 1) {
      setStage(2);
      const retryLogo = businessLogoUrl(business);
      const retry = retryLogo.includes('?') ? `${retryLogo}&retry=1` : `${retryLogo}?retry=1`;
      setSrc(retry);
      return;
    }
    if (stage === 2) {
      setStage(3);
      setSrc(placeholder);
    }
  };

  return (
    <img
      id={id}
      key={`${business.id}-${stage}`}
      src={src || placeholder}
      alt={alt ?? business.name ?? 'Business'}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
      onError={handleError}
    />
  );
};

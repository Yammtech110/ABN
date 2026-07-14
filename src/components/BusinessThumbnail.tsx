import React, { useEffect, useState } from 'react';
import { businessLogoUrl, DEFAULT_LISTING_LOGO } from '../utils/listingImages';

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

/** Listing thumbnail — resolves API logo URL and shows a fallback if load fails */
export const BusinessThumbnail: React.FC<BusinessThumbnailProps> = ({
  business,
  className = 'w-full h-full object-cover',
  id,
  alt,
  eager = false,
}) => {
  const resolved = businessLogoUrl(business);
  const [src, setSrc] = useState(resolved);

  useEffect(() => {
    setSrc(businessLogoUrl(business));
  }, [business.id, business.logoUrl, business.coverUrl]);

  return (
    <img
      id={id}
      key={resolved}
      src={src || DEFAULT_LISTING_LOGO}
      alt={alt ?? business.name ?? 'Business'}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
      onError={() => setSrc(DEFAULT_LISTING_LOGO)}
    />
  );
};

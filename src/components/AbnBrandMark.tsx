import React from 'react';
import { AbnLogo, AbnLogoSize } from './AbnLogo';

const TITLE_CLASSES: Record<AbnLogoSize, string> = {
  sm:     'text-xl',
  md:     'text-2xl',
  lg:     'text-3xl',
  hero:   'text-4xl',
  splash: 'text-5xl',
};

const TAGLINE_CLASSES: Record<AbnLogoSize, string> = {
  sm:     'text-[9px]',
  md:     'text-[10px]',
  lg:     'text-[11px]',
  hero:   'text-xs',
  splash: 'text-sm',
};

interface AbnBrandMarkProps {
  size?: AbnLogoSize;
  className?: string;
}

/** Emblem → ABN wordmark → AHLE-BAIT NETWORK tagline on seamless dark canvas */
export const AbnBrandMark: React.FC<AbnBrandMarkProps> = ({ size = 'md', className = '' }) => (
  <div className={`flex flex-col items-center text-center bg-[#0A0705] ${className}`.trim()}>
    <AbnLogo variant="emblem" size={size} />
    <h1
      className={`${TITLE_CLASSES[size]} font-black text-[#FFA048] tracking-widest uppercase mt-4`}
      aria-label="ABN"
    >
      ABN
    </h1>
    <p className={`${TAGLINE_CLASSES[size]} font-bold text-[#C8925A] tracking-[0.22em] uppercase mt-2`}>
      AHLE-BAIT NETWORK
    </p>
  </div>
);

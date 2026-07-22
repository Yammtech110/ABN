import React from 'react';
import { AbnLogo, AbnLogoSize } from './AbnLogo';

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

/** Gold ABN mark + Ahle-Bait Network tagline (logo already includes ABN letters) */
export const AbnBrandMark: React.FC<AbnBrandMarkProps> = ({ size = 'md', className = '' }) => (
  <div className={`flex flex-col items-center text-center bg-transparent ${className}`.trim()}>
    <AbnLogo variant="full" size={size} />
    <p className={`${TAGLINE_CLASSES[size]} font-bold text-[#C9A24A] tracking-[0.22em] uppercase mt-3`}>
      AHLE-BAIT NETWORK
    </p>
  </div>
);

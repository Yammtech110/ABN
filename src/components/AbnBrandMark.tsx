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

/** Official ABN mark + Ahlebait Network tagline */
export const AbnBrandMark: React.FC<AbnBrandMarkProps> = ({ size = 'md', className = '' }) => (
  <div className={`flex flex-col items-center text-center bg-transparent ${className}`.trim()}>
    <AbnLogo variant="full" size={size} />
    <p className={`${TAGLINE_CLASSES[size]} font-bold text-[#EA580C] tracking-[0.22em] uppercase mt-3`}>
      AHLEBAIT NETWORK
    </p>
    <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-[#7C2D12] mt-1.5">
      Connect · Collaborate · Grow
    </p>
  </div>
);

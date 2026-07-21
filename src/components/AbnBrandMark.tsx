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
  /** When false, only the logo mark is shown (no tagline). */
  showTagline?: boolean;
}

/** Official logo mark + AHLE-BAIT NETWORK tagline (ABN letters are in the artwork). */
export const AbnBrandMark: React.FC<AbnBrandMarkProps> = ({
  size = 'md',
  className = '',
  showTagline = true,
}) => (
  <div className={`flex flex-col items-center text-center ${className}`.trim()}>
    <AbnLogo variant="full" size={size} />
    {showTagline && (
      <p className={`${TAGLINE_CLASSES[size]} font-bold text-[#C8925A] tracking-[0.22em] uppercase mt-3`}>
        AHLE-BAIT NETWORK
      </p>
    )}
  </div>
);

import React from 'react';
import { AbnLogo, AbnLogoSize } from './AbnLogo';

interface AbnBrandMarkProps {
  size?: AbnLogoSize;
  className?: string;
}

/** Official ABN full logo (includes wordmark + tagline in the image) */
export const AbnBrandMark: React.FC<AbnBrandMarkProps> = ({ size = 'md', className = '' }) => (
  <div className={`flex flex-col items-center text-center bg-transparent ${className}`.trim()}>
    <AbnLogo variant="full" size={size} />
  </div>
);

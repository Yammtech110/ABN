import React from 'react';

const SIZE_CLASSES = {
  sm:     'h-10 w-auto max-w-[96px]',
  md:     'h-14 w-auto max-w-[140px]',
  lg:     'h-20 w-auto max-w-[180px]',
  hero:   'h-[120px] w-auto max-w-[220px]',
  splash: 'h-[min(42vw,168px)] w-auto max-w-[min(52vw,220px)]',
} as const;

export type AbnLogoSize = keyof typeof SIZE_CLASSES;

interface AbnLogoProps {
  size?: AbnLogoSize;
  className?: string;
  /** full = complete gold mark; emblem kept for compatibility (= full) */
  variant?: 'emblem' | 'full';
}

/** Gold hexagonal ABN mark (public/abn-logo.png) */
export const AbnLogo: React.FC<AbnLogoProps> = ({
  size = 'md',
  className = '',
  variant: _variant = 'full',
}) => (
  <img
    src="/abn-logo.png"
    alt="ABN — Ahle Bait Network"
    className={`object-contain object-center ${SIZE_CLASSES[size]} ${className}`.trim()}
    draggable={false}
  />
);

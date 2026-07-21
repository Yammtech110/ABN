import React from 'react';

const SIZE_CLASSES = {
  sm:     'h-10 w-10',
  md:     'h-14 w-14',
  lg:     'h-20 w-20',
  hero:   'h-28 w-28',
  splash: 'h-[min(42vw,168px)] w-[min(42vw,168px)]',
} as const;

export type AbnLogoSize = keyof typeof SIZE_CLASSES;

interface AbnLogoProps {
  size?: AbnLogoSize;
  className?: string;
  /** `full` and `emblem` both show the complete square mark (ABN is in the artwork). */
  variant?: 'emblem' | 'full';
}

/** Official ABN gold network mark */
export const AbnLogo: React.FC<AbnLogoProps> = ({
  size = 'md',
  className = '',
  variant = 'full',
}) => (
  <img
    src="/abn-logo.png"
    alt={variant === 'full' ? 'ABN — Ahle Bait Network' : ''}
    className={`object-contain object-center rounded-2xl ${SIZE_CLASSES[size]} ${className}`.trim()}
    draggable={false}
  />
);

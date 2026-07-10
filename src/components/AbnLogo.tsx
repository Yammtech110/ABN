import React from 'react';

const SIZE_CLASSES = {
  sm:     'h-8 w-auto max-w-[80px]',
  md:     'h-11 w-auto max-w-[104px]',
  lg:     'h-14 w-auto max-w-[128px]',
  hero:   'h-[72px] w-auto max-w-[168px]',
  splash: 'h-[min(38vw,140px)] w-auto max-w-[min(44vw,180px)]',
} as const;

/** Visible emblem crop — excludes baked-in ABN / metadata from PNG */
const EMBLEM_FRAME_CLASSES: Record<keyof typeof SIZE_CLASSES, string> = {
  sm:     'h-8 w-11',
  md:     'h-10 w-14',
  lg:     'h-12 w-16',
  hero:   'h-[68px] w-[88px]',
  splash: 'h-[min(32vw,128px)] w-[min(40vw,160px)]',
};

export type AbnLogoSize = keyof typeof SIZE_CLASSES;

interface AbnLogoProps {
  size?: AbnLogoSize;
  className?: string;
  variant?: 'emblem' | 'full';
}

/** Copper emblem — transparent on #0A0705 via blend; no hardcoded black matte box */
export const AbnLogo: React.FC<AbnLogoProps> = ({
  size = 'md',
  className = '',
  variant = 'emblem',
}) => {
  if (variant === 'emblem') {
    return (
      <div
        className={`relative flex items-start justify-center bg-[#0A0705] ${EMBLEM_FRAME_CLASSES[size]} ${className}`.trim()}
        aria-hidden="true"
      >
        <img
          src="/abn-logo.png"
          alt=""
          className="absolute top-0 left-1/2 h-[240%] w-auto max-w-none -translate-x-1/2 object-top object-contain mix-blend-lighten pointer-events-none select-none [clip-path:inset(0_0_56%_0)]"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <img
      src="/abn-logo.png"
      alt="ABN — Ahle Bait Network"
      className={`object-contain object-center mix-blend-lighten bg-[#0A0705] ${SIZE_CLASSES[size]} ${className}`.trim()}
      draggable={false}
    />
  );
};

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
  /** full = complete mark; emblem kept for compatibility (= full) */
  variant?: 'emblem' | 'full';
  /** Use on dark navy surfaces (splash) vs light auth surfaces */
  tone?: 'light' | 'dark';
}

/** Navy / emerald ABN brand mark — matches app theme */
export const AbnLogo: React.FC<AbnLogoProps> = ({
  size = 'md',
  className = '',
  variant: _variant = 'full',
  tone = 'light',
}) => {
  const onDark = tone === 'dark';
  const fill = onDark ? '#00A859' : '#FFFFFF';
  const stroke = onDark ? '#5DFFB0' : '#00A859';
  const letter = onDark ? '#FFFFFF' : '#0B2545';
  const accent = onDark ? '#FFFFFF' : '#00A859';
  const glowStart = onDark ? 'rgba(0,168,89,0.45)' : 'rgba(0,168,89,0.35)';
  const glowEnd = onDark ? 'rgba(93,255,176,0.12)' : 'rgba(11,37,69,0.12)';

  return (
    <svg
      viewBox="0 0 160 160"
      role="img"
      aria-label="ABN — Ahle Bait Network"
      className={`object-contain object-center ${SIZE_CLASSES[size]} ${className}`.trim()}
      draggable={false}
    >
      <defs>
        <linearGradient id={`abnHexGlow-${tone}`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor={glowStart} />
          <stop offset="100%" stopColor={glowEnd} />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="72" fill={`url(#abnHexGlow-${tone})`} />
      <path
        d="M80 18 L128 46 L128 102 L80 130 L32 102 L32 46 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M80 34 L114 54 L114 94 L80 114 L46 94 L46 54 Z"
        fill="none"
        stroke={accent}
        strokeWidth="2"
        opacity="0.55"
      />
      <text
        x="80"
        y="88"
        textAnchor="middle"
        fontFamily="Segoe UI, system-ui, sans-serif"
        fontWeight="900"
        fontSize="34"
        letterSpacing="1.5"
        fill={letter}
      >
        ABN
      </text>
      <circle cx="80" cy="108" r="3.5" fill={accent} />
    </svg>
  );
};

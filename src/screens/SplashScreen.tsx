import React from 'react';
import { motion } from 'motion/react';
import { AbnLogo } from '../components/AbnLogo';

/** Minimum time splash stays fully visible before transition begins */
export const SPLASH_VISIBLE_MS = 2800;
/** Fade-out duration after the visible window */
export const SPLASH_FADE_MS = 550;
/** Total overlay lifetime — visible window + fade */
export const SPLASH_TOTAL_MS = SPLASH_VISIBLE_MS + SPLASH_FADE_MS;

interface SplashScreenProps {
  fading?: boolean;
}

const NODES = [
  { x: 18, y: 22 },
  { x: 78, y: 18 },
  { x: 88, y: 48 },
  { x: 72, y: 78 },
  { x: 28, y: 82 },
  { x: 12, y: 52 },
  { x: 48, y: 12 },
  { x: 55, y: 88 },
];

/** Cinematic launch splash — logo reveal, network pulse, brand wordmark */
export const SplashScreen: React.FC<SplashScreenProps> = ({ fading = false }) => (
  <div
    className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-opacity ease-out ${
      fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}
    id="splash-screen"
    style={{
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      transitionDuration: `${SPLASH_FADE_MS}ms`,
      background:
        'radial-gradient(120% 80% at 50% 20%, #123B5D 0%, #0B2545 48%, #061526 100%)',
    }}
  >
    {/* Soft emerald glow behind brand */}
    <motion.div
      className="pointer-events-none absolute w-[70vw] h-[70vw] max-w-[420px] max-h-[420px] rounded-full"
      style={{
        background: 'radial-gradient(circle, rgba(0,168,89,0.28) 0%, transparent 68%)',
      }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1.15 }}
      transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
    />

    {/* Expanding network rings */}
    {[0, 1, 2].map((i) => (
      <motion.div
        key={`ring-${i}`}
        className="pointer-events-none absolute rounded-full border border-[#00A859]/25"
        style={{ width: 140 + i * 70, height: 140 + i * 70 }}
        initial={{ opacity: 0, scale: 0.55 }}
        animate={{ opacity: [0, 0.55, 0], scale: [0.55, 1.15, 1.45] }}
        transition={{
          duration: 2.2,
          delay: 0.25 + i * 0.28,
          ease: 'easeOut',
          repeat: Infinity,
          repeatDelay: 0.6,
        }}
      />
    ))}

    {/* Floating connection nodes */}
    <div className="pointer-events-none absolute inset-0">
      {NODES.map((n, i) => (
        <motion.span
          key={`node-${i}`}
          className="absolute w-2 h-2 rounded-full bg-[#00A859] shadow-[0_0_12px_rgba(0,168,89,0.8)]"
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0.45, 1], scale: [0, 1.2, 0.9, 1] }}
          transition={{ duration: 1.8, delay: 0.35 + i * 0.08, ease: 'easeOut' }}
        />
      ))}
    </div>

    {/* Brand stack */}
    <div className="relative z-10 flex flex-col items-center px-8 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.72, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.75, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="mb-5 drop-shadow-[0_0_32px_rgba(0,168,89,0.35)]"
      >
        <AbnLogo size="splash" className="brightness-110" />
      </motion.div>

      <motion.p
        className="text-[11px] font-bold tracking-[0.28em] uppercase text-[#00A859] mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.55 }}
      >
        Welcome to ABN
      </motion.p>

      <motion.h1
        className="leading-[0.95] mb-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="block text-[34px] sm:text-[40px] font-black tracking-tight text-white">
          AHLEBAIT
        </span>
        <span className="block text-[34px] sm:text-[40px] font-black tracking-tight text-[#00A859]">
          NETWORK
        </span>
      </motion.h1>

      <motion.p
        className="text-[13px] text-white/70 font-medium max-w-[260px]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.95 }}
      >
        Connecting Businesses. Empowering Our Community.
      </motion.p>

      {/* Loading pulse bar */}
      <motion.div
        className="mt-8 h-1 w-28 rounded-full bg-white/10 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#00A859] to-[#12C06E]"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.4, delay: 1.15, ease: [0.22, 1, 0.36, 1], repeat: Infinity }}
          style={{ width: '55%' }}
        />
      </motion.div>
    </div>
  </div>
);

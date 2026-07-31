import React from 'react';
import { Loader2 } from 'lucide-react';

/** Time splash stays fully visible before fade */
export const SPLASH_VISIBLE_MS = 1800;
/** Fade-out duration */
export const SPLASH_FADE_MS = 400;
export const SPLASH_TOTAL_MS = SPLASH_VISIBLE_MS + SPLASH_FADE_MS;

interface SplashScreenProps {
  fading?: boolean;
}

/** Simple launch splash — logo + loading only */
export const SplashScreen: React.FC<SplashScreenProps> = ({ fading = false }) => (
  <div
    className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0D0906] transition-opacity ease-out ${
      fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}
    id="splash-screen"
    style={{
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      transitionDuration: `${SPLASH_FADE_MS}ms`,
    }}
  >
    <div className="relative z-10 flex flex-col items-center px-8">
      <img
        src="/abn-logo-login-clear.png"
        alt="ABN — Ahlebait Network"
        className="h-[min(42vw,180px)] w-auto max-w-[min(72vw,280px)] object-contain object-center"
        draggable={false}
      />
      <p className="mt-3 text-center text-[10px] font-semibold tracking-[0.18em] uppercase text-[#CFCFCF]">
        Connect <span className="text-[#F08C32]">•</span> Collaborate <span className="text-[#F08C32]">•</span> Grow
      </p>

      <div className="mt-10 flex flex-col items-center gap-3">
        <Loader2 className="w-7 h-7 text-[#F08C32] animate-spin" aria-hidden />
        <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#8E8E8E]">
          Loading
        </p>
      </div>
    </div>
  </div>
);

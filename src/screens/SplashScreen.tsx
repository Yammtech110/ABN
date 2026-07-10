import React from 'react';
import { AbnBrandMark } from '../components/AbnBrandMark';

/** Minimum time splash stays fully visible before transition begins */
export const SPLASH_VISIBLE_MS = 2000;
/** Fade-out duration after the visible window */
export const SPLASH_FADE_MS = 400;
/** Total overlay lifetime — visible window + fade */
export const SPLASH_TOTAL_MS = SPLASH_VISIBLE_MS + SPLASH_FADE_MS;

interface SplashScreenProps {
  fading?: boolean;
}

/** Initial welcome splash — emblem, ABN wordmark, and network tagline on dark canvas */
export const SplashScreen: React.FC<SplashScreenProps> = ({ fading = false }) => (
  <div
    className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0A0705] transition-opacity ease-out ${
      fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}
    id="splash-screen"
    style={{
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      transitionDuration: `${SPLASH_FADE_MS}ms`,
    }}
  >
    <div className="animate-fade-in-up px-6">
      <AbnBrandMark size="splash" />
    </div>
  </div>
);

import React from 'react';
import { WifiOff } from 'lucide-react';

interface OfflineGateProps {
  children: React.ReactNode;
}

/** Blocks the app UI when the device has no network. */
export const OfflineGate: React.FC<OfflineGateProps> = ({ children }) => {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  React.useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-8 text-center"
        id="offline-gate"
        style={{
          background: 'linear-gradient(165deg, #061433 0%, #0A1B4A 50%, #123A7A 100%)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="w-16 h-16 rounded-full border-2 border-white/30 flex items-center justify-center mb-5">
          <WifiOff className="w-8 h-8 text-white" strokeWidth={2} />
        </div>
        <h1 className="text-xl font-black tracking-[0.12em] uppercase text-white mb-2">
          Connect to Internet
        </h1>
        <p className="text-sm text-white/75 max-w-[280px] leading-relaxed">
          No network connection. Please turn on mobile data or Wi‑Fi, then reopen the app.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

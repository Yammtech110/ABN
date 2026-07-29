import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Production APK loads the live web app from Render Static Site.
 * Push to GitHub → Render rebuilds abn-1 → phones get the new UI on next open
 * (no new APK needed for UI/bugfix changes).
 *
 * Native-only changes (plugins, permissions, icons) still need a new APK.
 */
const isProductionApp = process.env.CAPACITOR_PRODUCTION === 'true';

/** Override with CAPACITOR_SERVER_URL if the static site hostname changes */
const LIVE_WEB_URL =
  process.env.CAPACITOR_SERVER_URL?.trim() || 'https://abn-1.onrender.com';

const config: CapacitorConfig = {
  appId: 'com.example.shiabusinessdirectory',
  appName: 'ABN',
  webDir: 'dist',
  server: isProductionApp
    ? {
        url: LIVE_WEB_URL,
        androidScheme: 'https',
        iosScheme: 'https',
        // Allow API + auth redirects from the WebView
        allowNavigation: [
          'abn-1.onrender.com',
          'abn-my4f.onrender.com',
          '*.supabase.co',
          '*.google.com',
          '*.googleapis.com',
        ],
      }
    : {
        androidScheme: 'http',
        cleartext: true,
        iosScheme: 'capacitor',
      },
  android: {
    backgroundColor: '#0A0705',
    allowMixedContent: !isProductionApp,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0A0705',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;

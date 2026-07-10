import type { CapacitorConfig } from '@capacitor/cli';

/** Set CAPACITOR_PRODUCTION=true when building APK for clients worldwide */
const isProductionApp = process.env.CAPACITOR_PRODUCTION === 'true';

const config: CapacitorConfig = {
  appId: 'com.example.shiabusinessdirectory',
  appName: 'ANV',
  webDir: 'dist',
  server: isProductionApp
    ? { androidScheme: 'https' }
    : { androidScheme: 'http', cleartext: true },
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

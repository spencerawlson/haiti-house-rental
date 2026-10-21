import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kayayiti.app',
  appName: 'Kay Ayiti',
  webDir: 'public',
  // Remote-URL mode: the native shells load the live site, same pattern
  // as the Farelune app. No bundled web build; updates ship via the site.
  server: {
    url: 'https://kayayiti.app',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#bae6fd',
    },
  },
};

export default config;

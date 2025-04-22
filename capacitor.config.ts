import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bonaevents.app',
  appName: 'Wave Events',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#FFFFFF"
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FFFFFF'
    }
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;

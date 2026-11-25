import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.icupump.assistant',
  appName: 'ICU泵助手',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0f172a',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;

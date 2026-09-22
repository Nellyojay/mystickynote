import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mystickynote.app',
  appName: 'My Sticky Note',
  webDir: 'dist',

  server: {
    url: 'https://nellyojay.github.io/mystickynote/',
    cleartext: false
  }
};

export default config;

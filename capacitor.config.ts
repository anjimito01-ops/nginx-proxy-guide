import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'jp.soryo.eleven',
  appName: '蒼陵イレブン',
  webDir: 'dist',
  android: {
    // ドット絵を等倍で拡大したときにぼやけないようにする
    backgroundColor: '#0a0a12',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;

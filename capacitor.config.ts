import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 設定
 *
 * webDir 指向 vite 的產出目錄；`vite.config.ts` 已經把 base 設成 './'，
 * 因為 WebView 是用 file:// 載入的，絕對路徑會找不到資源。
 */
const config: CapacitorConfig = {
  appId: 'com.corgidoku.app',
  appName: 'Corgidoku',
  webDir: 'dist',
};

export default config;

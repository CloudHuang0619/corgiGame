/**
 * AdMob 廣告單元 ID
 *
 * 預設全部是 Google 官方的測試單元。用測試 ID 而不是留空字串，是因為
 * 沒有正式 ID 時廣告會直接載入失敗，開發時就看不出版位有沒有排對；
 * 測試 ID 保證每次都回一則假廣告，版面問題當場就會現形。
 *
 * 正式 ID 從 .env 進來（`VITE_ADMOB_*`），不寫死在原始碼裡——iOS 與
 * Android 是兩個不同的 AdMob 應用程式，各自有一組 ID。
 *
 * 要注意：拿真實 ID 在自己手機上點自己的廣告會被 Google 判為無效流量，
 * 所以開發階段就該一直是測試 ID，正式 ID 只在打包正式版時注入。
 */

import { Capacitor } from '@capacitor/core';

/** Google 官方測試單元，任何人都可以用，永遠會回填 */
const TEST = {
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
} as const;

type Slot = keyof typeof TEST.android;

const env = import.meta.env as Record<string, string | undefined>;

/**
 * 只有三個條件同時成立才會用正式 ID：正式建置、該平台該版位的 ID 有設、
 * 而且沒有明確要求強制測試。任何一個不成立就退回測試 ID——寧可少賺一次
 * 曝光，也不要在開發機上污染正式帳號的數據。
 */
export const useTestAds =
  import.meta.env.DEV || env.VITE_ADMOB_FORCE_TEST === 'true';

export function adUnitId(slot: Slot): string {
  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  if (useTestAds) return TEST[platform][slot];

  const key = `VITE_ADMOB_${platform.toUpperCase()}_${slot.toUpperCase()}`;
  return env[key] || TEST[platform][slot];
}

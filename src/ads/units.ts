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

/** 開發模式，或明確要求強制測試 */
const forced = import.meta.env.DEV || env.VITE_ADMOB_FORCE_TEST === 'true';

function platform(): keyof typeof TEST {
  return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
}

/**
 * 一個版位要用的廣告單元，以及這是不是測試廣告。
 *
 * 兩件事必須一起決定，不能分開算。先前把「用哪個 ID」與「isTesting 傳什麼」
 * 拆成兩段邏輯，結果正式建置在沒設定 ID 時退回測試單元，卻仍然對 SDK 宣稱
 * isTesting=false —— 拿測試單元去跑正式請求，數據與行為都對不上。
 *
 * 沒設定正式 ID 時退回測試單元而不是報錯，是因為報錯會讓廣告變成遊戲的
 * 單點故障；但退回時一定要誠實把 isTesting 標成 true，否則就會出現
 * 「安靜地帶著測試單元上架、零收益也零錯誤訊息」這種最難發現的狀況。
 */
export function adUnit(slot: Slot): { readonly id: string; readonly isTesting: boolean } {
  const test = TEST[platform()][slot];
  if (forced) return { id: test, isTesting: true };

  const key = `VITE_ADMOB_${platform().toUpperCase()}_${slot.toUpperCase()}`;
  const real = env[key]?.trim();
  return real ? { id: real, isTesting: false } : { id: test, isTesting: true };
}

/**
 * 這次建置是不是完全沒有正式 ID —— 三個版位都退回測試單元。
 * 用來決定 SDK 的 initializeForTesting，也讓「忘了填 ID」在 log 裡看得見。
 */
export function allTestAds(): boolean {
  return (['banner', 'interstitial', 'rewarded'] as const).every((s) => adUnit(s).isTesting);
}

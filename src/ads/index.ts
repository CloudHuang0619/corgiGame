/**
 * AdMob 串接
 *
 * 這一層存在的理由是「遊戲程式碼不該知道自己跑在哪裡」。網頁版沒有 AdMob，
 * 但 `Game.tsx` 不應該為此到處寫 if——所以每個函式在非原生平台一律安靜地
 * no-op，呼叫端可以無條件呼叫。
 *
 * 每個函式也都自己吞例外。廣告是附加價值，不是遊戲流程的一部分：載入失敗、
 * 沒網路、使用者拒絕追蹤，都只該少一次曝光，絕不該讓玩家卡在通關動畫中間。
 * 這跟 `core/storage.ts` 對存檔的態度是同一個原則。
 */

import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  type AdMobRewardItem,
} from '@capacitor-community/admob';

import { adUnitId, useTestAds } from './units.ts';

const native = () => Capacitor.isNativePlatform();

let ready = false;

/** 記住插頁與獎勵廣告是否已經備妥，避免在還沒 prepare 完就 show */
let interstitialReady = false;
let rewardedReady = false;

/**
 * 初始化，並跑一次 UMP 同意流程。
 *
 * 同意流程必須在載入任何廣告「之前」跑完：歐盟使用者沒表態就送出個人化
 * 廣告請求會違反 GDPR，Google 也會直接擋掉填充。
 */
export async function initAds(): Promise<void> {
  if (!native() || ready) return;
  // 讓 CSS 知道自己在原生殼裡，好為底部橫幅留出空間（見 app.css .native）
  document.documentElement.classList.add('native');
  try {
    await AdMob.initialize({ initializeForTesting: useTestAds });

    const consent = await AdMob.requestConsentInfo();
    if (consent.isConsentFormAvailable && consent.status === 'REQUIRED') {
      await AdMob.showConsentForm();
    }

    // iOS 的 ATT 對話框。Android 沒有這個概念，plugin 會直接回 authorized。
    await AdMob.requestTrackingAuthorization();

    ready = true;
    // 預先備好，玩家真的通關時才不會盯著載入轉圈
    void prepareInterstitial();
    void prepareRewarded();
  } catch (err) {
    console.warn('[ads] 初始化失敗，本次遊玩不顯示廣告', err);
  }
}

/* ---------- 橫幅：遊戲主畫面底部 ---------- */

export async function showBanner(): Promise<void> {
  if (!native()) return;
  try {
    await AdMob.showBanner({
      adId: adUnitId('banner'),
      // 自適應橫幅會依裝置寬度挑高度，比固定 320x50 在大螢幕上不會留白
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: useTestAds,
    });
  } catch (err) {
    console.warn('[ads] 橫幅載入失敗', err);
  }
}

export async function hideBanner(): Promise<void> {
  if (!native()) return;
  try {
    // remove 而不是 hide：離開遊戲畫面後這則廣告就不該再計曝光，
    // 而且留著的話下次進來會沿用舊的請求。
    await AdMob.removeBanner();
  } catch {
    /* 本來就沒有橫幅時會丟例外，忽略即可 */
  }
}

/* ---------- 插頁：通關結算中間 ---------- */

async function prepareInterstitial(): Promise<void> {
  if (!native() || interstitialReady) return;
  try {
    await AdMob.prepareInterstitial({ adId: adUnitId('interstitial'), isTesting: useTestAds });
    interstitialReady = true;
  } catch (err) {
    console.warn('[ads] 插頁預載失敗', err);
  }
}

/**
 * 顯示插頁廣告。回傳的 Promise 在廣告關閉後才 resolve，呼叫端可以用它
 * 把後續的結算動畫接在廣告之後——沒廣告可播時會立刻 resolve，兩條路徑
 * 對呼叫端長得一樣。
 */
export async function showInterstitial(): Promise<void> {
  if (!native()) return;
  if (!interstitialReady) {
    await prepareInterstitial();
    if (!interstitialReady) return;
  }
  try {
    await AdMob.showInterstitial();
  } catch (err) {
    console.warn('[ads] 插頁顯示失敗', err);
  } finally {
    // 一則插頁只能播一次，播完立刻補下一則
    interstitialReady = false;
    void prepareInterstitial();
  }
}

/* ---------- 獎勵式：看廣告換骨頭／道具 ---------- */

async function prepareRewarded(): Promise<void> {
  if (!native() || rewardedReady) return;
  try {
    await AdMob.prepareRewardVideoAd({ adId: adUnitId('rewarded'), isTesting: useTestAds });
    rewardedReady = true;
  } catch (err) {
    console.warn('[ads] 獎勵廣告預載失敗', err);
  }
}

/** 獎勵廣告目前是否播得動——用來決定 UI 上那顆按鈕要不要出現 */
export function isRewardedReady(): boolean {
  return native() && rewardedReady;
}

/**
 * 播獎勵廣告，回傳玩家是否真的看完並拿到獎勵。
 *
 * 只有 `true` 才能發獎勵。中途關掉廣告 plugin 會 resolve 成 null，那時候
 * 發獎勵等於白送——獎勵式廣告的整個交易前提就是「看完才給」。
 */
export async function showRewarded(): Promise<boolean> {
  if (!native()) return false;
  if (!rewardedReady) {
    await prepareRewarded();
    if (!rewardedReady) return false;
  }
  try {
    const reward: AdMobRewardItem | null = await AdMob.showRewardVideoAd();
    return reward != null;
  } catch (err) {
    console.warn('[ads] 獎勵廣告播放失敗', err);
    return false;
  } finally {
    rewardedReady = false;
    void prepareRewarded();
  }
}

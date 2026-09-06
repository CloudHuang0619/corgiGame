/**
 * 柯基動畫的 sprite sheet 設定
 *
 * 播放順序：START →（IDLE → LOOP）→（IDLE → LOOP）→ …
 * START 只在柯基被放下的那一刻播一次，之後就在 IDLE 與 LOOP 之間輪流。
 *
 * 圖檔放在 public/sprites/，用執行期的 URL 載入而不是 import。
 * 這是刻意的：import 會讓「檔案還沒放進來」變成建置失敗，
 * 而執行期載入可以在檔案缺席時安靜地退回手繪版本。
 */

export type SpritePhase = 'start' | 'idle' | 'loop';

export interface SheetSpec {
  readonly file: string;
  /** 影格數 */
  readonly frames: number;
  /** 播放一輪的時間（毫秒）＝ frames / fps */
  readonly durationMs: number;
}

/** 24 FPS，與素材一致 */
export const SHEETS: Record<SpritePhase, SheetSpec> = {
  start: { file: 'corgi-start.png', frames: 24, durationMs: 1000 },
  idle: { file: 'corgi-idle.png', frames: 24, durationMs: 1000 },
  loop: { file: 'corgi-loop.png', frames: 36, durationMs: 1500 },
};

/** START 播完接 IDLE；之後 IDLE 與 LOOP 互相接力 */
export const NEXT_PHASE: Record<SpritePhase, SpritePhase> = {
  start: 'idle',
  idle: 'loop',
  loop: 'idle',
};

/**
 * BASE_URL 而不是寫死 '/'：vite.config 的 base 設成相對路徑，
 * 之後用 Capacitor 包成 App 時資源才找得到。
 */
export function sheetUrl(phase: SpritePhase): string {
  return `${import.meta.env.BASE_URL}sprites/${SHEETS[phase].file}`;
}

/**
 * 檢查 sprite sheet 是否可用。
 *
 * 只探測 idle 這張 —— 三張是一起放進來的，逐張檢查只是多兩次請求。
 * 結果快取在模組層，整個 App 只探測一次。
 */
let probe: Promise<boolean> | null = null;

export function spritesAvailable(): Promise<boolean> {
  if (!probe) {
    probe = new Promise<boolean>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth > 0);
      image.onerror = () => resolve(false);
      image.src = sheetUrl('idle');
    });
  }
  return probe;
}

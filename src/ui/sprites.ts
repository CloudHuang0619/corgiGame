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
  /** 影格總數 */
  readonly frames: number;
  /** 播放一輪的時間（毫秒） */
  readonly durationMs: number;
}

export const SHEETS: Record<SpritePhase, SheetSpec> = {
  start: { file: 'corgi-start.png', frames: 20, durationMs: 500 },
  idle: { file: 'corgi-idle.png', frames: 24, durationMs: 1000 },
  loop: { file: 'corgi-loop.png', frames: 36, durationMs: 1500 },
};

/** START 播完接 IDLE；之後 IDLE 與 LOOP 互相接力 */
export const NEXT_PHASE: Record<SpritePhase, SpritePhase> = {
  start: 'idle',
  idle: 'loop',
  loop: 'idle',
};

/** 量出來的排版：這張圖是幾欄幾排 */
export interface SheetLayout {
  readonly url: string;
  readonly cols: number;
  readonly rows: number;
  readonly durationMs: number;
}

/**
 * BASE_URL 而不是寫死 '/'：vite.config 的 base 設成相對路徑，
 * 之後用 Capacitor 包成 App 時資源才找得到。
 */
export function sheetUrl(phase: SpritePhase): string {
  return `${import.meta.env.BASE_URL}sprites/${SHEETS[phase].file}`;
}

/**
 * 從圖檔的長寬比反推排版。
 *
 * 不把欄數寫死在設定裡，是因為素材的排版會變 —— 同一批動畫可能這次匯出成
 * 單排、下次匯出成兩排，寫死就得跟著改程式，而且改漏了只會得到錯位的畫面，
 * 很難一眼看出原因。
 *
 * 推法：影格是正方形，所以 單格寬 = 圖寬/欄 且 單格高 = 圖高/排，兩者相等
 * 得 欄/排 = 圖寬/圖高。再配合 欄×排 = 影格數，就能解出
 * 欄 = √(影格數 × 圖寬 / 圖高)。
 * 例：20 格、2000×394 的圖 → √(20 × 5.08) ≈ 10.08 → 10 欄 2 排。
 */
function deriveLayout(image: HTMLImageElement, frames: number): { cols: number; rows: number } {
  const ratio = image.naturalWidth / image.naturalHeight;
  const cols = Math.max(1, Math.min(frames, Math.round(Math.sqrt(frames * ratio))));
  const rows = Math.max(1, Math.ceil(frames / cols));
  return { cols, rows };
}

function measure(phase: SpritePhase): Promise<SheetLayout | null> {
  return new Promise((resolve) => {
    const spec = SHEETS[phase];
    const url = sheetUrl(phase);
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth) {
        resolve(null);
        return;
      }
      const { cols, rows } = deriveLayout(image, spec.frames);
      resolve({ url, cols, rows, durationMs: spec.durationMs });
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export type SheetLayouts = Record<SpritePhase, SheetLayout>;

/**
 * 載入三張 sheet 並量出排版。任何一張缺席就整組放棄，改用手繪備援 ——
 * 只有一半的動畫比完全沒有更奇怪。
 *
 * 結果快取在模組層，整個 App 只量一次。
 */
let pending: Promise<SheetLayouts | null> | null = null;

export function loadSheets(): Promise<SheetLayouts | null> {
  if (!pending) {
    pending = Promise.all([measure('start'), measure('idle'), measure('loop')]).then(
      ([start, idle, loop]) => (start && idle && loop ? { start, idle, loop } : null),
    );
  }
  return pending;
}

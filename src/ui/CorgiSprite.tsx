/**
 * Sprite sheet 播放器
 *
 * 用 CSS steps() 逐格播放，而不是每格用 JS 換圖：steps() 走的是合成執行緒，
 * 就算主執行緒正在算求解器也不會掉格。JS 只負責在一段播完時切換到下一段。
 *
 * 逐格原理：
 *   background-size   設成 (影格數 × 100%) 寬，整張圖橫向鋪在格子上
 *   background-position-x 從 0% 動到 100%
 *   steps(N, jump-none) 產生 N 個定格，含頭尾兩端，剛好對上第 1 到第 N 格
 *
 * jump-none 是關鍵，不能寫成單純的 steps(N)。position-x 從 0% 到 100% 實際
 * 只跨越 N-1 個影格寬（0% 是第一格靠左、100% 是最後一格靠右），steps(N) 會
 * 把它切成 N 等份、每份 (N-1)/N 格，於是每一格都停在兩張圖中間，而且最後
 * 一格永遠顯示不到。jump-none 改成切 N-1 等份但輸出 N 個值，剛好落在格線上。
 *
 * 用百分比而不是像素，所以同一份程式碼在 6×6 的大格子和 9×9 的小格子上
 * 都正確，不必知道實際尺寸。
 */

import { useEffect, useState } from 'react';

import { NEXT_PHASE, SHEETS, sheetUrl } from './sprites.ts';
import type { SpritePhase } from './sprites.ts';

interface CorgiSpriteProps {
  readonly className?: string;
  /**
   * 靜態模式：只顯示 IDLE 的第一格，不播動畫。
   * 給頂欄與結算畫面用 —— 那些地方會出現好幾隻，一起動很吵。
   */
  readonly still?: boolean;
}

export function CorgiSprite({ className, still = false }: CorgiSpriteProps) {
  const [phase, setPhase] = useState<SpritePhase>('start');

  // 預先把另外兩張載進快取，切換時才不會閃一下白
  useEffect(() => {
    if (still) return;
    for (const next of ['idle', 'loop'] as const) {
      const image = new Image();
      image.src = sheetUrl(next);
    }
  }, [still]);

  const active: SpritePhase = still ? 'idle' : phase;
  const sheet = SHEETS[active];

  return (
    <div
      className={[className, 'corgi-sprite', still ? 'is-still' : ''].filter(Boolean).join(' ')}
      aria-hidden="true"
      style={{
        backgroundImage: `url("${sheetUrl(active)}")`,
        backgroundSize: `${sheet.frames * 100}% 100%`,
        /*
         * 三段用三個不同名字的 keyframes（內容其實一樣）。
         * START 與 IDLE 都是 24 格、同樣長度，若共用同一個 animation-name，
         * 切換時瀏覽器會認為動畫沒變而不重播，第二段就永遠不會動。
         */
        animation: still
          ? undefined
          : `sprite-play-${active} ${sheet.durationMs}ms steps(${sheet.frames}, jump-none) 1 both`,
      }}
      onAnimationEnd={() => {
        if (!still) setPhase((current) => NEXT_PHASE[current]);
      }}
    />
  );
}

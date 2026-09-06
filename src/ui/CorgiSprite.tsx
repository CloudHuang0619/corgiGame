/**
 * Sprite sheet 播放器
 *
 * 用 CSS steps() 逐格播放，而不是每格用 JS 換圖：steps() 走的是合成執行緒，
 * 就算主執行緒正在算求解器也不會掉格。JS 只負責在一段播完時切換到下一段。
 *
 * 逐格原理（支援多排排版）：
 *   background-size  設成 (欄×100%) × (排×100%)，整張圖鋪在格子上
 *   sprite-x         橫向從 0% 走到 100%，一排走一輪，總共重複「排數」次
 *   sprite-y         縱向從 0% 走到 100%，把整段時間切成「排數」個定格
 *
 * jump-none 是關鍵，不能寫成單純的 steps(N)。position 從 0% 到 100% 實際只
 * 跨越 N-1 個影格寬（0% 是第一格靠左、100% 是最後一格靠右），steps(N) 會把
 * 它切成 N 等份、每份 (N-1)/N 格，於是每一格都停在兩張圖中間，而且最後一格
 * 永遠顯示不到。jump-none 改成切 N-1 等份但輸出 N 個值，剛好落在格線上。
 *
 * 全部用百分比而不是像素，所以同一份程式碼在 6×6 的大格子和 9×9 的小格子上
 * 都正確，不必知道實際尺寸。
 */

import { useEffect, useState } from 'react';

import { NEXT_PHASE, loadSheets } from './sprites.ts';
import type { SheetLayouts, SpritePhase } from './sprites.ts';

interface CorgiSpriteProps {
  readonly sheets: SheetLayouts;
  readonly className?: string;
  /**
   * 靜態模式：只顯示 IDLE 的第一格，不播動畫。
   * 給頂欄與結算畫面用 —— 那些地方會出現好幾隻，一起動很吵。
   */
  readonly still?: boolean;
}

export function CorgiSprite({ sheets, className, still = false }: CorgiSpriteProps) {
  const [phase, setPhase] = useState<SpritePhase>('start');

  // 讓瀏覽器先把三張圖放進快取，切換段落時才不會閃一下
  useEffect(() => {
    void loadSheets();
  }, []);

  const active: SpritePhase = still ? 'idle' : phase;
  const layout = sheets[active];
  const { cols, rows, durationMs } = layout;

  /*
   * 多排時要兩條動畫；單排就只有橫向那條。
   * steps(1, jump-none) 是無效語法，所以 rows === 1 必須整條省略。
   */
  const animation = still
    ? undefined
    : rows > 1
      ? `sprite-x ${durationMs / rows}ms steps(${cols}, jump-none) ${rows} both, ` +
        `sprite-y ${durationMs}ms steps(${rows}, jump-none) 1 both`
      : `sprite-x ${durationMs}ms steps(${cols}, jump-none) 1 both`;

  // 兩條動畫會各發一次 animationend，只認其中一條才不會把段落推進兩次
  const finishSignal = rows > 1 ? 'sprite-y' : 'sprite-x';

  return (
    <div
      /*
       * key 掛 phase：三段共用同一組 keyframes 名稱，靠重新掛載強制重播。
       * 若沿用同一個元素，瀏覽器會認為 animation-name 沒變而不重新開始，
       * 第二段就永遠停在第一格。
       */
      key={active}
      className={[className, 'corgi-sprite', still ? 'is-still' : ''].filter(Boolean).join(' ')}
      aria-hidden="true"
      style={{
        backgroundImage: `url("${layout.url}")`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        animation,
      }}
      onAnimationEnd={(event) => {
        if (still) return;
        if (event.animationName !== finishSignal) return;
        setPhase((current) => NEXT_PHASE[current]);
      }}
    />
  );
}

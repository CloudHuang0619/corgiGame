/**
 * 柯基
 *
 * 這一層只做調度：public/sprites/ 底下有素材就播 sprite sheet，
 * 沒有就退回手繪的 SVG（CorgiDrawing）。
 *
 * 之所以做成執行期偵測而不是建置期決定，是因為素材與程式碼的時程分開 ——
 * 圖還沒交、或路徑打錯，遊戲都該照常能玩，只是柯基長得樸素一點。
 */

import { useEffect, useState } from 'react';

import { CorgiDrawing } from './CorgiDrawing.tsx';
import { CorgiSprite } from './CorgiSprite.tsx';
import { spritesAvailable } from './sprites.ts';

interface CorgiProps {
  /** 已放好但違規時換成警示色（僅手繪版支援） */
  readonly variant?: 'normal' | 'conflict' | 'ghost';
  readonly className?: string;
  /** 播放 START → IDLE → LOOP。頂欄與結算畫面用靜態的就好 */
  readonly animated?: boolean;
}

export function Corgi({ variant = 'normal', className, animated = false }: CorgiProps) {
  const [hasSprites, setHasSprites] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void spritesAvailable().then((ok) => {
      if (alive) setHasSprites(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 還在偵測時先畫手繪版，避免第一幀空白閃一下
  if (hasSprites) {
    return <CorgiSprite className={className} still={!animated} />;
  }
  return <CorgiDrawing variant={variant} className={className} />;
}

/**
 * 通關慶祝序列
 *
 * 規格把結算拆成好幾拍依序播放，而不是一次全部丟出來。這個節奏是有作用的：
 * 先讓玩家看到分數跳到最終值，再看到骨頭入帳，最後才是慶祝畫面 ——
 * 每一段獎勵都被單獨看見一次，比全部擠在同一個對話框裡有份量。
 *
 * 原版的完整序列約 20 秒，中間夾了排行榜浮層與插頁廣告。排行榜要後端，
 * 這一版沒有；插頁廣告已經接上（見 src/ads），插在最後一拍與慶祝畫面之間，
 * 由 Game.tsx 觸發。扣掉排行榜之後節奏壓縮成 3.2 秒。
 */

import { useEffect, useMemo, useState } from 'react';

import { Bone } from './Bone.tsx';
import type { Translate } from '../i18n/index.ts';

export type ClearStage = 'score' | 'bones' | 'toast' | 'celebration';

/** 每一拍開始的時間點（毫秒）。 */
const TIMELINE: { at: number; stage: ClearStage }[] = [
  { at: 0, stage: 'score' },
  { at: 800, stage: 'bones' },
  { at: 1600, stage: 'toast' },
  { at: 3200, stage: 'celebration' },
];

/** 驅動整段序列，回傳目前走到哪一拍。 */
export function useClearSequence(active: boolean): ClearStage | null {
  const [stage, setStage] = useState<ClearStage | null>(null);

  useEffect(() => {
    if (!active) {
      setStage(null);
      return;
    }
    const timers = TIMELINE.map(({ at, stage: next }) =>
      window.setTimeout(() => setStage(next), at),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [active]);

  return stage;
}

/** 分數處噴發的星光。 */
export function Sparkles() {
  // 角度與距離先算好並固定下來，重繪時才不會每一格都換位置
  const bits = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
        const distance = 26 + Math.random() * 22;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          delay: Math.random() * 120,
        };
      }),
    [],
  );

  return (
    <span className="sparkles" aria-hidden="true">
      {bits.map((bit, i) => (
        <i
          key={i}
          style={{
            // 用自訂屬性把終點交給 keyframes，才不必為每一顆各寫一組動畫
            ['--dx' as string]: `${bit.x}px`,
            ['--dy' as string]: `${bit.y}px`,
            animationDelay: `${bit.delay}ms`,
          }}
        />
      ))}
    </span>
  );
}

/** 骨頭入帳：由 0 滾到剩餘數。 */
export function BoneTally({ count, label }: { count: number; label: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (count <= 0) return;
    let current = 0;
    const id = window.setInterval(() => {
      current += 1;
      setShown(current);
      if (current >= count) window.clearInterval(id);
    }, 260);
    return () => window.clearInterval(id);
  }, [count]);

  return (
    <div className="bone-tally" role="status">
      <Bone className="life-bone" />
      <span className="bone-tally-count">+{shown}</span>
      <span className="bone-tally-label">{label}</span>
    </div>
  );
}

export function ClearToast({ t }: { t: Translate }) {
  return (
    <div className="clear-toast" role="status">
      <span aria-hidden="true">🐾</span>
      {t('clear.toast')}
    </div>
  );
}

/**
 * 彩帶。
 *
 * 每一片的顏色、起點、飄落時間、旋轉都先隨機決定好，再交給同一組 keyframes
 * 播放 —— 這樣只需要一段 CSS 動畫就能做出各自不同的落法，不必產生幾十組。
 */
export function Confetti({ pieces = 28 }: { pieces?: number }) {
  const colours = ['#E48722', '#F0C043', '#5FBF6A', '#3BABB9', '#EC81DF', '#7C65D1'];

  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, () => ({
        left: Math.random() * 100,
        colour: colours[Math.floor(Math.random() * colours.length)]!,
        delay: Math.random() * 900,
        duration: 1600 + Math.random() * 1200,
        drift: (Math.random() - 0.5) * 90,
        spin: 360 + Math.random() * 540,
        width: 5 + Math.random() * 5,
        height: 9 + Math.random() * 7,
      })),
    // colours 是常數陣列，只需要在片數改變時重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pieces],
  );

  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((bit, i) => (
        <i
          key={i}
          style={{
            left: `${bit.left}%`,
            width: `${bit.width}px`,
            height: `${bit.height}px`,
            background: bit.colour,
            animationDelay: `${bit.delay}ms`,
            animationDuration: `${bit.duration}ms`,
            ['--drift' as string]: `${bit.drift}px`,
            ['--spin' as string]: `${bit.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * 關卡結算
 *
 * 評價分級依剩餘骨頭數：三根全留＝無懈可擊。原版只觀察到最高一級的文案，
 * 另外兩級是照同樣語氣補的。
 *
 * 排行榜浮層要後端，這裡不做。插頁廣告在這個對話框「打開之前」播完
 * （見 Game.tsx），所以這裡也不必知道廣告的存在。
 */

import { Bone } from '../Bone.tsx';
import { Confetti } from '../ClearSequence.tsx';
import { Corgi } from '../Corgi.tsx';
import type { Translate } from '../../i18n/index.ts';
import { MAX_LIVES } from '../../core/game.ts';
import { Dialog } from './Dialog.tsx';

interface ClearDialogProps {
  readonly open: boolean;
  readonly t: Translate;
  readonly score: number;
  readonly livesLeft: number;
  readonly nextLevel: number | null;
  readonly onNext: () => void;
  readonly onClose: () => void;
}

export function ClearDialog({
  open,
  t,
  score,
  livesLeft,
  nextLevel,
  onNext,
  onClose,
}: ClearDialogProps) {
  const tier = livesLeft >= MAX_LIVES ? 'flawless' : livesLeft === 1 ? 'close' : 'good';

  return (
    <Dialog open={open} title={t(`clear.${tier}` as const)} onClose={onClose}>
      <div className="clear">
        <Confetti />
        <div className="clear-corgis">
          <Corgi />
          <Corgi />
          <Corgi />
        </div>

        <p className="clear-score">{score.toLocaleString()}</p>
        <p className="clear-sub">{t(`clear.${tier}Sub` as const)}</p>

        <div className="clear-bones">
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <Bone key={i} spent={i >= livesLeft} className="life-bone" />
          ))}
          <span>{t('clear.bonesEarned', { n: livesLeft })}</span>
        </div>

        {nextLevel === null ? (
          <p className="clear-sub">{t('clear.allDone')}</p>
        ) : (
          <button type="button" className="btn btn-primary btn-block" onClick={onNext}>
            {t('clear.next', { level: nextLevel })}
          </button>
        )}
      </div>
    </Dialog>
  );
}

import { Bone } from '../Bone.tsx';
import type { Translate } from '../../i18n/index.ts';
import { MAX_LIVES } from '../../core/game.ts';
import { Dialog } from './Dialog.tsx';

interface FailDialogProps {
  readonly open: boolean;
  readonly t: Translate;
  readonly onRetry: () => void;
  readonly onClose: () => void;
  /** 看廣告續命。沒有廣告可播時傳 null，按鈕就整顆不出現 */
  readonly onWatchAd: (() => void) | null;
}

export function FailDialog({ open, t, onRetry, onClose, onWatchAd }: FailDialogProps) {
  return (
    <Dialog open={open} title={t('fail.title')} onClose={onClose}>
      <div className="fail">
        <div className="fail-bones">
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <Bone key={i} spent />
          ))}
        </div>
        <p className="fail-lead">{t('fail.body')}</p>
        <p className="fail-tip">{t('fail.tip')}</p>
        {/*
          * 續命擺在重來上面，但用次要樣式：它是這裡比較有價值的選項，
          * 不該要玩家去找；可是主鈕留給「再試一次」，才不會讓人覺得
          * 不看廣告就沒得玩。
          */}
        {onWatchAd && (
          <button type="button" className="btn btn-block" onClick={onWatchAd}>
            {t('fail.watchAd')}
          </button>
        )}
        <button type="button" className="btn btn-primary btn-block" onClick={onRetry}>
          {t('fail.retry')}
        </button>
      </div>
    </Dialog>
  );
}

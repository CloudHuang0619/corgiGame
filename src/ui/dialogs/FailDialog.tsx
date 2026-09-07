import { Bone } from '../Bone.tsx';
import type { Translate } from '../../i18n/index.ts';
import { MAX_LIVES } from '../../core/game.ts';
import { Dialog } from './Dialog.tsx';

interface FailDialogProps {
  readonly open: boolean;
  readonly t: Translate;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}

export function FailDialog({ open, t, onRetry, onClose }: FailDialogProps) {
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
        <button type="button" className="btn btn-primary btn-block" onClick={onRetry}>
          {t('fail.retry')}
        </button>
      </div>
    </Dialog>
  );
}

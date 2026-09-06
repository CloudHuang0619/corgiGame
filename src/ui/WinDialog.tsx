import { formatTime } from '../core/game.ts';
import { Corgi } from './Corgi.tsx';
import { Dialog } from './Dialog.tsx';

interface WinDialogProps {
  readonly open: boolean;
  readonly elapsedMs: number;
  readonly hintsUsed: number;
  readonly isNewBest: boolean;
  readonly hasNext: boolean;
  readonly onNext: () => void;
  readonly onReplay: () => void;
  readonly onClose: () => void;
}

export function WinDialog({
  open,
  elapsedMs,
  hintsUsed,
  isNewBest,
  hasNext,
  onNext,
  onReplay,
  onClose,
}: WinDialogProps) {
  return (
    <Dialog open={open} title="全部就位！" onClose={onClose}>
      <div className="win">
        <div className="win-corgis">
          <Corgi />
          <Corgi />
          <Corgi />
        </div>
        <p className="win-time">
          {formatTime(elapsedMs)}
          {isNewBest && <span className="win-best">新紀錄</span>}
        </p>
        <p className="win-meta">
          {hintsUsed === 0 ? '沒有用提示，漂亮。' : `用了 ${hintsUsed} 次提示。`}
        </p>
        <div className="win-actions">
          <button type="button" className="btn btn-ghost" onClick={onReplay}>
            再玩一次
          </button>
          {hasNext && (
            <button type="button" className="btn btn-primary" onClick={onNext}>
              下一關
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

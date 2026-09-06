import { Bone } from './Bone.tsx';
import { Dialog } from './Dialog.tsx';

interface FailDialogProps {
  readonly open: boolean;
  readonly onRetry: () => void;
  readonly onReveal: () => void;
  readonly onClose: () => void;
}

export function FailDialog({ open, onRetry, onReveal, onClose }: FailDialogProps) {
  return (
    <Dialog open={open} title="骨頭用完了" onClose={onClose}>
      <div className="fail">
        <div className="fail-bones">
          <Bone spent />
          <Bone spent />
          <Bone spent />
        </div>
        <p className="fail-lead">三次都放錯了，這一關要重來。</p>
        <p className="fail-tip">
          下次放柯基之前，先把同列、同欄、同色區與周圍八格都標上叉號。
          能確定的位置才放，剩下的先留白。
        </p>
        <div className="fail-actions">
          <button type="button" className="btn btn-ghost" onClick={onReveal}>
            看答案
          </button>
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            再試一次
          </button>
        </div>
      </div>
    </Dialog>
  );
}

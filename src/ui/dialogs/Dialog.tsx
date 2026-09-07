import { useEffect, useRef } from 'react';

interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}

/**
 * 用原生 <dialog> 而不是自刻 overlay：焦點鎖定、Esc 關閉、
 * 以及和頁面其他內容的無障礙隔離都由瀏覽器處理好了。
 */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onCancel={onClose} onClose={onClose}>
      <div className="dialog-head">
        <h2>{title}</h2>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="關閉">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6 L18 18 M18 6 L6 18"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}

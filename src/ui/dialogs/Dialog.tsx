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
 *
 * 關閉時不渲染內容。這不只是省一點記憶體 —— 內容若一直掛在那裡，裡面的
 * 進場動畫會在對話框還沒打開時就播完（結算的彩帶就踩過這個坑），
 * 而且隱藏的內容仍會留在無障礙樹裡。
 */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  /*
   * 原生 <dialog> 的 close 事件在「任何」關閉時都會觸發，包括我們自己因為
   * open 變 false 而呼叫的 node.close()。不區分的話，從一個對話框切到另一個
   * 會互相踩：設定→選關卡時，setDialog('levels') 讓設定的 open 變 false，
   * 它關閉時回呼 onClose 又把狀態設回 null，選關卡於是從沒顯示過。
   *
   * 用一個旗標標記「這次是程式主動關的」，只有使用者按 Esc、點背景或按叉號
   * 才往上通知。
   */
  const closingSelf = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) {
      closingSelf.current = true;
      node.close();
    }
  }, [open]);

  const handleNativeClose = (): void => {
    if (closingSelf.current) {
      closingSelf.current = false;
      return;
    }
    onClose();
  };

  return (
    <dialog ref={ref} className="dialog" onClose={handleNativeClose}>
      {open && (
        <>
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
        </>
      )}
    </dialog>
  );
}

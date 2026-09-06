interface ToolbarProps {
  readonly onLevels: () => void;
  readonly onHint: () => void;
  readonly onUndo: () => void;
  readonly onRestart: () => void;
  readonly onReveal: () => void;
  readonly onRules: () => void;
  readonly canUndo: boolean;
  readonly revealed: boolean;
}

interface ToolButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}

function ToolButton({ label, onClick, disabled, children }: ToolButtonProps) {
  return (
    <button type="button" className="tool" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      {children}
    </button>
  );
}

export function Toolbar({
  onLevels,
  onHint,
  onUndo,
  onRestart,
  onReveal,
  onRules,
  canUndo,
  revealed,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <ToolButton label="選擇關卡" onClick={onLevels}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </svg>
      </ToolButton>

      <ToolButton label="提示" onClick={onHint}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18h6M10 21h4" strokeLinecap="round" />
          <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" />
        </svg>
      </ToolButton>

      <ToolButton label="復原" onClick={onUndo} disabled={!canUndo}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 9h11a5 5 0 0 1 0 10h-6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 5 4 9l4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolButton>

      <ToolButton label="重新開始" onClick={onRestart}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 12a8 8 0 1 1-2.3-5.7" strokeLinecap="round" />
          <path d="M20 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolButton>

      <ToolButton label={revealed ? '收起答案' : '看答案'} onClick={onReveal}>
        {revealed ? (
          // 已攤開時換成劃掉的眼睛，一眼看得出再按一次是收起來
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8M9.4 5.4A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7 0 1-.7 2.3-1.8 3.5M6.5 6.9C4.4 8.3 3 10.4 3 12c0 2.5 4 7 9 7 1.4 0 2.7-.3 3.8-.9"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12c0-2.5 4-7 9-7s9 4.5 9 7-4 7-9 7-9-4.5-9-7Z" />
            <circle cx="12" cy="12" r="2.6" />
          </svg>
        )}
      </ToolButton>

      <ToolButton label="遊戲規則" onClick={onRules}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.2a2.6 2.6 0 1 1 3.3 2.5c-.5.2-.8.7-.8 1.2v.6" strokeLinecap="round" />
          <circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </ToolButton>
    </div>
  );
}

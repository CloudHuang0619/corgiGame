interface ToolbarProps {
  readonly onLevels: () => void;
  readonly onHint: () => void;
  readonly onUndo: () => void;
  readonly onRestart: () => void;
  readonly onRules: () => void;
  readonly canUndo: boolean;
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

export function Toolbar({ onLevels, onHint, onUndo, onRestart, onRules, canUndo }: ToolbarProps) {
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

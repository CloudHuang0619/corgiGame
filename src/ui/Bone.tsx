/**
 * 骨頭 —— 命數指示器。
 *
 * 用掉的骨頭不移除，只轉成灰色留在原位：玩家一眼就看得出「本來有三根、
 * 現在剩幾根」，比直接消失更好讀。
 *
 * 畫法是疊兩層而不是描邊：骨頭由四個圓加一根橫桿組成，直接描邊會在圖形
 * 交疊處露出內部接縫。所以先畫大一號的深色形狀當外框，再疊一層小一點的
 * 淺色形狀，交界自然被蓋掉。
 */

interface BoneProps {
  readonly spent?: boolean;
  readonly className?: string;
}

export function Bone({ spent = false, className }: BoneProps) {
  const outline = spent ? '#bcaea1' : '#c08c4e';
  const fill = spent ? '#ddd4ca' : '#f8efe1';

  return (
    <svg viewBox="0 0 48 26" className={className} aria-hidden="true">
      <g fill={outline}>
        <circle cx="9" cy="8" r="7.5" />
        <circle cx="9" cy="18" r="7.5" />
        <circle cx="39" cy="8" r="7.5" />
        <circle cx="39" cy="18" r="7.5" />
        <rect x="9" y="6" width="30" height="14" rx="7" />
      </g>
      <g fill={fill}>
        <circle cx="9" cy="8" r="5.6" />
        <circle cx="9" cy="18" r="5.6" />
        <circle cx="39" cy="8" r="5.6" />
        <circle cx="39" cy="18" r="5.6" />
        <rect x="9" y="8.4" width="30" height="9.2" rx="4.6" />
      </g>
    </svg>
  );
}

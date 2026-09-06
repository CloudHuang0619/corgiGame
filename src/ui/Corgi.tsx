/**
 * 柯基頭像
 *
 * 用 SVG 而不是圖檔或 emoji：格子大小會隨盤面（6×6 到 9×9）和螢幕寬度變動，
 * 向量在任何尺寸都清楚，也不用多打一次網路請求。
 */

interface CorgiProps {
  /** 已放好但違規時，整隻換成警示色 */
  readonly variant?: 'normal' | 'conflict' | 'ghost';
  readonly className?: string;
}

export function Corgi({ variant = 'normal', className }: CorgiProps) {
  const fur = variant === 'conflict' ? '#d9705b' : '#dd9a55';
  const furDark = variant === 'conflict' ? '#bd5945' : '#c07f3c';
  const cream = '#fff6ec';
  const ink = '#43302a';

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      style={{ opacity: variant === 'ghost' ? 0.35 : 1 }}
    >
      {/* 耳朵：柯基的招牌大三角立耳，用 round linejoin 讓尖角圓潤一點 */}
      <path
        d="M24 44 L15 9 L45 27 Z"
        fill={fur}
        stroke={fur}
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <path
        d="M76 44 L85 9 L55 27 Z"
        fill={fur}
        stroke={fur}
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <path d="M27 40 L21 19 L39 30 Z" fill="#eeb0a6" stroke="#eeb0a6" strokeWidth="3" strokeLinejoin="round" />
      <path d="M73 40 L79 19 L61 30 Z" fill="#eeb0a6" stroke="#eeb0a6" strokeWidth="3" strokeLinejoin="round" />

      {/* 臉 */}
      <ellipse cx="50" cy="57" rx="33" ry="29" fill={fur} />

      {/* 臉中央的白色斑紋 + 白嘴吻，柯基臉最好認的特徵 */}
      <path d="M50 28 Q42 44 44 60 L56 60 Q58 44 50 28 Z" fill={cream} />
      <ellipse cx="50" cy="68" rx="22" ry="15" fill={cream} />
      <ellipse cx="22" cy="66" rx="9" ry="10" fill={cream} opacity="0.85" />
      <ellipse cx="78" cy="66" rx="9" ry="10" fill={cream} opacity="0.85" />

      {/* 眼睛 */}
      <ellipse cx="36" cy="53" rx="4.6" ry="5.2" fill={ink} />
      <ellipse cx="64" cy="53" rx="4.6" ry="5.2" fill={ink} />
      <circle cx="37.6" cy="51.2" r="1.6" fill="#fff" />
      <circle cx="65.6" cy="51.2" r="1.6" fill="#fff" />

      {/* 鼻子與嘴 */}
      <path d="M44 62 Q50 58 56 62 Q50 68 44 62 Z" fill={ink} />
      <path
        d="M50 67 L50 71 M50 71 Q45 76 41 71 M50 71 Q55 76 59 71"
        stroke={ink}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* 腮紅 */}
      <ellipse cx="27" cy="60" rx="5" ry="3.4" fill={furDark} opacity="0.35" />
      <ellipse cx="73" cy="60" rx="5" ry="3.4" fill={furDark} opacity="0.35" />
    </svg>
  );
}

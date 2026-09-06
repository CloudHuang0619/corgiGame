/**
 * 柯基
 *
 * 手繪貼紙風。第一版是用橢圓和圓形拼出來的，結果看起來像企業吉祥物，
 * 因為幾何元件的弧度是固定的，而手繪線條的曲率一路都在變。
 *
 * 所以這一版改變作法：
 *
 *   連續輪廓  頭和兩隻耳朵是一條 path 一筆畫完，不是三個形狀疊在一起。
 *             交界處沒有接縫，輪廓才會有流動感。
 *   不對稱    左耳比右耳高一點、角度也不同；頭的左右控制點不等距。
 *             手繪的味道就來自這些歪斜。
 *   細描邊    主輪廓 2.4、內部線條 1.6。粗描邊會把圖形壓成貼標。
 *   小圓點眼  不加高光。加了就變成卡通角色，不是插畫。
 *   奶油打底  底色是奶油，橘色是覆在上面的斑塊，不是反過來。
 *
 * 構圖是「趴上窗台往外看」：兩隻前腳搭在下緣，頭從中間探出來。
 * 這個姿勢配合 START 動畫（從格子下方彈上來）最自然。
 *
 * corgi-root 與 corgi-head 分兩層是為了動畫各管各的：root 負責整隻彈出，
 * head 負責之後的嗅聞，身體與前腳留在原地不動。
 */

interface CorgiProps {
  /** 已放好但違規時換成警示色 */
  readonly variant?: 'normal' | 'conflict' | 'ghost';
  readonly className?: string;
}

/** 頭與雙耳的連續輪廓，也拿來當底色形狀 */
const HEAD_OUTLINE =
  'M28 42 C22 34 17 22 20 16 C29 16 40 24 46 32 C48.5 30.5 52 30.5 54.5 32 ' +
  'C61 23 72 15 80 16 C83 22 78 34 72 42 C81 47 86 56 84 66 ' +
  'C81 77 67 83 50 83 C33 83 19 77 16 66 C14 56 19 47 28 42 Z';

/** 橘色斑塊：耳朵、頭頂與兩頰，中間留出白斑的缺口 */
const ORANGE_PATCH =
  'M28 42 C22 34 17 22 20 16 C29 16 40 24 46 32 C48.5 30.5 52 30.5 54.5 32 ' +
  'C61 23 72 15 80 16 C83 22 78 34 72 42 C78 46 82.5 52 84 59 ' +
  'C77 55 69 55.5 65 60 C63 50 60 42 56.5 36 C58 45 58.5 52 58 58 ' +
  'L42 58 C41.5 52 42 45 43.5 36 C40 42 37 50 35 60 ' +
  'C31 55.5 23 55 16 59.5 C17.5 52 22 46 28 42 Z';

export function Corgi({ variant = 'normal', className }: CorgiProps) {
  const conflict = variant === 'conflict';

  const ink = conflict ? '#8a3b28' : '#7a4a24'; // 描邊：暖棕，不用黑
  const fur = conflict ? '#d9694f' : '#e58a45'; // 橘斑
  const cream = conflict ? '#fbe9e2' : '#fdf3e2'; // 底色，帶米黃才不死白
  const dark = conflict ? '#6b2a1c' : '#5b3a1c'; // 眼鼻
  const ear = conflict ? '#e3a196' : '#eeb08c'; // 耳內
  const tongue = '#f2909a';

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      style={{ opacity: variant === 'ghost' ? 0.4 : 1, overflow: 'visible' }}
    >
      <g
        className="corgi-root"
        stroke={ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <g className="corgi-head">
          {/* 奶油底 */}
          <path d={HEAD_OUTLINE} fill={cream} />

          {/* 橘斑蓋在底色上，只描細邊；輪廓交給下面那層補回來 */}
          <path d={ORANGE_PATCH} fill={fur} strokeWidth="1.6" />

          {/* 耳內。左右形狀不同，跟外耳一樣刻意不對稱 */}
          <path d="M31 37 C27 31 23 24 24 20 C30 21 37 27 41 33 C37 34 33 35.5 31 37 Z" fill={ear} strokeWidth="1.4" />
          <path d="M69 38 C73 32 77 25 76 21 C70 22 63 27 59 33 C63 35 66.5 36.5 69 38 Z" fill={ear} strokeWidth="1.4" />

          {/* 舌頭藏在嘴吻底下，只有 START 動畫會把它探出來 */}
          <path
            className="corgi-tongue"
            d="M45.5 66 Q50 64 54.5 66 L54.5 79 Q50 84 45.5 79 Z"
            fill={tongue}
            strokeWidth="1.6"
          />

          {/* 嘴吻：一團鬆的圓，左右不等寬 */}
          <path
            d="M50 55 C59 55 66.5 59.5 65.5 66 C64.5 72.5 58 76 49.5 76 C41 76 34.5 72 33.5 66 C32.5 59.5 41 55 50 55 Z"
            fill={cream}
            strokeWidth="1.6"
          />

          {/* 眼睛：單純的深色圓點 */}
          <ellipse cx="39" cy="51" rx="3" ry="3.6" fill={dark} stroke="none" />
          <ellipse cx="61" cy="50.4" rx="3" ry="3.6" fill={dark} stroke="none" />

          {/* 鼻子與嘴 */}
          <path d="M47 62 C48.2 60 51.8 60 53 62 C51.8 65 48.2 65 47 62 Z" fill={dark} strokeWidth="1.4" />
          <path
            d="M50 64.5 L50 67 M50 67 C48.8 70 46.2 69.6 45.4 67.2 M50 67 C51.2 70 53.8 69.6 54.6 67.2"
            fill="none"
            strokeWidth="1.6"
          />

          {/* 外輪廓最後再描一次，把被橘斑細線切斷的地方接回來 */}
          <path d={HEAD_OUTLINE} fill="none" />
        </g>

        {/* 胸口 —— 墊在兩隻前腳後面 */}
        <path d="M37 101 C37 87 43 84 50 84 C57 84 63 87 63 101 Z" fill={cream} strokeWidth="2" />

        {/* 前腳：矮圓的小肉墊，一道趾縫就夠。左右高度略差 */}
        <path d="M24 101 L24 92 C24 86.5 27.5 84 32 84 C36.5 84 40 86.5 40 92 L40 101 Z" fill={cream} />
        <path d="M60 101 L60 93 C60 87.5 63.5 85 68 85 C72.5 85 76 87.5 76 93 L76 101 Z" fill={cream} />
        <path d="M32 91 C32 93.5 32 95 32 96.5" fill="none" strokeWidth="1.5" />
        <path d="M68 92 C68 94.5 68 96 68 97.5" fill="none" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

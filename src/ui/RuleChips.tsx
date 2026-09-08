/**
 * 規則卡
 *
 * 三張常駐的小卡，各附一張 3×3 迷你示意圖。示意圖比文字有效 ——
 * 「不能相鄰」用畫的一眼就懂，用讀的還要想一下含不含對角。
 *
 * 違規時對應的卡會高亮，讓玩家知道是哪一條擋住了。
 */

import type { RuleId } from '../core/types.ts';
import { RuleId as R } from '../core/types.ts';
import type { Translate } from '../i18n/index.ts';

interface RuleChipsProps {
  readonly t: Translate;
  /** 要高亮的規則。null 表示都不高亮。 */
  readonly highlight: RuleId | null;
  /** 關卡進場時整列閃一次外框，引導玩家注意規則 */
  readonly pulse?: boolean;
  /**
   * 疊加型盤面。「每行每列各一隻」在複合圖上是錯的 —— 一整列跨越兩個
   * 子盤面，兩邊各要一隻 —— 所以那條規則要換句話說。
   */
  readonly composite?: boolean;
}

const CELL = 11;
const GAP = 2;

function MiniBoard({ children }: { children: React.ReactNode }) {
  const span = CELL * 3 + GAP * 2;
  return (
    <svg viewBox={`0 0 ${span} ${span}`} className="chip-mini" aria-hidden="true">
      {children}
    </svg>
  );
}

function MiniCell({ r, c, fill }: { r: number; c: number; fill: string }) {
  return (
    <rect
      x={c * (CELL + GAP)}
      y={r * (CELL + GAP)}
      width={CELL}
      height={CELL}
      rx={3}
      fill={fill}
    />
  );
}

/** 迷你圖裡的柯基就用一個深色圓點代表，這個尺寸畫不出臉。 */
function MiniDot({ r, c }: { r: number; c: number }) {
  return (
    <circle
      cx={c * (CELL + GAP) + CELL / 2}
      cy={r * (CELL + GAP) + CELL / 2}
      r={CELL * 0.3}
      fill="#3D302C"
    />
  );
}

function MiniCross({ r, c }: { r: number; c: number }) {
  const x = c * (CELL + GAP) + CELL / 2;
  const y = r * (CELL + GAP) + CELL / 2;
  const d = CELL * 0.26;
  return (
    <path
      d={`M${x - d} ${y - d} L${x + d} ${y + d} M${x + d} ${y - d} L${x - d} ${y + d}`}
      stroke="#D9534F"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  );
}

export function RuleChips({ t, highlight, pulse = false, composite = false }: RuleChipsProps) {
  const pale = '#EDE3D6';
  const chips: { rule: RuleId; label: string; art: React.ReactNode }[] = [
    {
      rule: R.Region,
      label: t('game.rule.region'),
      // 三個顏色區域各一隻
      art: (
        <MiniBoard>
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <MiniCell key={`${r}${c}`} r={r} c={c} fill={['#F18C54', '#86DF75', '#9DC0E0'][r]!} />
            )),
          )}
          <MiniDot r={0} c={1} />
        </MiniBoard>
      ),
    },
    {
      rule: R.Row,
      label: t(composite ? 'game.rule.lineComposite' : 'game.rule.line'),
      // 一隻柯基，同列同欄被排除
      art: (
        <MiniBoard>
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <MiniCell
                key={`${r}${c}`}
                r={r}
                c={c}
                fill={r === 1 || c === 1 ? '#F5D9BE' : pale}
              />
            )),
          )}
          <MiniDot r={1} c={1} />
          <MiniCross r={1} c={0} />
          <MiniCross r={0} c={1} />
        </MiniBoard>
      ),
    },
    {
      rule: R.Adjacent,
      label: t('game.rule.adjacent'),
      // 斜角相鄰也不行
      art: (
        <MiniBoard>
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => <MiniCell key={`${r}${c}`} r={r} c={c} fill={pale} />),
          )}
          <MiniDot r={0} c={0} />
          <MiniCross r={1} c={1} />
        </MiniBoard>
      ),
    },
  ];

  return (
    <div className={['rule-chips', pulse ? 'is-pulsing' : ''].filter(Boolean).join(' ')}>
      {chips.map((chip) => (
        <div
          key={chip.rule}
          className={['rule-chip', highlight === chip.rule ? 'is-violated' : ''].filter(Boolean).join(' ')}
        >
          {chip.art}
          <span>{chip.label}</span>
        </div>
      ))}
    </div>
  );
}

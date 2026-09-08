import type { Translate } from '../../i18n/index.ts';
import { Dialog } from './Dialog.tsx';

interface OverlapDialogProps {
  readonly open: boolean;
  readonly t: Translate;
  readonly onClose: () => void;
}

/**
 * 第一次遇到疊加型盤面時的說明。
 *
 * 只出現一次，看過就記在 settings 裡。這種一次性說明會擋在玩家和遊戲之間，
 * 出現第二次就是干擾。
 *
 * 附一張示意圖而不是只寫文字，理由跟規則卡一樣：「兩個盤面共用中間那塊」
 * 用畫的一眼就懂，用讀的要想一下。示意圖用兩個 4×4 疊 2 格，比實際的
 * 7×7 疊 4 格單純，但要傳達的關係是同一個。
 */
export function OverlapDialog({ open, t, onClose }: OverlapDialogProps) {
  const CELL = 15;
  const GAP = 2;
  const STEP = CELL + GAP;
  const SPAN = 6; // 兩個 4×4 疊 2 格

  const cells: { r: number; c: number; shared: boolean }[] = [];
  for (let r = 0; r < SPAN; r += 1) {
    for (let c = 0; c < SPAN; c += 1) {
      const inA = r < 4 && c < 4;
      const inB = r >= 2 && c >= 2;
      if (!inA && !inB) continue;
      cells.push({ r, c, shared: inA && inB });
    }
  }

  return (
    <Dialog open={open} title={t('game.overlap.title')} onClose={onClose}>
      <div className="overlap-intro">
        <svg
          viewBox={`-4 -4 ${SPAN * STEP + 6} ${SPAN * STEP + 6}`}
          className="overlap-mini"
          aria-hidden="true"
        >
          {cells.map(({ r, c, shared }) => (
            <rect
              key={`${r}-${c}`}
              x={c * STEP}
              y={r * STEP}
              width={CELL}
              height={CELL}
              rx={3}
              fill={shared ? 'var(--accent)' : 'var(--card)'}
              stroke="var(--line, #e6dad0)"
            />
          ))}
          <rect
            x={-2}
            y={-2}
            width={4 * STEP - GAP + 4}
            height={4 * STEP - GAP + 4}
            rx={5}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
          />
          <rect
            x={2 * STEP - 2}
            y={2 * STEP - 2}
            width={4 * STEP - GAP + 4}
            height={4 * STEP - GAP + 4}
            rx={5}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
          />
        </svg>
        <p className="overlap-body">{t('game.overlap.body')}</p>
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          {t('game.overlap.ok')}
        </button>
      </div>
    </Dialog>
  );
}

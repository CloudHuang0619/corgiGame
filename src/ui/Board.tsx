/**
 * 盤面
 *
 * 區域不畫外框，純粹靠顏色分辨 —— 格子做成圓角磚塊、彼此留白。
 *
 * 輸入用指標事件自己配對而不是 onClick：觸控裝置上「一次手勢 = 一次 click」
 * 沒有保證，瀏覽器在 touchend 之後還會補送相容用的 mouse 事件，某些情況會
 * 多產生一次 click，結果一次點擊推進兩個狀態。改成配對 pointerdown/pointerup
 * 就沒有這個問題，而且順便支援拖曳標記。
 */

import { memo, useRef } from 'react';

import type { GameState } from '../core/game.ts';
import { key } from '../core/game.ts';
import { CellState } from '../core/types.ts';
import type { Coord } from '../core/types.ts';
import { Corgi } from './Corgi.tsx';
import { REGION_COLORS } from './theme.ts';

interface BoardProps {
  readonly state: GameState;
  /** 提示指出的格子，畫脈動光暈 */
  readonly hintCell: Coord | null;
  /** 提示浮層開啟時，只有目標格維持全亮 */
  readonly spotlight: boolean;
  readonly onTap: (row: number, col: number) => void;
  /** 拖曳開始，帶起始格 —— 塗或擦由那一格的狀態決定 */
  readonly onStrokeStart: (row: number, col: number) => void;
  readonly onStrokePaint: (row: number, col: number) => void;
  readonly disabled?: boolean;
  /** 關卡進場時的對角線階梯式淡入 */
  readonly entering?: boolean;
}

export const Board = memo(function Board({
  state,
  hintCell,
  spotlight,
  onTap,
  onStrokeStart,
  onStrokePaint,
  disabled = false,
  entering = false,
}: BoardProps) {
  const { puzzle, board } = state;
  const size = puzzle.size;

  const pressed = useRef<{
    pointerId: number;
    row: number;
    col: number;
    dragging: boolean;
    lastRow: number;
    lastCol: number;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, row: number, col: number) => {
    if (e.button !== 0) return;
    pressed.current = { pointerId: e.pointerId, row, col, dragging: false, lastRow: row, lastCol: col };
  };

  /*
   * 觸控時瀏覽器會把指標隱式綁定在按下的那一格，pointermove 永遠送到原本那格，
   * e.target 沒有參考價值。改用 elementFromPoint 反查指標底下是哪一格，
   * 滑鼠與觸控就能走同一套邏輯。
   */
  const cellUnderPointer = (clientX: number, clientY: number): Coord | null => {
    const element = document.elementFromPoint(clientX, clientY);
    const cell = element?.closest<HTMLElement>('[data-row]');
    if (!cell) return null;
    return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pressed.current;
    if (!start || start.pointerId !== e.pointerId) return;

    const here = cellUnderPointer(e.clientX, e.clientY);
    if (!here) return;
    if (!start.dragging && here.row === start.row && here.col === start.col) return;

    if (!start.dragging) {
      start.dragging = true;
      onStrokeStart(start.row, start.col);
      onStrokePaint(start.row, start.col);
    }

    /*
     * pointermove 是離散取樣的，手指劃快一點就會直接從第 1 格跳到第 3 格。
     * 沿著上一格到這一格的直線把中間補滿，快速劃過才不會漏格。
     */
    const steps = Math.max(Math.abs(here.row - start.lastRow), Math.abs(here.col - start.lastCol));
    for (let i = 1; i <= steps; i += 1) {
      const row = Math.round(start.lastRow + ((here.row - start.lastRow) * i) / steps);
      const col = Math.round(start.lastCol + ((here.col - start.lastCol) * i) / steps);
      onStrokePaint(row, col);
    }

    start.lastRow = here.row;
    start.lastCol = here.col;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>, row: number, col: number) => {
    const start = pressed.current;
    pressed.current = null;
    if (!start || start.pointerId !== e.pointerId) return;
    if (start.dragging) return;
    if (start.row !== row || start.col !== col) return;

    // 觸控的隱式綁定會讓 pointerup 一律送到按下的那一格，所以要自己確認
    // 放開時指標還在格子範圍內，玩家才能「按下發現點錯、滑開再放」取消。
    const box = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < box.left ||
      e.clientX > box.right ||
      e.clientY < box.top ||
      e.clientY > box.bottom
    ) {
      return;
    }

    onTap(row, col);
  };

  return (
    <div
      className={['board', entering ? 'is-entering' : ''].filter(Boolean).join(' ')}
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      role="grid"
      aria-label={`${size} 乘 ${size} 的盤面`}
      onPointerMove={handlePointerMove}
    >
      {board.map((rowCells, row) =>
        rowCells.map((cell, col) => {
          const cellKey = key(row, col);
          const region = puzzle.regions[row]![col]!;
          const isHint = hintCell?.row === row && hintCell.col === col;
          const settled = cell === CellState.Corgi || cell === CellState.Error;

          const stateLabel =
            cell === CellState.Corgi
              ? '柯基'
              : cell === CellState.Marked
                ? '叉號'
                : cell === CellState.Error
                  ? '放錯過的紅色叉號'
                  : '空白';

          return (
            <button
              key={cellKey}
              type="button"
              role="gridcell"
              className={[
                'cell',
                isHint ? 'is-hint' : '',
                settled ? 'is-settled' : '',
                spotlight && !isHint ? 'is-dimmed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                background: REGION_COLORS[region] ?? '#ddd',
                // 對角線階梯式淡入：同一條反對角線的格子一起進場
                animationDelay: entering ? `${(row + col) * 28}ms` : undefined,
              }}
              data-row={row}
              data-col={col}
              onPointerDown={(e) => handlePointerDown(e, row, col)}
              onPointerUp={(e) => handlePointerUp(e, row, col)}
              onPointerCancel={() => {
                pressed.current = null;
              }}
              onClick={(e) => {
                // detail 只有鍵盤觸發時是 0；滑鼠與觸控的 click 已由 pointerup 處理
                if (e.detail === 0) onTap(row, col);
              }}
              disabled={disabled}
              aria-label={`第 ${row + 1} 列、第 ${col + 1} 欄，${region} 區，${stateLabel}`}
            >
              {cell === CellState.Corgi && <Corgi className="cell-corgi" animated />}
              {(cell === CellState.Marked || cell === CellState.Error) && (
                <svg
                  className={cell === CellState.Error ? 'cell-mark is-error' : 'cell-mark'}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M7 7 L17 17 M17 7 L7 17"
                    stroke="currentColor"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
});

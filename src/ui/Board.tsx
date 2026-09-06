/**
 * 盤面
 *
 * 區域邊界的畫法：每一格分別判斷四個邊「隔壁是不是同一個區域」，
 * 不同區域就畫粗深色線、同區域畫細白線。這比用 SVG 疊一層外框簡單得多，
 * 而且格子縮放時邊界永遠對齊。
 */

import { memo, useRef } from 'react';

import type { GameState } from '../core/game.ts';
import { key } from '../core/game.ts';
import { CellState } from '../core/types.ts';
import { Corgi } from './Corgi.tsx';
import { REGION_COLORS } from './palette.ts';

interface BoardProps {
  readonly state: GameState;
  readonly conflicts: ReadonlySet<string>;
  /** 提示指出的格子，畫脈動光暈 */
  readonly hintCell: { row: number; col: number } | null;
  readonly onCellClick: (row: number, col: number) => void;
  /** 開始一段拖曳標記，App 會在這時記下復原點 */
  readonly onStrokeStart: () => void;
  /** 拖曳經過的格子，累積起來一起套用 */
  readonly onStrokePaint: (row: number, col: number) => void;
  readonly disabled?: boolean;
}

function edgeClasses(regions: readonly string[], row: number, col: number, size: number): string {
  const me = regions[row]![col]!;
  const classes: string[] = [];
  if (row === 0 || regions[row - 1]![col] !== me) classes.push('edge-top');
  if (row === size - 1 || regions[row + 1]![col] !== me) classes.push('edge-bottom');
  if (col === 0 || regions[row]![col - 1] !== me) classes.push('edge-left');
  if (col === size - 1 || regions[row]![col + 1] !== me) classes.push('edge-right');
  return classes.join(' ');
}

export const Board = memo(function Board({
  state,
  conflicts,
  hintCell,
  onCellClick,
  onStrokeStart,
  onStrokePaint,
  disabled = false,
}: BoardProps) {
  const { puzzle, board, locked } = state;
  const size = puzzle.size;

  /*
   * 為什麼不用 onClick
   * -----------------
   * 觸控裝置上「一次手勢 = 一次 click」並沒有保證。瀏覽器在 touchend 之後
   * 還會補送一組相容用的 mouse 事件，某些情況下會多產生一次 click，
   * 結果一次點擊推進了兩個狀態（空白直接跳到柯基）。
   *
   * 改成自己配對 pointerdown / pointerup：
   *   - 指標事件不論滑鼠或觸控都只會送一次，不會有相容事件的重複
   *   - 記下按下時是哪一格，放開時必須是同一格才算數，手指滑開就取消
   *   - 瀏覽器隨後補送的 click（detail >= 1）一律忽略
   *   - detail === 0 的 click 來自鍵盤 Enter/Space，保留給無障礙操作
   */
  const pressed = useRef<{
    pointerId: number;
    row: number;
    col: number;
    /** 手指／滑鼠是否已經離開起始格 —— 離開了就是拖曳，不是單擊 */
    dragging: boolean;
    /** 上一次塗到的格子，用來補上兩次事件之間被跨過的格子 */
    lastRow: number;
    lastCol: number;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, row: number, col: number) => {
    if (e.button !== 0) return;
    pressed.current = { pointerId: e.pointerId, row, col, dragging: false, lastRow: row, lastCol: col };
  };

  /*
   * 拖曳標記
   * --------
   * 觸控時瀏覽器會把指標隱式綁定在按下的那一格，pointermove 永遠送到原本那格，
   * e.target 沒有參考價值。所以改用 elementFromPoint 反查目前指標底下是哪一格，
   * 滑鼠與觸控就能走同一套邏輯。
   */
  const cellUnderPointer = (clientX: number, clientY: number): { row: number; col: number } | null => {
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
      // 剛離開起始格，這一刻才確定是拖曳。先記下復原點，起始格也要塗。
      start.dragging = true;
      onStrokeStart();
      onStrokePaint(start.row, start.col);
    }

    /*
     * pointermove 是離散取樣的，手指劃快一點就會直接從第 1 格跳到第 3 格，
     * 中間那格永遠收不到事件。所以沿著上一格到這一格的直線把中間補滿，
     * 快速劃過才不會漏格。
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
    if (!start) return;
    if (start.pointerId !== e.pointerId) return;
    // 拖曳過了就不再當成單擊，否則起始格會被多推進一個狀態
    if (start.dragging) return;
    if (start.row !== row || start.col !== col) return;

    // 觸控時瀏覽器會把指標隱式綁定在按下的那一格，就算手指移開了 pointerup
    // 還是送到原本那格。所以要自己比對放開的座標是否仍在格子範圍內，
    // 玩家才能用「按下去發現點錯、滑開再放」取消這一次操作。
    const box = e.currentTarget.getBoundingClientRect();
    const inside =
      e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
    if (!inside) return;

    onCellClick(row, col);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>, row: number, col: number) => {
    // detail 只有鍵盤觸發時是 0；滑鼠與觸控產生的 click 都已由 pointerup 處理完
    if (e.detail !== 0) return;
    onCellClick(row, col);
  };

  return (
    <div
      className="board"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      role="grid"
      aria-label={`${size} 乘 ${size} 的柯基盤面`}
      onPointerMove={handlePointerMove}
    >
      {board.map((rowCells, row) =>
        rowCells.map((cell, col) => {
          const cellKey = key(row, col);
          const region = puzzle.regions[row]![col]!;
          const isLocked = locked.has(cellKey);
          const inConflict = conflicts.has(cellKey);
          const isHint = hintCell?.row === row && hintCell?.col === col;

          const stateLabel =
            cell === CellState.Corgi ? '柯基' : cell === CellState.Marked ? '叉號' : '空白';

          return (
            <button
              key={cellKey}
              type="button"
              role="gridcell"
              className={[
                'cell',
                edgeClasses(puzzle.regions, row, col, size),
                inConflict ? 'is-conflict' : '',
                isHint ? 'is-hint' : '',
                isLocked ? 'is-locked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ background: REGION_COLORS[region] ?? '#ddd' }}
              data-row={row}
              data-col={col}
              onPointerDown={(e) => handlePointerDown(e, row, col)}
              onPointerUp={(e) => handlePointerUp(e, row, col)}
              onPointerCancel={() => {
                pressed.current = null;
              }}
              onClick={(e) => handleClick(e, row, col)}
              disabled={disabled || isLocked}
              aria-label={`第 ${row + 1} 列、第 ${col + 1} 欄，${region} 區，${stateLabel}`}
            >
              {cell === CellState.Corgi && (
                <Corgi className="cell-corgi" variant={inConflict ? 'conflict' : 'normal'} />
              )}
              {cell === CellState.Marked && (
                <svg className="cell-mark" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M7 7 L17 17 M17 7 L7 17"
                    stroke="currentColor"
                    strokeWidth="3.4"
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

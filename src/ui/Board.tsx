/**
 * 盤面
 *
 * 區域邊界的畫法：每一格分別判斷四個邊「隔壁是不是同一個區域」，
 * 不同區域就畫粗深色線、同區域畫細白線。這比用 SVG 疊一層外框簡單得多，
 * 而且格子縮放時邊界永遠對齊。
 */

import { memo } from 'react';

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
  disabled = false,
}: BoardProps) {
  const { puzzle, board, locked } = state;
  const size = puzzle.size;

  return (
    <div
      className="board"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      role="grid"
      aria-label={`${size} 乘 ${size} 的柯基盤面`}
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
              onClick={() => onCellClick(row, col)}
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

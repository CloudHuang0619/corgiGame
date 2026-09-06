/**
 * 遊戲狀態機
 *
 * 純函式設計：每個操作都吃一個舊 state、吐一個新 state，不改動輸入。
 * 這讓「復原」只是保留舊 state 的引用，也讓之後對戰模式要把狀態
 * 序列化丟給伺服器變得很單純。
 */

import type { CellState, Conflict, Coord, Puzzle } from './types.ts';
import { CellState as CS, ConflictKind } from './types.ts';
import { nextHint } from './solver.ts';
import type { DeductionStep } from './solver.ts';

export interface GameState {
  readonly puzzle: Puzzle;
  /** board[row][col] 的三態 */
  readonly board: readonly (readonly CellState[])[];
  /** 開局送的柯基不可更動，這裡記下座標方便 UI 畫鎖定樣式 */
  readonly locked: ReadonlySet<string>;
  readonly moveCount: number;
  readonly hintsUsed: number;
  /** 復原堆疊；只存棋盤快照，體積很小 */
  readonly history: readonly (readonly (readonly CellState[])[])[];
  readonly startedAt: number;
  readonly finishedAt: number | null;
}

export const key = (row: number, col: number): string => `${row},${col}`;

export function createGame(puzzle: Puzzle, now = Date.now()): GameState {
  const board: CellState[][] = Array.from({ length: puzzle.size }, () =>
    new Array<CellState>(puzzle.size).fill(CS.Empty),
  );
  const locked = new Set<string>();
  for (const [r, c] of puzzle.given) {
    board[r]![c] = CS.Corgi;
    locked.add(key(r, c));
  }
  return {
    puzzle,
    board,
    locked,
    moveCount: 0,
    hintsUsed: 0,
    history: [],
    startedAt: now,
    finishedAt: null,
  };
}

/** 點擊循環：空白 → 叉號 → 柯基 → 空白 */
function nextState(current: CellState): CellState {
  switch (current) {
    case CS.Empty:
      return CS.Marked;
    case CS.Marked:
      return CS.Corgi;
    case CS.Corgi:
      return CS.Empty;
    default:
      return CS.Empty;
  }
}

function cloneBoard(board: readonly (readonly CellState[])[]): CellState[][] {
  return board.map((row) => [...row]);
}

export function cycleCell(state: GameState, row: number, col: number, now = Date.now()): GameState {
  if (state.finishedAt !== null) return state;
  if (state.locked.has(key(row, col))) return state;

  const board = cloneBoard(state.board);
  board[row]![col] = nextState(state.board[row]![col]!);

  const next: GameState = {
    ...state,
    board,
    moveCount: state.moveCount + 1,
    history: [...state.history, state.board],
  };

  return isSolved(next) ? { ...next, finishedAt: now } : next;
}

/** 直接放柯基（提示採納、長按等入口用），不走三態循環。 */
export function placeCorgi(state: GameState, row: number, col: number, now = Date.now()): GameState {
  if (state.finishedAt !== null) return state;
  if (state.locked.has(key(row, col))) return state;
  if (state.board[row]![col] === CS.Corgi) return state;

  const board = cloneBoard(state.board);
  board[row]![col] = CS.Corgi;
  const next: GameState = {
    ...state,
    board,
    moveCount: state.moveCount + 1,
    history: [...state.history, state.board],
  };
  return isSolved(next) ? { ...next, finishedAt: now } : next;
}

export function undo(state: GameState): GameState {
  const previous = state.history[state.history.length - 1];
  if (!previous) return state;
  return {
    ...state,
    board: previous,
    history: state.history.slice(0, -1),
    finishedAt: null,
  };
}

export function restart(state: GameState, now = Date.now()): GameState {
  return createGame(state.puzzle, now);
}

// ---------------------------------------------------------------------------
// 規則檢查
// ---------------------------------------------------------------------------

export function corgiPositions(state: GameState): Coord[] {
  const result: Coord[] = [];
  state.board.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell === CS.Corgi) result.push({ row: r, col: c });
    });
  });
  return result;
}

/**
 * 找出目前盤面上所有違規。
 *
 * 刻意「回報所有違規」而不是碰到第一個就停 —— UI 要能同時把每一組
 * 衝突的柯基都標紅，玩家才看得出來到底哪裡撞在一起。
 */
export function findConflicts(state: GameState): Conflict[] {
  const corgis = corgiPositions(state);
  const conflicts: Conflict[] = [];

  const groupBy = (fn: (c: Coord) => string, kind: Conflict['kind']): void => {
    const groups = new Map<string, Coord[]>();
    for (const coord of corgis) {
      const k = fn(coord);
      let list = groups.get(k);
      if (!list) {
        list = [];
        groups.set(k, list);
      }
      list.push(coord);
    }
    for (const cells of groups.values()) {
      if (cells.length > 1) conflicts.push({ kind, cells });
    }
  };

  groupBy((c) => `r${c.row}`, ConflictKind.Row);
  groupBy((c) => `c${c.col}`, ConflictKind.Col);
  groupBy((c) => state.puzzle.regions[c.row]![c.col]!, ConflictKind.Region);

  for (let i = 0; i < corgis.length; i += 1) {
    for (let j = i + 1; j < corgis.length; j += 1) {
      const a = corgis[i]!;
      const b = corgis[j]!;
      if (Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1) {
        conflicts.push({ kind: ConflictKind.Adjacent, cells: [a, b] });
      }
    }
  }

  return conflicts;
}

/** 目前處於違規狀態的格子集合，key 格式同 key()。 */
export function conflictCells(state: GameState): Set<string> {
  const cells = new Set<string>();
  for (const conflict of findConflicts(state)) {
    for (const c of conflict.cells) cells.add(key(c.row, c.col));
  }
  return cells;
}

export function isSolved(state: GameState): boolean {
  const corgis = corgiPositions(state);
  if (corgis.length !== state.puzzle.size) return false;
  return findConflicts(state).length === 0;
}

// ---------------------------------------------------------------------------
// 提示
// ---------------------------------------------------------------------------

export interface Hint {
  readonly step: DeductionStep;
  /** 給玩家看的中文說明 */
  readonly message: string;
}

const REASON_TEXT: Record<DeductionStep['reason'], string> = {
  row: '這一列只剩這一格能放',
  col: '這一欄只剩這一格能放',
  region: '這個顏色區域只剩這一格能放',
};

/**
 * 給下一步提示。回傳位置與理由，但不動盤面 ——
 * 提示是指路，要不要放還是玩家決定。
 */
export function getHint(state: GameState): Hint | null {
  const placed = new Map<number, number>();
  for (const { row, col } of corgiPositions(state)) {
    // 同一列放了兩隻的話盤面本來就違規，交給衝突提示處理
    if (!placed.has(row)) placed.set(row, col);
  }

  const step = nextHint(state.puzzle.regions, state.puzzle.solution, placed);
  if (!step) return null;

  return {
    step,
    message: `試試第 ${step.row + 1} 列、第 ${step.col + 1} 欄 —— ${REASON_TEXT[step.reason]}。`,
  };
}

/** 記一次提示使用；刻意不叫 useHint，免得被當成 React hook。 */
export function markHintUsed(state: GameState): GameState {
  return { ...state, hintsUsed: state.hintsUsed + 1 };
}

export function elapsedMs(state: GameState, now = Date.now()): number {
  return (state.finishedAt ?? now) - state.startedAt;
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

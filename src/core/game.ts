/**
 * 遊戲狀態機
 *
 * 純函式設計：每個操作都吃一個舊 state、吐一個新 state，不改動輸入。
 * 這讓「復原」只是保留舊 state 的引用，也讓進度持久化與之後的對戰同步
 * 都只是序列化一個物件的事。
 */

import type { CellState, Coord, Failure, Puzzle, RuleId, SubBoard } from './types.ts';
import { CellState as CS, FailureKind, RuleId as R, Technique } from './types.ts';
import { nextHint } from './solver.ts';
import { buildShape } from './shape.ts';
import { analyseOn } from './solver-general.ts';
import type { DeductionStep } from './solver.ts';

/** 每關的命數。放錯一次扣一根，扣完就得重來。 */
export const MAX_LIVES = 3;

/**
 * 計分公式：第 k 隻柯基（k 由 1 起算）成功放下時得 576 + 96(k−1)。
 *
 * 兩個常數都是從實機錄影的分數變化逐格反推的，而且在 9×9 與 10×10 兩關
 * 都相同，所以獎勵只跟「第幾隻」有關，跟盤面大小無關。
 */
export const SCORE_BASE = 576;
export const SCORE_STEP = 96;

export function awardFor(k: number): number {
  return SCORE_BASE + SCORE_STEP * (k - 1);
}

/**
 * 連擊稱號。綁定連續正確數，所以失誤會歸零重算。
 * 前兩隻沒有稱號；k ≥ 9 原版未觀察到，沿用最後一級。
 */
export const STREAK_TITLES = ['Nice', 'Great', 'Perfect', 'Excellent', 'Amazing', 'Unbelievable'] as const;

export function titleForStreak(streak: number): string | null {
  if (streak < 3) return null;
  return STREAK_TITLES[Math.min(streak - 3, STREAK_TITLES.length - 1)]!;
}

export interface GameState {
  readonly puzzle: Puzzle;
  readonly board: readonly (readonly CellState[])[];
  /** 已成功放下的柯基數。失誤不計入。 */
  readonly catsPlaced: number;
  readonly score: number;
  /**
   * 剩餘命數。刻意不進 history —— 復原可以收回棋步，但收不回失誤，
   * 否則「放錯就復原」等於沒有代價，這條規則也就沒有意義了。
   */
  readonly lives: number;
  /** 連續正確數，驅動稱號。失誤歸零。 */
  readonly streak: number;
  readonly hintsUsed: number;
  /** 復原堆疊。只有測試工具在用，正式流程沒有復原。 */
  readonly history: readonly (readonly (readonly CellState[])[])[];
  /** 開始時間。目前不顯示在 HUD，是為對戰模式預留的計時基準。 */
  readonly startedAt: number;
  readonly finishedAt: number | null;
  /** 看過答案（測試工具）。看過就不記成績。 */
  readonly revealed: boolean;
}

export const key = (row: number, col: number): string => `${row},${col}`;

export function createGame(puzzle: Puzzle, now = Date.now()): GameState {
  return {
    puzzle,
    // 開局是全空的盤面 —— 規格裡有「重新開始後在空盤面上放第一手就失誤」的直接證據
    board: Array.from({ length: puzzle.size }, () => new Array<CellState>(puzzle.size).fill(CS.Empty)),
    catsPlaced: 0,
    score: 0,
    lives: MAX_LIVES,
    streak: 0,
    hintsUsed: 0,
    history: [],
    startedAt: now,
    finishedAt: null,
    revealed: false,
  };
}

export function isFailed(state: GameState): boolean {
  return state.lives <= 0;
}

export function isCleared(state: GameState): boolean {
  return state.finishedAt !== null;
}

/** 盤面是否還能操作。已通關或命已耗盡就鎖住。 */
export function isLocked(state: GameState): boolean {
  return isCleared(state) || isFailed(state);
}

function cloneBoard(board: readonly (readonly CellState[])[]): CellState[][] {
  return board.map((row) => [...row]);
}

// ---------------------------------------------------------------------------
// 放置驗證：先查規則衝突，再比對解答
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
 * 這一關要放幾隻柯基。
 *
 * 單一盤面等於邊長（每列一隻）。疊加型不成立 —— 共用格上的一隻柯基同時
 * 滿足兩個子盤面，所以總數比「子盤面數 x 邊長」少，得看解答本身。
 */
export function corgiTarget(puzzle: Puzzle): number {
  return puzzle.solutionCells ? puzzle.solutionCells.length : puzzle.size;
}

/** 正解的格子集合。單一盤面從 perm 轉出來，疊加型本來就是格子清單。 */
export function solutionSet(puzzle: Puzzle): ReadonlySet<number> {
  if (puzzle.solutionCells) return new Set(puzzle.solutionCells);
  return new Set(puzzle.solution.map((col, row) => row * puzzle.size + col));
}

/** 涵蓋整張圖的預設子盤面 —— 讓單一盤面走跟疊加型同一條路徑。 */
function boardsOf(puzzle: Puzzle): readonly SubBoard[] {
  return puzzle.boards ?? [{ row: 0, col: 0, size: puzzle.size }];
}

function inBoard(b: SubBoard, row: number, col: number): boolean {
  return row >= b.row && row < b.row + b.size && col >= b.col && col < b.col + b.size;
}

/**
 * 跟 (row, col) 同「列」的所有格子。
 *
 * 疊加型的關鍵差別就在這裡：複合圖的一整列不是一個約束，而是每個子盤面
 * 各自的一列。所以只取跟這一格同屬一個子盤面的那一段，跨到別的子盤面
 * 就不算 —— 那一段有它自己的一隻柯基。
 */
function rowCells(puzzle: Puzzle, row: number, col: number): Coord[] {
  const seen = new Set<number>();
  const cells: Coord[] = [];
  for (const b of boardsOf(puzzle)) {
    if (!inBoard(b, row, col)) continue;
    for (let c = b.col; c < b.col + b.size; c += 1) {
      const k = row * puzzle.size + c;
      if (seen.has(k)) continue;
      seen.add(k);
      cells.push({ row, col: c });
    }
  }
  return cells;
}

function colCells(puzzle: Puzzle, row: number, col: number): Coord[] {
  const seen = new Set<number>();
  const cells: Coord[] = [];
  for (const b of boardsOf(puzzle)) {
    if (!inBoard(b, row, col)) continue;
    for (let r = b.row; r < b.row + b.size; r += 1) {
      const k = r * puzzle.size + col;
      if (seen.has(k)) continue;
      seen.add(k);
      cells.push({ row: r, col });
    }
  }
  return cells;
}

function regionCells(puzzle: Puzzle, letter: string): Coord[] {
  const cells: Coord[] = [];
  for (let r = 0; r < puzzle.size; r += 1) {
    for (let c = 0; c < puzzle.size; c += 1) {
      if (puzzle.regions[r]![c] === letter) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

function blockCells(size: number, row: number, col: number): Coord[] {
  const cells: Coord[] = [];
  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = col - 1; c <= col + 1; c += 1) {
      if (r >= 0 && r < size && c >= 0 && c < size) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

/**
 * 檢查這一格會不會跟盤面上既有的柯基牴觸。
 *
 * 回傳的 conflictCells 是「要畫金色外框的範圍」而不只是撞到的那隻柯基：
 * 撞列就框整列、撞欄就框整欄、撞區域就框整個區域、相鄰違規則框周圍 3×3。
 * 這樣玩家一眼看得出是哪條規則擋住了。
 */
export function findRuleConflict(state: GameState, row: number, col: number): Failure | null {
  const { puzzle } = state;
  const cats = corgiPositions(state);
  const size = puzzle.size;
  const letter = puzzle.regions[row]![col]!;

  const sameRow = new Set(rowCells(puzzle, row, col).map((c) => c.row * size + c.col));
  const sameCol = new Set(colCells(puzzle, row, col).map((c) => c.row * size + c.col));

  const check: { rule: RuleId; hit: boolean; cells: () => Coord[] }[] = [
    {
      rule: R.Row,
      hit: cats.some((c) => sameRow.has(c.row * size + c.col)),
      cells: () => rowCells(puzzle, row, col),
    },
    {
      rule: R.Col,
      hit: cats.some((c) => sameCol.has(c.row * size + c.col)),
      cells: () => colCells(puzzle, row, col),
    },
    {
      rule: R.Region,
      hit: cats.some((c) => puzzle.regions[c.row]![c.col] === letter),
      cells: () => regionCells(puzzle, letter),
    },
    {
      rule: R.Adjacent,
      hit: cats.some((c) => Math.abs(c.row - row) <= 1 && Math.abs(c.col - col) <= 1),
      cells: () => blockCells(size, row, col),
    },
  ];

  // 同時違反多條時取第一條。原版在這種情況下的呈現未觀察到，
  // 取固定順序至少是可預期的，不會每次不一樣。
  const first = check.find((c) => c.hit);
  if (!first) return null;

  return {
    kind: FailureKind.RuleConflict,
    cell: { row, col },
    rule: first.rule,
    conflictCells: first.cells(),
  };
}

export interface PlaceResult {
  readonly state: GameState;
  /** 成功時這一手的得分 */
  readonly award: number | null;
  /** 成功後的連擊稱號，未達門檻為 null */
  readonly title: string | null;
  /** 失敗時的型態與細節 */
  readonly failure: Failure | null;
}

/**
 * 嘗試在這一格放下柯基。
 *
 * 雙層驗證，順序不能反：
 *   1. 先看有沒有跟既有柯基牴觸 → 失誤型態 A，能明確指出違反哪一條規則
 *   2. 再比對是不是正解的格子 → 失誤型態 B，沒有規則可指，只能說「不對」
 *
 * 第二層是這個遊戲跟一般 Queens 變體最大的差別：引擎手上有答案，會即時比對，
 * 所以玩家不可能走到「合法但推不下去」的死路。也因此零失誤通關才有意義。
 */
export function placeCorgi(state: GameState, row: number, col: number, now = Date.now()): PlaceResult {
  const conflict = findRuleConflict(state, row, col);
  if (conflict) return fail(state, conflict);

  const correct = solutionSet(state.puzzle).has(row * state.puzzle.size + col);
  if (!correct) {
    return fail(state, { kind: FailureKind.NotSolution, cell: { row, col } });
  }

  const board = cloneBoard(state.board);
  board[row]![col] = CS.Corgi;
  const catsPlaced = state.catsPlaced + 1;
  const streak = state.streak + 1;
  const award = awardFor(catsPlaced);
  const solved = catsPlaced === corgiTarget(state.puzzle);

  return {
    state: {
      ...state,
      board,
      catsPlaced,
      streak,
      score: state.score + award,
      history: [...state.history, state.board],
      finishedAt: solved && !state.revealed ? now : state.finishedAt,
    },
    award,
    title: titleForStreak(streak),
    failure: null,
  };
}

function fail(state: GameState, failure: Failure): PlaceResult {
  const { row, col } = failure.cell;
  const board = cloneBoard(state.board);
  // 柯基不會留在盤面上，該格改留一個持久的紅叉
  board[row]![col] = CS.Error;

  return {
    state: {
      ...state,
      board,
      lives: state.lives - 1,
      streak: 0,
      history: [...state.history, state.board],
    },
    award: null,
    title: null,
    failure,
  };
}

// ---------------------------------------------------------------------------
// 格子操作
// ---------------------------------------------------------------------------

/** 已定案、任何操作都不能更動的格子。 */
function isSettled(cell: CellState): boolean {
  return cell === CS.Corgi || cell === CS.Error;
}

/**
 * 一次點擊要做什麼。
 *
 *   toggle 空白 ↔ 叉號來回切換
 *   place  嘗試放柯基
 *
 * 由 UI 依「是不是快速連點同一格」決定，核心只管執行 ——
 * 時間窗屬於輸入判讀，不該混進遊戲規則裡。
 */
export type TapIntent = 'toggle' | 'place';

/**
 * 點擊一格。
 *
 * 叉號是玩家的推理筆記，必須零成本、可反覆 —— 標錯了要能隨手清掉，
 * 而不是只剩「賭一條命放柯基」這一條出路。所以單擊只在空白與叉號之間
 * 來回切換，放柯基另外用快速連點兩下觸發。
 */
export function tapCell(
  state: GameState,
  row: number,
  col: number,
  intent: TapIntent = 'toggle',
  now = Date.now(),
): PlaceResult {
  const noop: PlaceResult = { state, award: null, title: null, failure: null };
  if (isLocked(state)) return noop;

  const current = state.board[row]![col]!;
  if (isSettled(current)) return noop;

  if (intent === 'place') return placeCorgi(state, row, col, now);

  const board = cloneBoard(state.board);
  board[row]![col] = current === CS.Empty ? CS.Marked : CS.Empty;
  return {
    state: { ...state, board, history: [...state.history, state.board] },
    award: null,
    title: null,
    failure: null,
  };
}

/**
 * 判定成「快速連點」的時間上限。
 *
 * 實機錄影量到的兩次點擊間隔是 100–166 毫秒，取 350 毫秒留了兩倍餘裕，
 * 手比較慢的人也放得出柯基；而刻意要取消叉號的那一下通常隔得遠得多，
 * 不會誤觸。
 */
export const DOUBLE_TAP_MS = 350;

/**
 * 拖曳的模式。由起點那一格的狀態決定：
 *   從空白格開始 → 塗上叉號
 *   從叉號開始   → 擦掉叉號
 *
 * 這是「能劃出來就該能劃掉」的直覺。用起點決定而不是中途切換，是因為
 * 一次拖曳如果又塗又擦，手指劃過去的結果會變得無法預期。
 */
export type StrokeMode = 'mark' | 'erase';

export function strokeModeFor(state: GameState, row: number, col: number): StrokeMode {
  return state.board[row]![col] === CS.Marked ? 'erase' : 'mark';
}

/**
 * 一次拖曳把經過的格子整批塗上或擦掉叉號。
 *
 * 刻意從「拖曳開始前的狀態」重新套用整組座標，而不是逐格累加：
 * 這樣整段拖曳只留下一筆復原紀錄，而且重複經過同一格也不會來回翻轉。
 * 柯基與紅叉一律跳過 —— 那兩種已經定案。
 */
export function applyMarkStroke(
  base: GameState,
  cells: ReadonlySet<string>,
  mode: StrokeMode = 'mark',
): GameState {
  if (isLocked(base)) return base;

  const from = mode === 'mark' ? CS.Empty : CS.Marked;
  const to = mode === 'mark' ? CS.Marked : CS.Empty;

  const board = cloneBoard(base.board);
  let changed = 0;

  for (const cellKey of cells) {
    const [rowText, colText] = cellKey.split(',');
    const row = Number(rowText);
    const col = Number(colText);
    if (board[row]?.[col] !== from) continue;
    board[row]![col] = to;
    changed += 1;
  }

  if (changed === 0) return base;
  return { ...base, board, history: [...base.history, base.board] };
}

export function restart(state: GameState, now = Date.now()): GameState {
  return createGame(state.puzzle, now);
}

/**
 * 續命：補一根骨頭，盤面原封不動。
 *
 * 保留已放的柯基與紅叉，是因為續命的價值就在「不必從頭推一遍」；連紅叉
 * 都還在，玩家先前排除掉的可能性也還在。跟 `restart` 的差別是刻意的：
 * 一個接續、一個歸零。
 *
 * 只在 lives 已耗盡時才有作用——沒失敗就不該能靠這條路囤命。
 */
export function revive(state: GameState, lives = 1): GameState {
  if (!isFailed(state)) return state;
  return { ...state, lives: Math.min(lives, MAX_LIVES) };
}

// ---------------------------------------------------------------------------
// 測試工具（不屬於正式流程）
// ---------------------------------------------------------------------------

/**
 * 復原上一步。正式版沒有這個功能，是測試用的。
 *
 * 紅叉不隨復原消失 —— 命已經扣了，若還能靠復原把痕跡抹掉，就會變成
 * 「點錯 → 復原 → 當作沒事」，跟紅叉持久的規則自相矛盾。
 */
export function undo(state: GameState): GameState {
  const previous = state.history[state.history.length - 1];
  if (!previous) return state;

  const board = previous.map((row, r) =>
    row.map((cell, c) => (state.board[r]![c] === CS.Error ? CS.Error : cell)),
  );
  const catsPlaced = board.flat().filter((cell) => cell === CS.Corgi).length;

  return {
    ...state,
    board,
    catsPlaced,
    history: state.history.slice(0, -1),
    finishedAt: null,
    revealed: false,
  };
}

/** 攤開答案。看過就不算通關，也不記成績。 */
export function revealSolution(state: GameState): GameState {
  const board: CellState[][] = Array.from({ length: state.puzzle.size }, () =>
    new Array<CellState>(state.puzzle.size).fill(CS.Empty),
  );
  state.puzzle.solution.forEach((col, row) => {
    board[row]![col] = CS.Corgi;
  });

  return {
    ...state,
    board,
    catsPlaced: state.puzzle.size,
    revealed: true,
    history: [...state.history, state.board],
  };
}

// ---------------------------------------------------------------------------
// 提示
// ---------------------------------------------------------------------------

export interface Hint {
  readonly step: DeductionStep;
  readonly cell: Coord;
  /** 推論依據的對象：區域字母，或列/欄的索引 */
  readonly regionLetter: string | null;
}

/**
 * 推出下一格可以確定的位置。
 *
 * 只回傳位置與理由，不動盤面 —— 原版的提示浮層也是先指出格子、
 * 由玩家按「套用」才放下。
 */
export function getHint(state: GameState): Hint | null {
  const { puzzle } = state;

  /*
   * 疊加型走通用推論引擎。舊的 nextHint 以「每列一隻」為前提，用 row 當
   * Map 的鍵；複合圖的一列可能有兩隻（分屬兩個子盤面），那個鍵會撞掉，
   * 給出的提示會是錯的。
   */
  if (puzzle.boards && puzzle.boards.length > 1) {
    const shape = buildShape(puzzle.boards, puzzle.regions);
    const correct = solutionSet(puzzle);
    // 玩家可能放錯，錯的線索餵進推論只會得到矛盾。先濾掉不在正解上的
    const valid = corgiPositions(state)
      .map(({ row, col }) => row * puzzle.size + col)
      .filter((idx) => correct.has(idx));

    const known = new Set(valid);
    const result = analyseOn(shape, valid);
    const fresh = result.steps.find((s) => !known.has(s.cell));
    const cellIdx = fresh
      ? fresh.cell
      // 推不出下一步時退回用正解補一格，跟單一盤面的行為一致
      : puzzle.solutionCells!.find((idx) => !known.has(idx));
    if (cellIdx === undefined) return null;

    const row = Math.floor(cellIdx / puzzle.size);
    const col = cellIdx % puzzle.size;
    const reason = fresh?.reason ?? 'row';
    return {
      step: { row, col, reason, technique: fresh?.technique ?? Technique.Advanced },
      cell: { row, col },
      regionLetter: reason === 'region' ? puzzle.regions[row]![col]! : null,
    };
  }

  const placed = new Map<number, number>();
  for (const { row, col } of corgiPositions(state)) {
    if (!placed.has(row)) placed.set(row, col);
  }

  const step = nextHint(puzzle.regions, puzzle.solution, placed);
  if (!step) return null;

  return {
    step,
    cell: { row: step.row, col: step.col },
    regionLetter: step.reason === 'region' ? state.puzzle.regions[step.row]![step.col]! : null,
  };
}

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

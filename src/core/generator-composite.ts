/**
 * 疊加型盤面生成器
 *
 * 流程與 generator.ts 相同 —— 先有答案再長出題目 —— 但每一步都改成在
 * 「格子 + 約束群組」上運作，因為複合圖不是正方形，也沒有「每列一隻」
 * 這回事：跨兩個子盤面的複合列，兩邊各要一隻。
 *
 *   1. 在複合圖上隨機找一組合法解（滿足所有子盤面的列欄，且全域不相鄰）
 *   2. 以解的每一格為種子，洪水填充長出區域，空洞格不參與
 *   3. 用通用求解器驗證唯一解，多解就靠搬格子逐一消掉
 *   4. 用通用推論引擎評難度
 */

import { buildShape, VOID, type Shape, type SubBoard } from './shape.ts';
import { createRng, type Rng } from './generator.ts';
import { analyseOn, findSolutionsOn } from './solver-general.ts';
import type { RegionGrid } from './types.ts';
import { Technique } from './types.ts';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface CompositePuzzle {
  readonly level: number;
  readonly size: number;
  readonly regions: RegionGrid;
  /** 解答是格子索引（row * span + col），不是 perm —— 複合圖沒有 perm 這種東西 */
  readonly solutionCells: readonly number[];
  readonly boards: readonly SubBoard[];
}

interface Base {
  readonly span: number;
  readonly present: boolean[];
  readonly cells: number[];
  /** 只有列與欄，色區此時還不存在 */
  readonly groups: number[][];
  readonly groupsOfCell: number[][];
  readonly neighbours: number[][];
}

const ORTHO: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function compositeBase(boards: readonly SubBoard[]): Base {
  const span = Math.max(...boards.map((b) => Math.max(b.row, b.col) + b.size));
  const present = new Array<boolean>(span * span).fill(false);
  for (const b of boards) {
    for (let i = 0; i < b.size; i += 1) {
      for (let j = 0; j < b.size; j += 1) present[(b.row + i) * span + (b.col + j)] = true;
    }
  }

  const cells: number[] = [];
  for (let i = 0; i < span * span; i += 1) if (present[i]) cells.push(i);

  const groups: number[][] = [];
  for (const b of boards) {
    for (let i = 0; i < b.size; i += 1) {
      const row: number[] = [];
      const col: number[] = [];
      for (let j = 0; j < b.size; j += 1) {
        row.push((b.row + i) * span + (b.col + j));
        col.push((b.row + j) * span + (b.col + i));
      }
      groups.push(row, col);
    }
  }

  const groupsOfCell: number[][] = Array.from({ length: span * span }, () => []);
  groups.forEach((g, gi) => { for (const c of g) groupsOfCell[c]!.push(gi); });

  const neighbours: number[][] = Array.from({ length: span * span }, () => []);
  for (const idx of cells) {
    const r = Math.floor(idx / span);
    const c = idx % span;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= span || nc < 0 || nc >= span) continue;
        const n = nr * span + nc;
        if (present[n]) neighbours[idx]!.push(n);
      }
    }
  }
  return { span, present, cells, groups, groupsOfCell, neighbours };
}

/** 在複合圖上隨機找一組合法解。候選順序打亂，同一個版面才長得出不同題目。 */
export function randomCompositeSolution(base: Base, rng: Rng): number[] | null {
  const alive = new Uint8Array(base.span * base.span);
  for (const c of base.cells) alive[c] = 1;
  const filled = new Int32Array(base.groups.length);
  const placed: number[] = [];

  const liveOf = (gi: number): number[] => base.groups[gi]!.filter((c) => alive[c]);

  const search = (): boolean => {
    let target = -1;
    let best = Infinity;
    for (let gi = 0; gi < base.groups.length; gi += 1) {
      if (filled[gi]! > 0) continue;
      const n = liveOf(gi).length;
      if (n < best) {
        best = n;
        target = gi;
      }
      if (best <= 1) break;
    }
    if (target === -1) return true;
    if (best === 0) return false;

    const options = liveOf(target);
    for (let i = options.length - 1; i > 0; i -= 1) {
      const j = rng.int(i + 1);
      const tmp = options[i]!;
      options[i] = options[j]!;
      options[j] = tmp;
    }

    for (const idx of options) {
      // 這裡直接快照整個狀態而不做增量還原：解只會找一組，深度等於柯基數
      // （十幾層），快照的成本遠低於維護對稱的增量還原所需的心力。
      const snapshot = new Uint8Array(alive);
      const before = Int32Array.from(filled);
      alive[idx] = 0;
      for (const gi of base.groupsOfCell[idx]!) {
        filled[gi]! += 1;
        for (const c of base.groups[gi]!) if (c !== idx) alive[c] = 0;
      }
      for (const c of base.neighbours[idx]!) alive[c] = 0;
      placed.push(idx);
      if (search()) return true;
      placed.pop();
      alive.set(snapshot);
      filled.set(before);
    }
    return false;
  };

  return search() ? [...placed].sort((a, b) => a - b) : null;
}

/** 以解答的每一格為種子長出區域；空洞不參與填充。 */
export function growCompositeRegions(
  base: Base,
  solution: readonly number[],
  rng: Rng,
  compactness = 0.65,
): RegionGrid | null {
  const owner = new Array<number | null>(base.span * base.span).fill(null);
  const sizes = new Array<number>(solution.length).fill(1);
  const frontier: [number, number][] = [];

  const push = (idx: number, cell: number): void => {
    const r = Math.floor(cell / base.span);
    const c = cell % base.span;
    for (const [dr, dc] of ORTHO) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= base.span || nc < 0 || nc >= base.span) continue;
      const n = nr * base.span + nc;
      if (base.present[n] && owner[n] === null) frontier.push([idx, n]);
    }
  };

  solution.forEach((cell, i) => {
    owner[cell] = i;
    push(i, cell);
  });

  while (frontier.length > 0) {
    let index: number;
    if (rng() < compactness) {
      frontier.sort((x, y) => sizes[x[0]]! - sizes[y[0]]!);
      index = rng.int(Math.min(4, frontier.length));
    } else {
      index = rng.int(frontier.length);
    }
    const [idx, cell] = frontier.splice(index, 1)[0]!;
    if (owner[cell] !== null) continue;
    owner[cell] = idx;
    sizes[idx] = sizes[idx]! + 1;
    push(idx, cell);
  }

  if (base.cells.some((c) => owner[c] === null)) return null;

  const rows: string[] = [];
  for (let r = 0; r < base.span; r += 1) {
    let line = '';
    for (let c = 0; c < base.span; c += 1) {
      const o = owner[r * base.span + c] ?? null;
      line += o === null ? VOID : LETTERS[o]!;
    }
    rows.push(line);
  }
  return rows;
}

export function shapeOf(boards: readonly SubBoard[], regions: RegionGrid): Shape {
  return buildShape(boards, regions);
}

/**
 * 把多解盤面收斂成唯一解。
 *
 * 手法與 generator.ts 相同：找一組多餘的解 S2，挑一格 S2 有、正解沒有的
 * 位置，改劃給隔壁區域 —— S2 因此在該區出現兩隻而失效，正解則完全不受
 * 影響，因為被搬動的那格本來就不是正解的柯基。
 */
export function repairCompositeToUnique(
  boards: readonly SubBoard[],
  base: Base,
  regions: RegionGrid,
  solution: readonly number[],
  rng: Rng,
  maxRepairs = 300,
): RegionGrid | null {
  const grid = regions.map((row) => row.split(''));
  const at = (cell: number): string => grid[Math.floor(cell / base.span)]![cell % base.span]!;
  const set = (cell: number, letter: string): void => {
    grid[Math.floor(cell / base.span)]![cell % base.span] = letter;
  };
  const render = (): RegionGrid => grid.map((row) => row.join(''));
  const solutionSet = new Set(solution);
  const cellsOf = (letter: string): number[] => base.cells.filter((c) => at(c) === letter);

  const stillConnected = (letter: string, drop: number): boolean => {
    const cells = cellsOf(letter).filter((c) => c !== drop);
    if (cells.length === 0) return false;
    const seen = new Set<number>([cells[0]!]);
    const stack = [cells[0]!];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const r = Math.floor(cur / base.span);
      const c = cur % base.span;
      for (const [dr, dc] of ORTHO) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= base.span || nc < 0 || nc >= base.span) continue;
        const n = nr * base.span + nc;
        if (n === drop || !base.present[n] || at(n) !== letter || seen.has(n)) continue;
        seen.add(n);
        stack.push(n);
      }
    }
    return seen.size === cells.length;
  };

  for (let iter = 0; iter < maxRepairs; iter += 1) {
    const found = findSolutionsOn(shapeOf(boards, render()), 2);
    if (found.length === 0) return null; // 不該發生：正解一定是解
    if (found.length === 1) return render();

    const rogue = found.find(
      (s) => s.length !== solution.length || s.some((c) => !solutionSet.has(c)),
    );
    if (!rogue) return null;

    const moves: { cell: number; to: string }[] = [];
    for (const cell of rogue) {
      if (solutionSet.has(cell)) continue; // 正解也有這格，動了會傷到正解
      const from = at(cell);
      if (cellsOf(from).length <= 2) continue;
      if (!stillConnected(from, cell)) continue;
      const r = Math.floor(cell / base.span);
      const c = cell % base.span;
      for (const [dr, dc] of ORTHO) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= base.span || nc < 0 || nc >= base.span) continue;
        const n = nr * base.span + nc;
        if (!base.present[n]) continue;
        const to = at(n);
        if (to !== from) moves.push({ cell, to });
      }
    }
    if (moves.length === 0) return null; // 走進死路，交給外層換 seed 重來

    const mv = rng.pick(moves);
    set(mv.cell, mv.to);
  }

  return findSolutionsOn(shapeOf(boards, render()), 2).length === 1 ? render() : null;
}

export function generateComposite(
  level: number,
  boards: readonly SubBoard[],
  seed: number,
  targetTechnique: Technique,
  maxAttempts = 300,
): CompositePuzzle | null {
  const base = compositeBase(boards);
  const rng = createRng(seed);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const solution = randomCompositeSolution(base, rng);
    if (!solution) continue;
    const grown = growCompositeRegions(base, solution, rng);
    if (!grown) continue;
    const fixed = repairCompositeToUnique(boards, base, grown, solution, rng);
    if (!fixed) continue;
    if (analyseOn(shapeOf(boards, fixed)).technique !== targetTechnique) continue;
    return { level, size: base.span, regions: fixed, solutionCells: solution, boards };
  }
  return null;
}

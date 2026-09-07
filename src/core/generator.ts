/**
 * 關卡生成器
 *
 * 流程刻意反過來做 —— 先有答案，再長出題目：
 *   1. 隨機挑一組合法解（排列，且相鄰列的欄差 >= 2）
 *   2. 以解的每一格為種子，隨機洪水填充長出 N 個連通區域
 *   3. 用求解器驗證「恰好一組解」，不然重來
 *   4. 用推論引擎評難度，不符目標等級就重來
 *
 * 這個順序保證產出的題目一定有解；反過來先畫區域再檢查，絕大多數會是死盤。
 *
 * 生成過程吃一個可指定的亂數種子，因此同一個 seed 一定得到同一張盤面。
 * 這點在對戰模式很重要 —— 伺服器只要送一個 seed，雙方就能各自算出同一張題目。
 */

import { countSolutions, analyse, findSolutions } from './solver.ts';
import type { Puzzle, RegionGrid } from './types.ts';
import { Technique } from './types.ts';

const LETTERS = 'ABCDEFGHIJKLMNOP';

// ---------------------------------------------------------------------------
// 可重現的亂數（mulberry32）—— 不用 Math.random，才能靠 seed 重現盤面
// ---------------------------------------------------------------------------

export interface Rng {
  (): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = next as Rng;
  rng.int = (maxExclusive: number) => Math.floor(next() * maxExclusive);
  rng.pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  return rng;
}

// ---------------------------------------------------------------------------
// 步驟 1：隨機合法解
// ---------------------------------------------------------------------------

function randomSolution(n: number, rng: Rng): number[] | null {
  // 貪心逐列挑欄，走進死路就整組重來。N <= 9 時成功率夠高，重試很便宜。
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const available = new Set<number>();
    for (let i = 0; i < n; i += 1) available.add(i);
    const perm: number[] = [];
    let ok = true;
    for (let row = 0; row < n; row += 1) {
      const prev = perm.length > 0 ? perm[perm.length - 1]! : -99;
      const choices = [...available].filter((c) => Math.abs(c - prev) >= 2);
      if (choices.length === 0) {
        ok = false;
        break;
      }
      const chosen = rng.pick(choices);
      perm.push(chosen);
      available.delete(chosen);
    }
    if (ok) return perm;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 步驟 2：洪水填充長出區域
// ---------------------------------------------------------------------------

/** compactness 越高，越傾向讓面積小的區域先長，盤面就不會出現「一格區 + 巨獸區」。 */
function growRegions(n: number, perm: readonly number[], rng: Rng, compactness = 0.65): RegionGrid | null {
  const grid: (number | null)[][] = Array.from({ length: n }, () => new Array<number | null>(n).fill(null));
  const frontier: [number, number, number][] = []; // [regionIndex, row, col]
  const sizes = new Array<number>(n).fill(1);

  const pushNeighbours = (idx: number, r: number, c: number): void => {
    const deltas: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of deltas) {
      const i = r + dr;
      const j = c + dc;
      if (i >= 0 && i < n && j >= 0 && j < n && grid[i]![j] === null) frontier.push([idx, i, j]);
    }
  };

  perm.forEach((col, row) => {
    grid[row]![col] = row;
    pushNeighbours(row, row, col);
  });

  while (frontier.length > 0) {
    let index: number;
    if (rng() < compactness) {
      // 偏袒目前最小的區域：只在最小的幾個候選裡挑
      frontier.sort((x, y) => sizes[x[0]]! - sizes[y[0]]!);
      index = rng.int(Math.min(4, frontier.length));
    } else {
      index = rng.int(frontier.length);
    }
    const [idx, r, c] = frontier.splice(index, 1)[0]!;
    if (grid[r]![c] !== null) continue;
    grid[r]![c] = idx;
    sizes[idx] = sizes[idx]! + 1;
    pushNeighbours(idx, r, c);
  }

  if (grid.some((row) => row.some((cell) => cell === null))) return null;
  return grid.map((row) => row.map((cell) => LETTERS[cell!]!).join(''));
}

// ---------------------------------------------------------------------------
// 步驟 3：迭代修復，把多解盤面收斂成唯一解
// ---------------------------------------------------------------------------

/**
 * 純隨機長出來的區域幾乎必定多解（實測 400 次只有 1 次唯一），
 * 所以生成的重點其實在這裡：把多餘的解一組一組消掉。
 *
 * 手法：找出一組不是正解的解 S2，挑一格 S2 有、正解沒有的柯基位置，
 * 把那格改劃給隔壁區域。由於任何解都必須「每區恰好一隻」，該格搬進去之後
 * 隔壁區在 S2 裡就變成兩隻，S2 因此失效。
 *
 * 而正解 S1 完全不受影響 —— 被搬動的那格保證不是 S1 的柯基（它跟 S1 在
 * 同一列但不同欄），所以「每區恰好一隻 S1 柯基」的性質原封不動。
 */
function repairToUnique(
  regions: string[],
  solution: readonly number[],
  rng: Rng,
  maxRepairs = 200,
): string[] | null {
  const n = regions.length;
  const grid = regions.map((row) => row.split(''));

  const regionOf = (r: number, c: number): string => grid[r]![c]!;

  const cellsOfRegion = (letter: string): [number, number][] => {
    const cells: [number, number][] = [];
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) if (grid[r]![c] === letter) cells.push([r, c]);
    }
    return cells;
  };

  /** 拿掉 (er, ec) 之後，該區域是否仍然連通（四方向）。 */
  const stillConnected = (letter: string, er: number, ec: number): boolean => {
    const cells = cellsOfRegion(letter).filter(([r, c]) => !(r === er && c === ec));
    if (cells.length === 0) return false;
    const want = cells.length;
    const seen = new Set<string>();
    const stack: [number, number][] = [cells[0]!];
    seen.add(`${cells[0]![0]},${cells[0]![1]}`);
    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
        const i = r + dr;
        const j = c + dc;
        if (i < 0 || i >= n || j < 0 || j >= n) continue;
        if (i === er && j === ec) continue;
        if (grid[i]![j] !== letter) continue;
        const k = `${i},${j}`;
        if (seen.has(k)) continue;
        seen.add(k);
        stack.push([i, j]);
      }
    }
    return seen.size === want;
  };

  for (let iteration = 0; iteration < maxRepairs; iteration += 1) {
    const solutions = findSolutions(grid.map((row) => row.join('')), 2);
    if (solutions.length === 0) return null; // 不該發生：S1 一定是解
    if (solutions.length === 1) return grid.map((row) => row.join(''));

    // 挑出不是正解的那一組
    const rogue = solutions.find((s) => s.some((col, row) => col !== solution[row]));
    if (!rogue) return null;

    // 蒐集所有「搬一格就能殺掉 rogue」的合法動作
    type Move = { r: number; c: number; from: string; to: string };
    const moves: Move[] = [];
    for (let r = 0; r < n; r += 1) {
      const col = rogue[r]!;
      if (col === solution[r]) continue; // 這格正解也有，動了會傷到 S1
      const from = regionOf(r, col);
      // 搬走之後原區域不能斷開，也不能剩太小
      if (cellsOfRegion(from).length <= 2) continue;
      if (!stillConnected(from, r, col)) continue;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
        const i = r + dr;
        const j = col + dc;
        if (i < 0 || i >= n || j < 0 || j >= n) continue;
        const to = grid[i]![j]!;
        if (to === from) continue;
        moves.push({ r, c: col, from, to });
      }
    }

    if (moves.length === 0) return null; // 走進死路，交給外層換 seed 重來

    const move = rng.pick(moves);
    grid[move.r]![move.c] = move.to;
  }

  return countSolutions(grid.map((row) => row.join('')), 2) === 1
    ? grid.map((row) => row.join(''))
    : null;
}

// ---------------------------------------------------------------------------
// 關卡曲線
// ---------------------------------------------------------------------------

/**
 * 每一關的盤面大小與目標難度。
 *
 * 規格只驗證到兩個點：第 17 關是 9×9、第 18 關是 10×10。中間與前段是依
 * 「逐步變大、逐步需要更深的推論」補的成長曲線，10×10 之後就不再變大 ——
 * 再大在手機直向畫面上一格會小到點不準。
 *
 * 起手不送柯基。規格裡有明確證據：重新開始後是空盤面，玩家在上面放第一手
 * 就被判失誤。所以開局盤面必須是全空的。
 */
export interface LevelSpec {
  readonly level: number;
  readonly size: number;
  readonly technique: Technique;
}

function sizeForLevel(level: number): number {
  if (level <= 3) return 5;
  if (level <= 7) return 6;
  if (level <= 11) return 7;
  if (level <= 16) return 8;
  if (level === 17) return 9; // 規格實測
  return 10; // 規格實測第 18 關為 10×10，之後維持
}

function techniqueForLevel(level: number): Technique {
  if (level <= 6) return Technique.Basic;
  if (level <= 16) return Technique.Intermediate;
  return Technique.Advanced;
}

export function getLevelSpec(level: number): LevelSpec {
  return { level, size: sizeForLevel(level), technique: techniqueForLevel(level) };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  /** 放寬難度比對 —— 找不到剛好符合的等級時，接受任何唯一解盤面 */
  readonly relaxTechnique?: boolean;
  readonly maxAttempts?: number;
}

/**
 * 產生指定關卡的盤面。
 *
 * 同一個 seed 永遠產出同一張盤面，所以關卡表可以只存 seed，也讓對戰時
 * 雙方只要同步一個數字就能算出同一張題目。
 */
export function generatePuzzle(level: number, seed: number, options: GenerateOptions = {}): Puzzle | null {
  const spec = getLevelSpec(level);
  const { relaxTechnique = false, maxAttempts = 8000 } = options;
  const rng = createRng(seed);
  const n = spec.size;

  let fallback: { regions: RegionGrid; perm: number[] } | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const perm = randomSolution(n, rng);
    if (!perm) continue;

    const grown = growRegions(n, perm, rng);
    if (!grown) continue;

    // 隨機長出來的區域幾乎必定多解，靠修復收斂成唯一解
    const regions = repairToUnique([...grown], perm, rng);
    if (!regions) continue;

    // 規格 §12.1 明確記錄「允許只有 1 格的區域」（第 18 關 F 區就是），
    // 所以這裡不濾掉單格區域 —— 那反而是原版的特徵之一。
    const analysis = analyse(regions);
    if (analysis.technique !== spec.technique) {
      if (!fallback) fallback = { regions, perm };
      continue;
    }
    return { level, size: n, regions, solution: [...perm] };
  }

  if (relaxTechnique && fallback) {
    return { level, size: n, regions: fallback.regions, solution: [...fallback.perm] };
  }
  return null;
}

/**
 * 一直換 seed 直到生出盤面為止。
 * 給「隨機來一局」用；固定關卡走 generatePuzzle 保留可重現性。
 */
export function generateUntilSuccess(level: number, startSeed: number): Puzzle {
  for (let i = 0; i < 300; i += 1) {
    const puzzle = generatePuzzle(level, startSeed + i * 7919, { maxAttempts: 3000 });
    if (puzzle) return puzzle;
  }
  const relaxed = generatePuzzle(level, startSeed, { relaxTechnique: true, maxAttempts: 20000 });
  if (relaxed) return relaxed;
  throw new Error(`無法產生第 ${level} 關的盤面`);
}

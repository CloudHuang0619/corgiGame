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
import type { DifficultyId, DifficultySpec, Puzzle, RegionGrid } from './types.ts';
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
// 難度設定
// ---------------------------------------------------------------------------

export const DIFFICULTY_SPECS: readonly DifficultySpec[] = [
  { id: 'easy', name: '一般', size: 6, technique: Technique.Basic, givenCount: 1 },
  { id: 'hard', name: '困難', size: 8, technique: Technique.Intermediate, givenCount: 1 },
  { id: 'expert', name: '超難', size: 9, technique: Technique.Advanced, givenCount: 0 },
];

export function getSpec(id: DifficultyId): DifficultySpec {
  const spec = DIFFICULTY_SPECS.find((d) => d.id === id);
  if (!spec) throw new Error(`未知的難度：${id}`);
  return spec;
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
 * 產生一張符合難度設定的盤面。
 *
 * 同一個 seed 永遠產出同一張盤面，所以對戰時只要同步 seed 就能同步題目。
 */
export function generatePuzzle(
  difficulty: DifficultyId,
  seed: number,
  options: GenerateOptions = {},
): Puzzle | null {
  const spec = getSpec(difficulty);
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

    // 單格區域等於直接把答案送給玩家，濾掉
    const counts = new Map<string, number>();
    for (const row of regions) {
      for (const ch of row) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    if (Math.min(...counts.values()) < 2) continue;

    const given = chooseGivens(spec, regions, perm, rng);
    if (!given) {
      if (!fallback) fallback = { regions, perm };
      continue;
    }
    return finalise(spec, seed, regions, perm, given);
  }

  if (relaxTechnique && fallback) {
    const given = fallback.perm
      .map((col, row) => [row, col] as [number, number])
      .slice(0, spec.givenCount);
    return finalise(spec, seed, fallback.regions, fallback.perm, given);
  }
  return null;
}

/**
 * 挑選開局送的柯基，並確認「送了這些提示之後」的難度剛好等於目標。
 *
 * 難度必須連同起手提示一起評 —— 同一張盤面，提示放在不同列，可能是
 * 一路推到底的簡單題，也可能是得靠試誤的硬題。反過來說，這也是我們
 * 控制難度的旋鈕：不只挑盤面，也挑提示位置。
 *
 * 回傳 null 表示這張盤面配不出目標難度，外層應換一張。
 */
function chooseGivens(
  spec: DifficultySpec,
  regions: RegionGrid,
  perm: readonly number[],
  rng: Rng,
): [number, number][] | null {
  if (spec.givenCount === 0) {
    return analyse(regions).technique === spec.technique ? [] : null;
  }

  const rows: number[] = [];
  for (let r = 0; r < spec.size; r += 1) rows.push(r);
  for (let i = rows.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    [rows[i], rows[j]] = [rows[j]!, rows[i]!];
  }

  if (spec.givenCount === 1) {
    for (const r of rows) {
      const known = new Map([[r, perm[r]!]]);
      if (analyse(regions, known).technique === spec.technique) {
        return [[r, perm[r]!]];
      }
    }
    return null;
  }

  // givenCount >= 2：只試洗牌後的前幾組，夠用且不會拖慢生成
  for (let attempt = 0; attempt < spec.size * 2; attempt += 1) {
    const picked = rows.slice(attempt, attempt + spec.givenCount);
    if (picked.length < spec.givenCount) break;
    const known = new Map(picked.map((r) => [r, perm[r]!] as const));
    if (analyse(regions, known).technique === spec.technique) {
      return picked.map((r) => [r, perm[r]!] as [number, number]).sort((a, b) => a[0] - b[0]);
    }
  }
  return null;
}

function finalise(
  spec: DifficultySpec,
  seed: number,
  regions: RegionGrid,
  perm: readonly number[],
  given: readonly [number, number][],
): Puzzle {
  return {
    id: `gen-${spec.id}-${seed}`,
    size: spec.size,
    regions,
    solution: [...perm],
    given: [...given].sort((a, b) => a[0] - b[0]),
    difficulty: spec.id,
  };
}

/**
 * 一直換 seed 直到生出盤面為止。
 * 給「隨機來一局」用；固定關卡走 generatePuzzle 保留可重現性。
 */
export function generateUntilSuccess(difficulty: DifficultyId, startSeed: number): Puzzle {
  for (let i = 0; i < 200; i += 1) {
    const puzzle = generatePuzzle(difficulty, startSeed + i * 7919, { maxAttempts: 3000 });
    if (puzzle) return puzzle;
  }
  const relaxed = generatePuzzle(difficulty, startSeed, { relaxTechnique: true, maxAttempts: 20000 });
  if (relaxed) return relaxed;
  throw new Error(`無法產生 ${difficulty} 難度的盤面`);
}

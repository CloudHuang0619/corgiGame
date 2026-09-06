/**
 * 關卡表健檢：把 src/core/levels.ts 裡每一關都獨立重驗一次。
 *
 *   npm run verify
 *
 * 這是刻意寫成「不信任生成器」的第二道關卡 —— 生成器改壞了、
 * 或關卡表被手動編輯過，都會在這裡被抓出來，而不是等玩家撞到死盤。
 */

import { LEVELS } from '../src/core/levels.ts';
import { analyse, countSolutions } from '../src/core/solver.ts';
import { getSpec } from '../src/core/generator.ts';
import type { Puzzle, RegionGrid } from '../src/core/types.ts';

let failures = 0;

function fail(puzzle: Puzzle, message: string): void {
  console.error(`  X ${puzzle.id}: ${message}`);
  failures += 1;
}

/** 區域必須是四方向連通的一塊，否則玩家看到的會是分散的色塊。 */
function isContiguous(regions: RegionGrid, letter: string): boolean {
  const n = regions.length;
  const cells: [number, number][] = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) if (regions[r]![c] === letter) cells.push([r, c]);
  }
  if (cells.length === 0) return false;
  const seen = new Set<string>([`${cells[0]![0]},${cells[0]![1]}`]);
  const stack = [cells[0]!];
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
      const i = r + dr;
      const j = c + dc;
      if (i < 0 || i >= n || j < 0 || j >= n) continue;
      if (regions[i]![j] !== letter) continue;
      const k = `${i},${j}`;
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push([i, j]);
    }
  }
  return seen.size === cells.length;
}

function verify(puzzle: Puzzle): void {
  const n = puzzle.size;
  const spec = getSpec(puzzle.difficulty);

  if (spec.size !== n) fail(puzzle, `尺寸 ${n} 與難度設定 ${spec.size} 不符`);
  if (puzzle.regions.length !== n) fail(puzzle, `regions 只有 ${puzzle.regions.length} 列`);
  if (puzzle.regions.some((row) => row.length !== n)) fail(puzzle, 'regions 有列長度不對');

  const letters = new Set<string>();
  for (const row of puzzle.regions) for (const ch of row) letters.add(ch);
  if (letters.size !== n) fail(puzzle, `區域數 ${letters.size}，應為 ${n}`);
  for (const letter of letters) {
    if (!isContiguous(puzzle.regions, letter)) fail(puzzle, `區域 ${letter} 不連通`);
  }

  // 解本身要合法
  const sol = puzzle.solution;
  if (sol.length !== n) fail(puzzle, `solution 長度 ${sol.length}`);
  if (new Set(sol).size !== n) fail(puzzle, 'solution 有重複欄位');
  for (let r = 1; r < n; r += 1) {
    if (Math.abs(sol[r]! - sol[r - 1]!) < 2) fail(puzzle, `第 ${r} 列與前一列的柯基相鄰`);
  }
  const solRegions = new Set(sol.map((c, r) => puzzle.regions[r]![c]!));
  if (solRegions.size !== n) fail(puzzle, 'solution 沒有覆蓋每個區域各一次');

  // 唯一解
  const count = countSolutions(puzzle.regions, 2);
  if (count !== 1) fail(puzzle, count === 0 ? '無解' : '不只一組解');

  // 起手提示必須落在正解上，否則玩家一開局就在錯的盤面上推理
  for (const [r, c] of puzzle.given) {
    if (sol[r] !== c) fail(puzzle, `起手提示 (${r},${c}) 不在正解上`);
  }
  if (puzzle.given.length !== spec.givenCount) {
    fail(puzzle, `起手提示 ${puzzle.given.length} 個，難度設定為 ${spec.givenCount}`);
  }

  // 玩家實際感受到的難度（含起手提示）要符合難度設定
  const known = new Map(puzzle.given.map(([r, c]) => [r, c] as const));
  const tech = analyse(puzzle.regions, known).technique;
  if (tech !== spec.technique) {
    fail(puzzle, `難度等級 ${tech}，${spec.name} 應為 ${spec.technique}`);
  }
}

const t0 = Date.now();
let total = 0;
for (const [difficulty, list] of Object.entries(LEVELS)) {
  console.log(`檢查 ${difficulty}（${list.length} 關）`);
  const seen = new Set<string>();
  for (const puzzle of list) {
    total += 1;
    verify(puzzle);
    const fingerprint = puzzle.regions.join('|');
    if (seen.has(fingerprint)) fail(puzzle, '與同難度的其他關卡重複');
    seen.add(fingerprint);
  }
}

console.log(`\n共 ${total} 關，耗時 ${Date.now() - t0}ms`);
if (failures > 0) {
  console.error(`失敗 ${failures} 項`);
  process.exit(1);
}
console.log('全部通過');

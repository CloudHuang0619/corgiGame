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
import { getLevelSpec } from '../src/core/generator.ts';
import { buildShape, VOID } from '../src/core/shape.ts';
import { analyseOn, findSolutionsOn } from '../src/core/solver-general.ts';
import type { Puzzle, RegionGrid } from '../src/core/types.ts';

let failures = 0;

function fail(puzzle: Puzzle, message: string): void {
  console.error(`  X 第 ${puzzle.level} 關: ${message}`);
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

/**
 * 疊加型的驗證。
 *
 * 不能沿用單一盤面那套：複合圖的區域數不等於邊長，解也不是排列，
 * 「相鄰列的欄差 >= 2」更是不成立（那條規則本來就是排列表示法的副產品）。
 * 改成直接用通用求解器與形狀模型驗，跟遊戲執行時走的是同一條路。
 */
function verifyComposite(puzzle: Puzzle, index: number): void {
  const n = puzzle.size;
  if (puzzle.level !== index + 1) fail(puzzle, `編號 ${puzzle.level} 與位置 ${index + 1} 不符`);
  if (puzzle.regions.length !== n) fail(puzzle, `regions 只有 ${puzzle.regions.length} 列`);
  if (puzzle.regions.some((row) => row.length !== n)) fail(puzzle, 'regions 有列長度不對');

  const cells = puzzle.solutionCells;
  if (!cells || cells.length === 0) { fail(puzzle, '缺少 solutionCells'); return; }

  const letters = new Set<string>();
  for (const row of puzzle.regions) for (const ch of row) if (ch !== VOID) letters.add(ch);
  if (letters.size !== cells.length) {
    fail(puzzle, `區域數 ${letters.size} 與柯基數 ${cells.length} 不符`);
  }
  for (const letter of letters) {
    if (!isContiguous(puzzle.regions, letter)) fail(puzzle, `區域 ${letter} 不連通`);
  }

  const shape = buildShape(puzzle.boards!, puzzle.regions);

  // 空洞不能有柯基，柯基之間不能相鄰
  for (const idx of cells) {
    if (!shape.present[idx]) fail(puzzle, `解答落在空洞 ${idx}`);
    for (const nb of shape.neighbours[idx]!) {
      if (cells.includes(nb)) fail(puzzle, `解答有兩隻柯基相鄰（${idx} 與 ${nb}）`);
    }
  }
  // 每個群組恰好一隻
  shape.groups.forEach((g, gi) => {
    const hit = g.filter((c) => cells.includes(c)).length;
    if (hit !== 1) fail(puzzle, `第 ${gi} 個群組（${shape.groupKinds[gi]}）有 ${hit} 隻柯基`);
  });

  const found = findSolutionsOn(shape, 2);
  if (found.length !== 1) fail(puzzle, found.length === 0 ? '無解' : '不只一組解');

  // 疊加關卡落在第 17 關之後，難度曲線要求 Advanced
  const tech = analyseOn(shape).technique;
  if (tech !== getLevelSpec(puzzle.level).technique) {
    fail(puzzle, `難度等級 ${tech}，關卡曲線要求 ${getLevelSpec(puzzle.level).technique}`);
  }
}

function verify(puzzle: Puzzle, index: number): void {
  if (puzzle.boards && puzzle.boards.length > 1) {
    verifyComposite(puzzle, index);
    return;
  }

  const n = puzzle.size;
  const spec = getLevelSpec(puzzle.level);

  if (puzzle.level !== index + 1) fail(puzzle, `編號 ${puzzle.level} 與位置 ${index + 1} 不符`);
  if (spec.size !== n) fail(puzzle, `尺寸 ${n} 與關卡曲線的 ${spec.size} 不符`);
  if (puzzle.regions.length !== n) fail(puzzle, `regions 只有 ${puzzle.regions.length} 列`);
  if (puzzle.regions.some((row) => row.length !== n)) fail(puzzle, 'regions 有列長度不對');

  const letters = new Set<string>();
  for (const row of puzzle.regions) for (const ch of row) letters.add(ch);
  if (letters.size !== n) fail(puzzle, `區域數 ${letters.size}，應為 ${n}`);
  for (const letter of letters) {
    if (!isContiguous(puzzle.regions, letter)) fail(puzzle, `區域 ${letter} 不連通`);
  }

  const sol = puzzle.solution;
  if (sol.length !== n) fail(puzzle, `solution 長度 ${sol.length}`);
  if (new Set(sol).size !== n) fail(puzzle, 'solution 有重複欄位');
  for (let r = 1; r < n; r += 1) {
    if (Math.abs(sol[r]! - sol[r - 1]!) < 2) fail(puzzle, `第 ${r} 列與前一列的柯基相鄰`);
  }
  if (new Set(sol.map((c, r) => puzzle.regions[r]![c]!)).size !== n) {
    fail(puzzle, 'solution 沒有覆蓋每個區域各一次');
  }

  const count = countSolutions(puzzle.regions, 2);
  if (count !== 1) fail(puzzle, count === 0 ? '無解' : '不只一組解');

  const tech = analyse(puzzle.regions).technique;
  if (tech !== spec.technique) {
    fail(puzzle, `難度等級 ${tech}，關卡曲線要求 ${spec.technique}`);
  }
}

const t0 = Date.now();
const seen = new Set<string>();
LEVELS.forEach((puzzle, index) => {
  verify(puzzle, index);
  const fingerprint = puzzle.regions.join('|');
  if (seen.has(fingerprint)) fail(puzzle, '與其他關卡盤面重複');
  seen.add(fingerprint);
});

console.log(`共 ${LEVELS.length} 關，耗時 ${Date.now() - t0}ms`);
if (failures > 0) {
  console.error(`失敗 ${failures} 項`);
  process.exit(1);
}
console.log('全部通過');

/**
 * 生成器容量測試：問「產到幾關會開始重複」。
 *
 *   npx tsx scripts/capacity.ts             # 每個盤面大小目標 300 張
 *   npx tsx scripts/capacity.ts --target 2000
 *
 * 量三件事：
 *   1. 撞到多少次重複（同一組區域配置）才湊滿目標張數
 *   2. 平均每張要花多少時間
 *   3. 底層的解空間有多大（合法排列數），這是理論上限的地板
 */

import { generatePuzzle, getLevelSpec } from '../src/core/generator.ts';
import { LAST_LEVEL } from '../src/core/levels.ts';

function parseTarget(): number {
  const args = process.argv.slice(2);
  const i = args.indexOf('--target');
  if (i === -1) return 300;
  const value = Number(args[i + 1]);
  return Number.isFinite(value) ? value : 300;
}

/** 合法排列數：每列每欄一隻、且相鄰兩列欄差 >= 2 的排列有幾種。 */
function countValidPermutations(n: number): number {
  let total = 0;
  const search = (row: number, usedCols: number, prevCol: number): void => {
    if (row === n) {
      total += 1;
      return;
    }
    for (let col = 0; col < n; col += 1) {
      if (usedCols & (1 << col)) continue;
      if (prevCol >= 0 && Math.abs(col - prevCol) < 2) continue;
      search(row + 1, usedCols | (1 << col), col);
    }
  };
  search(0, 0, -1);
  return total;
}

/** 關卡曲線上出現過的每一種（尺寸, 技巧）組合，各挑一個代表關卡來測。 */
function samplePoints(): { level: number; size: number; technique: number }[] {
  const seen = new Set<string>();
  const points: { level: number; size: number; technique: number }[] = [];
  for (let level = 1; level <= Math.max(LAST_LEVEL, 30); level += 1) {
    const spec = getLevelSpec(level);
    const k = `${spec.size}-${spec.technique}`;
    if (seen.has(k)) continue;
    seen.add(k);
    points.push({ level, size: spec.size, technique: spec.technique });
  }
  return points;
}

const target = parseTarget();
console.log(`目標：每種盤面 ${target} 張\n`);

for (const point of samplePoints()) {
  const permutations = countValidPermutations(point.size);

  const seen = new Set<string>();
  let duplicates = 0;
  let failures = 0;
  let seedsTried = 0;
  let seed = 1;
  const t0 = Date.now();

  while (seen.size < target && seedsTried < target * 200) {
    seedsTried += 1;
    seed += 7919;
    const puzzle = generatePuzzle(point.level, seed, { maxAttempts: 400 });
    if (!puzzle) {
      failures += 1;
      continue;
    }
    const fingerprint = puzzle.regions.join('|');
    if (seen.has(fingerprint)) {
      duplicates += 1;
      continue;
    }
    seen.add(fingerprint);
  }

  const ms = Date.now() - t0;
  console.log(`${point.size}×${point.size}（技巧 ${point.technique}，以第 ${point.level} 關為樣本）`);
  console.log(`  合法排列數（解空間地板）: ${permutations.toLocaleString()}`);
  console.log(`  產出不重複盤面: ${seen.size}`);
  console.log(`  重複撞擊: ${duplicates} 次   生成失敗: ${failures} 次`);
  console.log(`  耗時: ${(ms / 1000).toFixed(1)}s   平均每張 ${(ms / Math.max(1, seen.size)).toFixed(1)}ms`);
  console.log();
}

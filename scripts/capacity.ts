/**
 * 生成器容量測試：問「產到幾關會開始重複」。
 *
 *   npx tsx scripts/capacity.ts            # 每個難度目標 500 關
 *   npx tsx scripts/capacity.ts --target 2000
 *
 * 量三件事：
 *   1. 撞到多少次重複（同一組區域配置）才湊滿目標關數
 *   2. 平均每關要試幾個 seed、花多少時間
 *   3. 底層的解空間有多大（合法排列數），這是理論上限的地板
 */

import { DIFFICULTY_SPECS, generatePuzzle } from '../src/core/generator.ts';
import type { DifficultyId } from '../src/core/types.ts';

function parseTarget(): number {
  const args = process.argv.slice(2);
  const i = args.indexOf('--target');
  if (i === -1) return 500;
  const value = Number(args[i + 1]);
  return Number.isFinite(value) ? value : 500;
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

const target = parseTarget();
console.log(`目標：每個難度 ${target} 關\n`);

for (const spec of DIFFICULTY_SPECS) {
  const permutations = countValidPermutations(spec.size);

  const seen = new Set<string>();
  let duplicates = 0;
  let failures = 0;
  let seedsTried = 0;
  let seed = 1;
  const t0 = Date.now();
  // 記錄「第 N 關」時累積撞了幾次重複，用來看重複率怎麼隨規模上升
  const milestones: string[] = [];
  const marks = new Set([50, 100, 250, 500, 1000, 2000].filter((m) => m <= target));

  while (seen.size < target && seedsTried < target * 200) {
    seedsTried += 1;
    seed += 7919;
    const puzzle = generatePuzzle(spec.id as DifficultyId, seed, { maxAttempts: 400 });
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
    if (marks.has(seen.size)) {
      milestones.push(`${seen.size}關時累積重複 ${duplicates} 次`);
    }
  }

  const ms = Date.now() - t0;
  console.log(`${spec.name} (${spec.size}x${spec.size})`);
  console.log(`  合法排列數（解空間地板）: ${permutations.toLocaleString()}`);
  console.log(`  產出不重複關卡: ${seen.size}`);
  console.log(`  重複撞擊: ${duplicates} 次   生成失敗: ${failures} 次`);
  console.log(`  重複率: ${((duplicates / Math.max(1, seedsTried)) * 100).toFixed(2)}%`);
  console.log(`  耗時: ${(ms / 1000).toFixed(1)}s   平均每關 ${(ms / Math.max(1, seen.size)).toFixed(1)}ms`);
  if (milestones.length > 0) console.log(`  ${milestones.join(' / ')}`);
  console.log();
}

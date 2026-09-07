/**
 * 離線產生固定關卡表，寫入 src/core/levels.ts。
 *
 *   npm run levels                 # 預設 30 關
 *   npm run levels -- --count 60
 *   npm run levels -- --seed 1234
 *
 * 關卡必須是固定資料：規格已驗證同一個關號在不同 session 解析出逐格相同的
 * 分區，所以不能進遊戲時才隨機生成。用固定 seed，同樣的參數永遠產出同一批
 * 關卡，關卡表進版控之後每台機器的「第 N 關」都是同一張盤面。
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generatePuzzle, getLevelSpec } from '../src/core/generator.ts';
import { countSolutions } from '../src/core/solver.ts';
import type { Puzzle } from '../src/core/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/core/levels.ts');

function parseArgs(): { count: number; seed: number } {
  const args = process.argv.slice(2);
  const read = (flag: string, fallback: number): number => {
    const i = args.indexOf(flag);
    if (i === -1) return fallback;
    const value = Number(args[i + 1]);
    return Number.isFinite(value) ? value : fallback;
  };
  return { count: read('--count', 30), seed: read('--seed', 20260906) };
}

function build(count: number, baseSeed: number): Puzzle[] {
  const levels: Puzzle[] = [];

  for (let level = 1; level <= count; level += 1) {
    const spec = getLevelSpec(level);
    let seed = baseSeed + level * 104729; // 每關一段獨立的 seed 區間
    let puzzle: Puzzle | null = null;

    for (let tries = 0; tries < 400 && !puzzle; tries += 1) {
      seed += 7919;
      const candidate = generatePuzzle(level, seed, { maxAttempts: 4000 });
      if (!candidate) continue;
      // 保險起見再驗一次唯一解，避免生成器改動後靜默產出壞關卡
      if (countSolutions(candidate.regions, 2) !== 1) {
        console.error(`  !! 第 ${level} 關 seed=${seed} 唯一解驗證失敗，跳過`);
        continue;
      }
      puzzle = candidate;
    }

    if (!puzzle) {
      console.error(`  !! 第 ${level} 關（${spec.size}×${spec.size}）產不出來，放寬難度條件`);
      puzzle = generatePuzzle(level, seed, { relaxTechnique: true, maxAttempts: 20000 });
    }
    if (!puzzle) throw new Error(`第 ${level} 關無法產生`);

    levels.push(puzzle);
    console.error(`  第 ${level} 關 ${spec.size}×${spec.size} 技巧=${spec.technique}`);
  }

  return levels;
}

function serialise(levels: readonly Puzzle[]): string {
  const entries = levels
    .map((lv) => {
      const regions = lv.regions.map((r) => `      '${r}',`).join('\n');
      return [
        '  {',
        `    level: ${lv.level},`,
        `    size: ${lv.size},`,
        '    regions: [',
        regions,
        '    ],',
        `    solution: [${lv.solution.join(', ')}],`,
        '  },',
      ].join('\n');
    })
    .join('\n');

  return `// 此檔由 scripts/build-levels.ts 自動產生，請勿手動編輯。
// 重新產生：npm run levels
//
// 每一關都經過求解器驗證，確認「恰好一組解」。
//   regions  — 每個字元代表一個彩色區域
//   solution — solution[row] = 該列柯基所在的欄
//
// 開局是空盤面，不預先放柯基。

import type { Puzzle } from './types.ts';

export const LEVELS: readonly Puzzle[] = [
${entries}
];

export const LAST_LEVEL = LEVELS.length;

/** 關卡編號從 1 起算；超出範圍時回傳 null。 */
export function getLevel(level: number): Puzzle | null {
  return LEVELS[level - 1] ?? null;
}

/** 把關卡編號夾在有效範圍內，避免存檔指到不存在的關卡。 */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.min(Math.max(Math.trunc(level), 1), LAST_LEVEL);
}
`;
}

const { count, seed } = parseArgs();
console.error(`產生關卡：共 ${count} 關，seed=${seed}`);
const started = Date.now();
const levels = build(count, seed);
writeFileSync(OUT, serialise(levels), 'utf8');
console.error(`完成：${levels.length} 關，耗時 ${((Date.now() - started) / 1000).toFixed(1)}s → ${OUT}`);

/**
 * 離線產生固定關卡表，寫入 src/core/levels.ts。
 *
 *   npm run levels                 # 每個難度 6 關
 *   npm run levels -- --count 12   # 每個難度 12 關
 *   npm run levels -- --seed 1234
 *
 * 用固定 seed，所以同樣的參數永遠產出同一批關卡 —— 關卡表進版控後，
 * 玩家的「第 3 關」在任何機器上都是同一張盤面。
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DIFFICULTY_SPECS, generatePuzzle } from '../src/core/generator.ts';
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
  return { count: read('--count', 6), seed: read('--seed', 20260906) };
}

function build(count: number, baseSeed: number): Record<string, Puzzle[]> {
  const out: Record<string, Puzzle[]> = {};

  for (const spec of DIFFICULTY_SPECS) {
    const levels: Puzzle[] = [];
    const seen = new Set<string>();
    let seed = baseSeed;
    let guard = 0;

    while (levels.length < count && guard < count * 400) {
      guard += 1;
      seed += 7919; // 隨便挑的質數，讓 seed 之間拉開距離
      const puzzle = generatePuzzle(spec.id, seed, { maxAttempts: 4000 });
      if (!puzzle) continue;

      const fingerprint = puzzle.regions.join('|');
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);

      // 保險起見再驗一次唯一解，避免生成器改動後靜默產出壞關卡
      if (countSolutions(puzzle.regions, 2) !== 1) {
        console.error(`  !! ${spec.id} seed=${seed} 唯一解驗證失敗，跳過`);
        continue;
      }

      levels.push({ ...puzzle, id: `${spec.id}-${levels.length + 1}` });
      console.error(`  ${spec.id} #${levels.length} (${spec.size}x${spec.size}) seed=${seed}`);
    }

    if (levels.length < count) {
      console.error(`  !! ${spec.id} 只生出 ${levels.length}/${count} 關`);
    }
    out[spec.id] = levels;
  }

  return out;
}

function serialise(levels: Record<string, Puzzle[]>): string {
  const body = Object.entries(levels)
    .map(([id, list]) => {
      const entries = list
        .map((lv) => {
          const regions = lv.regions.map((r) => `      '${r}',`).join('\n');
          const given =
            lv.given.length === 0
              ? '[]'
              : `[${lv.given.map(([r, c]) => `[${r}, ${c}]`).join(', ')}]`;
          return [
            '    {',
            `      id: '${lv.id}',`,
            `      size: ${lv.size},`,
            `      difficulty: '${lv.difficulty}',`,
            '      regions: [',
            regions,
            '      ],',
            `      solution: [${lv.solution.join(', ')}],`,
            `      given: ${given},`,
            '    },',
          ].join('\n');
        })
        .join('\n');
      return `  ${id}: [\n${entries}\n  ],`;
    })
    .join('\n');

  return `// 此檔由 scripts/build-levels.ts 自動產生，請勿手動編輯。
// 重新產生：npm run levels
//
// 每一關都經過求解器驗證，確認「恰好一組解」。
//   regions  — 每個字元代表一個彩色區域
//   solution — solution[row] = 該列柯基所在的欄
//   given    — 開局就先擺好、不可更動的柯基

import type { DifficultyId, Puzzle } from './types.ts';

export const LEVELS: Record<DifficultyId, readonly Puzzle[]> = {
${body}
};

export function getLevel(difficulty: DifficultyId, index: number): Puzzle | null {
  return LEVELS[difficulty]?.[index] ?? null;
}

export function levelCount(difficulty: DifficultyId): number {
  return LEVELS[difficulty]?.length ?? 0;
}
`;
}

const { count, seed } = parseArgs();
console.error(`產生關卡：每個難度 ${count} 關，seed=${seed}`);
const started = Date.now();
const levels = build(count, seed);
writeFileSync(OUT, serialise(levels), 'utf8');
const total = Object.values(levels).reduce((sum, list) => sum + list.length, 0);
console.error(`完成：${total} 關，耗時 ${((Date.now() - started) / 1000).toFixed(1)}s → ${OUT}`);

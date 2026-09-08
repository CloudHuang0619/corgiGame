/**
 * 把關卡表的一段換成疊加型盤面。
 *
 *   npm run composite                        # 預設換掉 50–100 關
 *   npm run composite -- --from 50 --to 100
 *   npm run composite -- --tries 40000       # 搜尋次數，越多品質越好
 *
 * 為什麼是「局部置換」而不是重新產生整張表：已經有人在玩，她的進度落在
 * 前段。`loadSession` 只比對關號與盤面尺寸（見 storage.ts），關號與尺寸都
 * 相同但區域配置換掉的話，她進行中的盤面會直接壞掉而且無從察覺。所以
 * 除了指定的區間，其餘每一關都必須逐字不變。
 *
 * 腳本啟動時會先自我檢查：把目前的關卡表重新序列化一次，逐字比對硬碟上的
 * 檔案。對不上就中止 —— 那代表序列化器與既有檔案格式有出入，繼續寫下去會
 * 連沒要動的關卡一起改掉。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEVELS } from '../src/core/levels.ts';
import { generateComposite, shapeOf } from '../src/core/generator-composite.ts';
import { analyseOn, findSolutionsOn } from '../src/core/solver-general.ts';
import { Technique } from '../src/core/types.ts';
import type { Puzzle, SubBoard } from '../src/core/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/core/levels.ts');

/**
 * 疊加型的難度坡度。
 *
 * 一進第 50 關就給滿版的兩個 7×7 疊 4 格，等於同時丟出三件新事情：規則變了、
 * 盤面變形了、重疊區還很深。分成三段，讓三個維度一起慢慢長 ——
 * 複合邊長 8→9→10、共用格 4→9→16 —— 玩家有十一關的時間只需要消化「重疊」
 * 這一個概念本身。
 *
 * 三段的每格邊長分別是 47.5 / 42.2 / 38.0 px，都在舒適範圍（現行最大的
 * 單一 10×10 就是 38px）。再往上疊會掉到 27px，而放柯基是快速連點，
 * 目標變小會直接推高誤觸率。
 */
interface Stage {
  readonly from: number;
  readonly to: number;
  readonly boards: readonly SubBoard[];
}

const STAGES: readonly Stage[] = [
  {
    from: 50,
    to: 60,
    boards: [{ row: 0, col: 0, size: 5 }, { row: 3, col: 3, size: 5 }],
  },
  {
    from: 61,
    to: 75,
    boards: [{ row: 0, col: 0, size: 6 }, { row: 3, col: 3, size: 6 }],
  },
  {
    from: 76,
    to: 100,
    boards: [{ row: 0, col: 0, size: 7 }, { row: 3, col: 3, size: 7 }],
  },
];

function parseArgs(): { from: number; to: number; tries: number; seed: number } {
  const args = process.argv.slice(2);
  const read = (flag: string, fallback: number): number => {
    const i = args.indexOf(flag);
    if (i === -1) return fallback;
    const v = Number(args[i + 1]);
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    from: read('--from', 50),
    to: read('--to', 100),
    tries: read('--tries', 40000),
    seed: read('--seed', 20260908),
  };
}

function serialise(levels: readonly Puzzle[]): string {
  const entries = levels
    .map((lv) => {
      const regions = lv.regions.map((r) => `      '${r}',`).join('\n');
      const lines = [
        '  {',
        `    level: ${lv.level},`,
        `    size: ${lv.size},`,
        '    regions: [',
        regions,
        '    ],',
        `    solution: [${lv.solution.join(', ')}],`,
      ];
      if (lv.boards) {
        const boards = lv.boards
          .map((b) => `{ row: ${b.row}, col: ${b.col}, size: ${b.size} }`)
          .join(', ');
        lines.push(`    boards: [${boards}],`);
        lines.push(`    solutionCells: [${(lv.solutionCells ?? []).join(', ')}],`);
      }
      lines.push('  },');
      return lines.join('\n');
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

interface Candidate {
  readonly puzzle: Puzzle;
  readonly ratio: number;
}

function search(
  boards: readonly SubBoard[],
  tries: number,
  baseSeed: number,
  need: number,
): Candidate[] {
  const found: Candidate[] = [];
  const seenRegions = new Set<string>();

  for (let i = 0; i < tries; i += 1) {
    const seed = baseSeed + i * 7919;
    const made = generateComposite(0, boards, seed, Technique.Advanced, 30);
    if (!made) continue;

    const key = made.regions.join('|');
    if (seenRegions.has(key)) continue;
    seenRegions.add(key);

    const shape = shapeOf(boards, made.regions);
    const ratio = analyseOn(shape).steps.length / shape.corgiCount;
    if (ratio < 0.3) continue;

    found.push({
      ratio,
      puzzle: {
        level: 0,
        size: made.size,
        regions: made.regions,
        solution: [],
        boards: [...boards],
        solutionCells: [...made.solutionCells],
      },
    });
  }

  // 可推導比例高的優先 —— 被換掉的那批有 82% 連第一步都推不出來，
  // 這一批至少要比那個好，不然換了也只是換一種猜法
  found.sort((a, b) => b.ratio - a.ratio);
  return found.slice(0, need);
}

function main(): void {
  const { from, to, tries, seed } = parseArgs();

  // 自我檢查：不能動到指定區間以外的任何一關
  const current = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n');
  if (serialise(LEVELS) !== current) {
    console.error('序列化器與現有 levels.ts 不一致，中止 —— 繼續寫會改到不該動的關卡。');
    process.exit(1);
  }
  console.error('自我檢查通過：序列化結果與現有檔案逐字相同');

  const byLevel = new Map<number, Candidate>();
  for (const stage of STAGES) {
    const lo = Math.max(stage.from, from);
    const hi = Math.min(stage.to, to);
    if (lo > hi) continue;
    const want = hi - lo + 1;
    const label = `${stage.boards.length} 個 ${stage.boards[0]!.size}×${stage.boards[0]!.size}`;
    console.error(`第 ${lo}–${hi} 關（${label}）搜尋 ${want} 張，最多 ${tries} 次…`);
    const picked = search(stage.boards, tries, seed + stage.from * 104729, want);
    if (picked.length < want) {
      console.error(`  只找到 ${picked.length} 張，不足 ${want} 張。請提高 --tries。`);
      process.exit(1);
    }
    const ratios = picked.map((c) => c.ratio);
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    console.error(
      `  可推導比例 最低 ${(Math.min(...ratios) * 100).toFixed(0)}%`
      + ` / 平均 ${(avg * 100).toFixed(0)}%`
      + ` / 最高 ${(Math.max(...ratios) * 100).toFixed(0)}%`,
    );
    picked.forEach((c, i) => byLevel.set(lo + i, c));
  }

  const next = LEVELS.map((lv) => {
    const c = byLevel.get(lv.level);
    if (!c) return lv;
    return { ...c.puzzle, level: lv.level };
  });

  // 最後再驗一次：換進去的每一關都要是唯一解
  for (const lv of next) {
    if (!lv.boards) continue;
    const n = findSolutionsOn(shapeOf(lv.boards, lv.regions), 2).length;
    if (n !== 1) throw new Error(`第 ${lv.level} 關唯一解驗證失敗（${n} 組解）`);
  }

  writeFileSync(OUT, serialise(next), 'utf8');

  console.error(`完成：第 ${from}–${to} 關換成疊加型`);
}

main();

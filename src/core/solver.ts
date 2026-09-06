/**
 * 求解器 —— 唯一解驗證、難度評分、提示推導。
 *
 * 關鍵觀察：規則要求「每列一隻、每欄一隻」，所以任何解必然是一個排列
 * perm[row] = col。在排列的前提下，同一列不可能有兩隻，因此「八格相鄰」
 * 只可能發生在相鄰的兩列之間，等價於 |perm[r] - perm[r+1]| >= 2。
 * 這讓搜尋空間從 C(N²,N) 縮到 N!，N=9 時快到可以在瀏覽器裡即時跑。
 */

import type { RegionGrid, Solution } from './types.ts';
import { Technique } from './types.ts';

const CHAR_A = 65;

function regionIndex(regions: RegionGrid, row: number, col: number): number {
  return regions[row]!.charCodeAt(col) - CHAR_A;
}

/**
 * 數出這張盤面有幾組解，最多數到 limit 就提前結束。
 * 驗證唯一解時傳 limit=2 即可 —— 我們只需要分辨 0 / 1 / 「不只一組」。
 */
export function countSolutions(regions: RegionGrid, limit = 2): number {
  const n = regions.length;
  let found = 0;

  const search = (row: number, usedCols: number, usedRegions: number, prevCol: number): void => {
    if (found >= limit) return;
    if (row === n) {
      found += 1;
      return;
    }
    for (let col = 0; col < n; col += 1) {
      if (usedCols & (1 << col)) continue;
      if (prevCol >= 0 && Math.abs(col - prevCol) < 2) continue;
      const rg = regionIndex(regions, row, col);
      if (usedRegions & (1 << rg)) continue;
      search(row + 1, usedCols | (1 << col), usedRegions | (1 << rg), col);
      if (found >= limit) return;
    }
  };

  search(0, 0, 0, -1);
  return found;
}

export function hasUniqueSolution(regions: RegionGrid): boolean {
  return countSolutions(regions, 2) === 1;
}

/**
 * 取出最多 limit 組解。
 *
 * 生成器需要「第二組解」才能知道該修哪裡 —— 光知道「不只一解」沒有用，
 * 得看到那組多餘的解長什麼樣，才能針對性地破壞它。
 */
export function findSolutions(regions: RegionGrid, limit: number): Solution[] {
  const n = regions.length;
  const results: number[][] = [];
  const acc: number[] = [];

  const search = (row: number, usedCols: number, usedRegions: number, prevCol: number): void => {
    if (results.length >= limit) return;
    if (row === n) {
      results.push([...acc]);
      return;
    }
    for (let col = 0; col < n; col += 1) {
      if (usedCols & (1 << col)) continue;
      if (prevCol >= 0 && Math.abs(col - prevCol) < 2) continue;
      const rg = regionIndex(regions, row, col);
      if (usedRegions & (1 << rg)) continue;
      acc.push(col);
      search(row + 1, usedCols | (1 << col), usedRegions | (1 << rg), col);
      acc.pop();
      if (results.length >= limit) return;
    }
  };

  search(0, 0, 0, -1);
  return results;
}

/** 找出第一組解；無解時回傳 null。 */
export function solve(regions: RegionGrid): Solution | null {
  const n = regions.length;
  const acc: number[] = [];

  const search = (row: number, usedCols: number, usedRegions: number, prevCol: number): boolean => {
    if (row === n) return true;
    for (let col = 0; col < n; col += 1) {
      if (usedCols & (1 << col)) continue;
      if (prevCol >= 0 && Math.abs(col - prevCol) < 2) continue;
      const rg = regionIndex(regions, row, col);
      if (usedRegions & (1 << rg)) continue;
      acc.push(col);
      if (search(row + 1, usedCols | (1 << col), usedRegions | (1 << rg), col)) return true;
      acc.pop();
    }
    return false;
  };

  return search(0, 0, 0, -1) ? acc : null;
}

// ---------------------------------------------------------------------------
// 邏輯推論引擎 —— 同時用於難度評分和遊戲內提示
// ---------------------------------------------------------------------------

/** 推論引擎每走一步所產生的紀錄，提示系統直接拿來用。 */
export interface DeductionStep {
  readonly row: number;
  readonly col: number;
  /** 這一步靠哪條線索推出來的 */
  readonly reason: 'row' | 'col' | 'region';
  /** 推導時用到的最高階技巧 */
  readonly technique: Technique;
}

export interface AnalysisResult {
  /** 用邏輯推論能推出的步驟（依序） */
  readonly steps: readonly DeductionStep[];
  /** 是否純靠邏輯就能完整解開 */
  readonly solvedByLogic: boolean;
  /** 全程用到的最高階技巧；推不完就是 Advanced */
  readonly technique: Technique;
}

interface EngineState {
  /** candidate[row][col] = 這格還有可能是柯基嗎 */
  readonly candidate: boolean[][];
  /** placed[row] = 該列已確定的欄，未確定為 -1 */
  readonly placed: number[];
}

function createState(n: number): EngineState {
  const candidate = Array.from({ length: n }, () => new Array<boolean>(n).fill(true));
  const placed = new Array<number>(n).fill(-1);
  return { candidate, placed };
}

/**
 * 以「人類會用的推論規則」去解盤面，回傳推導過程。
 *
 * @param known 已經確定的柯基（玩家已放好的），key = row、value = col。
 *              提示系統會把玩家目前盤面餵進來，才能給出「下一步」。
 */
export function analyse(regions: RegionGrid, known?: ReadonlyMap<number, number>): AnalysisResult {
  const n = regions.length;
  const state = createState(n);
  const steps: DeductionStep[] = [];
  let maxTechnique: Technique = Technique.Basic;

  // 把某個區域的所有格子先建索引，推論迴圈裡會反覆查
  const regionCells = new Map<string, [number, number][]>();
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const letter = regions[r]![c]!;
      let list = regionCells.get(letter);
      if (!list) {
        list = [];
        regionCells.set(letter, list);
      }
      list.push([r, c]);
    }
  }
  const allRegions = [...regionCells.keys()].sort();
  const placedRegions = new Set<string>();

  const place = (r: number, c: number): void => {
    state.placed[r] = c;
    placedRegions.add(regions[r]![c]!);
    const letter = regions[r]![c]!;
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (i === r || j === c || regions[i]![j] === letter) state.candidate[i]![j] = false;
      }
    }
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const i = r + dr;
        const j = c + dc;
        if (i >= 0 && i < n && j >= 0 && j < n) state.candidate[i]![j] = false;
      }
    }
    state.candidate[r]![c] = true;
  };

  // 先把玩家已放好的柯基套進去
  if (known) {
    for (const [r, c] of known) place(r, c);
  }

  let progress = true;
  while (progress && state.placed.filter((c) => c >= 0).length < n) {
    progress = false;

    // --- 技巧 1：某列 / 某欄 / 某區域只剩一個候選格 ---
    for (let r = 0; r < n; r += 1) {
      if (state.placed[r]! >= 0) continue;
      const spots: number[] = [];
      for (let c = 0; c < n; c += 1) if (state.candidate[r]![c]) spots.push(c);
      if (spots.length === 1) {
        place(r, spots[0]!);
        steps.push({ row: r, col: spots[0]!, reason: 'row', technique: Technique.Basic });
        progress = true;
      }
    }

    const takenCols = new Set(state.placed.filter((c) => c >= 0));
    for (let c = 0; c < n; c += 1) {
      if (takenCols.has(c)) continue;
      const spots: number[] = [];
      for (let r = 0; r < n; r += 1) {
        if (state.placed[r]! < 0 && state.candidate[r]![c]) spots.push(r);
      }
      if (spots.length === 1) {
        place(spots[0]!, c);
        steps.push({ row: spots[0]!, col: c, reason: 'col', technique: Technique.Basic });
        progress = true;
      }
    }

    for (const letter of allRegions) {
      if (placedRegions.has(letter)) continue;
      const spots = regionCells.get(letter)!.filter(([r, c]) => state.candidate[r]![c]);
      if (spots.length === 1) {
        const [r, c] = spots[0]!;
        place(r, c);
        steps.push({ row: r, col: c, reason: 'region', technique: Technique.Basic });
        progress = true;
      }
    }

    if (progress) continue;

    // --- 技巧 2：某區域的候選全落在同一列（或欄）→ 該列（欄）其餘格排除 ---
    for (const letter of allRegions) {
      if (placedRegions.has(letter)) continue;
      const spots = regionCells.get(letter)!.filter(([r, c]) => state.candidate[r]![c]);
      if (spots.length === 0) continue;
      const rows = new Set(spots.map(([r]) => r));
      const cols = new Set(spots.map(([, c]) => c));
      if (rows.size === 1) {
        const r = [...rows][0]!;
        for (let c = 0; c < n; c += 1) {
          if (state.candidate[r]![c] && regions[r]![c] !== letter) {
            state.candidate[r]![c] = false;
            progress = true;
            maxTechnique = Technique.Intermediate;
          }
        }
      }
      if (cols.size === 1) {
        const c = [...cols][0]!;
        for (let r = 0; r < n; r += 1) {
          if (state.candidate[r]![c] && regions[r]![c] !== letter) {
            state.candidate[r]![c] = false;
            progress = true;
            maxTechnique = Technique.Intermediate;
          }
        }
      }
    }

    // --- 技巧 2b：某列的候選全落在同一區域 → 該區域其餘格排除 ---
    for (let r = 0; r < n; r += 1) {
      if (state.placed[r]! >= 0) continue;
      const spots: number[] = [];
      for (let c = 0; c < n; c += 1) if (state.candidate[r]![c]) spots.push(c);
      if (spots.length === 0) continue;
      const letters = new Set(spots.map((c) => regions[r]![c]!));
      if (letters.size !== 1) continue;
      const letter = [...letters][0]!;
      for (const [i, j] of regionCells.get(letter)!) {
        if (i !== r && state.candidate[i]![j]) {
          state.candidate[i]![j] = false;
          progress = true;
          maxTechnique = Technique.Intermediate;
        }
      }
    }
  }

  const solvedByLogic = state.placed.every((c) => c >= 0);
  return {
    steps,
    solvedByLogic,
    technique: solvedByLogic ? maxTechnique : Technique.Advanced,
  };
}

/**
 * 給定玩家目前放好的柯基，推出「下一格可以確定的位置」。
 *
 * 刻意只回傳位置與理由，不直接幫玩家放 —— 提示應該是指路，不是代打。
 * 找不到純邏輯的下一步時（超難盤面可能發生），退回用正解補一格。
 */
export function nextHint(
  regions: RegionGrid,
  solution: Solution,
  placedCorgis: ReadonlyMap<number, number>,
): DeductionStep | null {
  // 玩家可能放錯，錯的線索餵進推論引擎只會得到矛盾。先過濾掉不在正解上的。
  const valid = new Map<number, number>();
  for (const [r, c] of placedCorgis) {
    if (solution[r] === c) valid.set(r, c);
  }

  const result = analyse(regions, valid);
  const fresh = result.steps.find((s) => !valid.has(s.row));
  if (fresh) return fresh;

  for (let r = 0; r < regions.length; r += 1) {
    if (!valid.has(r)) {
      return { row: r, col: solution[r]!, reason: 'row', technique: Technique.Advanced };
    }
  }
  return null;
}

/**
 * 盤面形狀 —— 把「哪些格子存在」與「哪些格子必須恰好一隻柯基」抽出來。
 *
 * 原本的求解器把兩件事寫死在型別裡：盤面是正方形、每一列恰好一隻，於是
 * 解必然是排列 perm[row] = col。那個假設換來很好的效能（見 solver.ts 開頭），
 * 但疊加型盤面兩條都不成立 —— 複合圖不是矩形，複合圖的「一列」也不對應
 * 單一約束（跨越兩個子盤面的那一列，兩邊各要一隻）。
 *
 * 所以這裡改用通用的表示法：一組格子，加上若干個「恰好一個」的群組。
 * 正方形盤面是它的特例（群組 = n 條列 + n 條欄 + n 個色區），疊加型只是
 * 群組來自多個子盤面而已。引擎不需要知道兩者的差別。
 */

import type { RegionGrid, SubBoard } from './types.ts';

export type { SubBoard };

/** 約束群組的來源，UI 要據此高亮對應的規則卡。 */
export type GroupKind = 'row' | 'col' | 'region';

export interface Shape {
  /** 邊界方框邊長。單一盤面就是 n，疊加型是複合圖的外接正方形 */
  readonly span: number;
  /** 存在的格子索引（row * span + col），已排序 */
  readonly cells: readonly number[];
  /** cellAt[index] = true 表示該格存在。查詢用，避免每次掃 cells */
  readonly present: readonly boolean[];
  /** 每個群組是一串格子索引，語意是「恰好一隻柯基」 */
  readonly groups: readonly (readonly number[])[];
  readonly groupKinds: readonly GroupKind[];
  /** 每格屬於哪些群組，推論引擎反覆查 */
  readonly groupsOfCell: readonly (readonly number[])[];
  /** 每格的八方鄰居（只含存在的格） */
  readonly neighbours: readonly (readonly number[])[];
  /** 子盤面；單一盤面就是一個涵蓋全圖的項目 */
  readonly boards: readonly SubBoard[];
  /** 解答會有幾隻柯基 —— 等於獨立的「恰好一個」群組能同時滿足的數量 */
  readonly corgiCount: number;
}

export const VOID = '.';

/**
 * 從子盤面清單與色區網格建出形狀。
 *
 * 色區群組是從 regions 網格推出來的（同一個字母 = 同一個群組），而不是另外
 * 傳進來，因為色區本來就以網格形式存在，兩份資料容易不同步。
 */
export function buildShape(boards: readonly SubBoard[], regions: RegionGrid): Shape {
  const span = regions.length;
  const present = new Array<boolean>(span * span).fill(false);
  const cells: number[] = [];

  for (let r = 0; r < span; r += 1) {
    for (let c = 0; c < span; c += 1) {
      if (regions[r]![c] === VOID) continue;
      present[r * span + c] = true;
      cells.push(r * span + c);
    }
  }

  const groups: number[][] = [];
  const groupKinds: GroupKind[] = [];

  // 每個子盤面的每一列、每一欄各是一個群組。
  // 跨兩個子盤面的複合列會產生兩個群組，這正是疊加型的關鍵。
  for (const b of boards) {
    for (let i = 0; i < b.size; i += 1) {
      const rowCells: number[] = [];
      const colCells: number[] = [];
      for (let j = 0; j < b.size; j += 1) {
        const rc = (b.row + i) * span + (b.col + j);
        const cc = (b.row + j) * span + (b.col + i);
        if (present[rc]) rowCells.push(rc);
        if (present[cc]) colCells.push(cc);
      }
      if (rowCells.length > 0) { groups.push(rowCells); groupKinds.push('row'); }
      if (colCells.length > 0) { groups.push(colCells); groupKinds.push('col'); }
    }
  }

  // 色區：同一個字母的所有格子。疊加型的色區可以跨子盤面
  const byLetter = new Map<string, number[]>();
  for (const idx of cells) {
    const letter = regions[Math.floor(idx / span)]![idx % span]!;
    let list = byLetter.get(letter);
    if (!list) { list = []; byLetter.set(letter, list); }
    list.push(idx);
  }
  for (const letter of [...byLetter.keys()].sort()) {
    groups.push(byLetter.get(letter)!);
    groupKinds.push('region');
  }

  const groupsOfCell: number[][] = Array.from({ length: span * span }, () => []);
  groups.forEach((g, gi) => { for (const idx of g) groupsOfCell[idx]!.push(gi); });

  const neighbours: number[][] = Array.from({ length: span * span }, () => []);
  for (const idx of cells) {
    const r = Math.floor(idx / span);
    const c = idx % span;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= span || nc < 0 || nc >= span) continue;
        const n = nr * span + nc;
        if (present[n]) neighbours[idx]!.push(n);
      }
    }
  }

  // 柯基數 = 色區數。每個色區恰好一隻，而色區是覆蓋全圖且互斥的
  const corgiCount = byLetter.size;

  return { span, cells, present, groups, groupKinds, groupsOfCell, neighbours, boards, corgiCount };
}

/** 單一正方形盤面 —— 疊加型的特例，只有一個涵蓋全圖的子盤面。 */
export function squareShape(regions: RegionGrid): Shape {
  return buildShape([{ row: 0, col: 0, size: regions.length }], regions);
}

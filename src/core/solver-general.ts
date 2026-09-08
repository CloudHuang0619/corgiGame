/**
 * 通用求解器 —— 在任意形狀上跑，不假設盤面是正方形。
 *
 * solver.ts 的版本把解看成排列 perm[row] = col，用位元遮罩沿列往下搜，很快，
 * 但那個表示法只對「正方形 + 每列恰好一隻」成立。疊加型的複合列跨越兩個
 * 子盤面，各要一隻，排列表示法直接不適用。
 *
 * 這裡改成在格子上搜尋，約束來自 Shape 的群組。代價是失去了排列的剪枝，
 * 換來的是同一套程式碼同時吃單一盤面與疊加盤面 —— 前者只是群組剛好等於
 * 「n 條列 + n 條欄 + n 個色區」的特例。
 *
 * 搜尋策略是「每次挑候選最少的群組」（最小剩餘值），這在約束交織的疊加型
 * 盤面上特別有效：共用格同時屬於多個群組，一旦某個群組被逼到只剩一格，
 * 連鎖排除會立刻擴散出去。
 */

import type { Shape } from './shape.ts';

/** 解答以格子索引集合表示（升冪），不再是 perm。 */
export type CellSolution = readonly number[];

interface SearchState {
  /** 每格是否還可能放柯基 */
  readonly alive: Uint8Array;
  /** 每個群組已放了幾隻 */
  readonly filled: Int32Array;
  /** 每個群組還剩幾個活著的候選格 */
  readonly remaining: Int32Array;
  readonly placed: number[];
}

function initial(shape: Shape): SearchState {
  const alive = new Uint8Array(shape.span * shape.span);
  for (const idx of shape.cells) alive[idx] = 1;
  const filled = new Int32Array(shape.groups.length);
  const remaining = Int32Array.from(shape.groups.map((g) => g.length));
  return { alive, filled, remaining, placed: [] };
}

/**
 * 放下一隻柯基，回傳可還原的操作紀錄。
 *
 * 手動記錄被關掉的格子而不是整份複製狀態，是因為搜尋很深、複製的成本會
 * 主導整個執行時間。回溯時照紀錄還原即可。
 */
function place(shape: Shape, st: SearchState, idx: number): number[] | null {
  const killed: number[] = [];

  /*
   * 關掉一格，回報「這一步有沒有把某個群組逼死」。
   *
   * 注意迴圈一定要跑完才判定。早期版本在偵測到死路時就 return，於是那一格
   * 剩下的群組沒被扣到 remaining，可是 undo 會把它的所有群組都加回去 ——
   * 計數只增不減，狀態腐化，搜尋在垃圾狀態裡永遠繞不出來。扣減與還原必須
   * 嚴格對稱。
   */
  const kill = (cell: number): boolean => {
    if (!st.alive[cell]) return true;
    st.alive[cell] = 0;
    killed.push(cell);
    let dead = false;
    for (const gi of shape.groupsOfCell[cell]!) {
      st.remaining[gi]! -= 1;
      // 這個群組還沒放到柯基，候選卻歸零 —— 死路
      if (st.remaining[gi] === 0 && st.filled[gi] === 0) dead = true;
    }
    return !dead;
  };

  st.alive[idx] = 0;
  killed.push(idx);
  let doubled = false;
  for (const gi of shape.groupsOfCell[idx]!) {
    st.filled[gi]! += 1;
    st.remaining[gi]! -= 1;
    if (st.filled[gi]! > 1) doubled = true;
  }
  st.placed.push(idx);
  if (doubled) { undoPlace(shape, st, idx, killed); return null; }

  // 同群組的其他格、以及八方鄰居，都不能再放
  let ok = true;
  for (const gi of shape.groupsOfCell[idx]!) {
    for (const cell of shape.groups[gi]!) {
      if (cell !== idx && !kill(cell)) ok = false;
    }
  }
  for (const cell of shape.neighbours[idx]!) {
    if (!kill(cell)) ok = false;
  }
  if (!ok) { undoPlace(shape, st, idx, killed); return null; }
  return killed;
}

function undo(shape: Shape, st: SearchState, killed: readonly number[]): void {
  for (let i = killed.length - 1; i >= 0; i -= 1) {
    const cell = killed[i]!;
    if (st.alive[cell]) continue;
    st.alive[cell] = 1;
    for (const gi of shape.groupsOfCell[cell]!) st.remaining[gi]! += 1;
  }
}

function undoPlace(shape: Shape, st: SearchState, idx: number, killed: readonly number[]): void {
  st.placed.pop();
  for (const gi of shape.groupsOfCell[idx]!) st.filled[gi]! -= 1;
  // idx 自己的 remaining 在 kill 迴圈外先扣過，undo 會一併加回來
  undo(shape, st, killed);
}

/** 挑「還沒滿足、候選最少」的群組。回傳 null 表示全部群組都已滿足。 */
function pickGroup(shape: Shape, st: SearchState): number | null {
  let best = -1;
  let bestCount = Infinity;
  for (let gi = 0; gi < shape.groups.length; gi += 1) {
    if (st.filled[gi]! > 0) continue;
    const count = st.remaining[gi]!;
    if (count < bestCount) { best = gi; bestCount = count; }
    if (bestCount <= 1) break;
  }
  return best === -1 ? null : best;
}

/**
 * 找出最多 limit 組解。驗證唯一解傳 limit=2 就夠 —— 只需分辨 0 / 1 / 不只一組。
 */
export function findSolutionsOn(shape: Shape, limit: number): CellSolution[] {
  const st = initial(shape);
  const out: CellSolution[] = [];

  const search = (): void => {
    if (out.length >= limit) return;
    const gi = pickGroup(shape, st);
    if (gi === null) { out.push([...st.placed].sort((a, b) => a - b)); return; }
    if (st.remaining[gi] === 0) return;
    for (const idx of shape.groups[gi]!) {
      if (!st.alive[idx]) continue;
      const killed = place(shape, st, idx);
      if (killed) {
        search();
        undoPlace(shape, st, idx, killed);
      }
      if (out.length >= limit) return;
    }
  };

  search();
  return out;
}

export function countSolutionsOn(shape: Shape, limit = 2): number {
  return findSolutionsOn(shape, limit).length;
}

export function hasUniqueSolutionOn(shape: Shape): boolean {
  return countSolutionsOn(shape, 2) === 1;
}

export function solveOn(shape: Shape): CellSolution | null {
  return findSolutionsOn(shape, 1)[0] ?? null;
}

// ---------------------------------------------------------------------------
// 推論引擎 —— 難度評分與遊戲內提示共用
// ---------------------------------------------------------------------------

import type { GroupKind } from './shape.ts';
import { Technique } from './types.ts';

export interface CellStep {
  readonly cell: number;
  readonly reason: GroupKind;
  readonly technique: Technique;
}

export interface CellAnalysis {
  readonly steps: readonly CellStep[];
  readonly solvedByLogic: boolean;
  readonly technique: Technique;
}

/**
 * 用「人類會用的推論規則」去解，回傳推導過程。
 *
 * 技巧 1：某個群組只剩一個候選格 → 那格必是柯基。
 * 技巧 2：群組 A 的候選全部落在群組 B 之內 → B 裡不屬於 A 的格子都可排除。
 *
 * 技巧 2 在這裡比原版更一般。solver.ts 拆成兩條特例寫（色區落在同一列、
 * 某列落在同一色區），但那其實是同一件事的兩個方向 —— 一旦改用群組表示，
 * 「A 的候選被 B 包住」一條就涵蓋了，而且順帶涵蓋列對欄、色區對色區這些
 * 原版沒處理的組合。疊加型會大量出現這類關係，因為共用格同時屬於兩個
 * 子盤面的列與欄。
 */
export function analyseOn(
  shape: Shape,
  known?: Iterable<number>,
): CellAnalysis {
  const alive = new Uint8Array(shape.span * shape.span);
  for (const idx of shape.cells) alive[idx] = 1;
  const settled = new Uint8Array(shape.groups.length);
  const steps: CellStep[] = [];
  let maxTechnique: Technique = Technique.Basic;
  let placedCount = 0;

  const place = (idx: number): void => {
    placedCount += 1;
    for (const gi of shape.groupsOfCell[idx]!) {
      settled[gi] = 1;
      for (const cell of shape.groups[gi]!) if (cell !== idx) alive[cell] = 0;
    }
    for (const cell of shape.neighbours[idx]!) alive[cell] = 0;
    alive[idx] = 1;
  };

  if (known) for (const idx of known) place(idx);

  const liveOf = (gi: number): number[] => shape.groups[gi]!.filter((c) => alive[c]);

  let progress = true;
  while (progress && placedCount < shape.corgiCount) {
    progress = false;

    // 技巧 1
    for (let gi = 0; gi < shape.groups.length; gi += 1) {
      if (settled[gi]) continue;
      const live = liveOf(gi);
      if (live.length === 1) {
        place(live[0]!);
        steps.push({ cell: live[0]!, reason: shape.groupKinds[gi]!, technique: Technique.Basic });
        progress = true;
      }
    }
    if (progress) continue;

    // 技巧 2
    for (let a = 0; a < shape.groups.length && !progress; a += 1) {
      if (settled[a]) continue;
      const liveA = liveOf(a);
      if (liveA.length === 0) continue;
      // 候選格共同所屬的群組才可能包住 A，從其中一格的群組清單找起就夠
      for (const b of shape.groupsOfCell[liveA[0]!]!) {
        if (b === a || settled[b]) continue;
        if (!liveA.every((c) => shape.groupsOfCell[c]!.includes(b))) continue;
        for (const cell of shape.groups[b]!) {
          if (alive[cell] && !liveA.includes(cell)) {
            alive[cell] = 0;
            progress = true;
            maxTechnique = Technique.Intermediate;
          }
        }
      }
    }
  }

  const solvedByLogic = placedCount >= shape.corgiCount;
  return { steps, solvedByLogic, technique: solvedByLogic ? maxTechnique : Technique.Advanced };
}

/**
 * Corgidoku 核心型別
 *
 * 這整個 core/ 資料夾不碰任何 DOM 或 React —— 未來要包 Capacitor、
 * 或整份搬到 React Native，都可以原封不動重用。
 */

/** 區域以單一大寫字母標記：A、B、C… 一個 N×N 盤面剛好有 N 個區域。 */
export type RegionId = string;

/** 一張盤面的區域配置：regions[row][col] 是該格所屬的區域字母。 */
export type RegionGrid = readonly string[];

/** 解答以排列表示：solution[row] = 該列柯基所在的欄。 */
export type Solution = readonly number[];

/** 一格的三種狀態。點擊會依序循環 empty → marked → corgi → empty。 */
export const CellState = {
  Empty: 'empty',
  /** 玩家標記「這裡不可能」的叉號 */
  Marked: 'marked',
  Corgi: 'corgi',
} as const;

export type CellState = (typeof CellState)[keyof typeof CellState];

export interface Coord {
  readonly row: number;
  readonly col: number;
}

/** 難度等級 —— 對應求解時需要用到的最高階推論技巧。 */
export const Technique = {
  /** 只需要「某列/欄/區域只剩一個候選格」 */
  Basic: 1,
  /** 需要「區域 ↔ 線」的交叉排除 */
  Intermediate: 2,
  /** 上述規則推不完，得靠試誤 */
  Advanced: 3,
} as const;

export type Technique = (typeof Technique)[keyof typeof Technique];

export interface Puzzle {
  /** 穩定識別碼，例如 "easy-1"。隨機生成的關卡用 "gen-<seed>"。 */
  readonly id: string;
  readonly size: number;
  readonly regions: RegionGrid;
  readonly solution: Solution;
  /** 開局就先擺好、不可更動的柯基 */
  readonly given: readonly (readonly [number, number])[];
  readonly difficulty: DifficultyId;
}

export type DifficultyId = 'easy' | 'hard' | 'expert';

export interface DifficultySpec {
  readonly id: DifficultyId;
  readonly name: string;
  readonly size: number;
  /** 目標推論技巧等級 */
  readonly technique: Technique;
  /** 開局先送幾隻柯基 */
  readonly givenCount: number;
}

/** 違規原因 —— UI 用來決定要把哪些格子標紅。 */
export const ConflictKind = {
  Row: 'row',
  Col: 'col',
  Region: 'region',
  Adjacent: 'adjacent',
} as const;

export type ConflictKind = (typeof ConflictKind)[keyof typeof ConflictKind];

export interface Conflict {
  readonly kind: ConflictKind;
  readonly cells: readonly Coord[];
}

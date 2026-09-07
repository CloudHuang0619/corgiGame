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

/**
 * 一格的狀態。
 *
 * 點擊循環是 empty → marked →（嘗試放柯基）。第三步會分岔：位置正確就是
 * corgi，錯了就是 error（紅色叉號）並扣一條命。因為每關保證唯一解，
 * 對錯是明確的。
 */
export const CellState = {
  Empty: 'empty',
  /** 玩家標記「這裡不可能」的白色叉號 */
  Marked: 'marked',
  Corgi: 'corgi',
  /** 放錯留下的紅色叉號，同時也是「這裡不可能」的記號 */
  Error: 'error',
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

/**
 * 一個關卡。
 *
 * 關卡是線性編號的，而且同一個編號永遠對應同一張盤面 —— 這是規格明確
 * 要求的（同關號在不同 session 解析出逐格相同的分區），所以關卡必須是
 * 預先產生的固定資料，不能進遊戲時才隨機生成。
 */
export interface Puzzle {
  /** 關卡編號，從 1 起算 */
  readonly level: number;
  readonly size: number;
  readonly regions: RegionGrid;
  readonly solution: Solution;
}

/** 四條規則。違規時 UI 要知道是哪一條，才能高亮對應的規則卡。 */
export const RuleId = {
  Row: 'row',
  Col: 'col',
  Region: 'region',
  Adjacent: 'adjacent',
} as const;

export type RuleId = (typeof RuleId)[keyof typeof RuleId];

/**
 * 失誤的兩種型態。
 *
 * 這是規格裡最關鍵的一條推導：遊戲不只檢查規則衝突，還會即時比對唯一解。
 * 證據是空盤面上放錯也會被拒絕扣命 —— 那時不可能有任何規則衝突。
 *
 * 兩種型態的回饋長度與元素不同，所以必須分開。
 */
export const FailureKind = {
  /** 型態 A：與盤面上既有的柯基牴觸，有明確的規則可以指出來 */
  RuleConflict: 'rule-conflict',
  /** 型態 B：沒有牴觸任何規則，但這格不在正解上 */
  NotSolution: 'not-solution',
} as const;

export type FailureKind = (typeof FailureKind)[keyof typeof FailureKind];

export interface Failure {
  readonly kind: FailureKind;
  readonly cell: Coord;
  /** 僅 RuleConflict 有值 —— UI 用它決定要高亮哪張規則卡 */
  readonly rule?: RuleId;
  /** 僅 RuleConflict 有值 —— UI 用它畫金色衝突外框 */
  readonly conflictCells?: readonly Coord[];
}

/**
 * 進度存檔（localStorage）
 *
 * 全部包在 try/catch 裡：無痕視窗、瀏覽器封鎖網站資料、或 Capacitor 的
 * WebView 設定不同時，存取都可能直接丟例外。存檔失敗不該讓遊戲當掉，
 * 頂多就是這局不記錄。
 */

import type { DifficultyId } from './types.ts';

const KEY = 'corgidoku.progress.v1';

export interface LevelRecord {
  /** 最佳完成時間（毫秒） */
  readonly bestMs: number;
  /** 該次最佳成績用了幾次提示 */
  readonly hintsUsed: number;
}

export interface Progress {
  /** progress[難度][關卡索引] = 成績；沒破過就沒有這個 key */
  readonly records: Partial<Record<DifficultyId, Record<number, LevelRecord>>>;
  /** 上次玩到哪 */
  readonly lastDifficulty: DifficultyId;
  readonly lastLevel: number;
}

const EMPTY: Progress = {
  records: {},
  lastDifficulty: 'easy',
  lastLevel: 0,
};

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      records: parsed.records ?? {},
      lastDifficulty: parsed.lastDifficulty ?? 'easy',
      lastLevel: parsed.lastLevel ?? 0,
    };
  } catch {
    return EMPTY;
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // 存不進去就算了，不影響這一局
  }
}

export function isCleared(progress: Progress, difficulty: DifficultyId, index: number): boolean {
  return progress.records[difficulty]?.[index] !== undefined;
}

export function clearedCount(progress: Progress, difficulty: DifficultyId): number {
  return Object.keys(progress.records[difficulty] ?? {}).length;
}

/** 記錄一次通關；只有成績更好才覆蓋舊紀錄。 */
export function recordClear(
  progress: Progress,
  difficulty: DifficultyId,
  index: number,
  elapsedMs: number,
  hintsUsed: number,
): Progress {
  const forDifficulty = { ...(progress.records[difficulty] ?? {}) };
  const previous = forDifficulty[index];
  if (!previous || elapsedMs < previous.bestMs) {
    forDifficulty[index] = { bestMs: elapsedMs, hintsUsed };
  }
  return {
    ...progress,
    records: { ...progress.records, [difficulty]: forDifficulty },
  };
}

export function rememberPosition(
  progress: Progress,
  difficulty: DifficultyId,
  index: number,
): Progress {
  return { ...progress, lastDifficulty: difficulty, lastLevel: index };
}

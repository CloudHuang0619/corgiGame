/**
 * 存檔（localStorage）
 *
 * 分成三份獨立的鍵，因為它們的生命週期完全不同：
 *   profile  玩家資料，跨關卡累積
 *   settings 設定，跟遊戲進度無關
 *   session  進行中的關卡，通關或放棄後就清掉
 *
 * 全部包在 try/catch 裡：無痕視窗、瀏覽器封鎖網站資料、或 Capacitor 的
 * WebView 設定不同時，存取都可能直接丟例外。存檔失敗不該讓遊戲當掉。
 */

import type { CellState } from './types.ts';
import type { GameState } from './game.ts';
import { MAX_LIVES } from './game.ts';

const PROFILE_KEY = 'corgidoku.profile.v2';
const SETTINGS_KEY = 'corgidoku.settings.v1';
const SESSION_KEY = 'corgidoku.session.v1';

// ---------------------------------------------------------------------------
// 玩家資料
// ---------------------------------------------------------------------------

export interface Powerups {
  /** 柯基道具：立刻在一個正確位置放下一隻 */
  readonly autoPlace: number;
  /** 提示道具 */
  readonly hint: number;
}

export interface PlayerProfile {
  /** 下一個要挑戰的關卡，從 1 起算 */
  readonly currentLevel: number;
  readonly nickname: string;
  readonly avatarId: string;
  readonly avatarFrameId: string;
  /** 骨頭總數。通關時把剩餘的命數加進來，之後排行榜會用到。 */
  readonly boneTotal: number;
  readonly powerups: Powerups;
  /** 每一關的最佳成績。key 是關卡編號。 */
  readonly bests: Record<number, LevelBest>;
}

export interface LevelBest {
  readonly score: number;
  readonly livesLeft: number;
  readonly elapsedMs: number;
}

/** 暱稱預設值取隨機英數，跟原版觀察到的「92CPR7」同一種形式。 */
function randomNickname(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const DEFAULT_PROFILE: PlayerProfile = {
  currentLevel: 1,
  nickname: '',
  avatarId: 'corgi',
  avatarFrameId: 'orange',
  boneTotal: 0,
  powerups: { autoPlace: 5, hint: 1 },
  bests: {},
};

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE, nickname: randomNickname() };
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      nickname: parsed.nickname || randomNickname(),
      powerups: { ...DEFAULT_PROFILE.powerups, ...(parsed.powerups ?? {}) },
      bests: parsed.bests ?? {},
    };
  } catch {
    return { ...DEFAULT_PROFILE, nickname: randomNickname() };
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // 存不進去就算了，不影響這一局
  }
}

/** 通關結算：關卡推進、骨頭入帳、更新最佳成績。 */
export function recordClear(
  profile: PlayerProfile,
  level: number,
  score: number,
  livesLeft: number,
  elapsedMs: number,
): PlayerProfile {
  const previous = profile.bests[level];
  const better =
    !previous || score > previous.score || (score === previous.score && elapsedMs < previous.elapsedMs);

  return {
    ...profile,
    currentLevel: Math.max(profile.currentLevel, level + 1),
    boneTotal: profile.boneTotal + livesLeft,
    bests: better ? { ...profile.bests, [level]: { score, livesLeft, elapsedMs } } : profile.bests,
  };
}

export function spendPowerup(profile: PlayerProfile, which: keyof Powerups): PlayerProfile {
  const left = profile.powerups[which];
  if (left <= 0) return profile;
  return { ...profile, powerups: { ...profile.powerups, [which]: left - 1 } };
}

export function grantPowerup(profile: PlayerProfile, which: keyof Powerups, count = 1): PlayerProfile {
  return { ...profile, powerups: { ...profile.powerups, [which]: profile.powerups[which] + count } };
}

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------

export interface Settings {
  readonly music: boolean;
  readonly sfx: boolean;
  readonly voice: boolean;
  readonly vibration: boolean;
  /** 色盲輔助：在區域色塊上疊加圖案紋理 */
  readonly patternMode: boolean;
  readonly locale: string;
  /** 測試工具：柯基動畫放慢三倍，用來逐格檢查對齊 */
  readonly slowMotion: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  music: true,
  sfx: true,
  voice: true,
  vibration: true,
  patternMode: false,
  locale: 'zh-Hant',
  slowMotion: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 同上
  }
}

// ---------------------------------------------------------------------------
// 進行中的關卡
// ---------------------------------------------------------------------------

/**
 * 只存會變動的部分，盤面資料（regions/solution）靠 level 重新取得。
 * 這讓存檔小很多，也避免關卡表更新後讀到舊盤面。
 */
interface StoredSession {
  readonly level: number;
  readonly board: CellState[][];
  readonly catsPlaced: number;
  readonly score: number;
  readonly lives: number;
  readonly streak: number;
  readonly hintsUsed: number;
  readonly startedAt: number;
}

export function saveSession(state: GameState): void {
  // 已通關或已失敗的局面不必留，下次進來應該是新的一局
  if (state.finishedAt !== null || state.lives <= 0 || state.revealed) {
    clearSession();
    return;
  }
  try {
    const payload: StoredSession = {
      level: state.puzzle.level,
      board: state.board.map((row) => [...row]),
      catsPlaced: state.catsPlaced,
      score: state.score,
      lives: state.lives,
      streak: state.streak,
      hintsUsed: state.hintsUsed,
      startedAt: state.startedAt,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // 同上
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // 同上
  }
}

/**
 * 讀回進行中的關卡。盤面尺寸對不上就丟棄 —— 關卡表若改過，
 * 舊存檔套到新盤面只會產生無法解的局面。
 */
export function loadSession(level: number, size: number): Partial<GameState> | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredSession;
    if (stored.level !== level) return null;
    if (stored.board.length !== size || stored.board.some((row) => row.length !== size)) return null;

    return {
      board: stored.board,
      catsPlaced: stored.catsPlaced,
      score: stored.score,
      lives: Math.min(stored.lives, MAX_LIVES),
      streak: stored.streak,
      hintsUsed: stored.hintsUsed,
      startedAt: stored.startedAt,
    };
  } catch {
    return null;
  }
}

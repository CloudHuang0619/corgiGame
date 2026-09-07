/**
 * 視覺常數
 *
 * 色票直接採用規格 §15.1 與 §14 兩張區域色表 —— 那是從實機畫面取樣出來的，
 * 照抄才會有原版的質感。區域色共 10 種，剛好對應最大盤面 10×10。
 */

/** 區域色。字母對應 regions 字串裡的字元。 */
export const REGION_COLORS: Record<string, string> = {
  A: '#F18C54', // 橘
  B: '#965E43', // 棕
  C: '#3BABB9', // 青
  D: '#86DF75', // 淺綠
  E: '#2B8F49', // 深綠
  F: '#C65782', // 玫紅
  G: '#9DC0E0', // 淺藍
  H: '#7C65D1', // 紫
  I: '#EC81DF', // 洋紅
  J: '#F8D579', // 奶油黃
  K: '#C2A108', // 橄欖（備用）
};

/**
 * 頭像。原版是 3D 渲染的動物頭像，這裡先用 emoji 佔位 ——
 * 形狀辨識度夠、不必等美術，之後換成圖檔只要改這張表。
 */
export interface AvatarDef {
  readonly id: string;
  readonly glyph: string;
}

export const AVATARS: readonly AvatarDef[] = [
  { id: 'corgi', glyph: '🐕' },
  { id: 'cat', glyph: '🐈' },
  { id: 'panda', glyph: '🐼' },
  { id: 'fox', glyph: '🦊' },
  { id: 'rabbit', glyph: '🐰' },
  { id: 'bear', glyph: '🐻' },
  { id: 'koala', glyph: '🐨' },
  { id: 'tiger', glyph: '🐯' },
];

/** 頭像框：八種顏色，與原版觀察到的色系一致。 */
export interface FrameDef {
  readonly id: string;
  readonly color: string;
}

export const AVATAR_FRAMES: readonly FrameDef[] = [
  { id: 'orange', color: '#E48722' },
  { id: 'red', color: '#D9534F' },
  { id: 'yellow', color: '#F0C043' },
  { id: 'skyblue', color: '#7FB6E8' },
  { id: 'green', color: '#5FBF6A' },
  { id: 'teal', color: '#3BABB9' },
  { id: 'indigo', color: '#5760A3' },
  { id: 'purple', color: '#7C65D1' },
];

export function frameColor(id: string): string {
  return AVATAR_FRAMES.find((f) => f.id === id)?.color ?? AVATAR_FRAMES[0]!.color;
}

export function avatarGlyph(id: string): string {
  return AVATARS.find((a) => a.id === id)?.glyph ?? AVATARS[0]!.glyph;
}

/**
 * 載入頁語錄。前兩則是實機錄影裡出現過的，其餘同風格補齊，
 * 每次啟動隨機取一則。
 */
export const QUOTES: readonly { text: string; author: string }[] = [
  { text: '改變看待事情的方式，你所看的事情也會跟著改變。', author: '偉恩·戴爾' },
  { text: '當你用正面的想法取代負面的想法，就會開始得到正面的結果。', author: '威利·尼爾森' },
  { text: '慢慢來比較快。', author: '佚名' },
  { text: '每一個不曾起舞的日子，都是對生命的辜負。', author: '尼采' },
  { text: '你不需要看見整座樓梯，只要踏出第一階。', author: '馬丁·路德·金恩' },
];

export function randomQuote(): { text: string; author: string } {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]!;
}

/** 每日挑戰的解鎖關卡。原版是第 21 關。 */
export const DAILY_CHALLENGE_UNLOCK_LEVEL = 21;

export const APP_VERSION = '0.2.0';

/**
 * 多語系
 *
 * 刻意做得很薄：一個字典查表加上 `{name}` 佔位替換，沒有複數規則、
 * 沒有日期格式化。這個遊戲的文案就是幾十條短句，引一套 i18n 函式庫
 * 反而是負擔。
 *
 * zh-Hant 是基準語言，它的鍵值型別 MessageKey 會強制其他語系補齊 ——
 * 少一條就編譯不過，不會靜默漏翻。
 */

import { en } from './en.ts';
import { ja } from './ja.ts';
import { zhHant } from './zh-Hant.ts';
import type { MessageKey } from './zh-Hant.ts';

export type { MessageKey };

export interface LocaleDef {
  readonly code: string;
  /** 母語名稱，語言選單的主標 */
  readonly native: string;
  /** 目前介面語言下的名稱，語言選單的副標 */
  readonly labelKey: string;
  readonly messages: Record<MessageKey, string>;
}

/**
 * 目前支援三種語言。原版列了八種，其餘五種只差字典檔 ——
 * 新增一個語系就是複製 en.ts、翻完、加進這個陣列，不必動任何程式邏輯。
 */
export const LOCALES: readonly LocaleDef[] = [
  { code: 'zh-Hant', native: '繁體中文', labelKey: '繁體中文', messages: zhHant },
  { code: 'en', native: 'English', labelKey: '英語', messages: en },
  { code: 'ja', native: '日本語', labelKey: '日語', messages: ja },
];

export const DEFAULT_LOCALE = 'zh-Hant';

export function getLocale(code: string): LocaleDef {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0]!;
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** 建立一個翻譯函式。找不到鍵值時回傳鍵值本身，方便一眼看出漏翻。 */
export function createTranslator(code: string): Translate {
  const locale = getLocale(code);
  return (key, vars) => {
    const template = locale.messages[key] ?? zhHant[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in vars ? String(vars[name]) : whole,
    );
  };
}

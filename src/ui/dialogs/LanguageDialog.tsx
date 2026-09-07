/**
 * 語言
 *
 * 每一列是「母語名稱（大字）+ 目前介面語言下的名稱（小字）」。
 * 選中即時切換整個介面 —— 讓玩家馬上看到效果，比按確定才套用直觀。
 */

import type { Translate } from '../../i18n/index.ts';
import { LOCALES } from '../../i18n/index.ts';
import { Dialog } from './Dialog.tsx';

interface LanguageDialogProps {
  readonly open: boolean;
  readonly t: Translate;
  readonly current: string;
  readonly onSelect: (code: string) => void;
  readonly onClose: () => void;
}

export function LanguageDialog({ open, t, current, onSelect, onClose }: LanguageDialogProps) {
  return (
    <Dialog open={open} title={t('language.title')} onClose={onClose}>
      <ul className="language-list">
        {LOCALES.map((locale) => (
          <li key={locale.code}>
            <button
              type="button"
              className={['language-row', locale.code === current ? 'is-selected' : ''].filter(Boolean).join(' ')}
              onClick={() => onSelect(locale.code)}
            >
              <span className="language-native">{locale.native}</span>
              <span className="language-label">{locale.labelKey}</span>
              {locale.code === current && (
                <svg className="language-check" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="11" fill="#fff" />
                  <path
                    d="M7 12.5 10.5 16 17 9"
                    stroke="#4CAF50"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              )}
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
        {t('language.confirm')}
      </button>
    </Dialog>
  );
}

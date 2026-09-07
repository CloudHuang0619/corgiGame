/**
 * 設定
 *
 * 有兩種版本，內容不同：首頁版有語言與條款、遊戲版有圖案模式與重新開始。
 * 兩邊共用四顆音訊／觸覺開關。
 *
 * 遊戲版另外掛了一區測試工具（復原／看答案／選關卡）—— 那些不屬於正式
 * 流程，只是開發期間要驗證盤面用的，所以刻意放在設定裡而不是主畫面。
 */

import { useState } from 'react';

import type { Settings } from '../../core/storage.ts';
import type { Translate } from '../../i18n/index.ts';
import { APP_VERSION } from '../theme.ts';
import { Dialog } from './Dialog.tsx';

type ToggleKey = 'music' | 'sfx' | 'voice' | 'vibration';

interface SettingsDialogProps {
  readonly open: boolean;
  readonly variant: 'home' | 'game';
  readonly t: Translate;
  readonly settings: Settings;
  readonly onChange: (next: Settings) => void;
  readonly onClose: () => void;
  readonly onOpenLanguage?: () => void;
  readonly onRestart?: () => void;
  /** 測試工具，只在遊戲版出現 */
  readonly dev?: {
    readonly canUndo: boolean;
    readonly revealed: boolean;
    readonly onUndo: () => void;
    readonly onReveal: () => void;
    readonly onPickLevel: () => void;
    readonly elapsed: string;
  };
}

const TOGGLE_ICONS: Record<ToggleKey, React.ReactNode> = {
  music: (
    <path d="M9 18V5l10-2v13" strokeLinecap="round" strokeLinejoin="round" />
  ),
  sfx: (
    <path
      d="M4 9v6h4l5 4V5L8 9H4Zm12 -1a5 5 0 0 1 0 8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  voice: (
    <path
      d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Zm-7 8a7 7 0 0 0 14 0M12 18v3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  vibration: (
    <path
      d="M8 4h8v16H8zM4 9v6M20 9v6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

export function SettingsDialog({
  open,
  variant,
  t,
  settings,
  onChange,
  onClose,
  onOpenLanguage,
  onRestart,
  dev,
}: SettingsDialogProps) {
  const [toast, setToast] = useState<string | null>(null);

  const toggle = (which: ToggleKey) => {
    const next = { ...settings, [which]: !settings[which] };
    onChange(next);
    const item = t(`settings.${which}` as const);
    setToast(next[which] ? t('settings.toastOn', { item }) : t('settings.toastOff', { item }));
    window.setTimeout(() => setToast(null), 1500);

    // 震動開關順手示範一下，玩家才知道它有沒有作用
    if (which === 'vibration' && next.vibration) navigator.vibrate?.(30);
  };

  const toggles: ToggleKey[] = ['music', 'sfx', 'voice', 'vibration'];

  return (
    <Dialog open={open} title={t('settings.title')} onClose={onClose}>
      {toast && <div className="toast">{toast}</div>}

      <div className="switch-row">
        {toggles.map((which) => (
          <button
            key={which}
            type="button"
            className={['switch-cell', settings[which] ? 'is-on' : 'is-off'].filter(Boolean).join(' ')}
            onClick={() => toggle(which)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              {TOGGLE_ICONS[which]}
              {/* 關閉時圖示加一道斜線，不必看開關也知道狀態 */}
              {!settings[which] && <path d="M3 21 21 3" strokeLinecap="round" />}
            </svg>
            <span className="switch-label">{t(`settings.${which}` as const)}</span>
            <span className="switch-pill">{settings[which] ? t('settings.on') : t('settings.off')}</span>
          </button>
        ))}
      </div>

      {variant === 'game' && (
        <button
          type="button"
          className={['setting-row', settings.patternMode ? 'is-on' : ''].filter(Boolean).join(' ')}
          onClick={() => onChange({ ...settings, patternMode: !settings.patternMode })}
        >
          <span>{t('settings.patternMode')}</span>
          <span className="switch-pill">
            {settings.patternMode ? t('settings.on') : t('settings.off')}
          </span>
        </button>
      )}

      {variant === 'home' && (
        <button type="button" className="setting-row" onClick={onOpenLanguage}>
          <span>{t('settings.language')}</span>
          <span className="setting-value">
            {settings.locale === 'zh-Hant' ? '繁體中文' : settings.locale === 'ja' ? '日本語' : 'English'}
          </span>
        </button>
      )}

      <div className="setting-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {t('settings.feedback')}
        </button>
        {variant === 'game' && onRestart && (
          <button type="button" className="btn btn-primary" onClick={onRestart}>
            {t('settings.restart')}
          </button>
        )}
      </div>

      {dev && (
        <section className="dev-tools">
          <h3>{t('dev.title')}</h3>
          <p className="dev-note">{t('dev.note')}</p>
          <div className="dev-row">
            <button type="button" className="btn btn-ghost" onClick={dev.onUndo} disabled={!dev.canUndo}>
              {t('dev.undo')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={dev.onReveal}>
              {dev.revealed ? t('dev.hideAnswer') : t('dev.reveal')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={dev.onPickLevel}>
              {t('dev.levelPicker')}
            </button>
          </div>
          <p className="dev-note">
            {t('dev.timer')}：{dev.elapsed}
          </p>
        </section>
      )}

      {variant === 'home' && (
        <footer className="settings-foot">
          <a href="https://example.com/terms" target="_blank" rel="noreferrer">
            {t('settings.terms')}
          </a>
          <a href="https://example.com/privacy" target="_blank" rel="noreferrer">
            {t('settings.privacy')}
          </a>
          <p>{t('settings.version', { version: APP_VERSION })}</p>
        </footer>
      )}
    </Dialog>
  );
}

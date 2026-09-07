/**
 * 首頁
 *
 * 版面照規格：左上頭像、右上齒輪、每日挑戰卡（鎖定）、大大的標題、
 * 底部橘色主要 CTA 指向下一個要挑戰的關卡。
 *
 * 每日打卡與排行榜兩張卡需要後端支撐，這一版不做，所以版面上先不放，
 * 免得擺了一張永遠點不動的卡。
 */

import { useState } from 'react';

import { Bone } from '../Bone.tsx';
import { Corgi } from '../Corgi.tsx';
import type { PlayerProfile } from '../../core/storage.ts';
import type { Translate } from '../../i18n/index.ts';
import { DAILY_CHALLENGE_UNLOCK_LEVEL, avatarGlyph, frameColor } from '../theme.ts';

interface HomeProps {
  readonly t: Translate;
  readonly profile: PlayerProfile;
  readonly onPlay: () => void;
  readonly onOpenProfile: () => void;
  readonly onOpenSettings: () => void;
}

export function Home({ t, profile, onPlay, onOpenProfile, onOpenSettings }: HomeProps) {
  const [tip, setTip] = useState(false);
  const locked = profile.currentLevel <= DAILY_CHALLENGE_UNLOCK_LEVEL;

  return (
    <div className="home">
      <header className="home-top">
        <button
          type="button"
          className="avatar-button"
          style={{ borderColor: frameColor(profile.avatarFrameId) }}
          onClick={onOpenProfile}
          aria-label={t('profile.title')}
        >
          {avatarGlyph(profile.avatarId)}
        </button>

        <div className="bone-total" aria-label={t('home.bones')}>
          <Bone className="life-bone" />
          <span>{profile.boneTotal}</span>
        </div>

        <button
          type="button"
          className="icon-button"
          onClick={onOpenSettings}
          aria-label={t('settings.title')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v0a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
          </svg>
        </button>
      </header>

      <div className="home-cards">
        <button
          type="button"
          className={['daily-card', locked ? 'is-locked' : ''].filter(Boolean).join(' ')}
          onClick={() => {
            if (!locked) return;
            setTip(true);
            window.setTimeout(() => setTip(false), 2200);
          }}
        >
          <span className="daily-lock" aria-hidden="true">
            🔒
          </span>
          <span className="daily-title">{t('home.dailyChallenge')}</span>
          <span className="daily-sub">
            {t('home.dailyChallengeLocked', { level: DAILY_CHALLENGE_UNLOCK_LEVEL })}
          </span>
        </button>
        {tip && (
          <div className="tip-bubble" role="status">
            {t('home.dailyChallengeToast', { level: DAILY_CHALLENGE_UNLOCK_LEVEL })}
          </div>
        )}
      </div>

      <div className="home-brand">
        <Corgi className="home-corgi" />
        <h1>
          <span>CORGI</span>
          <span>DOKU</span>
        </h1>
      </div>

      <button type="button" className="btn btn-primary btn-cta" onClick={onPlay}>
        {t('home.levelCta', { level: profile.currentLevel })}
      </button>
    </div>
  );
}

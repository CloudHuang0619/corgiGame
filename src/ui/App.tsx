/**
 * 畫面切換與全域狀態
 *
 * 只有三個畫面（載入 → 首頁 → 遊戲），用一個字串狀態切換就夠，
 * 不必為此引進路由函式庫。玩家資料與設定放在這裡，是因為兩個畫面都要用。
 */

import { useCallback, useMemo, useState } from 'react';

import { clampLevel } from '../core/levels.ts';
import {
  loadProfile,
  loadSettings,
  recordClear,
  saveProfile,
  saveSettings,
} from '../core/storage.ts';
import type { PlayerProfile, Settings } from '../core/storage.ts';
import { createTranslator } from '../i18n/index.ts';

import { LanguageDialog } from './dialogs/LanguageDialog.tsx';
import { ProfileDialog } from './dialogs/ProfileDialog.tsx';
import { SettingsDialog } from './dialogs/SettingsDialog.tsx';
import { Game } from './screens/Game.tsx';
import { Home } from './screens/Home.tsx';
import { Splash } from './screens/Splash.tsx';

type Screen = 'splash' | 'home' | 'game';
type HomeDialog = 'settings' | 'profile' | 'language' | null;

export function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [dialog, setDialog] = useState<HomeDialog>(null);
  const [level, setLevel] = useState(() => clampLevel(loadProfile().currentLevel));

  const t = useMemo(() => createTranslator(settings.locale), [settings.locale]);

  const updateProfile = useCallback((next: PlayerProfile) => {
    setProfile(next);
    saveProfile(next);
  }, []);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const handleCleared = useCallback(
    (clearedLevel: number, score: number, livesLeft: number, elapsed: number) => {
      setProfile((prev) => {
        const next = recordClear(prev, clearedLevel, score, livesLeft, elapsed);
        saveProfile(next);
        return next;
      });
    },
    [],
  );

  const goToLevel = useCallback((next: number) => {
    setLevel(clampLevel(next));
    setScreen('game');
  }, []);

  if (screen === 'splash') {
    return <Splash t={t} onDone={() => setScreen('home')} />;
  }

  if (screen === 'game') {
    return (
      <Game
        t={t}
        level={level}
        profile={profile}
        settings={settings}
        onSettingsChange={updateSettings}
        onExit={() => setScreen('home')}
        onCleared={handleCleared}
        onGoToLevel={goToLevel}
      />
    );
  }

  return (
    <>
      <Home
        t={t}
        profile={profile}
        onPlay={() => goToLevel(profile.currentLevel)}
        onOpenProfile={() => setDialog('profile')}
        onOpenSettings={() => setDialog('settings')}
      />

      <SettingsDialog
        open={dialog === 'settings'}
        variant="home"
        t={t}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setDialog(null)}
        onOpenLanguage={() => setDialog('language')}
      />

      <ProfileDialog
        open={dialog === 'profile'}
        t={t}
        profile={profile}
        onConfirm={(patch) => updateProfile({ ...profile, ...patch })}
        onClose={() => setDialog(null)}
      />

      <LanguageDialog
        open={dialog === 'language'}
        t={t}
        current={settings.locale}
        onSelect={(locale) => updateSettings({ ...settings, locale })}
        onClose={() => setDialog('settings')}
      />
    </>
  );
}

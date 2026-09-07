/**
 * 個人資料
 *
 * 上方是預覽列（頭像 + 可編輯暱稱），下方是頭像／頭像框兩個分頁。
 * 選擇會立刻反映在上方預覽，但要按「確認」才寫回存檔 —— 這樣玩家可以
 * 一直換著看，反悔就直接關掉。
 */

import { useEffect, useState } from 'react';

import type { PlayerProfile } from '../../core/storage.ts';
import type { Translate } from '../../i18n/index.ts';
import { AVATARS, AVATAR_FRAMES, avatarGlyph, frameColor } from '../theme.ts';
import { Dialog } from './Dialog.tsx';

interface ProfileDialogProps {
  readonly open: boolean;
  readonly t: Translate;
  readonly profile: PlayerProfile;
  readonly onConfirm: (patch: Pick<PlayerProfile, 'nickname' | 'avatarId' | 'avatarFrameId'>) => void;
  readonly onClose: () => void;
}

export function ProfileDialog({ open, t, profile, onConfirm, onClose }: ProfileDialogProps) {
  const [tab, setTab] = useState<'avatar' | 'frame'>('avatar');
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatarId, setAvatarId] = useState(profile.avatarId);
  const [frameId, setFrameId] = useState(profile.avatarFrameId);

  // 每次重新打開都從存檔重置，免得上次沒確認的選擇殘留
  useEffect(() => {
    if (!open) return;
    setNickname(profile.nickname);
    setAvatarId(profile.avatarId);
    setFrameId(profile.avatarFrameId);
    setTab('avatar');
  }, [open, profile]);

  return (
    <Dialog open={open} title={t('profile.title')} onClose={onClose}>
      <div className="profile-preview">
        <span className="avatar" style={{ borderColor: frameColor(frameId) }}>
          {avatarGlyph(avatarId)}
        </span>
        <input
          className="nickname-input"
          value={nickname}
          maxLength={16}
          onChange={(e) => setNickname(e.target.value)}
          onFocus={(e) => e.target.select()}
          aria-label={t('profile.title')}
        />
      </div>

      <div className="tabs">
        <button
          type="button"
          className={tab === 'avatar' ? 'is-active' : ''}
          onClick={() => setTab('avatar')}
        >
          {t('profile.avatar')}
        </button>
        <button
          type="button"
          className={tab === 'frame' ? 'is-active' : ''}
          onClick={() => setTab('frame')}
        >
          {t('profile.frame')}
        </button>
      </div>

      <div className="picker-grid">
        {tab === 'avatar'
          ? AVATARS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={['picker-cell', a.id === avatarId ? 'is-selected' : ''].filter(Boolean).join(' ')}
                onClick={() => setAvatarId(a.id)}
              >
                <span className="picker-glyph">{a.glyph}</span>
              </button>
            ))
          : AVATAR_FRAMES.map((f) => (
              <button
                key={f.id}
                type="button"
                className={['picker-cell', f.id === frameId ? 'is-selected' : ''].filter(Boolean).join(' ')}
                onClick={() => setFrameId(f.id)}
              >
                <span className="picker-frame" style={{ borderColor: f.color }} />
              </button>
            ))}
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => {
          onConfirm({ nickname: nickname.trim() || profile.nickname, avatarId, avatarFrameId: frameId });
          onClose();
        }}
      >
        {t('profile.confirm')}
      </button>
    </Dialog>
  );
}

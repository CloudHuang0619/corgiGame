/**
 * 選關卡（測試工具）
 *
 * 正式版沒有這個 —— 原版是線性關卡，首頁 CTA 永遠指向下一個未通關的關卡，
 * 沒有跳關的入口。這裡留著是為了開發時能直接跳到指定盤面驗證。
 */

import { LEVELS } from '../../core/levels.ts';
import type { PlayerProfile } from '../../core/storage.ts';
import type { Translate } from '../../i18n/index.ts';
import { Dialog } from './Dialog.tsx';

interface LevelPickerDialogProps {
  readonly open: boolean;
  readonly t: Translate;
  readonly profile: PlayerProfile;
  readonly current: number;
  readonly onPick: (level: number) => void;
  readonly onClose: () => void;
}

export function LevelPickerDialog({
  open,
  t,
  profile,
  current,
  onPick,
  onClose,
}: LevelPickerDialogProps) {
  return (
    <Dialog open={open} title={t('dev.levelPicker')} onClose={onClose}>
      <p className="dev-note">{t('dev.note')}</p>
      <div className="level-grid">
        {LEVELS.map((puzzle) => {
          const best = profile.bests[puzzle.level];
          return (
            <button
              key={puzzle.level}
              type="button"
              className={[
                'level-chip',
                best ? 'is-cleared' : '',
                puzzle.level === current ? 'is-current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                onPick(puzzle.level);
                onClose();
              }}
            >
              <span className="level-chip-number">{puzzle.level}</span>
              <span className="level-chip-meta">
                {puzzle.size}×{puzzle.size}
                {/*
                  * 疊加型也是 10×10，光看尺寸分不出來。這是測試工具，
                  * 一眼要能挑到想驗的那一種。
                  */}
                {(puzzle.boards?.length ?? 1) > 1 && <span className="level-chip-overlap">疊</span>}
              </span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}

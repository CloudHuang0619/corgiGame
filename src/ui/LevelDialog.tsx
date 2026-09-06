import { LEVELS } from '../core/levels.ts';
import { DIFFICULTY_SPECS } from '../core/generator.ts';
import { formatTime } from '../core/game.ts';
import type { DifficultyId } from '../core/types.ts';
import type { Progress } from '../core/storage.ts';
import { Dialog } from './Dialog.tsx';

interface LevelDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly difficulty: DifficultyId;
  readonly current: number;
  readonly progress: Progress;
  readonly onPick: (difficulty: DifficultyId, index: number) => void;
}

export function LevelDialog({
  open,
  onClose,
  difficulty,
  current,
  progress,
  onPick,
}: LevelDialogProps) {
  return (
    <Dialog open={open} title="選擇關卡" onClose={onClose}>
      {DIFFICULTY_SPECS.map((spec) => {
        const levels = LEVELS[spec.id] ?? [];
        const records = progress.records[spec.id] ?? {};
        return (
          <section key={spec.id} className="level-group">
            <h3>
              {spec.name}
              <span className="level-group-meta">
                {spec.size}×{spec.size} · {Object.keys(records).length}/{levels.length}
              </span>
            </h3>
            <div className="level-grid">
              {levels.map((level, index) => {
                const record = records[index];
                const isCurrent = spec.id === difficulty && index === current;
                return (
                  <button
                    key={level.id}
                    type="button"
                    className={[
                      'level-chip',
                      record ? 'is-cleared' : '',
                      isCurrent ? 'is-current' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      onPick(spec.id, index);
                      onClose();
                    }}
                  >
                    <span className="level-chip-number">{index + 1}</span>
                    {record && <span className="level-chip-time">{formatTime(record.bestMs)}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </Dialog>
  );
}

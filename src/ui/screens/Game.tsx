/**
 * 遊戲主畫面
 *
 * 版面由上而下：返回／關卡分數／設定、進度與生命、規則卡、盤面。
 * 規格裡底部還有兩顆道具鈕與橫幅廣告，那兩塊分別屬於道具系統與變現，
 * 這一版不做。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  applyMarkStroke,
  createGame,
  strokeModeFor,
  DOUBLE_TAP_MS,
  elapsedMs,
  formatTime,
  getHint,
  isFailed,
  isLocked,
  key,
  markHintUsed,
  MAX_LIVES,
  restart as restartGame,
  revealSolution,
  tapCell,
  undo as undoGame,
} from '../../core/game.ts';
import type { GameState, StrokeMode } from '../../core/game.ts';
import { getLevel, LAST_LEVEL } from '../../core/levels.ts';
import { loadSession, saveSession, clearSession } from '../../core/storage.ts';
import type { PlayerProfile, Settings } from '../../core/storage.ts';
import type { Coord, RuleId } from '../../core/types.ts';
import type { Translate } from '../../i18n/index.ts';

import { Board } from '../Board.tsx';
import { Bone } from '../Bone.tsx';
import { BoneTally, ClearToast, Sparkles, useClearSequence } from '../ClearSequence.tsx';
import { Corgi } from '../Corgi.tsx';
import { RuleChips } from '../RuleChips.tsx';
import { ClearDialog } from '../dialogs/ClearDialog.tsx';
import { FailDialog } from '../dialogs/FailDialog.tsx';
import { LevelPickerDialog } from '../dialogs/LevelPickerDialog.tsx';
import { SettingsDialog } from '../dialogs/SettingsDialog.tsx';

interface GameProps {
  readonly t: Translate;
  readonly level: number;
  readonly profile: PlayerProfile;
  readonly settings: Settings;
  readonly onSettingsChange: (next: Settings) => void;
  readonly onExit: () => void;
  readonly onCleared: (level: number, score: number, livesLeft: number, elapsed: number) => void;
  readonly onGoToLevel: (level: number) => void;
}

type DialogName = 'settings' | 'clear' | 'fail' | 'levels' | null;

export function Game({
  t,
  level,
  profile,
  settings,
  onSettingsChange,
  onExit,
  onCleared,
  onGoToLevel,
}: GameProps) {
  const puzzle = useMemo(() => getLevel(level), [level]);

  const [game, setGame] = useState<GameState>(() => {
    const base = createGame(puzzle!);
    // 讀回進行中的進度。存檔只留必要欄位，盤面資料還是從關卡表取。
    const saved = puzzle ? loadSession(level, puzzle.size) : null;
    return saved ? { ...base, ...saved } : base;
  });

  const [dialog, setDialog] = useState<DialogName>(null);
  const [entering, setEntering] = useState(true);
  const [hint, setHint] = useState<{ cell: Coord; label: string } | null>(null);
  const [violated, setViolated] = useState<RuleId | null>(null);
  const [float, setFloat] = useState<{ award: number; title: string | null } | null>(null);
  /** 顯示用的分數刻意落後一次獎勵，等 +N 飄完才補上 —— 原版就是這個節奏 */
  const [shownScore, setShownScore] = useState(game.score);
  const [now, setNow] = useState(() => Date.now());

  // 換關時整個重來
  useEffect(() => {
    if (!puzzle) return;
    const base = createGame(puzzle);
    const saved = loadSession(level, puzzle.size);
    const next = saved ? { ...base, ...saved } : base;
    setGame(next);
    setShownScore(next.score);
    setEntering(true);
    setHint(null);
    setFloat(null);
    setViolated(null);
    setDialog(null);
    const id = window.setTimeout(() => setEntering(false), 900);
    return () => window.clearTimeout(id);
  }, [level, puzzle]);

  // 每一次盤面變動都寫回存檔，重整或關 App 都不會掉進度
  useEffect(() => {
    saveSession(game);
  }, [game]);

  // 計時只在進行中跑。目前不顯示在 HUD，是為對戰模式預留的。
  useEffect(() => {
    if (isLocked(game)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [game]);

  // 通關：記錄成績、清掉進行中存檔，接著跑慶祝序列（見 ClearSequence）
  const clearedRef = useRef(false);
  const cleared = game.finishedAt !== null;
  const clearStage = useClearSequence(cleared);

  useEffect(() => {
    if (game.finishedAt === null || clearedRef.current) return;
    clearedRef.current = true;
    clearSession();
    onCleared(level, game.score, game.lives, game.finishedAt - game.startedAt);
  }, [game.finishedAt, game.score, game.lives, game.startedAt, level, onCleared]);

  // 序列走到最後一拍才開慶祝畫面
  useEffect(() => {
    if (clearStage === 'celebration') setDialog('clear');
  }, [clearStage]);

  // 通關的瞬間分數就跳到最終值，不必等 +N 飄完
  useEffect(() => {
    if (cleared) setShownScore(game.score);
  }, [cleared, game.score]);

  useEffect(() => {
    clearedRef.current = false;
  }, [level]);

  // 命耗盡
  useEffect(() => {
    if (isFailed(game)) setDialog('fail');
  }, [game]);

  /*
   * 快速連點同一格 = 放柯基，其餘都是切換叉號。
   *
   * 時間窗放在這一層而不是核心：這純粹是輸入判讀，遊戲規則不該知道
   * 玩家點得多快。核心只收到「這一下要切叉號還是要放柯基」。
   */
  const lastTap = useRef<{ row: number; col: number; at: number } | null>(null);

  const handleTap = useCallback(
    (row: number, col: number) => {
      const previous = lastTap.current;
      const at = Date.now();
      const quickRepeat =
        previous !== null &&
        previous.row === row &&
        previous.col === col &&
        at - previous.at <= DOUBLE_TAP_MS;
      lastTap.current = { row, col, at };

      setHint(null);
      setGame((prev) => {
        const result = tapCell(prev, row, col, quickRepeat ? 'place' : 'toggle');
        if (result.award !== null) {
          setFloat({ award: result.award, title: result.title });
          window.setTimeout(() => {
            setShownScore(result.state.score);
            setFloat(null);
          }, 900);
        }
        if (result.failure) {
          setViolated(result.failure.rule ?? null);
          window.setTimeout(() => setViolated(null), 1200);
          if (settings.vibration) navigator.vibrate?.(60);
        }
        return result.state;
      });
    },
    [settings.vibration],
  );

  // 拖曳標記：每次都從拖曳前的狀態重算，整段只留一筆復原紀錄
  const strokeRef = useRef<{ base: GameState; cells: Set<string>; mode: StrokeMode } | null>(null);
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const handleStrokeStart = useCallback((row: number, col: number) => {
    setHint(null);
    // 拖曳結束後手指還在盤面上，若不清掉連點紀錄，接下來那一擊
    // 可能被誤判成「快速連點」而放出柯基
    lastTap.current = null;
    const base = gameRef.current;
    // 模式由起點決定：從叉號開始就是擦，從空白開始就是塗
    strokeRef.current = { base, cells: new Set(), mode: strokeModeFor(base, row, col) };
  }, []);

  const handleStrokePaint = useCallback((row: number, col: number) => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    stroke.cells.add(key(row, col));
    setGame(applyMarkStroke(stroke.base, stroke.cells, stroke.mode));
  }, []);

  const handleHint = useCallback(() => {
    const found = getHint(game);
    if (!found) {
      setHint(null);
      return;
    }
    const label =
      found.step.reason === 'region'
        ? t('game.hintRegion')
        : found.step.reason === 'row'
          ? t('game.hintRow', { n: found.cell.row + 1 })
          : t('game.hintCol', { n: found.cell.col + 1 });
    setHint({ cell: found.cell, label });
    setGame((prev) => markHintUsed(prev));
  }, [game, t]);

  if (!puzzle) {
    return (
      <div className="game">
        <p className="status">{t('clear.allDone')}</p>
        <button type="button" className="btn btn-primary" onClick={onExit}>
          {t('common.back')}
        </button>
      </div>
    );
  }

  const nextLevel = level < LAST_LEVEL ? level + 1 : null;

  return (
    <div className="game">
      <header className="game-top">
        <button type="button" className="icon-button" onClick={onExit} aria-label={t('common.back')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 5 8 12l7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="game-stats">
          <div>
            <span className="stat-label">{t('game.level')}</span>
            <span className="stat-value">{level}</span>
          </div>
          <div className="stat-score">
            <span className="stat-label">{t('game.score')}</span>
            <span className="stat-value">{shownScore.toLocaleString()}</span>
            {clearStage !== null && <Sparkles />}
          </div>
        </div>

        <button
          type="button"
          className="icon-button"
          onClick={() => setDialog('settings')}
          aria-label={t('settings.title')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="game-pills">
        <div className="pill progress-pill">
          <Corgi className="pill-corgi" />
          <span>
            <b>{game.catsPlaced}</b>/{puzzle.size}
          </span>
        </div>
        <div
          className={['pill', 'lives-pill', clearStage ? 'is-fading' : ''].filter(Boolean).join(' ')}
          aria-label={`${game.lives}`}
        >
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <Bone key={i} spent={i >= game.lives} className="life-bone" />
          ))}
        </div>
      </div>

      <RuleChips t={t} highlight={violated} pulse={entering} />

      <div className="board-frame">
        {float && (
          <div className="score-float">
            <span className="float-award">+{float.award}</span>
            {float.title && <span className="float-title">{float.title}</span>}
          </div>
        )}

        <Board
          state={game}
          hintCell={hint?.cell ?? null}
          spotlight={hint !== null}
          onTap={handleTap}
          onStrokeStart={handleStrokeStart}
          onStrokePaint={handleStrokePaint}
          disabled={isLocked(game)}
          entering={entering}
        />
      </div>

      {(clearStage === 'bones' || clearStage === 'toast') && (
        <BoneTally count={game.lives} label={t('clear.boneTally')} />
      )}
      {clearStage === 'toast' && <ClearToast t={t} />}

      {hint && (
        <div className="hint-overlay" role="dialog" aria-label={t('game.hintApply')}>
          <p className="hint-text">{t('game.hintTitle', { target: hint.label })}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const { row, col } = hint.cell;
              setHint(null);
              // 提示指的一定是正解，所以連點兩次讓它走完整的放置流程
              setGame((prev) => {
                const placed = tapCell(prev, row, col, 'place');
                if (placed.award !== null) {
                  setFloat({ award: placed.award, title: placed.title });
                  window.setTimeout(() => {
                    setShownScore(placed.state.score);
                    setFloat(null);
                  }, 900);
                }
                return placed.state;
              });
            }}
          >
            {t('game.hintApply')}
          </button>
        </div>
      )}

      <button type="button" className="hint-button" onClick={handleHint} aria-label={t('game.hintApply')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 18h6M10 21h4" strokeLinecap="round" />
          <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" />
        </svg>
      </button>

      <SettingsDialog
        open={dialog === 'settings'}
        variant="game"
        t={t}
        settings={settings}
        onChange={onSettingsChange}
        onClose={() => setDialog(null)}
        onRestart={() => {
          setDialog(null);
          clearSession();
          setGame((prev) => restartGame(prev));
          setShownScore(0);
        }}
        dev={{
          canUndo: game.history.length > 0,
          revealed: game.revealed,
          onUndo: () => setGame((prev) => undoGame(prev)),
          onReveal: () =>
            setGame((prev) => (prev.revealed ? undoGame(prev) : revealSolution(prev))),
          onPickLevel: () => setDialog('levels'),
          elapsed: formatTime(elapsedMs(game, now)),
        }}
      />

      <LevelPickerDialog
        open={dialog === 'levels'}
        t={t}
        profile={profile}
        current={level}
        onPick={onGoToLevel}
        onClose={() => setDialog(null)}
      />

      <ClearDialog
        open={dialog === 'clear'}
        t={t}
        score={game.score}
        livesLeft={game.lives}
        nextLevel={nextLevel}
        onNext={() => {
          setDialog(null);
          if (nextLevel) onGoToLevel(nextLevel);
        }}
        onClose={() => {
          setDialog(null);
          onExit();
        }}
      />

      <FailDialog
        open={dialog === 'fail'}
        t={t}
        onRetry={() => {
          setDialog(null);
          clearSession();
          setGame((prev) => restartGame(prev));
          setShownScore(0);
        }}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

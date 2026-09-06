import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DIFFICULTY_SPECS } from '../core/generator.ts';
import {
  applyMarkStroke,
  conflictCells,
  corgiPositions,
  createGame,
  cycleCell,
  key,
  elapsedMs,
  formatTime,
  getHint,
  restart as restartGame,
  revealSolution,
  undo as undoGame,
  markHintUsed,
} from '../core/game.ts';
import type { GameState } from '../core/game.ts';
import { LEVELS } from '../core/levels.ts';
import {
  loadProgress,
  recordClear,
  rememberPosition,
  saveProgress,
} from '../core/storage.ts';
import type { Progress } from '../core/storage.ts';
import type { DifficultyId } from '../core/types.ts';

import { Board } from './Board.tsx';
import { Corgi } from './Corgi.tsx';
import { LevelDialog } from './LevelDialog.tsx';
import { RulesDialog } from './RulesDialog.tsx';
import { Toolbar } from './Toolbar.tsx';
import { WinDialog } from './WinDialog.tsx';

type DialogName = 'levels' | 'rules' | 'win' | null;

export function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [difficulty, setDifficulty] = useState<DifficultyId>(() => progress.lastDifficulty);
  const [levelIndex, setLevelIndex] = useState(() => progress.lastLevel);
  const [game, setGame] = useState<GameState>(() =>
    createGame(LEVELS[progress.lastDifficulty]![progress.lastLevel] ?? LEVELS.easy[0]!),
  );
  const [dialog, setDialog] = useState<DialogName>(null);
  const [status, setStatus] = useState('先從已經就位的柯基開始推理。');
  const [hintCell, setHintCell] = useState<{ row: number; col: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // 剛通關的那一刻要判斷是不是新紀錄，得在寫入進度「之前」比對
  const newBestRef = useRef(false);

  const levels = LEVELS[difficulty] ?? [];
  const conflicts = useMemo(() => conflictCells(game), [game]);
  const placed = useMemo(() => corgiPositions(game).length, [game]);
  const finished = game.finishedAt !== null;

  // 計時器：只在進行中跑，通關後就不必再每秒重繪
  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [finished]);

  const loadLevel = useCallback(
    (nextDifficulty: DifficultyId, index: number) => {
      const puzzle = LEVELS[nextDifficulty]?.[index];
      if (!puzzle) return;
      setDifficulty(nextDifficulty);
      setLevelIndex(index);
      setGame(createGame(puzzle));
      setHintCell(null);
      setStatus('先從已經就位的柯基開始推理。');
      setNow(Date.now());
      setProgress((prev) => {
        const next = rememberPosition(prev, nextDifficulty, index);
        saveProgress(next);
        return next;
      });
    },
    [],
  );

  // 通關時記錄成績並跳出結算
  useEffect(() => {
    if (game.finishedAt === null) return;
    const ms = game.finishedAt - game.startedAt;
    const previousBest = progress.records[difficulty]?.[levelIndex]?.bestMs;
    newBestRef.current = previousBest === undefined || ms < previousBest;
    setProgress((prev) => {
      const next = recordClear(prev, difficulty, levelIndex, ms, game.hintsUsed);
      saveProgress(next);
      return next;
    });
    setDialog('win');
    setHintCell(null);
    // progress 刻意不放進依賴陣列：它在這個 effect 裡被更新，放進去會造成迴圈
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.finishedAt]);

  const handleCellClick = useCallback((row: number, col: number) => {
    setHintCell(null);
    setGame((prev) => cycleCell(prev, row, col));
  }, []);

  // 拖曳標記時要能拿到「拖曳開始前」的盤面當復原點，而事件處理器裡讀不到
  // 最新的 game（閉包會是上一次 render 的），所以用 ref 同步一份。
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const stroke = useRef<{ base: GameState; cells: Set<string> } | null>(null);

  const handleStrokeStart = useCallback(() => {
    setHintCell(null);
    stroke.current = { base: gameRef.current, cells: new Set() };
  }, []);

  const handleStrokePaint = useCallback((row: number, col: number) => {
    const current = stroke.current;
    if (!current) return;
    current.cells.add(key(row, col));
    // 每次都從拖曳前的盤面重算，整段拖曳因此只產生一筆復原紀錄
    setGame(applyMarkStroke(current.base, current.cells));
  }, []);

  const handleHint = useCallback(() => {
    const hint = getHint(game);
    if (!hint) {
      setStatus('目前的盤面推不出下一步，先檢查有沒有放錯的柯基。');
      return;
    }
    setHintCell({ row: hint.step.row, col: hint.step.col });
    setStatus(hint.message);
    setGame((prev) => markHintUsed(prev));
  }, [game]);

  const handleUndo = useCallback(() => {
    setHintCell(null);
    setGame((prev) => undoGame(prev));
  }, []);

  const handleRestart = useCallback(() => {
    setHintCell(null);
    setStatus('重新開始，盤面已還原。');
    setGame((prev) => restartGame(prev));
    setNow(Date.now());
  }, []);

  const handleReveal = useCallback(() => {
    setHintCell(null);
    if (game.revealed) {
      // 收起答案 = 退回攤開之前那一步
      setStatus('答案已收起，回到你剛才的盤面。');
      setGame((prev) => undoGame(prev));
      return;
    }
    setStatus('這是本關的正解。這一關不會記錄成績，按同一顆鈕可以收起來。');
    setGame((prev) => revealSolution(prev));
  }, [game.revealed]);

  const hasNext = levelIndex + 1 < levels.length;

  const conflictCount = conflicts.size;
  const liveStatus = finished
    ? '完成！每一列、每一欄、每個區域都剛好一隻柯基。'
    : conflictCount > 0
      ? `有 ${conflictCount} 隻柯基違規了，看看標紅的位置。`
      : status;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Corgi className="brand-corgi" />
          <div>
            <h1>Corgidoku</h1>
            <p>柯基邏輯益智</p>
          </div>
        </div>

        <div className="counter" aria-live="polite">
          <Corgi className="counter-corgi" />
          <span>
            {placed}/{game.puzzle.size}
          </span>
        </div>
      </header>

      <main className="stage">
        <div className="stage-head">
          <h2>
            {DIFFICULTY_SPECS.find((d) => d.id === difficulty)?.name} 關卡 {levelIndex + 1}
          </h2>
          <div className="timer" aria-label="經過時間">
            {formatTime(elapsedMs(game, now))}
          </div>
        </div>

        <div className="difficulty" role="tablist" aria-label="難度">
          {DIFFICULTY_SPECS.map((spec) => (
            <button
              key={spec.id}
              type="button"
              role="tab"
              aria-selected={spec.id === difficulty}
              className={spec.id === difficulty ? 'is-active' : ''}
              onClick={() => loadLevel(spec.id, 0)}
            >
              {spec.name}
            </button>
          ))}
        </div>

        <Toolbar
          onLevels={() => setDialog('levels')}
          onHint={handleHint}
          onUndo={handleUndo}
          onRestart={handleRestart}
          onReveal={handleReveal}
          onRules={() => setDialog('rules')}
          canUndo={game.history.length > 0}
          revealed={game.revealed}
        />

        <div className={game.revealed ? 'board-frame is-revealed' : 'board-frame'}>
          {game.revealed && <span className="reveal-badge">答案</span>}
          <Board
            state={game}
            conflicts={conflicts}
            hintCell={hintCell}
            onCellClick={handleCellClick}
            onStrokeStart={handleStrokeStart}
            onStrokePaint={handleStrokePaint}
            disabled={finished}
          />
        </div>

        <p className="status" role="status">
          {liveStatus}
        </p>
      </main>

      <LevelDialog
        open={dialog === 'levels'}
        onClose={() => setDialog(null)}
        difficulty={difficulty}
        current={levelIndex}
        progress={progress}
        onPick={loadLevel}
      />
      <RulesDialog open={dialog === 'rules'} onClose={() => setDialog(null)} />
      <WinDialog
        open={dialog === 'win'}
        elapsedMs={game.finishedAt ? game.finishedAt - game.startedAt : 0}
        hintsUsed={game.hintsUsed}
        isNewBest={newBestRef.current}
        hasNext={hasNext}
        onNext={() => {
          setDialog(null);
          loadLevel(difficulty, levelIndex + 1);
        }}
        onReplay={() => {
          setDialog(null);
          handleRestart();
        }}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

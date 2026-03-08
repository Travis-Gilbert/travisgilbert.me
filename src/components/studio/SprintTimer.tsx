'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  type SprintState,
  SPRINT_PRESETS,
  formatSprintTime,
} from '@/lib/studio-sprint';

/**
 * Pomodoro-style writing sprint timer embedded in the word count band.
 * Set a target duration, start the clock, see words written during the sprint.
 */
export default function SprintTimer({ editor }: { editor: Editor | null }) {
  const [state, setState] = useState<SprintState>('idle');
  const [durationMs, setDurationMs] = useState(SPRINT_PRESETS[1].ms);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startWords, setStartWords] = useState(0);
  const [showPresets, setShowPresets] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTsRef = useRef(0);
  const pausedElapsedRef = useRef(0);

  const currentWords = editor?.storage.characterCount?.words() ?? 0;
  const wordsWritten = state !== 'idle' ? Math.max(0, currentWords - startWords) : 0;
  const remainingMs = Math.max(0, durationMs - elapsedMs);

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTick = useCallback(() => {
    clearTick();
    startTsRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = pausedElapsedRef.current + (now - startTsRef.current);
      setElapsedMs(elapsed);
    }, 250);
  }, [clearTick]);

  /* Auto-complete when time runs out */
  useEffect(() => {
    if (state === 'running' && elapsedMs >= durationMs) {
      clearTick();
      setState('done');
    }
  }, [state, elapsedMs, durationMs, clearTick]);

  /* Clean up on unmount */
  useEffect(() => () => clearTick(), [clearTick]);

  const handleStart = useCallback(() => {
    setStartWords(currentWords);
    setElapsedMs(0);
    pausedElapsedRef.current = 0;
    setState('running');
    startTick();
    setShowPresets(false);
  }, [currentWords, startTick]);

  const handlePause = useCallback(() => {
    pausedElapsedRef.current = elapsedMs;
    clearTick();
    setState('paused');
  }, [elapsedMs, clearTick]);

  const handleResume = useCallback(() => {
    setState('running');
    startTick();
  }, [startTick]);

  const handleDismiss = useCallback(() => {
    clearTick();
    setState('idle');
    setElapsedMs(0);
    pausedElapsedRef.current = 0;
    setShowPresets(false);
  }, [clearTick]);

  if (state === 'idle') {
    return (
      <span className="sprint-timer sprint-timer--idle">
        <button
          type="button"
          className="sprint-timer-trigger"
          onClick={() => setShowPresets((p) => !p)}
          aria-label="Start writing sprint"
          title="Writing sprint"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
            <line x1="8" y1="4" x2="8" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="8" y1="8" x2="11" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        {showPresets && (
          <span className="sprint-timer-presets">
            {SPRINT_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`sprint-preset-btn ${p.ms === durationMs ? 'sprint-preset-btn--active' : ''}`}
                onClick={() => {
                  setDurationMs(p.ms);
                  handleStart();
                }}
              >
                {p.label}
              </button>
            ))}
          </span>
        )}
      </span>
    );
  }

  if (state === 'done') {
    const totalMinutes = Math.max(1, Math.round(durationMs / 60_000));
    const wpm = Math.round(wordsWritten / totalMinutes);
    return (
      <span className="sprint-timer sprint-timer--done">
        <span className="sprint-countdown">{formatSprintTime(0)}</span>
        <Stat label="written" value={`+${wordsWritten}`} />
        <Stat label="wpm" value={String(wpm)} />
        <button
          type="button"
          className="sprint-action-btn"
          onClick={handleDismiss}
          aria-label="Dismiss sprint results"
        >
          Done
        </button>
      </span>
    );
  }

  /* running or paused */
  return (
    <span className={`sprint-timer sprint-timer--${state}`}>
      <span className="sprint-countdown">{formatSprintTime(remainingMs)}</span>
      <Stat label="written" value={`+${wordsWritten}`} />
      {state === 'running' ? (
        <button
          type="button"
          className="sprint-action-btn"
          onClick={handlePause}
          aria-label="Pause sprint"
        >
          Pause
        </button>
      ) : (
        <button
          type="button"
          className="sprint-action-btn"
          onClick={handleResume}
          aria-label="Resume sprint"
        >
          Resume
        </button>
      )}
      <button
        type="button"
        className="sprint-action-btn sprint-action-btn--cancel"
        onClick={handleDismiss}
        aria-label="Cancel sprint"
      >
        Stop
      </button>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="studio-word-count-stat">
      <span className="studio-word-count-stat-value" style={{ color: '#6A9A5A' }}>
        {value}
      </span>
      <span className="studio-word-count-stat-label">{label}</span>
    </span>
  );
}

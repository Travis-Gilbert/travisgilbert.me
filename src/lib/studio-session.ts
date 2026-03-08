import { useState, useEffect, useRef, useCallback } from 'react';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000; /* 2 minutes */

interface SessionStats {
  /** Total active writing seconds this session */
  activeSeconds: number;
  /** Words written this session (current minus baseline) */
  wordsWritten: number;
  /** Whether the writer is currently active (not idle) */
  isActive: boolean;
}

/**
 * Tracks writing focus time and words-written delta for the
 * current editing session.
 *
 * Starts counting on first keypress. Pauses after 2 minutes
 * of inactivity. Resumes on next keypress.
 */
export function useSessionTimer(
  editorElement: HTMLElement | null,
  currentWordCount: number,
): SessionStats {
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const baselineWordsRef = useRef<number | null>(null);
  const currentWordCountRef = useRef(currentWordCount);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Keep word count ref in sync without recreating markActive */
  useEffect(() => {
    currentWordCountRef.current = currentWordCount;
  }, [currentWordCount]);

  /* Start or restart the active period */
  const markActive = useCallback(() => {
    /* Capture baseline word count on first activity */
    if (baselineWordsRef.current === null) {
      baselineWordsRef.current = currentWordCountRef.current;
    }

    setIsActive(true);

    /* Reset idle countdown */
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsActive(false);
    }, IDLE_TIMEOUT_MS);
  }, []);

  /* Tick: increment active seconds while active */
  useEffect(() => {
    if (isActive) {
      tickRef.current = setInterval(() => {
        setActiveSeconds((s) => s + 1);
      }, 1000);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isActive]);

  /* Listen for keypresses on the editor element */
  useEffect(() => {
    if (!editorElement) return;

    const handler = () => markActive();
    editorElement.addEventListener('keydown', handler);
    return () => editorElement.removeEventListener('keydown', handler);
  }, [editorElement, markActive]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const baseline = baselineWordsRef.current ?? currentWordCount;
  const wordsWritten = Math.max(0, currentWordCount - baseline);

  return { activeSeconds, wordsWritten, isActive };
}

/**
 * Format seconds into a human-readable session time string.
 * Examples: "3m", "1h 12m", "45s"
 */
export function formatSessionTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remainMins}m`;
  return `${mins}m`;
}

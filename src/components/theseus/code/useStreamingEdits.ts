'use client';

import { useEffect, useRef, useState } from 'react';
import type { StreamingEdit } from './agents';

interface StreamingEditsResult {
  editProgress: number;
  isComplete: boolean;
}

/**
 * Progressive edit application: increments editProgress at a steady
 * interval to animate streaming code edits into the editor.
 *
 * The onComplete callback fires inside the setInterval callback (not
 * inside an effect body) to satisfy React Compiler rules.
 */
export function useStreamingEdits(
  edits: StreamingEdit[],
  active: boolean,
  intervalMs = 280,
  onComplete?: () => void,
): StreamingEditsResult {
  const [editProgress, setEditProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Keep callback ref in sync via effect (not during render)
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active || edits.length === 0) return;

    let progress = 0;

    timerRef.current = setInterval(() => {
      progress += 1;
      if (progress >= edits.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setEditProgress(edits.length);
        onCompleteRef.current?.();
        return;
      }
      setEditProgress(progress);
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // Reset on cleanup so next activation starts from 0
      setEditProgress(0);
    };
  }, [edits, active, intervalMs]);

  return {
    editProgress,
    isComplete: editProgress >= edits.length && edits.length > 0,
  };
}

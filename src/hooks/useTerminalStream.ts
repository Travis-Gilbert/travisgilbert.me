'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * useTerminalStream: event queue for the TerminalStream component.
 *
 * Parents call push() as pipeline milestones fire, reset() at the start of a
 * new operation, and complete() when the operation finishes. The hook tracks
 * a monotonic start time so each event gets a relative timestamp (ms since
 * stream start). The TerminalStream component renders only the latest active
 * event plus the full history for the re-expandable record.
 *
 * The event queue is append-only within a session. reset() clears it for
 * the next operation. Call sites should avoid pushing identical events
 * back-to-back; the hook does not dedupe.
 */

export type TerminalEventKind = 'milestone' | 'data' | 'heartbeat';

export interface TerminalEvent {
  id: string;
  tMs: number;
  kind: TerminalEventKind;
  text: string;
  detail?: string;
}

export interface TerminalStreamHandle {
  events: TerminalEvent[];
  active: boolean;
  completionMs: number | null;
  push: (input: { kind: TerminalEventKind; text: string; detail?: string }) => void;
  reset: () => void;
  complete: () => void;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `te-${idCounter}`;
}

export function useTerminalStream(): TerminalStreamHandle {
  const [events, setEvents] = useState<TerminalEvent[]>([]);
  const [active, setActive] = useState(false);
  const [completionMs, setCompletionMs] = useState<number | null>(null);
  const startRef = useRef<number>(0);

  const push = useCallback(
    (input: { kind: TerminalEventKind; text: string; detail?: string }) => {
      const now = performance.now();
      if (!startRef.current) {
        startRef.current = now;
        setActive(true);
        setCompletionMs(null);
      }
      const event: TerminalEvent = {
        id: nextId(),
        tMs: now - startRef.current,
        kind: input.kind,
        text: input.text,
        detail: input.detail,
      };
      setEvents((prev) => [...prev, event]);
    },
    [],
  );

  const reset = useCallback(() => {
    startRef.current = 0;
    setEvents([]);
    setActive(false);
    setCompletionMs(null);
  }, []);

  const complete = useCallback(() => {
    if (!startRef.current) return;
    const elapsed = performance.now() - startRef.current;
    setCompletionMs(elapsed);
    setActive(false);
  }, []);

  return { events, active, completionMs, push, reset, complete };
}

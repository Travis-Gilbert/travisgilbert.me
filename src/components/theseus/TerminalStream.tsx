'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { TerminalEvent } from '@/hooks/useTerminalStream';

/**
 * TerminalStream: single-line cycling status display.
 *
 * Shows only the latest active event, replacing itself via 150ms crossfade
 * when a new event arrives. A braille spinner sits on the active line.
 * If no new event fires for HEARTBEAT_DELAY_MS, a dim "still working" suffix
 * appears so the surface never freezes.
 *
 * After completion (active=false, completionMs set), the component collapses
 * to a small pill with an expand chevron. Clicking the chevron reveals the
 * full event log as the re-expandable record.
 *
 * Two mount variants:
 *   floating: fixed position for Ask (pins bottom-left above the dock)
 *   inline: flows with parent layout for Explorer StatusStrip
 */

const BRAILLE_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
const BRAILLE_FRAME_MS = 90;
const CROSSFADE_MS = 150;
const HEARTBEAT_DELAY_MS = 3000;

type StreamVariant = 'floating' | 'inline';

interface TerminalStreamProps {
  events: TerminalEvent[];
  active: boolean;
  completionMs: number | null;
  variant?: StreamVariant;
  label?: string;
}

function formatElapsed(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toFixed(2)}s`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

function formatTimestamp(tMs: number): string {
  const seconds = tMs / 1000;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

function colorForKind(kind: TerminalEvent['kind']): string {
  switch (kind) {
    case 'milestone':
      return 'var(--vie-terra-light, #D47060)';
    case 'data':
      return 'var(--vie-teal-light, #4A8A96)';
    case 'heartbeat':
    default:
      return 'var(--vie-text-dim, #5a5650)';
  }
}

export default function TerminalStream({
  events,
  active,
  completionMs,
  variant = 'inline',
  label,
}: TerminalStreamProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [frameIdx, setFrameIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [heartbeat, setHeartbeat] = useState(false);
  const [displayedEventId, setDisplayedEventId] = useState<string | null>(null);
  const [fadeOpacity, setFadeOpacity] = useState(1);

  const latest = events.length > 0 ? events[events.length - 1] : null;

  // Braille spinner frame advance.
  useEffect(() => {
    if (!active || prefersReducedMotion) return;
    const handle = window.setInterval(() => {
      setFrameIdx((n) => (n + 1) % BRAILLE_FRAMES.length);
    }, BRAILLE_FRAME_MS);
    return () => window.clearInterval(handle);
  }, [active, prefersReducedMotion]);

  // Crossfade on event change. Fade out old, swap text, fade in new.
  useEffect(() => {
    if (!latest) {
      setDisplayedEventId(null);
      setFadeOpacity(1);
      return;
    }
    if (latest.id === displayedEventId) return;

    if (prefersReducedMotion) {
      setDisplayedEventId(latest.id);
      setFadeOpacity(1);
      return;
    }

    // Fade out current, then swap and fade back in.
    setFadeOpacity(0);
    const swapTimer = window.setTimeout(() => {
      setDisplayedEventId(latest.id);
      setFadeOpacity(1);
    }, CROSSFADE_MS);
    return () => window.clearTimeout(swapTimer);
  }, [latest, displayedEventId, prefersReducedMotion]);

  // Heartbeat: flip suffix on if no new event for HEARTBEAT_DELAY_MS.
  useEffect(() => {
    if (!active || !latest) {
      setHeartbeat(false);
      return;
    }
    setHeartbeat(false);
    const timer = window.setTimeout(() => setHeartbeat(true), HEARTBEAT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, latest]);

  // Collapse history on completion so the next run starts clean.
  useEffect(() => {
    if (active) setExpanded(false);
  }, [active]);

  const displayedEvent = displayedEventId
    ? events.find((e) => e.id === displayedEventId) ?? latest
    : latest;

  const containerStyle: React.CSSProperties =
    variant === 'floating'
      ? {
          position: 'fixed',
          left: 16,
          bottom: 88,
          zIndex: 12,
          maxWidth: 360,
          pointerEvents: 'auto',
        }
      : {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'auto',
        };

  // Nothing to show yet.
  if (!latest && !active && completionMs === null) {
    return null;
  }

  // Completion state: show pill with expand chevron.
  if (!active && completionMs !== null) {
    return (
      <div style={containerStyle}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="terminal-stream-pill"
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide event log' : 'Show event log'}
        >
          <span className="terminal-stream-check" aria-hidden="true">
            ✓
          </span>
          <span>
            {label ?? 'done'} in {formatElapsed(completionMs)}
          </span>
          <span
            className="terminal-stream-chevron"
            data-expanded={expanded ? 'true' : 'false'}
            aria-hidden="true"
          >
            ▸
          </span>
        </button>
        {expanded && events.length > 0 && (
          <div className="terminal-stream-history" role="log">
            {events.map((e) => (
              <div key={e.id} className="terminal-stream-history-row">
                <span className="terminal-stream-history-time">{formatTimestamp(e.tMs)}</span>
                <span
                  className="terminal-stream-history-text"
                  style={{ color: colorForKind(e.kind) }}
                >
                  {e.text}
                </span>
                {e.detail && (
                  <span className="terminal-stream-history-detail">{e.detail}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Active state: single line, spinner + latest event text.
  return (
    <div style={containerStyle}>
      <div
        className="terminal-stream-active"
        aria-live="polite"
        aria-atomic="true"
        style={{
          opacity: fadeOpacity,
          transition: prefersReducedMotion ? 'none' : `opacity ${CROSSFADE_MS}ms ease`,
        }}
      >
        <span
          className="terminal-stream-spinner"
          aria-hidden="true"
          style={{
            color: colorForKind(displayedEvent?.kind ?? 'milestone'),
          }}
        >
          {BRAILLE_FRAMES[frameIdx]}
        </span>
        <span
          className="terminal-stream-text"
          style={{
            color: colorForKind(displayedEvent?.kind ?? 'milestone'),
          }}
        >
          {displayedEvent?.text ?? 'working'}
        </span>
        {displayedEvent?.detail && (
          <span className="terminal-stream-detail"> · {displayedEvent.detail}</span>
        )}
        {heartbeat && (
          <span className="terminal-stream-heartbeat">· still working</span>
        )}
      </div>
    </div>
  );
}

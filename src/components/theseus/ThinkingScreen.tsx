'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { DataProcessingStatus } from '@/lib/theseus-data/types';
import type { AskState } from '@/components/theseus/AskExperience';

interface ThinkingScreenProps {
  state: AskState;
  query: string | null;
  dataStatus: DataProcessingStatus | null;
}

/**
 * ThinkingScreen used to be a centered overlay containing the query
 * text, a braille spinner, pipeline bars, and a heat gradient. All of
 * those moved into the persistent dock + traveling query system in
 * page.tsx so the user's eye never loses anything during the
 * thinking-to-answer transition.
 *
 * What remains here is a small honest status row that sits just below
 * where the traveling query lands during the wait, plus a slow-warning
 * line that fades in if the request takes longer than expected. The
 * wall-clock-driven label flip ("searching graph" → "searching the
 * web" → "reading web sources") was removed because it lied about
 * progress; once the SSE stage events from Index-API 968a226 are wired
 * up, this status row will reflect real backend phases.
 */
function getHonestStatus(state: AskState, dataStatus: DataProcessingStatus | null): string {
  if (state === 'CONSTRUCTING') {
    if (dataStatus?.phase === 'loading') return `loading ${dataStatus.source ?? 'data'}…`;
    if (dataStatus?.phase === 'processing') return `running query ${dataStatus.query_index + 1}/${dataStatus.total}…`;
    return 'constructing scene…';
  }
  if (state === 'MODEL') return 'assembling evidence…';
  return 'thinking…';
}

function getSlowWarning(totalElapsed: number): string | null {
  if (totalElapsed >= 30) return 'Still working. Complex queries can take a moment.';
  if (totalElapsed >= 15) return 'This is taking longer than usual…';
  return null;
}

export default function ThinkingScreen({ state, query, dataStatus }: ThinkingScreenProps) {
  // The `query` prop is intentionally accepted but not rendered: the
  // query text is owned by the TravelingQuery element in page.tsx.
  void query;

  const prefersReducedMotion = usePrefersReducedMotion();
  const [totalElapsed, setTotalElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = Date.now();
    const interval = window.setInterval(() => {
      setTotalElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const statusLabel = getHonestStatus(state, dataStatus);
  const slowWarning = getSlowWarning(totalElapsed);

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 130,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        pointerEvents: 'none',
        zIndex: 11,
      }}
    >
      <span
        aria-live="polite"
        style={{
          fontFamily: 'var(--vie-font-mono)',
          fontSize: 11,
          color: 'var(--vie-text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {statusLabel}
      </span>

      {slowWarning && (
        <p
          aria-live="polite"
          style={{
            marginTop: 8,
            fontFamily: 'var(--vie-font-body)',
            fontSize: 12,
            color: totalElapsed >= 30 ? 'var(--vie-terra)' : 'var(--vie-text-dim)',
            textAlign: 'center',
            maxWidth: 320,
            lineHeight: 1.5,
            transition: prefersReducedMotion ? 'none' : 'color 300ms ease',
          }}
        >
          {slowWarning}
        </p>
      )}
    </div>
  );
}

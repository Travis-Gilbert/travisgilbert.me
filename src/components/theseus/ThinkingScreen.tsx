'use client';

import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { DataProcessingStatus } from '@/lib/theseus-data/types';
import type { AskState } from '@/app/theseus/ask/page';

interface ThinkingScreenProps {
  state: AskState;
  query: string | null;
  dataStatus: DataProcessingStatus | null;
}

const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function getStatusLabel(state: AskState, dataStatus: DataProcessingStatus | null): string {
  switch (state) {
    case 'THINKING':
      return 'searching graph…';
    case 'MODEL':
      return 'assembling evidence…';
    case 'CONSTRUCTING': {
      if (dataStatus?.phase === 'loading') return `loading ${dataStatus.source ?? 'data'}…`;
      if (dataStatus?.phase === 'processing') return `running query ${dataStatus.query_index + 1}/${dataStatus.total}…`;
      return 'constructing scene…';
    }
    default:
      return '';
  }
}

function getPipelineStep(state: AskState): number {
  switch (state) {
    case 'THINKING': return 0;
    case 'MODEL': return 1;
    case 'CONSTRUCTING': return 2;
    default: return -1;
  }
}

function getHeatHeight(state: AskState): string {
  switch (state) {
    case 'THINKING': return '30%';
    case 'MODEL': return '50%';
    case 'CONSTRUCTING': return '70%';
    default: return '0%';
  }
}

function getHeatIntensity(state: AskState): number {
  switch (state) {
    case 'THINKING': return 0.06;
    case 'MODEL': return 0.10;
    case 'CONSTRUCTING': return 0.16;
    default: return 0;
  }
}

export default function ThinkingScreen({ state, query, dataStatus }: ThinkingScreenProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = window.setInterval(() => {
      setFrameIndex((previous) => (previous + 1) % BRAILLE_FRAMES.length);
    }, 80);
    return () => window.clearInterval(interval);
  }, [prefersReducedMotion]);

  const step = getPipelineStep(state);
  const statusLabel = getStatusLabel(state, dataStatus);
  const heatIntensity = getHeatIntensity(state);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: getHeatHeight(state),
          background: `linear-gradient(to top, rgba(196, 80, 60, ${heatIntensity}), rgba(196, 154, 74, ${heatIntensity * 0.4}), transparent)`,
          transition: prefersReducedMotion ? 'none' : 'height 2s ease-in-out, background 1.5s ease',
          pointerEvents: 'none',
        }}
      />

      {query && (
        <p
          style={{
            maxWidth: 480,
            textAlign: 'center',
            fontFamily: 'var(--vie-font-body)',
            fontSize: 15,
            color: 'var(--vie-text-muted)',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {query}
        </p>
      )}

      {statusLabel && (
        <div
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 14,
              color: 'var(--vie-teal-light)',
              lineHeight: 1,
              width: '1ch',
              textAlign: 'center',
            }}
          >
            {BRAILLE_FRAMES[frameIndex]}
          </span>
          <span
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
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 6,
          marginTop: 16,
        }}
      >
        {[0, 1, 2].map((barIndex) => (
          <div
            key={barIndex}
            style={{
              width: 60,
              height: 3,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: barIndex <= step ? '100%' : '0%',
                height: '100%',
                background: 'var(--vie-teal)',
                transition: prefersReducedMotion ? 'none' : 'width 400ms ease-out',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

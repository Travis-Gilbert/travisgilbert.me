'use client';

import type { FC } from 'react';
import type { TopologyInterpretation } from '@/lib/theseus-viz/SceneDirective';

interface DirectiveBannerProps {
  label?: string;
  topology?: TopologyInterpretation | null;
  onDismiss: () => void;
}

/**
 * Thin info strip shown when the Explorer was opened from a chat scene
 * directive. Displays the directive's origin label, optional topology
 * description + shape chip + confidence, and a dismiss control.
 */
const DirectiveBanner: FC<DirectiveBannerProps> = ({
  label = 'Focused from chat',
  topology,
  onDismiss,
}) => {
  const hasTopology = topology && typeof topology.primary_shape === 'string';
  const confidencePct = hasTopology
    ? Math.round(Math.max(0, Math.min(1, topology.shape_confidence ?? 0)) * 100)
    : 0;

  return (
    <div
      role="status"
      className="vie-directive-banner"
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-terracotta)',
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        padding: '8px 12px',
        borderRadius: 4,
        boxShadow: 'var(--shadow-warm)',
        zIndex: 5,
        maxWidth: 'min(720px, calc(100% - 48px))',
      }}
    >
      <span style={{ color: 'var(--color-terracotta)' }}>◆</span>
      <span style={{ color: 'var(--color-ink)' }}>{label}</span>
      {hasTopology && (
        <>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 1,
              height: 12,
              background: 'var(--color-ink-muted)',
              opacity: 0.35,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'none',
              color: 'var(--color-ink)',
              maxWidth: 380,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={topology.description}
          >
            {topology.description}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 3,
              background: 'color-mix(in srgb, var(--color-ink-muted) 14%, transparent)',
              color: 'var(--color-ink-muted)',
              letterSpacing: 0,
              textTransform: 'none',
            }}
          >
            {topology.primary_shape}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--color-ink-muted)',
            }}
          >
            {confidencePct}%
          </span>
        </>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Clear focus"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-ink-muted)',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
};

export default DirectiveBanner;

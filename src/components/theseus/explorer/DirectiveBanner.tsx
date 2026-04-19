'use client';

import type { FC } from 'react';

interface DirectiveBannerProps {
  label?: string;
  onDismiss: () => void;
}

/**
 * Top-center banner shown when the Explorer was opened from a chat
 * scene-directive. Click X to dismiss and return to the full graph.
 */
const DirectiveBanner: FC<DirectiveBannerProps> = ({ label = 'Focused from chat', onDismiss }) => {
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
      }}
    >
      <span style={{ color: 'var(--color-terracotta)' }}>◆</span>
      <span>{label}</span>
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

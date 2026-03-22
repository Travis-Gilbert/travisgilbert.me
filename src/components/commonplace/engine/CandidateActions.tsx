'use client';

import { useState } from 'react';

interface CandidateActionsProps {
  onAccept: () => void;
  onReject: () => void;
  status?: 'pending' | 'accepted' | 'rejected';
  inline?: boolean;
}

const STATUS_COLOR = {
  accepted: '#2E8A3E',
  rejected: '#68666E',
} as const;

export default function CandidateActions({
  onAccept,
  onReject,
  status = 'pending',
  inline = false,
}: CandidateActionsProps) {
  const [hoverTarget, setHoverTarget] = useState<'accept' | 'reject' | null>(
    null,
  );

  if (status === 'accepted') {
    return (
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 600,
          color: STATUS_COLOR.accepted,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        ACCEPTED
      </span>
    );
  }

  if (status === 'rejected') {
    return (
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 600,
          color: STATUS_COLOR.rejected,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          textDecoration: 'line-through',
        }}
      >
        REJECTED
      </span>
    );
  }

  const buttonBase: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: inline ? '1px 6px' : '2px 8px',
    cursor: 'pointer',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: inline ? 9 : 10,
    letterSpacing: '0.04em',
    lineHeight: 1,
    borderRadius: 2,
    transition: 'opacity 0.1s ease',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        gap: inline ? 4 : 6,
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAccept();
        }}
        onMouseEnter={() => setHoverTarget('accept')}
        onMouseLeave={() => setHoverTarget(null)}
        style={{
          ...buttonBase,
          color: STATUS_COLOR.accepted,
          border: `1px solid ${STATUS_COLOR.accepted}`,
          opacity: hoverTarget === 'accept' ? 1 : 0.75,
        }}
      >
        accept
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onReject();
        }}
        onMouseEnter={() => setHoverTarget('reject')}
        onMouseLeave={() => setHoverTarget(null)}
        style={{
          ...buttonBase,
          color: STATUS_COLOR.rejected,
          border: `1px solid var(--cp-border, #E2E0DC)`,
          opacity: hoverTarget === 'reject' ? 1 : 0.75,
        }}
      >
        reject
      </button>
    </span>
  );
}

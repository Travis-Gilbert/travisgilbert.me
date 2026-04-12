'use client';

import { useState } from 'react';

interface ConfidenceBarProps {
  value: number; // 0-100
}

export default function ConfidenceBar({ value }: ConfidenceBarProps) {
  const [hovered, setHovered] = useState(false);

  const fillColor =
    value > 80
      ? 'var(--vie-teal-ink)'
      : value > 50
        ? 'var(--vie-amber-ink)'
        : 'var(--vie-terra-ink)';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'default',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--vie-font-mono)',
          fontSize: 10.5,
          color: 'var(--vie-ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        confidence
      </span>

      <div
        style={{
          width: 72,
          height: 2.5,
          borderRadius: 2,
          background: 'var(--vie-panel-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            borderRadius: 2,
            background: fillColor,
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      <span
        style={{
          fontFamily: 'var(--vie-font-mono)',
          fontSize: 10.5,
          color: hovered ? 'var(--vie-ink-1)' : 'transparent',
          transition: 'color 0.2s',
          minWidth: 26,
          textAlign: 'right',
        }}
      >
        {value}%
      </span>
    </div>
  );
}

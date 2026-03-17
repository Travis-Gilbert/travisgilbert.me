'use client';

import type { InlineComponentProps } from './ComponentRenderer';

function CloseButton({ onClick }: { onClick?: () => void }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        marginLeft: 'auto',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        lineHeight: 1,
        color: '#606878',
        fontSize: 12,
      }}
      aria-label="Remove component"
    >
      x
    </button>
  );
}

/** Mock satellite positions (radial, ~25px from center). */
const SATELLITES = [
  { x: 75, y: 40 },
  { x: 62, y: 18 },
  { x: 30, y: 15 },
  { x: 25, y: 55 },
  { x: 60, y: 65 },
];

const NODE_COUNT = SATELLITES.length;

export default function MiniCluster({ component, onRemove }: InlineComponentProps) {
  return (
    <div style={{
      border: '1px solid var(--cp-border-faint)',
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '6px 10px',
        background: 'var(--cp-surface, transparent)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#7050A0',
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          color: 'var(--cp-text-muted)',
        }}>
          Cluster
        </span>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          color: 'var(--cp-text-muted)',
          marginLeft: 'auto',
        }}>
          {NODE_COUNT}
        </span>
        <CloseButton onClick={onRemove ? () => onRemove(component.id) : undefined} />
      </div>
      <svg viewBox="0 0 100 80" width="100%" height="auto" style={{ display: 'block' }}>
        {SATELLITES.map((sat, i) => (
          <line
            key={`edge-${i}`}
            x1={50}
            y1={40}
            x2={sat.x}
            y2={sat.y}
            stroke="var(--cp-border-faint)"
            strokeWidth={0.5}
          />
        ))}
        {SATELLITES.map((sat, i) => (
          <circle
            key={`node-${i}`}
            cx={sat.x}
            cy={sat.y}
            r={3}
            fill="#78767E"
          />
        ))}
        <circle cx={50} cy={40} r={6} fill="var(--cp-text-muted, #78767E)" />
      </svg>
    </div>
  );
}

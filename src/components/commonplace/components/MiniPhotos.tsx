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

const PLACEHOLDER_COUNT = 4;

export default function MiniPhotos({ component, onRemove }: InlineComponentProps) {
  return (
    <div style={{
      border: '1px solid var(--cp-border-faint)',
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#C49A4A',
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          color: 'var(--cp-text-muted)',
        }}>
          Photos
        </span>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          color: 'var(--cp-text-muted)',
          marginLeft: 'auto',
        }}>
          {PLACEHOLDER_COUNT}
        </span>
        <CloseButton onClick={onRemove ? () => onRemove(component.id) : undefined} />
      </div>
      <div style={{
        padding: '4px 10px 8px',
        display: 'flex',
        gap: 2,
        overflowX: 'auto',
      }}>
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
          <div
            key={i}
            style={{
              width: 36,
              height: 36,
              borderRadius: 3,
              background: 'var(--cp-border-faint)',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

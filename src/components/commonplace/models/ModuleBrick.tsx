'use client';

import type { ReactNode } from 'react';

interface ModuleBrickProps {
  title: string;
  accentColor: string;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

export default function ModuleBrick({
  title,
  accentColor,
  onClose,
  children,
  className,
}: ModuleBrickProps): React.ReactElement {
  return (
    <div
      className={className}
      style={{
        background: 'var(--cp-surface, #262320)',
        border: '1px solid var(--cp-border-faint)',
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderBottom: '1px solid var(--cp-border-faint, #ECEAE6)',
          background: 'var(--cp-surface, #F8F7F4)',
          userSelect: 'none',
        }}
      >
        {/* Grip icon */}
        <span
          style={{
            color: 'var(--cp-text-faint, #68666E)',
            fontSize: 7,
            lineHeight: 1,
            letterSpacing: '1px',
          }}
        >
          {'::'}
        </span>

        {/* Accent pip */}
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: accentColor,
            flexShrink: 0,
          }}
        />

        {/* Title */}
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: accentColor,
            flex: 1,
          }}
        >
          {title}
        </span>

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label={`Close ${title} module`}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '1px 3px',
              color: 'var(--cp-text-faint, #68666E)',
              fontSize: 9,
              lineHeight: 1,
              borderRadius: 2,
            }}
          >
            &times;
          </button>
        )}
      </div>

      {/* Content area */}
      <div style={{ padding: '6px 8px' }}>{children}</div>
    </div>
  );
}

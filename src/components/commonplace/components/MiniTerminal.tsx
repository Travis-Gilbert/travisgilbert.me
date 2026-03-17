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

const MOCK_LINES = [
  { pass: 'NER', color: '#6AAA6A', message: '3 entities extracted' },
  { pass: 'SBERT', color: '#4A9EC4', message: '0.82 similarity to "design systems"' },
  { pass: 'BM25', color: '#C49A4A', message: '12 lexical matches' },
];

export default function MiniTerminal({ component, onRemove }: InlineComponentProps) {
  return (
    <div style={{
      position: 'relative',
      background: '#1A1C22',
      border: '1px solid #2A2C32',
      borderRadius: 6,
      overflow: 'hidden',
      width: '100%',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 0% 100%, rgba(45,95,107,0.14) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#6AAA6A',
          boxShadow: '0 0 4px rgba(106,170,106,0.5)',
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          textTransform: 'uppercase',
          color: '#808898',
          letterSpacing: '0.06em',
        }}>
          TERMINAL
        </span>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 8,
          color: '#606878',
          marginLeft: 'auto',
        }}>
          scoped
        </span>
        <CloseButton onClick={onRemove ? () => onRemove(component.id) : undefined} />
      </div>
      <div style={{ padding: '4px 10px 8px', position: 'relative' }}>
        {MOCK_LINES.map((line) => (
          <div key={line.pass} style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            lineHeight: 1.6,
          }}>
            <span style={{ color: line.color }}>[{line.pass}]</span>{' '}
            <span style={{ color: '#C0C8D8' }}>{line.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

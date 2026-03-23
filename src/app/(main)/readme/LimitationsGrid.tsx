'use client';

import type { LimitationItem } from './readme-data';

interface LimitationsGridProps {
  items: LimitationItem[];
}

export default function LimitationsGrid({ items }: LimitationsGridProps) {
  return (
    <div>
      {items.map((item, i) => (
        <div
          key={item.label}
          className="readme-limitation-item"
          style={{
            padding: '16px 0',
            borderBottom:
              i < items.length - 1
                ? '1px solid var(--color-readme-border)'
                : 'none',
            display: 'grid',
            gridTemplateColumns: '130px 1fr',
            gap: '18px',
            alignItems: 'baseline',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-readme-text-dim)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.08em',
            }}
          >
            {item.label}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14.5px',
              color: 'var(--color-readme-text-muted)',
              lineHeight: 1.65,
            }}
          >
            {item.description}
          </span>
        </div>
      ))}
    </div>
  );
}

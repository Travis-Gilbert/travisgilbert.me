'use client';

import type { PriorArtItem } from './readme-data';

interface PriorArtGridProps {
  items: PriorArtItem[];
}

export default function PriorArtGrid({ items }: PriorArtGridProps) {
  return (
    <div
      className="readme-prior-art-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginTop: '14px',
      }}
    >
      {items.map((item) => (
        <div
          key={item.name}
          style={{
            fontFamily: 'var(--font-code)',
            fontSize: '11.5px',
            lineHeight: 1.6,
            padding: '12px 14px',
            border: '1px solid var(--color-patent-border)',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.3)',
          }}
        >
          <span
            style={{
              fontWeight: 600,
              color: 'var(--color-patent-text)',
              display: 'block',
              marginBottom: '2px',
            }}
          >
            {item.name}
          </span>
          <span
            style={{
              color: 'var(--color-patent-text-tertiary)',
              fontSize: '10.5px',
            }}
          >
            {item.note}
          </span>
        </div>
      ))}
    </div>
  );
}

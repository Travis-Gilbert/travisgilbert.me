'use client';

import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { ApiResurfaceCard } from '@/lib/commonplace';
import { hexToRgb, signalColor } from './library-data';

interface ResurfacedZoneProps {
  cards?: ApiResurfaceCard[];
  onOpenObject?: (objectRef: number) => void;
}

export default function ResurfacedZone({ cards, onOpenObject }: ResurfacedZoneProps) {
  if (!cards || cards.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <span className="cp-library-section-label" style={{ color: '#C4503C' }}>
          Resurfaced
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(cards.length, 3)}, 1fr)`,
          gap: 10,
        }}
      >
        {cards.map((card) => (
          <ResurfacedCard
            key={card.object.slug}
            card={card}
            onOpenObject={onOpenObject}
          />
        ))}
      </div>
    </div>
  );
}

function ResurfacedCard({
  card,
  onOpenObject,
}: {
  card: ApiResurfaceCard;
  onOpenObject?: (objectRef: number) => void;
}) {
  const identity = getObjectTypeIdentity(card.object.object_type_data.slug);
  const typeRgb = hexToRgb(identity.color);
  const signal = card.signal_label || card.signal.replace(/_/g, ' ');
  const sColor = signalColor(signal);
  const sRgb = hexToRgb(sColor);

  return (
    <button
      type="button"
      onClick={() => onOpenObject?.(card.object.id)}
      style={{
        all: 'unset',
        cursor: 'pointer',
        padding: '14px 16px',
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 200ms ease',
        background: `rgba(${sRgb},0.03)`,
        border: `1px solid rgba(${sRgb},0.08)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `rgba(${sRgb},0.06)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `rgba(${sRgb},0.03)`;
      }}
    >
      {/* Object identity: type dot + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <div
          className="cp-type-halo"
          style={{
            width: 14,
            height: 14,
            background: `radial-gradient(circle, rgba(${typeRgb},0.15) 0%, transparent 70%)`,
          }}
        >
          <span
            className="cp-type-halo-dot"
            style={{ width: 5, height: 5, background: identity.color }}
          />
        </div>
        <span
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12.5,
            fontWeight: 500,
            color: '#3A3632',
            lineHeight: 1.35,
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {card.object.display_title || card.object.title}
        </span>
      </div>

      {/* Signal label */}
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 600,
          color: sColor,
          letterSpacing: '0.04em',
          marginBottom: 4,
        }}
      >
        {signal}
      </div>

      {/* Explanation */}
      <div
        style={{
          fontFamily: 'var(--cp-font-body)',
          fontSize: 11,
          fontWeight: 300,
          color: '#6A6560',
          lineHeight: 1.45,
        }}
      >
        {card.explanation}
      </div>
    </button>
  );
}

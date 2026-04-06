'use client';

import { useCallback } from 'react';
import { TYPE_COLORS } from './renderers/rendering';

export interface SourceTrailItem {
  objectId: string;
  title: string;
  objectType: string;
  score: number;
  snippet: string;
}

interface SourceTrailProps {
  items: SourceTrailItem[];
  onSelect: (objectId: string) => void;
}

const MAX_VISIBLE = 5;

/**
 * Vertical stack of explored source cards below the query header.
 * Each time the user clicks a dot, the source gets added to the trail.
 * DOM element (not canvas) for persistent UI.
 */
export default function SourceTrail({ items, onSelect }: SourceTrailProps) {
  if (items.length === 0) return null;

  const visible = items.slice(0, MAX_VISIBLE);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        maxWidth: 480,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      {visible.map((item, idx) => (
        <SourceTrailCard
          key={`${item.objectId}-${idx}`}
          item={item}
          isNew={idx === 0}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function SourceTrailCard({
  item,
  isNew,
  onSelect,
}: {
  item: SourceTrailItem;
  isNew: boolean;
  onSelect: (objectId: string) => void;
}) {
  const handleClick = useCallback(() => {
    onSelect(item.objectId);
  }, [item.objectId, onSelect]);

  const badgeColor = TYPE_COLORS[item.objectType] ?? '#9A958D';

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '10px 14px',
        borderRadius: 12,
        background: 'rgba(15, 16, 18, 0.72)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        cursor: 'pointer',
        pointerEvents: 'auto',
        animation: isNew ? 'trailSlideIn 250ms ease-out' : undefined,
        transition: 'opacity 200ms ease',
      }}
    >
      {/* Badge row: type + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 4,
            background: `${badgeColor}33`,
            color: badgeColor,
            fontFamily: 'var(--vie-font-mono)',
            fontSize: 10,
            fontWeight: 400,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {item.objectType}
        </span>
        <span
          style={{
            fontFamily: 'var(--vie-font-mono)',
            fontSize: 10,
            color: 'rgba(156, 149, 141, 0.7)',
            letterSpacing: '0.06em',
          }}
        >
          {Math.round(item.score * 100)}%
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--vie-font-title)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--vie-text, #e8e5e0)',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.title}
      </div>

      {/* Snippet (one line) */}
      {item.snippet && (
        <div
          style={{
            marginTop: 2,
            fontFamily: 'var(--vie-font-body)',
            fontSize: 12,
            color: 'var(--vie-text-muted, rgba(156,149,141,0.85))',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.snippet}
        </div>
      )}
    </button>
  );
}

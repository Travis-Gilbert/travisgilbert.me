'use client';

import { useCallback, useMemo, useState } from 'react';
import { djb2, createPRNG } from '@/lib/studio-prng';
import type { ResearchTrailSource } from '@/lib/studio-api';

/**
 * Pin color by source type: warm hues matching the source identity.
 * Books = gold, articles = terracotta, data = teal, default = muted brown.
 */
const PIN_COLORS: Record<string, string> = {
  book: '#C49A4A',
  article: '#B45A2D',
  paper: '#B45A2D',
  report: '#8A6A9A',
  dataset: '#3A8A9A',
  website: '#3A8A9A',
  video: '#6A9A5A',
  podcast: '#9A8E82',
};

/**
 * Corkboard aesthetic for research sources: pinned index cards
 * with deterministic rotation, thumbtack dots, and drag-to-reorder.
 */
export default function CorkboardPanel({
  sources,
}: {
  sources: ResearchTrailSource[];
}) {
  const [order, setOrder] = useState<number[]>(() => sources.map((_, i) => i));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  /* Sync order array when sources length changes */
  const orderedSources = useMemo(() => {
    if (order.length !== sources.length) {
      const fresh = sources.map((_, i) => i);
      setOrder(fresh);
      return sources;
    }
    return order.map((i) => sources[i]).filter(Boolean);
  }, [sources, order]);

  /* Deterministic rotation for each source card (seeded by title) */
  const rotations = useMemo(() => {
    return sources.map((src) => {
      const rng = createPRNG(djb2(src.title));
      return (rng() - 0.5) * 4; // range: -2 to +2 degrees
    });
  }, [sources]);

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== idx) {
        setDropTarget(idx);
      }
    },
    [dragIdx],
  );

  const handleDrop = useCallback(
    (idx: number) => {
      if (dragIdx === null || dragIdx === idx) return;
      setOrder((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIdx, 1);
        next.splice(idx, 0, moved);
        return next;
      });
      setDragIdx(null);
      setDropTarget(null);
    },
    [dragIdx],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDropTarget(null);
  }, []);

  if (sources.length === 0) {
    return (
      <div className="corkboard-surface corkboard-surface--empty">
        <span
          style={{
            fontFamily: 'var(--studio-font-serif)',
            fontSize: '11px',
            color: 'rgba(60, 48, 36, 0.5)',
            fontStyle: 'italic',
          }}
        >
          No sources pinned yet.
        </span>
      </div>
    );
  }

  return (
    <div className="corkboard-surface">
      {orderedSources.map((src, idx) => {
        const origIdx = sources.indexOf(src);
        const rotation = rotations[origIdx] ?? 0;
        const pinColor = PIN_COLORS[src.sourceType] ?? '#9A8E82';
        const isDragging = dragIdx === idx;
        const isDropTarget = dropTarget === idx;

        return (
          <div
            key={src.id}
            className={`corkboard-card ${isDragging ? 'corkboard-card--dragging' : ''} ${isDropTarget ? 'corkboard-card--drop-target' : ''}`}
            style={{
              transform: `rotate(${rotation}deg)`,
            }}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={handleDragEnd}
          >
            {/* Thumbtack */}
            <div
              className="corkboard-pin"
              style={{ backgroundColor: pinColor }}
            />

            {/* Card content */}
            <div className="corkboard-card-title">
              {src.title}
            </div>

            {src.creator && (
              <div className="corkboard-card-creator">
                {src.creator}
              </div>
            )}

            {src.keyQuote && (
              <div className="corkboard-card-quote">
                {src.keyQuote.slice(0, 120)}
                {src.keyQuote.length > 120 ? '...' : ''}
              </div>
            )}

            {/* Footer: type badge + domain */}
            <div className="corkboard-card-footer">
              <span
                className="corkboard-card-type"
                style={{
                  color: pinColor,
                  backgroundColor: `color-mix(in srgb, ${pinColor} 12%, transparent)`,
                }}
              >
                {src.sourceType}
              </span>
              {src.publication && (
                <span className="corkboard-card-domain">
                  {src.publication}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

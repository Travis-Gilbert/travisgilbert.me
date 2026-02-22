'use client';

import { useState, useEffect, useCallback, type RefObject } from 'react';
import { measureParagraphOffsets } from '@/lib/paragraphPositions';
import { useConnectionHighlight } from '@/components/ConnectionContext';
import type { PositionedConnection } from '@/lib/connectionEngine';

interface ConnectionDotsProps {
  connections: PositionedConnection[];
  proseRef: RefObject<HTMLDivElement | null>;
}

export default function ConnectionDots({
  connections,
  proseRef,
}: ConnectionDotsProps) {
  const [offsets, setOffsets] = useState<Map<number, number>>(new Map());
  const { highlightedId, toggleHighlight } = useConnectionHighlight();

  const measure = useCallback(() => {
    if (!proseRef.current) return;
    setOffsets(measureParagraphOffsets(proseRef.current));
  }, [proseRef]);

  useEffect(() => {
    const container = proseRef.current;
    if (!container) return;

    document.fonts.ready.then(measure);

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => observer.disconnect();
  }, [measure]);

  // Only show connections that have a paragraph position
  const positioned = connections.filter((c) => c.paragraphIndex !== null);
  if (positioned.length === 0) return null;

  // Group by paragraph index for stacking
  const byParagraph = new Map<number, PositionedConnection[]>();
  for (const pc of positioned) {
    const idx = pc.paragraphIndex!;
    const group = byParagraph.get(idx) || [];
    group.push(pc);
    byParagraph.set(idx, group);
  }

  function handleClick(id: string) {
    toggleHighlight(id);

    // Smooth scroll to the footer connection map
    const mapEl = document.getElementById('connection-map');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  return (
    <div
      className="hidden xl:block absolute pointer-events-none"
      style={{
        top: 0,
        right: '100%',
        width: 48,
        height: '100%',
      }}
    >
      {Array.from(byParagraph.entries()).map(([paraIdx, group]) => {
        const yOffset = offsets.get(paraIdx);
        if (yOffset === undefined) return null;

        return group.map((pc, i) => {
          const isHighlighted = highlightedId === pc.connection.id;

          return (
            <button
              key={pc.connection.id}
              className="absolute pointer-events-auto transition-all duration-200"
              style={{
                top: yOffset + i * 12,
                right: 16,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: pc.connection.color,
                opacity: highlightedId && !isHighlighted ? 0.25 : 0.7,
                transform: isHighlighted ? 'scale(1.5)' : 'scale(1)',
                boxShadow: isHighlighted
                  ? `0 0 0 2px ${pc.connection.color}40`
                  : 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
              onClick={() => handleClick(pc.connection.id)}
              aria-label={`Connected: ${pc.connection.title}`}
              title={pc.connection.title}
            />
          );
        });
      })}
    </div>
  );
}

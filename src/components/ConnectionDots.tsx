'use client';

import { useState, useEffect, useCallback, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { measureParagraphOffsets } from '@/lib/paragraphPositions';
import type { PositionedConnection } from '@/lib/connectionEngine';

/** URL prefix per connection type */
const TYPE_URL: Record<string, string> = {
  essay: '/essays',
  'field-note': '/field-notes',
  shelf: '/shelf',
};

/** Display label per connection type */
const TYPE_LABEL: Record<string, string> = {
  essay: 'Essay',
  'field-note': 'Field Note',
  shelf: 'Shelf',
};

interface ConnectionDotsProps {
  connections: PositionedConnection[];
  proseRef: RefObject<HTMLDivElement | null>;
}

export default function ConnectionDots({
  connections,
  proseRef,
}: ConnectionDotsProps) {
  const router = useRouter();
  const [offsets, setOffsets] = useState<Map<number, number>>(new Map());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  // Only render fallback connections (mentionFound === false)
  const fallback = connections.filter((c) => !c.mentionFound);
  if (fallback.length === 0) return null;

  // Group by paragraph index for stacking
  const byParagraph = new Map<number, PositionedConnection[]>();
  for (const pc of fallback) {
    const group = byParagraph.get(pc.paragraphIndex) || [];
    group.push(pc);
    byParagraph.set(pc.paragraphIndex, group);
  }

  function handleClick(pc: PositionedConnection) {
    const prefix = TYPE_URL[pc.connection.type] ?? '';
    router.push(`${prefix}/${pc.connection.slug}`);
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
          const isHovered = hoveredId === pc.connection.id;

          return (
            <div
              key={pc.connection.id}
              className="absolute pointer-events-auto"
              style={{ top: yOffset + i * 12, right: 16 }}
              onMouseEnter={() => setHoveredId(pc.connection.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(pc.connection.id)}
              onBlur={() => setHoveredId(null)}
            >
              <button
                className="transition-all duration-200"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: pc.connection.color,
                  opacity: 0.7,
                  transform: isHovered ? 'scale(1.5)' : 'scale(1)',
                  boxShadow: isHovered
                    ? `0 0 0 2px ${pc.connection.color}40`
                    : 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
                onClick={() => handleClick(pc)}
                aria-label={`Connected: ${pc.connection.title}`}
              />

              {/* Hover card */}
              <div
                className="absolute transition-all duration-200 pointer-events-none"
                style={{
                  top: -4,
                  left: 16,
                  width: 200,
                  maxWidth: 200,
                  padding: isHovered ? '6px 8px' : '0 8px',
                  borderLeft: `2px solid ${pc.connection.color}`,
                  backgroundColor: isHovered ? 'var(--color-paper)' : 'transparent',
                  boxShadow: isHovered
                    ? '0 2px 8px rgba(42, 36, 32, 0.12)'
                    : 'none',
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? 'translateX(0)' : 'translateX(-4px)',
                  overflow: 'hidden',
                  maxHeight: isHovered ? 80 : 0,
                  borderRadius: '0 4px 4px 0',
                }}
              >
                <span
                  className="block font-mono uppercase tracking-[0.08em]"
                  style={{
                    fontSize: 9,
                    color: pc.connection.color,
                    opacity: 0.7,
                  }}
                >
                  {TYPE_LABEL[pc.connection.type] ?? pc.connection.type}
                </span>
                <span
                  className="block leading-tight mt-0.5"
                  style={{
                    fontFamily: 'var(--font-annotation)',
                    fontSize: 14,
                    color: pc.connection.color,
                  }}
                >
                  {pc.connection.title}
                </span>
              </div>
            </div>
          );
        });
      })}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { measureParagraphOffsets } from '@/lib/paragraphPositions';
import type { PositionedConnection } from '@/lib/connectionEngine';

/** URL prefix per connection type (internal site navigation) */
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

/**
 * Researcher backend base URL. Set NEXT_PUBLIC_RESEARCH_URL in .env.
 * Falls back to the production URL so links always resolve.
 */
const RESEARCH_URL =
  process.env.NEXT_PUBLIC_RESEARCH_URL ?? 'https://research.travisgilbert.me';

/**
 * Build a Researcher backend URL for a given connection.
 * Essays have dedicated paper trail pages; other types link to the main explorer.
 */
function researcherHref(type: string, slug: string): string {
  if (type === 'essay') return `${RESEARCH_URL}/paper-trail/essay-trail/${slug}/`;
  return `${RESEARCH_URL}/paper-trail/`;
}

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

  function handleDotClick(pc: PositionedConnection) {
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
          const href = researcherHref(pc.connection.type, pc.connection.slug);

          return (
            <div
              key={pc.connection.id}
              className="absolute pointer-events-none"
              style={{ top: yOffset + i * 12, right: 16 }}
            >
              {/* Dot button: navigates to the connected content internally */}
              <button
                className="pointer-events-auto transition-all duration-200"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: pc.connection.color,
                  opacity: isHovered ? 1 : 0.7,
                  transform: isHovered ? 'scale(1.5)' : 'scale(1)',
                  boxShadow: isHovered
                    ? `0 0 0 2px ${pc.connection.color}40`
                    : 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
                onClick={() => handleDotClick(pc)}
                onMouseEnter={() => setHoveredId(pc.connection.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(pc.connection.id)}
                onBlur={() => setHoveredId(null)}
                aria-label={`Connected: ${pc.connection.title}`}
              />

              {/*
               * Hover card: always expands LEFTWARD into the margin.
               *
               * Positioning: right: 0 anchors the card's right edge to the
               * dot's right edge. width: 160 fills leftward into the margin.
               * borderRight (not borderLeft) marks the prose-facing edge.
               * borderRadius: left corners rounded, right corners flat.
               * Transform slides from right (translateX 4px) to rest.
               *
               * pointer-events-auto when visible so the Researcher link is
               * clickable. onMouseEnter/Leave mirror the button's to keep
               * the card visible as the mouse traverses from dot to card.
               */}
              <div
                className="absolute transition-all duration-200"
                style={{
                  top: -4,
                  right: 0,
                  width: 160,
                  padding: isHovered ? '6px 8px' : '0 8px',
                  borderRight: `2px solid ${pc.connection.color}`,
                  backgroundColor: isHovered ? 'var(--color-paper)' : 'transparent',
                  boxShadow: isHovered ? 'var(--shadow-warm)' : 'none',
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? 'translateX(0)' : 'translateX(4px)',
                  overflow: 'hidden',
                  maxHeight: isHovered ? 120 : 0,
                  borderRadius: '4px 0 0 4px',
                  pointerEvents: isHovered ? 'auto' : 'none',
                }}
                onMouseEnter={() => setHoveredId(pc.connection.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Connection type label */}
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

                {/* Connection title */}
                <span
                  className="block leading-tight mt-0.5"
                  style={{
                    fontFamily: 'var(--font-annotation)',
                    fontSize: 13,
                    color: pc.connection.color,
                  }}
                >
                  {pc.connection.title}
                </span>

                {/* Researcher backend link */}
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-1.5 font-mono uppercase tracking-[0.08em] no-underline transition-opacity duration-150 hover:opacity-100"
                  style={{
                    fontSize: 8,
                    color: pc.connection.color,
                    opacity: 0.55,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  View in Researcher →
                </a>
              </div>
            </div>
          );
        });
      })}
    </div>
  );
}

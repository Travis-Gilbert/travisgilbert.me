'use client';

import { useMemo } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/**
 * SkeletonRows: dashed-outline placeholder rows that pulse while waiting
 * for tab content to load. Shape-matches the content that will replace it
 * (connection list, tension list, claim list, etc.) so the layout does not
 * jump when real data arrives.
 *
 * Variant picks a width pattern that loosely matches each tab's content:
 *   connections: four narrow rows (short titles)
 *   tensions:    three tall cards (tensions are paragraphs)
 *   claims:      four one-line rows (claims are single sentences)
 *   overview:    three mixed rows (title + two body bars)
 */

type SkeletonVariant = 'overview' | 'connections' | 'tensions' | 'claims';

interface SkeletonRowsProps {
  variant: SkeletonVariant;
}

interface RowShape {
  widthPct: number;
  heightPx: number;
}

function rowsForVariant(variant: SkeletonVariant): RowShape[] {
  switch (variant) {
    case 'overview':
      return [
        { widthPct: 62, heightPx: 18 },
        { widthPct: 92, heightPx: 12 },
        { widthPct: 78, heightPx: 12 },
      ];
    case 'connections':
      return [
        { widthPct: 86, heightPx: 22 },
        { widthPct: 74, heightPx: 22 },
        { widthPct: 88, heightPx: 22 },
        { widthPct: 68, heightPx: 22 },
      ];
    case 'tensions':
      return [
        { widthPct: 94, heightPx: 56 },
        { widthPct: 88, heightPx: 56 },
        { widthPct: 82, heightPx: 56 },
      ];
    case 'claims':
      return [
        { widthPct: 90, heightPx: 20 },
        { widthPct: 74, heightPx: 20 },
        { widthPct: 82, heightPx: 20 },
        { widthPct: 68, heightPx: 20 },
      ];
    default:
      return [];
  }
}

export default function SkeletonRows({ variant }: SkeletonRowsProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const rows = useMemo(() => rowsForVariant(variant), [variant]);

  return (
    <div className="explorer-skeleton-rows" aria-hidden="true">
      {rows.map((row, idx) => (
        <div
          key={idx}
          className="explorer-skeleton-row"
          style={{
            width: `${row.widthPct}%`,
            height: row.heightPx,
            animationDelay: prefersReducedMotion ? '0ms' : `${idx * 120}ms`,
            animationPlayState: prefersReducedMotion ? 'paused' : 'running',
          }}
        />
      ))}
    </div>
  );
}

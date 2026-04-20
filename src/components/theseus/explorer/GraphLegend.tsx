'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import { clausePoints } from '@uwdata/mosaic-core';
import { typeSelection } from '@/lib/theseus/mosaic/coordinator';
import type { CosmoPoint } from './useGraphData';

interface GraphLegendProps {
  points: CosmoPoint[];
}

/** Interactive object-type legend. Clicking a swatch publishes a point
 *  clause into `typeSelection`: the selectionBridge reads it and the
 *  Explorer canvas dims every non-matching node. Shift+click extends the
 *  selection (multi-type); click on an already-selected swatch toggles
 *  it off. An empty selection restores full visibility.
 *
 *  The legend is the ONE surface where per-type color still reads; on
 *  the canvas every node is colored by leiden_community via the warm
 *  ramp, so type-as-a-channel survives latently through this legend's
 *  filter. */
const GraphLegend: FC<GraphLegendProps> = ({ points }) => {
  // Stable source token for this legend instance. The Mosaic Selection
  // dedupes clauses by their `source`: we reuse the same object across
  // renders so re-clicks retract the existing clause rather than
  // stacking a parallel one.
  const sourceRef = useRef<{ readonly id: 'graph-legend' }>({ id: 'graph-legend' });

  // Current active types (null = all visible). Mirrored into Mosaic via
  // typeSelection.update(). Kept in local state so the swatch pressed /
  // dim styling updates synchronously without waiting for a Selection
  // round trip.
  const [activeTypes, setActiveTypes] = useState<Set<string> | null>(null);

  const entries = useMemo(() => {
    const byType = new Map<string, { color: string; count: number }>();
    const list = Array.isArray(points) ? points : [];
    for (const p of list) {
      const existing = byType.get(p.type);
      if (existing) existing.count += 1;
      else byType.set(p.type, { color: p.colorHex, count: 1 });
    }
    return Array.from(byType.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [points]);

  // Publish the active set into Mosaic. When the set is null or empty we
  // retract the clause entirely; the selectionBridge treats that as the
  // type axis being idle and stops filtering on type.
  const publishSelection = useCallback((next: Set<string> | null) => {
    const source = sourceRef.current;
    if (!next || next.size === 0) {
      typeSelection.update(clausePoints(['type'], null, { source }));
      return;
    }
    const values = Array.from(next).map((t) => [t]);
    typeSelection.update(clausePoints(['type'], values, { source }));
  }, []);

  // On unmount, drop our clause so the Selection returns to idle. This
  // is important in hot-reload and StrictMode double-mount paths where
  // the bridge might survive a remount of the legend.
  useEffect(() => {
    const source = sourceRef.current;
    return () => {
      typeSelection.update(clausePoints(['type'], null, { source }));
    };
  }, []);

  const handleClick = useCallback((type: string, shiftKey: boolean) => {
    setActiveTypes((prev) => {
      let next: Set<string> | null;
      if (!prev || prev.size === 0) {
        next = new Set([type]);
      } else if (shiftKey) {
        next = new Set(prev);
        if (next.has(type)) next.delete(type);
        else next.add(type);
      } else if (prev.size === 1 && prev.has(type)) {
        next = null;
      } else {
        next = new Set([type]);
      }
      if (next && next.size === 0) next = null;
      publishSelection(next);
      return next;
    });
  }, [publishSelection]);

  if (entries.length === 0) return null;

  const anyActive = activeTypes !== null && activeTypes.size > 0;

  return (
    <div
      className="vie-graph-legend"
      role="toolbar"
      aria-label="Filter by object type"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        padding: '8px 10px',
        boxShadow: 'var(--shadow-warm-sm)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-ink-muted)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        maxWidth: 460,
      }}
    >
      {entries.slice(0, 10).map(([type, { color, count }]) => {
        const isActive = anyActive && activeTypes!.has(type);
        const isDimmed = anyActive && !isActive;
        return (
          <button
            key={type}
            type="button"
            aria-pressed={isActive}
            title={`${type} (${count})`}
            onClick={(e) => handleClick(type, e.shiftKey)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 7px',
              borderRadius: 3,
              border: `1px solid ${isActive ? 'var(--color-ink-muted)' : 'transparent'}`,
              background: isActive
                ? 'color-mix(in srgb, var(--color-surface) 60%, var(--color-border))'
                : 'transparent',
              color: 'inherit',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              letterSpacing: 'inherit',
              textTransform: 'inherit',
              cursor: 'pointer',
              opacity: isDimmed ? 0.5 : 1,
              transition: 'opacity 140ms ease-out, border-color 140ms ease-out, background 140ms ease-out',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                display: 'inline-block',
              }}
            />
            {type}
          </button>
        );
      })}
    </div>
  );
};

export default GraphLegend;

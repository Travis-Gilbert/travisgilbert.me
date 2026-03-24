'use client';

import { useMemo, useCallback } from 'react';
import type { NotebookObjectCompact } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';

export default function TypeLandscape({
  objects,
  activeFilter,
  onFilter,
  totalShown,
}: {
  objects: NotebookObjectCompact[];
  activeFilter: string;
  onFilter: (typeSlug: string) => void;
  totalShown?: number;
}) {
  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of objects) {
      counts[o.object_type] = (counts[o.object_type] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([slug, count]) => ({
        slug,
        count,
        pct: count / objects.length,
      }));
  }, [objects]);

  const shown = totalShown ?? objects.length;
  const countLabel =
    shown < objects.length
      ? `${shown} of ${objects.length} objects`
      : `${objects.length} objects`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Proportional bar */}
      <div
        style={{
          display: 'flex',
          height: 6,
          borderRadius: 3,
          overflow: 'hidden',
          background: 'var(--cp-border)',
        }}
      >
        {distribution.map(({ slug, pct }) => (
          <div
            key={slug}
            style={{
              width: `${pct * 100}%`,
              background: getObjectTypeIdentity(slug).color,
              transition: 'width 300ms ease, opacity 200ms ease',
              opacity:
                activeFilter === 'all' || activeFilter === slug ? 1 : 0.25,
            }}
          />
        ))}
      </div>

      {/* Filter pills + count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexWrap: 'wrap',
        }}
      >
        {distribution.map(({ slug, count }) => (
          <FilterPill
            key={slug}
            slug={slug}
            count={count}
            active={activeFilter === slug}
            onToggle={onFilter}
          />
        ))}
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-ghost)',
            marginLeft: 'auto',
            flexShrink: 0,
          }}
        >
          {countLabel}
        </span>
      </div>
    </div>
  );
}

function FilterPill({
  slug,
  count,
  active,
  onToggle,
}: {
  slug: string;
  count: number;
  active: boolean;
  onToggle: (slug: string) => void;
}) {
  const type = getObjectTypeIdentity(slug);

  const handleClick = useCallback(() => {
    onToggle(active ? 'all' : slug);
  }, [active, slug, onToggle]);

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 3,
        fontFamily: 'var(--cp-font-mono)',
        fontSize: 10.5,
        fontWeight: 500,
        background: active ? `${type.color}18` : 'transparent',
        color: active ? type.color : 'var(--cp-text-faint)',
        border: `1px solid ${active ? `${type.color}30` : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all 150ms ease',
        letterSpacing: '0.02em',
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.color = type.color;
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.color =
            'var(--cp-text-faint)';
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: type.color,
          flexShrink: 0,
        }}
      />
      {type.label}
      <span style={{ opacity: 0.5 }}>{count}</span>
    </button>
  );
}

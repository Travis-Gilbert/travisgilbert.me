'use client';

import { NODE_TYPES } from '@/lib/networks';

/**
 * QuickFilterPills: horizontal scrollable filter row.
 *
 * Static pills: All, Inbox, Starred.
 * Dynamic pills: one per node type (from NODE_TYPES).
 * Active state uses terracotta glow.
 */

export type FilterValue =
  | 'all'
  | 'inbox'
  | 'starred'
  | { type: string };

interface QuickFilterPillsProps {
  activeFilter: FilterValue;
  onFilterChange: (filter: FilterValue) => void;
  typeCounts?: Record<string, number>;
}

export default function QuickFilterPills({
  activeFilter,
  onFilterChange,
  typeCounts,
}: QuickFilterPillsProps) {
  const isActive = (filter: FilterValue): boolean => {
    if (typeof activeFilter === 'string' && typeof filter === 'string') {
      return activeFilter === filter;
    }
    if (typeof activeFilter === 'object' && typeof filter === 'object') {
      return activeFilter.type === filter.type;
    }
    return false;
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 4,
        scrollbarWidth: 'none',
      }}
    >
      {/* Static pills */}
      <button
        type="button"
        className="nw-pill"
        data-active={isActive('all')}
        onClick={() => onFilterChange('all')}
      >
        All
      </button>
      <button
        type="button"
        className="nw-pill"
        data-active={isActive('inbox')}
        onClick={() => onFilterChange('inbox')}
      >
        Inbox
      </button>
      <button
        type="button"
        className="nw-pill"
        data-active={isActive('starred')}
        onClick={() => onFilterChange('starred')}
      >
        Starred
      </button>

      {/* Divider */}
      <div
        style={{
          width: 1,
          alignSelf: 'stretch',
          backgroundColor: 'var(--nw-border)',
          flexShrink: 0,
        }}
      />

      {/* Type pills */}
      {NODE_TYPES.map((nt) => {
        const count = typeCounts?.[nt.slug];
        return (
          <button
            key={nt.slug}
            type="button"
            className="nw-pill"
            data-active={isActive({ type: nt.slug })}
            onClick={() => onFilterChange({ type: nt.slug })}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <span
              className="nw-type-dot"
              style={{ backgroundColor: nt.color }}
            />
            <span>{nt.label}</span>
            {count !== undefined && count > 0 && (
              <span style={{ opacity: 0.5 }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

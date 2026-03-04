'use client';

import { useState } from 'react';
import { OBJECT_TYPES } from '@/lib/commonplace';

/**
 * TimelineSearch: search and filter bar at the top of the timeline.
 *
 * Contains:
 *   - Text search input (filters by title/summary)
 *   - Type filter pills (toggle to filter by object type)
 *
 * All filtering happens client-side on mock data. When live,
 * these filters become API query params.
 */

export interface TimelineFilters {
  query: string;
  activeTypes: Set<string>;
}

interface TimelineSearchProps {
  filters: TimelineFilters;
  onChange: (filters: TimelineFilters) => void;
  resultCount: number;
}

export default function TimelineSearch({
  filters,
  onChange,
  resultCount,
}: TimelineSearchProps) {
  const [isFocused, setIsFocused] = useState(false);

  function toggleType(slug: string) {
    const next = new Set(filters.activeTypes);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onChange({ ...filters, activeTypes: next });
  }

  return (
    <div className="cp-timeline-search">
      {/* Search input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 6,
          border: `1px solid ${isFocused ? 'var(--cp-terracotta)' : 'var(--cp-border)'}`,
          backgroundColor: 'var(--cp-surface)',
          transition: 'border-color 200ms',
        }}
      >
        {/* Search icon */}
        <svg
          width={14}
          height={14}
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--cp-text-faint)"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.6 }}
        >
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" />
        </svg>

        <input
          type="text"
          value={filters.query}
          onChange={(e) =>
            onChange({ ...filters, query: e.target.value })
          }
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search timeline..."
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--cp-font-body)',
            fontSize: 13,
            color: 'var(--cp-text)',
          }}
        />

        {/* Result count */}
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            color: 'var(--cp-text-faint)',
            flexShrink: 0,
          }}
        >
          {resultCount} objects
        </span>
      </div>

      {/* Type filter pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: 6,
        }}
      >
        {OBJECT_TYPES.map((objType) => {
          const isActive = filters.activeTypes.has(objType.slug);
          return (
            <button
              key={objType.slug}
              type="button"
              onClick={() => toggleType(objType.slug)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 10,
                border: `1px solid ${isActive ? `${objType.color}50` : 'var(--cp-border)'}`,
                background: isActive ? `${objType.color}15` : 'transparent',
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                letterSpacing: '0.04em',
                color: isActive ? objType.color : 'var(--cp-text-faint)',
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: objType.color,
                  opacity: isActive ? 1 : 0.4,
                  transition: 'opacity 150ms',
                }}
              />
              {objType.label}
            </button>
          );
        })}

        {/* Clear filters */}
        {(filters.query || filters.activeTypes.size > 0) && (
          <button
            type="button"
            onClick={() =>
              onChange({ query: '', activeTypes: new Set() })
            }
            style={{
              padding: '2px 8px',
              borderRadius: 10,
              border: '1px solid var(--cp-border)',
              background: 'transparent',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              color: 'var(--cp-text-faint)',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

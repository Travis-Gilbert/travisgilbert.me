'use client';

import { getObjectTypeIdentity } from '@/lib/commonplace';
import { hexToRgb } from './library-data';

interface LibraryTypeFiltersProps {
  types: string[];
  active: string | null;
  onFilter: (slug: string | null) => void;
}

export default function LibraryTypeFilters({
  types,
  active,
  onFilter,
}: LibraryTypeFiltersProps) {
  if (types.length <= 1) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 20 }}>
      <button
        type="button"
        onClick={() => onFilter(null)}
        style={{
          padding: '3px 10px',
          borderRadius: 14,
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9.5,
          fontWeight: 500,
          background: active === null ? 'rgba(196,80,60,0.08)' : 'transparent',
          color: active === null ? '#C4503C' : '#5C554D',
          border: `1px solid ${active === null ? 'rgba(196,80,60,0.18)' : 'rgba(0,0,0,0.08)'}`,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        All
      </button>
      {types.map((slug) => {
        const identity = getObjectTypeIdentity(slug);
        const on = active === slug;
        const rgb = hexToRgb(identity.color);
        return (
          <button
            key={slug}
            type="button"
            onClick={() => onFilter(on ? null : slug)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 14,
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9.5,
              fontWeight: 500,
              background: on ? `rgba(${rgb},0.08)` : 'transparent',
              color: on ? identity.color : '#5C554D',
              border: `1px solid ${on ? `rgba(${rgb},0.18)` : 'rgba(0,0,0,0.08)'}`,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: identity.color,
              }}
            />
            {identity.label}
          </button>
        );
      })}
    </div>
  );
}

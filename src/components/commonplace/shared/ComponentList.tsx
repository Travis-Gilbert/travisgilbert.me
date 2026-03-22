'use client';

/**
 * ComponentList: renders an object's typed components (properties).
 *
 * Each component has a type name, data type, key, and value.
 * Sorted by sort_order, formatted by data_type:
 *   - url: clickable link
 *   - date: formatted date string
 *   - number: right-aligned numeric
 *   - text/fallback: plain string
 */

import type { ApiComponent } from '@/lib/commonplace';

interface ComponentListProps {
  components: ApiComponent[];
}

function formatValue(component: ApiComponent): React.ReactNode {
  const { data_type, value } = component;

  if (!value) return <span className="cp-component-empty">empty</span>;

  if (data_type === 'url') {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="cp-component-url"
      >
        {value.length > 60 ? value.slice(0, 57) + '...' : value}
      </a>
    );
  }

  if (data_type === 'date') {
    try {
      const d = new Date(value);
      return (
        <span>
          {d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      );
    } catch {
      return <span>{value}</span>;
    }
  }

  if (data_type === 'number') {
    return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>;
  }

  /* text and fallback */
  return <span>{value}</span>;
}

export default function ComponentList({ components }: ComponentListProps) {
  if (components.length === 0) return null;

  const sorted = [...components].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="cp-detail-section">
      <h3 className="cp-detail-section-label">Components</h3>
      <div className="cp-component-list">
        {sorted.map((comp) => (
          <div key={comp.id} className="cp-component-item">
            <span className="cp-component-key">
              {comp.component_type_name}
              {comp.key !== comp.component_type_name && (
                <span className="cp-component-subkey"> / {comp.key}</span>
              )}
            </span>
            <span className="cp-component-value">
              {formatValue(comp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import type { GraphScope } from '@/lib/theseus-api';

interface AtlasScopeControlProps {
  scope: GraphScope;
  onChange: (next: GraphScope) => void;
}

const OPTIONS: Array<{ value: GraphScope; label: string; title: string }> = [
  {
    value: 'combined',
    label: 'Combined',
    title: 'Corpus + my captures (default)',
  },
  {
    value: 'corpus',
    label: 'Corpus',
    title: 'Pipeline-ingested Theseus corpus only',
  },
  {
    value: 'personal',
    label: 'Personal',
    title: 'Only objects you captured',
  },
];

/**
 * Three-position segmented control for the Explorer baseline scope.
 * Lives top-right of the canvas alongside the plate label. Writes via
 * atlasFilters.setScope; re-fetch is triggered by useGraphData on
 * scope-change.
 */
export default function AtlasScopeControl({
  scope,
  onChange,
}: AtlasScopeControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Graph scope"
      className="parchment-glass"
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 4,
        display: 'flex',
        gap: 2,
        padding: 4,
        borderRadius: 3,
      }}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === scope;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            onClick={() => {
              if (!active) onChange(opt.value);
            }}
            className="atlas-gc-btn"
            style={{
              padding: '5px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: active ? 'var(--paper-ink)' : 'transparent',
              color: active ? 'var(--paper-bg, #f4ede0)' : 'var(--paper-ink)',
              border: '1px solid var(--paper-rule)',
              borderRadius: 2,
              cursor: active ? 'default' : 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

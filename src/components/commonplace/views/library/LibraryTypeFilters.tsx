'use client';

import { getObjectTypeIdentity } from '@/lib/commonplace';

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
      <PillButton
        label="All"
        isActive={active === null}
        onClick={() => onFilter(null)}
      />
      {types.map((slug) => {
        const identity = getObjectTypeIdentity(slug);
        const on = active === slug;
        return (
          <PillButton
            key={slug}
            label={identity.label}
            dotColor={identity.color}
            isActive={on}
            onClick={() => onFilter(on ? null : slug)}
          />
        );
      })}
    </div>
  );
}

function PillButton({
  label,
  dotColor,
  isActive,
  onClick,
}: {
  label: string;
  dotColor?: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 99,
        fontFamily: 'var(--cp-font-mono)',
        fontSize: 10,
        fontWeight: isActive ? 500 : 400,
        background: isActive ? 'rgba(26, 24, 22, 0.06)' : 'transparent',
        color: isActive ? 'rgba(26, 24, 22, 0.6)' : 'rgba(26, 24, 22, 0.3)',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(26, 24, 22, 0.04)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {dotColor && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </button>
  );
}

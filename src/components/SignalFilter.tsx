'use client';

/**
 * SignalFilter: toggle buttons for filtering graph edges by connection signal.
 *
 * Five states: ALL (null), or one of the four research API signals.
 * Active button uses the signal's brand color; inactive buttons are muted.
 *
 * The component is purely presentational: state lives in the parent graph.
 */

import { SIGNAL_COLORS } from '@/lib/graph/colors';

export type SignalKey = 'shared_sources' | 'shared_tags' | 'shared_threads' | 'semantic';

interface SignalFilterProps {
  /** Currently active signal filter (null = show all) */
  activeSignal: SignalKey | null;
  /** Callback when user clicks a filter button */
  onSignalChange: (signal: SignalKey | null) => void;
  /** Which signals actually exist in the current dataset */
  availableSignals: Set<string>;
}

const SIGNAL_LABELS: Record<SignalKey, string> = {
  shared_sources: 'Sources',
  shared_tags: 'Tags',
  shared_threads: 'Threads',
  semantic: 'Semantic',
};

const SIGNAL_ORDER: SignalKey[] = [
  'shared_sources',
  'shared_tags',
  'shared_threads',
  'semantic',
];

export default function SignalFilter({
  activeSignal,
  onSignalChange,
  availableSignals,
}: SignalFilterProps) {
  const isAllActive = activeSignal === null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: 8,
      }}
    >
      {/* ALL button */}
      <button
        onClick={() => onSignalChange(null)}
        style={{
          padding: '3px 10px',
          borderRadius: 4,
          border: `1px solid ${isAllActive ? 'var(--color-ink-secondary)' : 'transparent'}`,
          background: isAllActive ? 'var(--color-surface-elevated, #F5F0E8)' : 'transparent',
          color: isAllActive ? 'var(--color-ink)' : 'var(--color-ink-light)',
          fontFamily: 'var(--font-metadata)',
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          cursor: 'pointer',
          transition: 'all 150ms ease',
          minHeight: 28,
        }}
      >
        All
      </button>

      {/* Signal buttons (only show signals present in the data) */}
      {SIGNAL_ORDER.filter((key) => availableSignals.has(key)).map((key) => {
        const isActive = activeSignal === key;
        const color = SIGNAL_COLORS[key];

        return (
          <button
            key={key}
            onClick={() => onSignalChange(isActive ? null : key)}
            style={{
              padding: '3px 10px',
              borderRadius: 4,
              border: `1px solid ${isActive ? color : 'transparent'}`,
              background: isActive ? `${color}12` : 'transparent',
              color: isActive ? color : 'var(--color-ink-light)',
              fontFamily: 'var(--font-metadata)',
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              cursor: 'pointer',
              transition: 'all 150ms ease',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              minHeight: 28,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: color,
                opacity: isActive ? 1 : 0.4,
                flexShrink: 0,
                transition: 'opacity 150ms ease',
              }}
            />
            {SIGNAL_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import type { FixPattern } from '@/lib/theseus-types';
import PatternCard from './PatternCard';

interface Props {
  open: boolean;
  patterns: FixPattern[];
  onSubmit: (patternId: string) => Promise<boolean>;
  onClose: () => void;
}

export default function PatternMemoryPanel({ open, patterns, onSubmit, onClose }: Props) {
  return (
    <aside
      className={`ce-patterns${open ? ' is-open' : ''}`}
      aria-label="Fix patterns panel"
      aria-hidden={!open}
    >
      <div className="ce-patterns-head">
        <div className="ce-patterns-head-left">
          <span className="ce-patterns-head-title">Fix Patterns</span>
          <span className="ce-patterns-head-count">{patterns.length}</span>
        </div>
        <button
          type="button"
          className="ce-patterns-close"
          onClick={onClose}
          aria-label="Close patterns panel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="ce-patterns-list">
        {patterns.length === 0 ? (
          <div className="ce-patterns-empty">
            <p className="ce-patterns-empty-text">
              No fix patterns for this symbol. Patterns appear after
              successful code fixes receive positive feedback.
            </p>
          </div>
        ) : (
          patterns.map((p) => (
            <PatternCard
              key={p.id}
              pattern={p}
              onSubmit={() => onSubmit(p.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

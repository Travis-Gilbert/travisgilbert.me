'use client';

import type { DriftTension } from '@/lib/theseus-types';
import DriftTensionCard from './DriftTensionCard';

type DriftAction = 'update_spec' | 'flag' | 'dismiss';

interface Props {
  open: boolean;
  drift: DriftTension[];
  onResolve: (id: string, action: DriftAction) => Promise<void>;
  onClose: () => void;
}

export default function DriftPanel({ open, drift, onResolve, onClose }: Props) {
  return (
    <aside
      className={`ce-drift${open ? ' is-open' : ''}`}
      aria-label="Spec drift panel"
      aria-hidden={!open}
    >
      <div className="ce-drift-head">
        <div className="ce-drift-head-left">
          <span className="ce-drift-head-title">Spec Drift</span>
          <span className="ce-drift-head-count">{drift.length}</span>
        </div>
        <button
          type="button"
          className="ce-drift-close"
          onClick={onClose}
          aria-label="Close drift panel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="ce-drift-list">
        {drift.length === 0 ? (
          <div className="ce-drift-empty">
            <div className="ce-drift-empty-dot" />
            <p className="ce-drift-empty-text">
              No drift detected. Code matches spec.
            </p>
          </div>
        ) : (
          drift.map((t) => (
            <DriftTensionCard
              key={t.id}
              tension={t}
              onResolve={(action) => onResolve(t.id, action)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

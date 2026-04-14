'use client';

import { useState } from 'react';
import type { DriftTension } from '@/lib/theseus-types';
import { severityColor } from './codeColors';

type DriftAction = 'update_spec' | 'flag' | 'dismiss';

interface Props {
  tension: DriftTension;
  onResolve: (action: DriftAction) => Promise<void>;
}

const ACTION_LABELS: Record<DriftAction, string> = {
  update_spec: 'Update spec',
  flag: 'Flag',
  dismiss: 'Dismiss',
};

export default function DriftTensionCard({ tension, onResolve }: Props) {
  const [pendingAction, setPendingAction] = useState<DriftAction | null>(null);
  const sev = Math.round(tension.severity * 100);
  const severityLabel = tension.severity >= 0.7
    ? 'High'
    : tension.severity >= 0.4
      ? 'Medium'
      : 'Low';

  async function handleClick(action: DriftAction) {
    if (pendingAction) return;
    setPendingAction(action);
    try {
      await onResolve(action);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <article className="ce-drift-card">
      <div
        className="ce-drift-card-severity"
        style={{ backgroundColor: severityColor(tension.severity) }}
        aria-hidden="true"
      />

      <div className="ce-drift-card-head">
        <span
          className="ce-drift-card-sev-label"
          style={{ color: severityColor(tension.severity) }}
        >
          {severityLabel} ({sev}%)
        </span>
        <h3 className="ce-drift-card-title">{tension.title}</h3>
      </div>

      <div className="ce-drift-card-diff">
        <div className="ce-drift-card-diff-col">
          <div className="ce-drift-card-diff-label">Spec expects</div>
          <p className="ce-drift-card-diff-spec">{tension.spec_expectation}</p>
        </div>
        <div className="ce-drift-card-diff-col">
          <div className="ce-drift-card-diff-label">Code has</div>
          <p className="ce-drift-card-diff-code">{tension.code_reality}</p>
        </div>
      </div>

      <div className="ce-drift-card-actions">
        {(Object.keys(ACTION_LABELS) as DriftAction[]).map((action) => (
          <button
            key={action}
            type="button"
            className={`ce-drift-card-action${
              pendingAction === action ? ' is-pending' : ''
            }`}
            onClick={() => handleClick(action)}
            disabled={pendingAction !== null}
          >
            {pendingAction === action ? 'Working...' : ACTION_LABELS[action]}
          </button>
        ))}
      </div>
    </article>
  );
}

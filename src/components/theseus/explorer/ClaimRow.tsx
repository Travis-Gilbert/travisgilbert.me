'use client';

import type { ClaimResult } from '@/lib/theseus-types';

function statusColor(status: string): string {
  switch (status) {
    case 'accepted': return 'var(--vie-type-source)';     // teal
    case 'contested': return 'var(--vie-type-person)';    // terracotta
    default: return 'var(--vie-type-hunch)';              // amber (pending)
  }
}

const STATUS_LABELS: Record<string, string> = {
  accepted: 'ACCEPTED',
  contested: 'CONTESTED',
  pending: 'PENDING',
  retracted: 'RETRACTED',
};

interface ClaimRowProps {
  claim: ClaimResult;
}

export default function ClaimRow({ claim }: ClaimRowProps) {
  return (
    <div className="explorer-claim-row">
      {/* Claim text */}
      <p className="explorer-claim-text">{claim.text}</p>

      {/* Confidence bar + status */}
      <div className="explorer-claim-meta">
        <span className="explorer-claim-bar">
          <span
            className="explorer-claim-bar-fill"
            style={{ width: `${Math.round(claim.confidence * 100)}%` }}
          />
        </span>
        <span
          className="explorer-claim-status"
          style={{ color: statusColor(claim.epistemic_status) }}
        >
          {STATUS_LABELS[claim.epistemic_status] ?? claim.epistemic_status.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

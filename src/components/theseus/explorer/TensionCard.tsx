'use client';

import type { TensionResult } from '@/lib/theseus-types';

function severityColor(severity: number): string {
  if (severity >= 0.7) return 'var(--vie-type-person)';  // terracotta (high)
  if (severity >= 0.4) return 'var(--vie-type-hunch)';   // amber (medium)
  return 'var(--vie-type-source)';                        // teal (low)
}

const STATUS_LABELS: Record<string, string> = {
  active: 'ACTIVE',
  resolved: 'RESOLVED',
  dismissed: 'DISMISSED',
  open: 'ACTIVE',
  investigating: 'INVESTIGATING',
};

interface TensionCardProps {
  tension: TensionResult;
}

export default function TensionCard({ tension }: TensionCardProps) {
  return (
    <div className="explorer-tension-card">
      {/* Claim A */}
      <p className="explorer-tension-claim">{tension.claim_a_text}</p>

      {/* Divider */}
      <div className="explorer-tension-divider">
        <span className="explorer-tension-vs">vs</span>
      </div>

      {/* Claim B */}
      <p className="explorer-tension-claim">{tension.claim_b_text}</p>

      {/* Footer: severity + status */}
      <div className="explorer-tension-footer">
        <span
          className="explorer-tension-severity"
          style={{ color: severityColor(tension.severity) }}
        >
          {Math.round(tension.severity * 100)}%
        </span>
        <span className="explorer-tension-status">
          {STATUS_LABELS[tension.status] ?? tension.status.toUpperCase()}
        </span>
        {tension.domain && (
          <span className="explorer-tension-domain">{tension.domain}</span>
        )}
      </div>
    </div>
  );
}

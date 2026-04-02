'use client';

import type { ReviewQueueEdge } from '@/lib/commonplace-api';

function formatScore(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Offline';
  return value.toFixed(2);
}

function formatMetric(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Unavailable';
  return value.toFixed(2);
}

interface ModelDiagnosticsProps {
  edge: ReviewQueueEdge;
}

export default function ModelDiagnostics({ edge }: ModelDiagnosticsProps) {
  const diagnostics = edge.scorer_diagnostics;
  const rows = [
    ['Queue strategy', edge.strategy?.toUpperCase() ?? 'AUTO'],
    ['GBT score', formatScore(diagnostics?.gbt ?? edge.predicted_prob)],
    ['GNN score', formatScore(diagnostics?.gnn)],
    ['RL score', formatScore(diagnostics?.rl)],
    ['BP score', formatScore(diagnostics?.bp)],
    ['Ensemble score', formatScore(diagnostics?.ensemble)],
    ['Predicted probability', formatMetric(edge.predicted_prob)],
    ['Uncertainty', formatMetric(edge.uncertainty)],
    ['Disagreement', formatMetric(edge.disagreement)],
    ['Engine', edge.engine || 'Unknown'],
  ];

  return (
    <details className="cw-diagnostics">
      <summary className="cw-diagnostics-summary">Model Diagnostics</summary>
      <div className="cw-diagnostics-grid">
        {rows.map(([label, value]) => (
          <div key={label} className="cw-diagnostics-row">
            <span className="cw-diagnostics-label">{label}</span>
            <span className="cw-diagnostics-value">{value}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

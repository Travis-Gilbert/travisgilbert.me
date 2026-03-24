/**
 * NotebookMetrics: four metric callouts in a row.
 * Server-safe (no hooks, no 'use client').
 * Uses parchment tokens (light theme).
 */
import type { ApiNotebookHealth } from '@/lib/commonplace';

export default function NotebookMetrics({
  health,
}: {
  health: ApiNotebookHealth | null;
}) {
  if (!health) return null;

  const density = `${(health.density * 100).toFixed(1)}%`;

  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        padding: '14px 0',
        borderTop: '1px solid var(--cp-border)',
        borderBottom: '1px solid var(--cp-border)',
        justifyContent: 'space-around',
        background: 'rgba(242, 236, 224, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: 6,
        marginBottom: 4,
      }}
    >
      <MetricCallout value={health.object_count} label="Objects" />
      <div style={{ width: 1, background: 'var(--cp-border)' }} />
      <MetricCallout value={health.edge_count} label="Edges" />
      <div style={{ width: 1, background: 'var(--cp-border)' }} />
      <MetricCallout value={density} label="Density" />
      <div style={{ width: 1, background: 'var(--cp-border)' }} />
      <MetricCallout value={health.cluster_count} label="Clusters" />
    </div>
  );
}

function MetricCallout({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div style={{ textAlign: 'center', minWidth: 56 }}>
      <div
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--cp-text)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 8.5,
          fontWeight: 500,
          color: 'var(--cp-text-faint)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.08em',
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

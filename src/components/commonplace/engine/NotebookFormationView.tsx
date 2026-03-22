'use client';

import { useState, useCallback } from 'react';
import { useApiData, fetchSelfOrganizePreview, runSelfOrganizeLoop } from '@/lib/commonplace-api';
import { useCapture } from '@/lib/providers/capture-provider';
import { getObjectTypeIdentity } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Notebook Formation Viewer
   Monitoring surface: modularity gate, cluster
   candidates with type breakdown, per-cluster
   approve / skip.
   ───────────────────────────────────────────────── */

export default function NotebookFormationView() {
  const { captureVersion } = useCapture();
  const { data, loading, error, refetch } = useApiData(
    () => fetchSelfOrganizePreview(),
    [captureVersion],
  );

  const formation = data?.notebook_formation ?? null;

  if (loading) {
    return (
      <div className="cp-pane-content" style={containerStyle}>
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-pane-content" style={containerStyle}>
        <ErrorState message={error.message} onRetry={refetch} />
      </div>
    );
  }

  if (!formation) {
    return (
      <div className="cp-pane-content" style={containerStyle}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="cp-pane-content" style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>Notebook Formation</h2>
        <p style={subtitleStyle}>
          Community detection identifies clusters of related objects
          that may warrant their own notebook.
        </p>
      </div>

      <ModularityGate
        modularity={formation.modularity}
        threshold={formation.threshold}
        eligible={formation.eligible}
        candidateCount={formation.candidate_count}
      />

      {formation.eligible && formation.candidates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {formation.candidates.map((candidate, i) => (
            <ClusterCandidate
              key={candidate.label + i}
              label={candidate.label}
              memberCount={candidate.member_count}
              unassignedCount={candidate.unassigned_count}
              topNotebookShare={candidate.top_notebook_share}
              topTypes={candidate.top_types}
              onRefetch={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Modularity Gate ── */

function ModularityGate({
  modularity,
  threshold,
  eligible,
  candidateCount,
}: {
  modularity: number;
  threshold: number;
  eligible: boolean;
  candidateCount: number;
}) {
  const gateColor = eligible ? 'var(--cp-green)' : 'var(--cp-red)';
  const pct = Math.min(modularity / Math.max(threshold * 2, 0.5), 1);

  return (
    <div style={gateCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: gateColor,
            flexShrink: 0,
          }}
        />
        <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 11, letterSpacing: '0.06em', color: 'var(--cp-text-muted)', textTransform: 'uppercase' as const }}>
          Modularity Gate
        </span>
      </div>

      {/* Bar */}
      <div style={{ position: 'relative', height: 6, borderRadius: 3, backgroundColor: 'var(--cp-chrome-line)', marginBottom: 8 }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${pct * 100}%`,
            borderRadius: 3,
            backgroundColor: gateColor,
            transition: 'width 0.3s ease',
          }}
        />
        {/* Threshold marker */}
        <div
          style={{
            position: 'absolute',
            top: -3,
            left: `${(threshold / Math.max(threshold * 2, 0.5)) * 100}%`,
            width: 2,
            height: 12,
            backgroundColor: 'var(--cp-text-faint)',
            borderRadius: 1,
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--cp-text-muted)' }}>
        <span>
          Score: <strong style={{ color: 'var(--cp-text)' }}>{modularity.toFixed(2)}</strong>
          {' / '}
          Threshold: {threshold.toFixed(2)}
        </span>
        <span>
          {eligible
            ? `${candidateCount} candidate${candidateCount !== 1 ? 's' : ''} ready`
            : 'Below threshold'}
        </span>
      </div>
    </div>
  );
}

/* ── Cluster Candidate ── */

type CandidateState = 'default' | 'approving' | 'approved' | 'skipped';

function ClusterCandidate({
  label,
  memberCount,
  unassignedCount,
  topNotebookShare,
  topTypes,
  onRefetch,
}: {
  label: string;
  memberCount: number;
  unassignedCount: number;
  topNotebookShare: number;
  topTypes: Record<string, number>;
  onRefetch: () => void;
}) {
  const [state, setState] = useState<CandidateState>('default');

  const handleApprove = useCallback(async () => {
    setState('approving');
    try {
      await runSelfOrganizeLoop('form-notebooks', { cluster_label: label });
      setState('approved');
      setTimeout(onRefetch, 1200);
    } catch {
      setState('default');
    }
  }, [label, onRefetch]);

  const handleSkip = useCallback(() => {
    setState('skipped');
  }, []);

  if (state === 'skipped') return null;

  const assignedPct = memberCount > 0
    ? ((memberCount - unassignedCount) / memberCount) * 100
    : 0;

  return (
    <div
      style={{
        ...candidateCardStyle,
        opacity: state === 'approved' ? 0.6 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--cp-font-title)', fontSize: 16, color: 'var(--cp-text)', marginBottom: 2 }}>
            {label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--cp-text-muted)' }}>
            {memberCount} member{memberCount !== 1 ? 's' : ''}
            {topNotebookShare > 0 && ` · ${Math.round(topNotebookShare * 100)}% already in a notebook`}
          </div>
        </div>

        {state === 'approved' ? (
          <div style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 11, color: 'var(--cp-green)', letterSpacing: '0.04em' }}>
            ✓ FORMED
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleApprove}
              disabled={state === 'approving'}
              style={approveButtonStyle}
            >
              {state === 'approving' ? 'Forming...' : 'Approve'}
            </button>
            <button onClick={handleSkip} style={skipButtonStyle}>
              Skip
            </button>
          </div>
        )}
      </div>

      {/* Unassigned bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--cp-text-faint)', marginBottom: 4 }}>
          <span>{unassignedCount} unassigned</span>
          <span>{memberCount - unassignedCount} assigned</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, backgroundColor: 'var(--cp-chrome-line)' }}>
          <div
            style={{
              height: '100%',
              width: `${assignedPct}%`,
              borderRadius: 2,
              backgroundColor: 'var(--cp-teal)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Type pills */}
      <TypePillList types={topTypes} />
    </div>
  );
}

/* ── TypePillList (reusable) ── */

export function TypePillList({ types }: { types: Record<string, number> }) {
  const entries = Object.entries(types).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {entries.map(([typeSlug, count]) => {
        const identity = getObjectTypeIdentity(typeSlug);
        return (
          <div
            key={typeSlug}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 10,
              backgroundColor: `${identity.color}18`,
              border: `1px solid ${identity.color}30`,
              fontSize: 11,
              color: identity.color,
              fontFamily: 'var(--cp-font-mono)',
            }}
          >
            <span>{identity.label}</span>
            <span style={{ opacity: 0.7 }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Loading / Error / Empty states ── */

function LoadingState() {
  return (
    <div style={centeredStyle}>
      <div style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 12, color: 'var(--cp-text-faint)', letterSpacing: '0.06em' }}>
        LOADING PREVIEW...
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={centeredStyle}>
      <div style={{ color: 'var(--cp-red)', fontSize: 13, marginBottom: 8 }}>{message}</div>
      <button onClick={onRetry} style={approveButtonStyle}>
        Retry
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={centeredStyle}>
      <div style={{ fontFamily: 'var(--cp-font-title)', fontSize: 18, color: 'var(--cp-text)', marginBottom: 6 }}>
        No formation data
      </div>
      <div style={{ fontSize: 13, color: 'var(--cp-text-muted)', maxWidth: 300, textAlign: 'center' as const }}>
        The self-organize preview endpoint is not available, or there
        is not enough data for community detection.
      </div>
    </div>
  );
}

/* ── Styles ── */

const containerStyle: React.CSSProperties = {
  padding: 20,
  overflowY: 'auto',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const headerStyle: React.CSSProperties = {
  marginBottom: 4,
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--cp-font-title)',
  fontSize: 22,
  color: 'var(--cp-text)',
  margin: 0,
  marginBottom: 4,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--cp-text-muted)',
  margin: 0,
  lineHeight: 1.5,
};

const gateCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 8,
  backgroundColor: 'var(--cp-surface)',
  border: '1px solid var(--cp-chrome-line)',
};

const candidateCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 8,
  backgroundColor: 'var(--cp-surface)',
  border: '1px solid var(--cp-chrome-line)',
};

const centeredStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
};

const approveButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 6,
  border: '1px solid var(--cp-green)',
  backgroundColor: 'transparent',
  color: 'var(--cp-green)',
  fontSize: 12,
  fontFamily: 'var(--cp-font-mono)',
  cursor: 'pointer',
  letterSpacing: '0.03em',
};

const skipButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 6,
  border: '1px solid var(--cp-chrome-line)',
  backgroundColor: 'transparent',
  color: 'var(--cp-text-faint)',
  fontSize: 12,
  fontFamily: 'var(--cp-font-mono)',
  cursor: 'pointer',
};

'use client';

/**
 * CandidateActions: accept/reject controls for engine-proposed evidence.
 *
 * Renders as compact buttons next to an EvidenceItem when that item
 * is an engine candidate (isCandidate=true). After action, the button
 * set is replaced with a status indicator.
 */

interface CandidateActionsProps {
  onAccept: () => void;
  onReject: () => void;
  status?: 'pending' | 'accepted' | 'rejected';
}

export default function CandidateActions({
  onAccept,
  onReject,
  status = 'pending',
}: CandidateActionsProps) {
  if (status === 'accepted') {
    return (
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          color: '#2E8A3E',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        accepted
      </span>
    );
  }

  if (status === 'rejected') {
    return (
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          color: 'var(--cp-text-faint, #68666E)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          textDecoration: 'line-through',
        }}
      >
        rejected
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <button
        onClick={onAccept}
        title="Accept evidence"
        style={{
          background: 'none',
          border: '1px solid #2E8A3E',
          borderRadius: 2,
          padding: '1px 5px',
          cursor: 'pointer',
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          color: '#2E8A3E',
          lineHeight: 1,
        }}
      >
        &#x2713;
      </button>
      <button
        onClick={onReject}
        title="Reject evidence"
        style={{
          background: 'none',
          border: '1px solid var(--cp-text-faint, #68666E)',
          borderRadius: 2,
          padding: '1px 5px',
          cursor: 'pointer',
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          color: 'var(--cp-text-faint, #68666E)',
          lineHeight: 1,
        }}
      >
        &#x2717;
      </button>
    </span>
  );
}

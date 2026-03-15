'use client';

import { useState } from 'react';
import type { Assumption } from '@/lib/commonplace-models';
import { ASSUMPTION_STATUS_META } from '@/lib/commonplace-models';
import EvidenceItem from './EvidenceItem';

/**
 * AssumptionRow: single expandable assumption within the register.
 *
 * Collapsed: shows index label (A1, A2...), status pip, text, confidence.
 * Expanded: groups evidence by relation (supports / contradicts), shows
 * each via EvidenceItem with polymorphic rendering.
 *
 * The confidence bar uses the status color and fills proportionally.
 */

interface AssumptionRowProps {
  assumption: Assumption;
  index: number;
  onOpenObject?: (objectRef: number) => void;
}

export default function AssumptionRow({
  assumption,
  index,
  onOpenObject,
}: AssumptionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = ASSUMPTION_STATUS_META[assumption.status];
  const supporting = assumption.evidence.filter(
    (e) => e.relation === 'supports',
  );
  const contradicting = assumption.evidence.filter(
    (e) => e.relation === 'contradicts',
  );

  return (
    <div
      style={{
        border: '1px solid var(--cp-border-faint, #ECEAE6)',
        borderRadius: 4,
        background: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      {/* Collapsed header (always visible) */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Index label */}
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--cp-text-faint, #68666E)',
            flexShrink: 0,
            minWidth: 20,
          }}
        >
          A{index + 1}
        </span>

        {/* Status pip */}
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: statusMeta.color,
            flexShrink: 0,
          }}
          title={statusMeta.label}
        />

        {/* Claim text */}
        <span
          style={{
            flex: 1,
            fontFamily: 'var(--cp-font-body)',
            fontSize: 13,
            color: 'var(--cp-text, #18181B)',
            lineHeight: 1.45,
          }}
        >
          {assumption.text}
        </span>

        {/* Evidence count */}
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-faint, #68666E)',
            flexShrink: 0,
          }}
        >
          {assumption.evidence.length > 0
            ? `${assumption.evidence.length} evidence`
            : 'no evidence'}
        </span>

        {/* Expand chevron */}
        <span
          style={{
            fontSize: 10,
            color: 'var(--cp-text-faint, #68666E)',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.12s ease',
            flexShrink: 0,
          }}
        >
          &#x25B6;
        </span>
      </button>

      {/* Confidence bar */}
      <div
        style={{
          height: 2,
          background: 'var(--cp-border-faint, #ECEAE6)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${assumption.confidence * 100}%`,
            background: statusMeta.color,
            transition: 'width 0.2s ease',
          }}
        />
      </div>

      {/* Expanded: evidence grouped by relation */}
      {expanded && (
        <div
          style={{
            padding: '8px 14px 12px',
            background: 'var(--cp-surface, #F8F7F4)',
            borderTop: '1px solid var(--cp-border-faint, #ECEAE6)',
          }}
        >
          {/* Status label + confidence */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
            }}
          >
            <span
              style={{
                color: statusMeta.color,
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {statusMeta.label}
            </span>
            <span style={{ color: 'var(--cp-text-faint, #68666E)' }}>
              {Math.round(assumption.confidence * 100)}% confidence
            </span>
          </div>

          {/* Supporting evidence */}
          {supporting.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#1A7A8A',
                  marginBottom: 4,
                }}
              >
                supports
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {supporting.map((e) => (
                  <EvidenceItem
                    key={e.id}
                    evidence={e}
                    onOpenObject={onOpenObject}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Contradicting evidence */}
          {contradicting.length > 0 && (
            <div>
              <div
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#C4503C',
                  marginBottom: 4,
                }}
              >
                contradicts
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {contradicting.map((e) => (
                  <EvidenceItem
                    key={e.id}
                    evidence={e}
                    onOpenObject={onOpenObject}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty evidence state */}
          {assumption.evidence.length === 0 && (
            <div
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 11,
                color: 'var(--cp-text-faint, #68666E)',
                fontStyle: 'italic',
                padding: '4px 0',
              }}
            >
              No evidence linked. This assumption is a gap.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

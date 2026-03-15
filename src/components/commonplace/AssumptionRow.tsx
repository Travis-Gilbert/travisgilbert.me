'use client';

import { useState } from 'react';
import type { Assumption, EvidenceLink } from '@/lib/commonplace-models';
import { ASSUMPTION_STATUS_META } from '@/lib/commonplace-models';
import EvidenceItem from './EvidenceItem';

interface AssumptionRowProps {
  assumption: Assumption;
  index: number;
  onOpenObject?: (objectRef: number) => void;
}

function confidenceBarColor(value: number): string {
  if (value > 0.7) return '#2E8A3E';
  if (value > 0.45) return '#D4944A';
  return '#C4503C';
}

function countByRelation(
  evidence: EvidenceLink[],
  relation: 'supports' | 'contradicts',
): number {
  return evidence.filter((e) => e.relation === relation && !e.isCandidate)
    .length;
}

function countCandidates(evidence: EvidenceLink[]): number {
  return evidence.filter((e) => e.isCandidate).length;
}

export default function AssumptionRow({
  assumption,
  index,
  onOpenObject,
}: AssumptionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = ASSUMPTION_STATUS_META[assumption.status];
  const statusColor = statusMeta.color;

  const supporting = assumption.evidence.filter(
    (e) => e.relation === 'supports',
  );
  const contradicting = assumption.evidence.filter(
    (e) => e.relation === 'contradicts',
  );

  const supportCount = countByRelation(assumption.evidence, 'supports');
  const contradictCount = countByRelation(assumption.evidence, 'contradicts');
  const candidateCount = countCandidates(assumption.evidence);

  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: 16,
      }}
    >
      {/* Left colored border */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: statusColor,
          borderRadius: 2,
        }}
      />

      {/* Dot node at top of border */}
      <div
        style={{
          position: 'absolute',
          left: -2,
          top: 8,
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'var(--cp-surface, #F8F7F4)',
          border: `2px solid ${statusColor}`,
        }}
      />

      {/* Collapsed header (always visible) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '6px 0 4px',
          cursor: 'pointer',
        }}
      >
        {/* Index label */}
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: statusColor,
            flexShrink: 0,
            minWidth: 22,
            paddingTop: 2,
          }}
        >
          A{index + 1}
        </span>

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

        {/* Expand chevron */}
        <span
          style={{
            fontSize: 10,
            color: 'var(--cp-text-faint, #68666E)',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.12s ease',
            flexShrink: 0,
            paddingTop: 3,
          }}
        >
          &#x25BE;
        </span>
      </div>

      {/* Status row: label + confidence bar + evidence counts */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 8,
          fontSize: 10,
          fontFamily: 'var(--cp-font-mono)',
        }}
      >
        {/* Status label */}
        <span
          style={{
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: statusColor,
            flexShrink: 0,
          }}
        >
          {statusMeta.label}
        </span>

        {/* Confidence bar */}
        <div
          style={{
            flex: 1,
            maxWidth: 80,
            height: 3,
            background: 'var(--cp-border-faint, #ECEAE6)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${assumption.confidence * 100}%`,
              background: confidenceBarColor(assumption.confidence),
              borderRadius: 2,
              transition: 'width 0.2s ease',
            }}
          />
        </div>

        {/* Evidence counts */}
        <span
          style={{
            color: 'var(--cp-text-faint, #68666E)',
            flexShrink: 0,
          }}
        >
          {supportCount > 0 && (
            <span style={{ color: '#1A7A8A' }}>
              {supportCount}s{' '}
            </span>
          )}
          {contradictCount > 0 && (
            <span style={{ color: '#C4503C' }}>
              {contradictCount}c{' '}
            </span>
          )}
          {candidateCount > 0 && (
            <span style={{ color: 'var(--cp-gold, #C49A4A)' }}>
              {candidateCount} cand.
            </span>
          )}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ paddingLeft: 6, paddingBottom: 12 }}>
          {/* Supporting evidence */}
          {supporting.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 1,
                    background: '#1A7A8A',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#1A7A8A',
                  }}
                >
                  SUPPORTS
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
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
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 1,
                    background: '#C4503C',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#C4503C',
                  }}
                >
                  CONTRADICTS
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
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

          {/* Empty state */}
          {assumption.evidence.length === 0 && (
            <div
              style={{
                border: '1.5px dashed #D4944A',
                borderRadius: 4,
                padding: '8px 10px',
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 11,
                color: '#D4944A',
                lineHeight: 1.4,
              }}
            >
              No evidence. Engine cannot evaluate.
            </div>
          )}

          {/* Add evidence button */}
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              style={{
                background: 'none',
                border: '1px solid #1A7A8A44',
                borderRadius: 3,
                padding: '3px 10px',
                cursor: 'pointer',
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 10,
                color: '#1A7A8A',
                letterSpacing: '0.03em',
              }}
            >
              + evidence
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

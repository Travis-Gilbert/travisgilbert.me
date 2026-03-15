'use client';

import type { EvidenceLink, EvidenceObjectType } from '@/lib/commonplace-models';
import { EVIDENCE_RELATION_COLOR } from '@/lib/commonplace-models';
import CandidateActions from './CandidateActions';

/**
 * EvidenceItem: polymorphic evidence renderer within an assumption.
 *
 * Renders differently per object type:
 *   source  → book icon prefix, title as citation
 *   hunch   → sparkle prefix, italic
 *   quote   → quotation marks, serif font
 *   concept → lightbulb prefix, bold
 *   note    → pencil prefix, standard
 *
 * Engine candidates show a dashed border and ENGINE label with
 * accept/reject controls.
 */

const TYPE_PREFIX: Record<EvidenceObjectType, string> = {
  source: '\u{1F4D6}',
  hunch: '\u2728',
  quote: '\u201C',
  concept: '\u{1F4A1}',
  note: '\u270E',
};

interface EvidenceItemProps {
  evidence: EvidenceLink;
  onOpenObject?: (objectRef: number) => void;
  candidateStatus?: 'pending' | 'accepted' | 'rejected';
  onAcceptCandidate?: () => void;
  onRejectCandidate?: () => void;
}

export default function EvidenceItem({
  evidence,
  onOpenObject,
  candidateStatus,
  onAcceptCandidate,
  onRejectCandidate,
}: EvidenceItemProps) {
  const relationColor = EVIDENCE_RELATION_COLOR[evidence.relation];
  const isCandidate = evidence.isCandidate;

  return (
    <button
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px',
        borderRadius: 3,
        border: isCandidate
          ? '1px dashed var(--cp-border, #E2E0DC)'
          : '1px solid transparent',
        background: isCandidate
          ? 'var(--cp-surface, #F8F7F4)'
          : 'transparent',
        fontSize: 12,
        lineHeight: 1.4,
        cursor: onOpenObject ? 'pointer' : 'default',
        width: '100%',
        textAlign: 'left',
      }}
      onClick={() => onOpenObject?.(evidence.objectRef)}
    >
      {/* Engine candidate label */}
      {isCandidate && (
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--cp-gold, #C49A4A)',
            flexShrink: 0,
          }}
        >
          ENGINE
        </span>
      )}

      {/* Relation indicator */}
      <span
        style={{
          width: 3,
          height: 14,
          borderRadius: 1,
          background: relationColor,
          flexShrink: 0,
        }}
      />

      {/* Type prefix */}
      <span style={{ fontSize: 11, flexShrink: 0 }}>
        {TYPE_PREFIX[evidence.objectType]}
      </span>

      {/* Title (polymorphic styling) */}
      <span
        style={{
          flex: 1,
          fontFamily:
            evidence.objectType === 'quote'
              ? 'var(--cp-font-title)'
              : 'var(--cp-font-body)',
          fontStyle:
            evidence.objectType === 'hunch' ? 'italic' : 'normal',
          fontWeight:
            evidence.objectType === 'concept' ? 600 : 400,
          color: 'var(--cp-text, #18181B)',
          fontSize: 12,
        }}
      >
        {evidence.objectType === 'quote' && '\u201C'}
        {evidence.objectTitle}
        {evidence.objectType === 'quote' && '\u201D'}
      </span>

      {/* Confidence */}
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          color: 'var(--cp-text-faint, #68666E)',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {Math.round(evidence.confidence * 100)}%
      </span>

      {/* Candidate actions */}
      {isCandidate && onAcceptCandidate && onRejectCandidate && (
        <CandidateActions
          onAccept={onAcceptCandidate}
          onReject={onRejectCandidate}
          status={candidateStatus}
        />
      )}
    </button>
  );
}

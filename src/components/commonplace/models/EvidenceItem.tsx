'use client';

import { useState } from 'react';
import type { EvidenceLink } from '@/lib/commonplace-models';
import {
  EVIDENCE_RELATION_COLOR,
  EVIDENCE_TYPE_COLOR,
} from '@/lib/commonplace-models';
import CandidateActions from '../engine/CandidateActions';

interface EvidenceItemProps {
  evidence: EvidenceLink;
  onOpenObject?: (objectRef: number) => void;
  candidateStatus?: 'pending' | 'accepted' | 'rejected';
  onAcceptCandidate?: () => void;
  onRejectCandidate?: () => void;
}

/** 4px pip showing the relation color (supports/contradicts). */
function RelationPip({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 4,
        height: 4,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  );
}

/** Engine label shown on candidate items. */
function EngineLabel() {
  return (
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
  );
}

/** Faint secondary text line (title, attribution, domain). */
function FaintLine({
  children,
  color,
  italic,
}: {
  children: React.ReactNode;
  color?: string;
  italic?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: 'var(--cp-font-mono)',
        fontSize: 10,
        color: color ?? 'var(--cp-text-faint, #68666E)',
        marginTop: 2,
        fontStyle: italic ? 'italic' : 'normal',
        lineHeight: 1.3,
      }}
    >
      {children}
    </div>
  );
}

function SourceEvidence({
  evidence,
  relationColor,
  typeColor,
}: {
  evidence: EvidenceLink;
  relationColor: string;
  typeColor: string;
}) {
  return (
    <div>
      {/* Gradient bar at top */}
      <div
        style={{
          height: 2,
          background: `linear-gradient(90deg, ${typeColor}, ${typeColor}88)`,
          borderRadius: '3px 3px 0 0',
        }}
      />
      <div style={{ padding: '6px 8px 6px 8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 3,
          }}
        >
          <RelationPip color={relationColor} />
          {evidence.domain && (
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: typeColor,
              }}
            >
              {evidence.domain}
            </span>
          )}
        </div>
        {evidence.contentText && (
          <div
            style={{
              fontFamily: 'var(--cp-font-body)',
              fontSize: 12,
              color: 'var(--cp-text, #18181B)',
              lineHeight: 1.45,
            }}
          >
            {evidence.contentText}
          </div>
        )}
        <FaintLine>{evidence.objectTitle}</FaintLine>
      </div>
    </div>
  );
}

function HunchEvidence({
  evidence,
  typeColor,
  relationColor,
}: {
  evidence: EvidenceLink;
  typeColor: string;
  relationColor: string;
}) {
  return (
    <div
      style={{
        border: `1.5px dashed ${typeColor}`,
        borderRadius: 4,
        background: `${typeColor}0A`,
        padding: '6px 8px',
        transform: 'rotate(-0.2deg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 3,
        }}
      >
        <RelationPip color={relationColor} />
      </div>
      {evidence.contentText && (
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            fontStyle: 'italic',
            color: 'var(--cp-text, #18181B)',
            lineHeight: 1.45,
          }}
        >
          {evidence.contentText}
        </div>
      )}
      <FaintLine color={typeColor}>{evidence.objectTitle}</FaintLine>
    </div>
  );
}

function QuoteEvidence({
  evidence,
  typeColor,
  relationColor,
}: {
  evidence: EvidenceLink;
  typeColor: string;
  relationColor: string;
}) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${typeColor}`,
        padding: '6px 0 6px 10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
          marginBottom: 2,
        }}
      >
        <RelationPip color={relationColor} />
      </div>
      <div
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 12,
          fontStyle: 'italic',
          color: 'var(--cp-text, #18181B)',
          lineHeight: 1.5,
        }}
      >
        &ldquo;{evidence.contentText ?? evidence.objectTitle}&rdquo;
      </div>
      {evidence.attribution && (
        <FaintLine italic>{evidence.attribution}</FaintLine>
      )}
      {!evidence.attribution && evidence.objectTitle && evidence.contentText && (
        <FaintLine>{evidence.objectTitle}</FaintLine>
      )}
    </div>
  );
}

function ConceptEvidence({
  evidence,
  typeColor,
  relationColor,
}: {
  evidence: EvidenceLink;
  typeColor: string;
  relationColor: string;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: `1.5px solid ${typeColor}`,
        borderRadius: 999,
        padding: '4px 12px',
      }}
    >
      <RelationPip color={relationColor} />
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: typeColor,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--cp-text, #18181B)',
        }}
      >
        {evidence.objectTitle}
      </span>
    </div>
  );
}

function NoteEvidence({
  evidence,
  typeColor,
  relationColor,
}: {
  evidence: EvidenceLink;
  typeColor: string;
  relationColor: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${typeColor}44`,
        borderRadius: 3,
        padding: '6px 8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 3,
        }}
      >
        <RelationPip color={relationColor} />
      </div>
      {evidence.contentText && (
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            color: 'var(--cp-text, #18181B)',
            lineHeight: 1.45,
          }}
        >
          {evidence.contentText}
        </div>
      )}
      <FaintLine>{evidence.objectTitle}</FaintLine>
    </div>
  );
}

export default function EvidenceItem({
  evidence,
  onOpenObject,
  candidateStatus,
  onAcceptCandidate,
  onRejectCandidate,
}: EvidenceItemProps) {
  const [hovered, setHovered] = useState(false);

  const relationColor = EVIDENCE_RELATION_COLOR[evidence.relation];
  const typeColor = EVIDENCE_TYPE_COLOR[evidence.objectType];
  const isCandidate = evidence.isCandidate;
  const isConcept = evidence.objectType === 'concept';

  function renderByType(): React.ReactNode {
    switch (evidence.objectType) {
      case 'source':
        return (
          <SourceEvidence
            evidence={evidence}
            relationColor={relationColor}
            typeColor={typeColor}
          />
        );
      case 'hunch':
        return (
          <HunchEvidence
            evidence={evidence}
            typeColor={typeColor}
            relationColor={relationColor}
          />
        );
      case 'quote':
        return (
          <QuoteEvidence
            evidence={evidence}
            typeColor={typeColor}
            relationColor={relationColor}
          />
        );
      case 'concept':
        return (
          <ConceptEvidence
            evidence={evidence}
            typeColor={typeColor}
            relationColor={relationColor}
          />
        );
      case 'note':
        return (
          <NoteEvidence
            evidence={evidence}
            typeColor={typeColor}
            relationColor={relationColor}
          />
        );
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenObject?.(evidence.objectRef)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenObject?.(evidence.objectRef);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: onOpenObject ? 'pointer' : 'default',
        opacity: hovered ? 1 : 0.92,
        transition: 'opacity 0.1s ease',
      }}
    >
      {/* Candidate header (ENGINE label + actions) */}
      {isCandidate && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <EngineLabel />
          {onAcceptCandidate && onRejectCandidate && (
            <CandidateActions
              onAccept={onAcceptCandidate}
              onReject={onRejectCandidate}
              status={candidateStatus}
              inline={isConcept}
            />
          )}
        </div>
      )}

      {renderByType()}
    </div>
  );
}

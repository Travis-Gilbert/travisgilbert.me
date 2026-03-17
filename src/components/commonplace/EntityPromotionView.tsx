'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  useApiData,
  fetchSelfOrganizePreview,
  runSelfOrganizeLoop,
} from '@/lib/commonplace-api';
import { useCommonPlace } from '@/lib/commonplace-context';
import type { ApiEntityPromotionCandidate } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Entity Promotion Viewer
   Monitoring surface: threshold slider, eligible
   vs approaching sections, per-entity and batch
   promote.
   ───────────────────────────────────────────────── */

/** NER type to object type mapping (from self_organize.py) */
const NER_TO_OBJECT_TYPE: Record<string, string> = {
  PERSON: 'person',
  ORG: 'organization',
  GPE: 'place',
  LOC: 'place',
  EVENT: 'event',
  WORK_OF_ART: 'source',
  CONCEPT: 'concept',
};

export default function EntityPromotionView() {
  const { captureVersion } = useCommonPlace();
  const [threshold, setThreshold] = useState<number | null>(null);
  const [promotedTexts, setPromotedTexts] = useState<Set<string>>(new Set());

  const { data, loading, error, refetch } = useApiData(
    () => fetchSelfOrganizePreview(),
    [captureVersion],
  );

  const entityData = data?.entity_promotions ?? null;
  const serverThreshold = entityData?.threshold ?? 5;
  const activeThreshold = threshold ?? serverThreshold;

  const { eligible, approaching } = useMemo(() => {
    if (!entityData?.candidates) return { eligible: [], approaching: [] };
    const sorted = [...entityData.candidates].sort(
      (a, b) => b.mention_count - a.mention_count,
    );
    const elig: ApiEntityPromotionCandidate[] = [];
    const appr: ApiEntityPromotionCandidate[] = [];
    for (const c of sorted) {
      if (promotedTexts.has(c.normalized_text)) continue;
      if (c.mention_count >= activeThreshold) elig.push(c);
      else appr.push(c);
    }
    return { eligible: elig, approaching: appr };
  }, [entityData, activeThreshold, promotedTexts]);

  const maxMentions = useMemo(
    () =>
      entityData?.candidates.reduce(
        (max, c) => Math.max(max, c.mention_count),
        0,
      ) ?? 1,
    [entityData],
  );

  const handlePromote = useCallback(
    async (entity: ApiEntityPromotionCandidate) => {
      try {
        await runSelfOrganizeLoop('promote-entities', {
          entity_texts: [entity.normalized_text],
          threshold: activeThreshold,
        });
        setPromotedTexts((prev) => new Set(prev).add(entity.normalized_text));
      } catch {
        // Silently fail
      }
    },
    [activeThreshold],
  );

  const handleBatchPromote = useCallback(async () => {
    for (const entity of eligible) {
      try {
        await runSelfOrganizeLoop('promote-entities', {
          entity_texts: [entity.normalized_text],
          threshold: activeThreshold,
        });
        setPromotedTexts((prev) => new Set(prev).add(entity.normalized_text));
      } catch {
        break;
      }
    }
  }, [eligible, activeThreshold]);

  if (loading) {
    return (
      <div className="cp-pane-content" style={containerStyle}>
        <div style={centeredStyle}>
          <div style={monoLabel}>LOADING ENTITIES...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-pane-content" style={containerStyle}>
        <div style={centeredStyle}>
          <div style={{ color: 'var(--cp-red)', fontSize: 13, marginBottom: 8 }}>
            {error.message}
          </div>
          <button onClick={refetch} style={promoteBtnStyle}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!entityData) {
    return (
      <div className="cp-pane-content" style={containerStyle}>
        <div style={centeredStyle}>
          <div style={{ fontFamily: 'var(--cp-font-title)', fontSize: 18, color: 'var(--cp-text)', marginBottom: 6 }}>
            No entity data
          </div>
          <div style={{ fontSize: 13, color: 'var(--cp-text-muted)', maxWidth: 300, textAlign: 'center' as const }}>
            The self-organize preview is not available, or the
            connection engine has not yet found recurring entities.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-pane-content" style={containerStyle}>
      {/* Header */}
      <div>
        <h2 style={titleStyle}>Entity Promotions</h2>
        <p style={subtitleStyle}>
          Entities that appear frequently across objects can be
          promoted to first-class Objects in the knowledge graph.
        </p>
      </div>

      {/* Threshold slider */}
      <ThresholdSlider
        value={activeThreshold}
        min={2}
        max={Math.max(maxMentions, 10)}
        onChange={setThreshold}
      />

      {/* Eligible section */}
      {eligible.length > 0 && (
        <div>
          <div style={sectionHeaderStyle}>
            <span style={{ ...monoLabel, color: 'var(--cp-green)' }}>
              ELIGIBLE ({eligible.length})
            </span>
            {eligible.length > 1 && (
              <button onClick={handleBatchPromote} style={promoteBtnStyle}>
                Promote all eligible
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {eligible.map((entity) => (
              <EntityRow
                key={entity.normalized_text}
                entity={entity}
                maxMentions={maxMentions}
                isEligible
                onPromote={() => handlePromote(entity)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Approaching section */}
      {approaching.length > 0 && (
        <div>
          <div style={sectionHeaderStyle}>
            <span style={{ ...monoLabel, color: 'var(--cp-text-faint)' }}>
              APPROACHING ({approaching.length})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {approaching.map((entity) => (
              <EntityRow
                key={entity.normalized_text}
                entity={entity}
                maxMentions={maxMentions}
                isEligible={false}
              />
            ))}
          </div>
        </div>
      )}

      {eligible.length === 0 && approaching.length === 0 && (
        <div style={centeredStyle}>
          <div style={{ fontSize: 13, color: 'var(--cp-text-muted)' }}>
            All entity candidates have been promoted.
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Threshold Slider ── */

function ThresholdSlider({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={sliderCardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ ...monoLabel, color: 'var(--cp-text-muted)' }}>
          Mention threshold
        </span>
        <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 14, color: 'var(--cp-text)' }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: 'var(--cp-teal)',
          cursor: 'pointer',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--cp-text-faint)', marginTop: 4 }}>
        <span>{min}</span>
        <span>Entities with {value}+ mentions are eligible</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

/* ── Entity Row ── */

function EntityRow({
  entity,
  maxMentions,
  isEligible,
  onPromote,
}: {
  entity: ApiEntityPromotionCandidate;
  maxMentions: number;
  isEligible: boolean;
  onPromote?: () => void;
}) {
  const [promoting, setPromoting] = useState(false);
  const objectType = NER_TO_OBJECT_TYPE[entity.entity_type] ?? entity.suggested_object_type;
  const identity = getObjectTypeIdentity(objectType);
  const barPct = maxMentions > 0 ? (entity.mention_count / maxMentions) * 100 : 0;

  const handlePromote = useCallback(async () => {
    if (!onPromote) return;
    setPromoting(true);
    await onPromote();
  }, [onPromote]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        borderRadius: 6,
        backgroundColor: 'var(--cp-surface)',
        border: '1px solid var(--cp-chrome-line)',
        opacity: isEligible ? 1 : 0.55,
      }}
    >
      {/* Entity text + NER label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: 'var(--cp-text)', textTransform: 'capitalize' as const }}>
          {entity.normalized_text}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--cp-font-mono)',
              color: identity.color,
              letterSpacing: '0.04em',
            }}
          >
            {entity.entity_type}
          </span>
          <span style={{ fontSize: 10, color: 'var(--cp-text-faint)' }}>
            → {identity.label}
          </span>
        </div>
      </div>

      {/* Mention count bar */}
      <div style={{ width: 100, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
          <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 12, color: 'var(--cp-text-muted)' }}>
            {entity.mention_count}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, backgroundColor: 'var(--cp-chrome-line)' }}>
          <div
            style={{
              height: '100%',
              width: `${barPct}%`,
              borderRadius: 2,
              backgroundColor: isEligible ? identity.color : 'var(--cp-text-faint)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Promote button (eligible only) */}
      {isEligible && onPromote && (
        <button
          onClick={handlePromote}
          disabled={promoting}
          style={promoteBtnStyle}
        >
          {promoting ? '...' : 'Promote'}
        </button>
      )}
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

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
};

const centeredStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  padding: 40,
};

const sliderCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 8,
  backgroundColor: 'var(--cp-surface)',
  border: '1px solid var(--cp-chrome-line)',
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  marginBottom: 4,
};

const promoteBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 5,
  border: '1px solid var(--cp-teal)',
  backgroundColor: 'transparent',
  color: 'var(--cp-teal)',
  fontSize: 12,
  fontFamily: 'var(--cp-font-mono)',
  cursor: 'pointer',
  letterSpacing: '0.03em',
  flexShrink: 0,
};

'use client';

/**
 * EntityBubbles: bubble scatter for entity promotion candidates.
 *
 * Replaces the flat EntityPromotionView list with sized bubbles.
 * Bubble radius = sqrt(mention_count) scaled. Color = NER type identity.
 * Threshold slider draws a visual divider line. Click bubble to promote.
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  useApiData,
  fetchSelfOrganizePreview,
  runSelfOrganizeLoop,
  fetchFeedbackStats,
} from '@/lib/commonplace-api';
import { useCapture } from '@/lib/providers/capture-provider';
import { useLayout } from '@/lib/providers/layout-provider';
import type { ApiEntityPromotionCandidate } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import EngineShell from './EngineShell';
import { SHRINK_EXIT, useSpring } from './engine-motion';

const NER_TO_OBJECT_TYPE: Record<string, string> = {
  PERSON: 'person',
  ORG: 'organization',
  GPE: 'place',
  LOC: 'place',
  EVENT: 'event',
  WORK_OF_ART: 'source',
  CONCEPT: 'concept',
};

export default function EntityBubbles() {
  const { captureVersion } = useCapture();
  const { navigateToScreen } = useLayout();
  const [threshold, setThreshold] = useState<number | null>(null);
  const [promotedTexts, setPromotedTexts] = useState<Set<string>>(new Set());
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApiData(
    () => fetchSelfOrganizePreview(),
    [captureVersion],
  );
  const { data: feedbackStats } = useApiData(fetchFeedbackStats, []);

  const entityData = data?.entity_promotions ?? null;
  const serverThreshold = entityData?.threshold ?? 5;
  const activeThreshold = threshold ?? serverThreshold;

  const candidates = useMemo(() => {
    if (!entityData?.candidates) return [];
    return entityData.candidates
      .filter((c) => !promotedTexts.has(c.normalized_text))
      .sort((a, b) => b.mention_count - a.mention_count);
  }, [entityData, promotedTexts]);

  const maxMentions = useMemo(
    () => candidates.reduce((max, c) => Math.max(max, c.mention_count), 1),
    [candidates],
  );

  const eligible = candidates.filter((c) => c.mention_count >= activeThreshold);
  const approaching = candidates.filter((c) => c.mention_count < activeThreshold);

  const spring = useSpring('natural');

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

  return (
    <EngineShell
      title="Entity Promotions"
      subtitle="Entities that appear frequently can be promoted to first-class Objects."
      feedbackStats={feedbackStats}
      onBack={() => navigateToScreen('engine')}
    >
      <style>{`
        .eb-threshold-card {
          padding: 16px;
          border-radius: 8px;
          background: var(--cp-surface, rgba(237,228,214,0.65));
          border: 1px solid var(--cp-chrome-line, rgba(244,243,240,0.06));
          margin-bottom: 16px;
        }
        .eb-threshold-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .eb-threshold-label {
          font-family: var(--cp-font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--cp-text-muted, #5C554D);
        }
        .eb-threshold-value {
          font-family: var(--cp-font-mono);
          font-size: 14px;
          color: var(--cp-text, #2A2520);
        }
        .eb-threshold-range {
          width: 100%;
          accent-color: var(--cp-teal, #2D5F6B);
          cursor: pointer;
        }
        .eb-threshold-hint {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: var(--cp-text-faint, #8A8279);
          margin-top: 4px;
        }
        .eb-section-label {
          font-family: var(--cp-font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .eb-section-label--eligible {
          color: var(--cp-green, #5A8A5A);
        }
        .eb-section-label--approaching {
          color: var(--cp-text-faint, #8A8279);
        }
        .eb-promote-all-btn {
          padding: 3px 10px;
          border-radius: 5px;
          border: 1px solid var(--cp-teal, #2D5F6B);
          background: transparent;
          color: var(--cp-teal, #2D5F6B);
          font-size: 11px;
          font-family: var(--cp-font-mono);
          cursor: pointer;
          letter-spacing: 0.03em;
        }
        .eb-bubble-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: flex-end;
          margin-bottom: 20px;
          min-height: 60px;
        }
        .eb-bubble {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: transform 120ms ease;
        }
        .eb-bubble:hover {
          transform: translateY(-2px);
        }
        .eb-bubble-circle {
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--cp-font-mono);
          font-weight: 700;
          color: #fff;
          transition: box-shadow 120ms ease;
        }
        .eb-bubble-label {
          font-size: 10px;
          color: var(--cp-text-muted, #5C554D);
          text-align: center;
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-transform: capitalize;
        }
        .eb-bubble-ner {
          font-family: var(--cp-font-mono);
          font-size: 9px;
          letter-spacing: 0.04em;
          color: var(--cp-text-faint, #8A8279);
        }
        .eb-tooltip {
          position: fixed;
          z-index: 100;
          pointer-events: none;
          padding: 8px 12px;
          border-radius: 6px;
          background: var(--cp-card, #242118);
          color: #f4f3f0;
          font-size: 12px;
          font-family: var(--cp-font-body);
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          max-width: 200px;
        }
        .eb-empty {
          text-align: center;
          padding: 40px 20px;
          color: var(--cp-text-muted, #5C554D);
          font-size: 13px;
        }
        .eb-loading {
          text-align: center;
          padding: 40px 20px;
          font-family: var(--cp-font-mono);
          font-size: 12px;
          color: var(--cp-text-faint, #8A8279);
          letter-spacing: 0.06em;
        }
      `}</style>

      {loading && <div className="eb-loading">LOADING ENTITIES...</div>}

      {error && (
        <div className="eb-empty">
          <div style={{ color: 'var(--cp-red)', marginBottom: 8 }}>{error.message}</div>
          <button onClick={refetch} className="eb-promote-all-btn">Retry</button>
        </div>
      )}

      {!loading && !error && !entityData && (
        <div className="eb-empty">
          No entity data available. The connection engine has not yet found recurring entities.
        </div>
      )}

      {!loading && !error && entityData && (
        <>
          {/* Threshold slider */}
          <div className="eb-threshold-card">
            <div className="eb-threshold-header">
              <span className="eb-threshold-label">Mention threshold</span>
              <span className="eb-threshold-value">{activeThreshold}</span>
            </div>
            <input
              type="range"
              className="eb-threshold-range"
              min={2}
              max={Math.max(maxMentions, 10)}
              value={activeThreshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <div className="eb-threshold-hint">
              <span>2</span>
              <span>Entities with {activeThreshold}+ mentions are eligible</span>
              <span>{Math.max(maxMentions, 10)}</span>
            </div>
          </div>

          {/* Eligible bubbles */}
          {eligible.length > 0 && (
            <div>
              <div className="eb-section-label eb-section-label--eligible">
                <span>ELIGIBLE ({eligible.length})</span>
                {eligible.length > 1 && (
                  <button onClick={handleBatchPromote} className="eb-promote-all-btn">
                    Promote all
                  </button>
                )}
              </div>
              <div className="eb-bubble-grid">
                <AnimatePresence initial={false}>
                  {eligible.map((entity) => (
                    <EntityBubble
                      key={entity.normalized_text}
                      entity={entity}
                      maxMentions={maxMentions}
                      isEligible
                      onPromote={() => handlePromote(entity)}
                      onHover={setHoveredEntity}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Approaching bubbles */}
          {approaching.length > 0 && (
            <div>
              <div className="eb-section-label eb-section-label--approaching">
                APPROACHING ({approaching.length})
              </div>
              <div className="eb-bubble-grid">
                {approaching.map((entity) => (
                  <EntityBubble
                    key={entity.normalized_text}
                    entity={entity}
                    maxMentions={maxMentions}
                    isEligible={false}
                    onHover={setHoveredEntity}
                  />
                ))}
              </div>
            </div>
          )}

          {candidates.length === 0 && (
            <div className="eb-empty">All entity candidates have been promoted.</div>
          )}
        </>
      )}
    </EngineShell>
  );
}

/* ── Single bubble ── */

function EntityBubble({
  entity,
  maxMentions,
  isEligible,
  onPromote,
  onHover,
}: {
  entity: ApiEntityPromotionCandidate;
  maxMentions: number;
  isEligible: boolean;
  onPromote?: () => void;
  onHover: (text: string | null) => void;
}) {
  const [promoting, setPromoting] = useState(false);
  const spring = useSpring('natural');
  const objectType = NER_TO_OBJECT_TYPE[entity.entity_type] ?? entity.suggested_object_type;
  const identity = getObjectTypeIdentity(objectType);

  // Size: min 28px, max 56px, sqrt-scaled
  const size = Math.round(28 + (Math.sqrt(entity.mention_count) / Math.sqrt(maxMentions)) * 28);

  const handleClick = useCallback(async () => {
    if (!onPromote || !isEligible) return;
    setPromoting(true);
    await onPromote();
  }, [onPromote, isEligible]);

  return (
    <motion.div
      className="eb-bubble"
      layout
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: isEligible ? 1 : 0.5, scale: 1 }}
      exit={SHRINK_EXIT}
      transition={spring}
      onClick={handleClick}
      onMouseEnter={() => onHover(entity.normalized_text)}
      onMouseLeave={() => onHover(null)}
      title={`${entity.normalized_text} (${entity.mention_count} mentions, ${entity.entity_type})`}
    >
      <div
        className="eb-bubble-circle"
        style={{
          width: size,
          height: size,
          fontSize: size < 36 ? 10 : 12,
          backgroundColor: isEligible ? identity.color : 'var(--cp-text-faint, #8A8279)',
          boxShadow: isEligible ? `0 2px 8px ${identity.color}40` : 'none',
        }}
      >
        {promoting ? '...' : entity.mention_count}
      </div>
      <span className="eb-bubble-label">{entity.normalized_text}</span>
      <span className="eb-bubble-ner">{entity.entity_type}</span>
    </motion.div>
  );
}

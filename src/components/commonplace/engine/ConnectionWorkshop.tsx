'use client';

/**
 * ConnectionWorkshop v2: graduated 6-level feedback for connection review.
 *
 * Verdict strip: Wrong | Obvious | Skip | Relevant | Surprising | Solves Problem
 * Keyboard:       Left    Down    Space   Right       Up        Shift+Right
 *
 * The 'generates_hypothesis' signal is system-only and never appears in the UI.
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  fetchReviewQueue,
  submitConnectionFeedback,
  fetchFeedbackStats,
  useApiData,
} from '@/lib/commonplace-api';
import type { ReviewQueueEdge } from '@/lib/commonplace-api';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { useLayout } from '@/lib/providers/layout-provider';
import { useDrawer } from '@/lib/providers/drawer-provider';
import ObjectRenderer from '../objects/ObjectRenderer';
import type { RenderableObject } from '../objects/ObjectRenderer';
import EngineShell from './EngineShell';
import EngineProvenance from './EngineProvenance';
import { CROSSFADE, useSpring } from './engine-motion';

const PURPLE = '#8B6FA0';

type Verdict = 'wrong' | 'obvious' | 'skip' | 'relevant' | 'surprising' | 'solves_problem';

const VERDICT_TO_API: Record<Exclude<Verdict, 'skip'>, { label: string; discovery_signal: string }> = {
  wrong: { label: 'dismissed', discovery_signal: 'wrong' },
  obvious: { label: 'dismissed', discovery_signal: 'obvious' },
  relevant: { label: 'engaged', discovery_signal: 'relevant' },
  surprising: { label: 'engaged', discovery_signal: 'surprising' },
  solves_problem: { label: 'engaged', discovery_signal: 'solves_problem' },
};

const VERDICT_CONFIG: { key: Verdict; label: string; symbol: string; shortcut: string; color: string; cssClass: string }[] = [
  { key: 'wrong', label: 'Wrong', symbol: '\u00D7', shortcut: '\u2190', color: '#D88A8A', cssClass: 'cw-verdict-btn--wrong' },
  { key: 'obvious', label: 'Obvious', symbol: '~', shortcut: '\u2193', color: '#8A8279', cssClass: 'cw-verdict-btn--obvious' },
  { key: 'skip', label: 'Skip', symbol: '\u2013', shortcut: 'space', color: '#AEA89F', cssClass: 'cw-verdict-btn--skip' },
  { key: 'relevant', label: 'Relevant', symbol: '+', shortcut: '\u2192', color: '#2D5F6B', cssClass: 'cw-verdict-btn--relevant' },
  { key: 'surprising', label: 'Surprising', symbol: '++', shortcut: '\u2191', color: '#C49A4A', cssClass: 'cw-verdict-btn--surprising' },
  { key: 'solves_problem', label: 'Solves Problem', symbol: '+++', shortcut: '\u21E7\u2192', color: '#5A8A5A', cssClass: 'cw-verdict-btn--solves' },
];

const INITIAL_STATS: Record<Verdict, number> = {
  wrong: 0, obvious: 0, skip: 0, relevant: 0, surprising: 0, solves_problem: 0,
};

export default function ConnectionWorkshop() {
  const { navigateToScreen } = useLayout();
  const { openDrawer } = useDrawer();
  const { data, loading, error, refetch } = useApiData(
    () => fetchReviewQueue({ limit: 40 }),
    [],
  );
  const { data: stats } = useApiData(fetchFeedbackStats, []);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionStats, setSessionStats] = useState({ ...INITIAL_STATS });
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const edges = useMemo(
    () => (data?.results ?? []).filter((e) => !dismissed.has(e.edge_id)),
    [data, dismissed],
  );

  const current = edges[currentIndex] ?? null;
  const total = edges.length;

  const spring = useSpring('natural');
  const snappySpring = useSpring('snappy');

  const judge = useCallback(
    async (verdict: Verdict) => {
      if (!current) return;

      setSessionStats((prev) => ({ ...prev, [verdict]: prev[verdict] + 1 }));

      if (verdict !== 'skip') {
        const apiParams = VERDICT_TO_API[verdict];
        try {
          await submitConnectionFeedback({
            from_object: current.from_object,
            to_object: current.to_object,
            label: apiParams.label as 'engaged' | 'dismissed',
            discovery_signal: apiParams.discovery_signal,
            feature_vector: current.feature_vector,
            edge: current.edge_id,
          });
        } catch {
          // Optimistic: still advance
        }
      }

      setDismissed((prev) => new Set(prev).add(current.edge_id));
    },
    [current],
  );

  // Keyboard shortcuts
  useHotkeys('ArrowLeft', () => judge('wrong'), [judge]);
  useHotkeys('ArrowDown', () => judge('obvious'), [judge]);
  useHotkeys('Space', (e) => { e.preventDefault(); judge('skip'); }, [judge]);
  useHotkeys('ArrowRight', () => judge('relevant'), [judge]);
  useHotkeys('ArrowUp', () => judge('surprising'), [judge]);
  useHotkeys('shift+ArrowRight', () => judge('solves_problem'), [judge]);

  const reviewedTotal = Object.values(sessionStats).reduce((a, b) => a + b, 0);

  return (
    <EngineShell
      title="Connection Review"
      subtitle="Rate engine-discovered connections with graduated feedback"
      feedbackStats={stats}
      onBack={() => navigateToScreen('engine')}
    >
      <style>{`
        .cw-session-stats {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          font-family: var(--cp-font-mono);
          font-size: 11px;
          color: var(--cp-text-muted, #5C554D);
          flex-wrap: wrap;
        }
        .cw-stat {
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .cw-stat-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .cw-nav-pills {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 16px;
        }
        .cw-pill {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--cp-border, rgba(42,37,32,0.12));
          transition: background 120ms ease;
        }
        .cw-pill--active {
          background: ${PURPLE};
        }
        .cw-pill--done {
          background: var(--cp-text-faint, #8A8279);
        }
        .cw-counter {
          font-family: var(--cp-font-mono);
          font-size: 11px;
          color: var(--cp-text-faint, #8A8279);
          margin-left: 8px;
        }
        .cw-bridge {
          background: rgba(139,111,160,0.20);
          border: 1px solid rgba(139,111,160,0.20);
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 12px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .cw-score-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: ${PURPLE};
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--cp-font-mono);
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .cw-bridge-content {
          flex: 1;
          min-width: 0;
        }
        .cw-bridge-reason {
          font-size: 13px;
          color: var(--cp-text, #2A2520);
          line-height: 1.4;
          margin-bottom: 6px;
        }
        .cw-bridge-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .cw-meta-badge {
          font-family: var(--cp-font-mono);
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(139,111,160,0.18);
          color: ${PURPLE};
          font-weight: 600;
        }
        .cw-objects {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }
        .cw-object-side {
          min-width: 0;
          overflow: hidden;
        }
        .cw-object-label {
          font-family: var(--cp-font-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--cp-text-faint, #8A8279);
          margin-bottom: 6px;
        }
        .cw-error-panel {
          padding: 16px;
          border-radius: 8px;
          background: rgba(180,90,45,0.06);
          border: 1px dashed rgba(180,90,45,0.2);
        }
        .cw-error-label {
          font-family: var(--cp-font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #D88A5A;
          display: block;
          margin-bottom: 4px;
        }
        .cw-error-panel p {
          font-size: 12px;
          color: var(--cp-text-muted, #5C554D);
          margin: 0 0 4px;
        }
        .cw-error-id {
          font-family: var(--cp-font-mono);
          font-size: 10px;
          color: var(--cp-text-faint, #8A8279);
        }
        .cw-verdicts {
          display: flex;
          justify-content: center;
          gap: 6px;
          padding: 16px 0 8px;
          flex-wrap: wrap;
        }
        .cw-verdict-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid var(--cp-border, rgba(42,37,32,0.12));
          background: transparent;
          cursor: pointer;
          font-family: var(--cp-font-body);
          font-size: 12px;
          font-weight: 500;
          transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
        }
        .cw-verdict-btn--wrong { color: #D88A8A; }
        .cw-verdict-btn--wrong:hover { background: rgba(216,138,138,0.1); border-color: rgba(216,138,138,0.3); }
        .cw-verdict-btn--obvious { color: #8A8279; }
        .cw-verdict-btn--obvious:hover { background: rgba(138,130,121,0.1); border-color: rgba(138,130,121,0.3); }
        .cw-verdict-btn--skip { color: #AEA89F; }
        .cw-verdict-btn--skip:hover { background: rgba(42,37,32,0.04); border-color: var(--cp-border); }
        .cw-verdict-btn--relevant { color: #2D5F6B; }
        .cw-verdict-btn--relevant:hover { background: rgba(45,95,107,0.1); border-color: rgba(45,95,107,0.3); }
        .cw-verdict-btn--surprising { color: #C49A4A; }
        .cw-verdict-btn--surprising:hover { background: rgba(196,154,74,0.1); border-color: rgba(196,154,74,0.3); }
        .cw-verdict-btn--solves {
          color: #5A8A5A;
          box-shadow: 0 0 0 0 rgba(90,138,90,0);
          transition: background 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 200ms ease;
        }
        .cw-verdict-btn--solves:hover {
          background: rgba(90,138,90,0.1);
          border-color: rgba(90,138,90,0.3);
          box-shadow: 0 0 8px 0 rgba(90,138,90,0.15);
        }
        .cw-shortcut {
          font-family: var(--cp-font-mono);
          font-size: 9px;
          padding: 1px 4px;
          border-radius: 3px;
          background: rgba(42,37,32,0.06);
          color: var(--cp-text-ghost, #AEA89F);
        }
        .cw-empty {
          text-align: center;
          padding: 60px 20px;
          color: var(--cp-text-muted, #5C554D);
        }
        .cw-empty-title {
          font-family: var(--cp-font-title, var(--font-title));
          font-size: 18px;
          font-weight: 600;
          color: var(--cp-text, #2A2520);
          margin-bottom: 6px;
        }
        .cw-loading {
          text-align: center;
          padding: 60px 20px;
          color: var(--cp-text-muted, #5C554D);
          font-size: 13px;
        }
      `}</style>

      {/* Loading */}
      {loading && <div className="cw-loading">Loading review queue...</div>}

      {/* Error */}
      {error && (
        <div className="cw-empty">
          <div className="cw-empty-title">Failed to load review queue</div>
          <button
            style={{
              marginTop: 8,
              fontSize: 12,
              color: PURPLE,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
            onClick={refetch}
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && total === 0 && (
        <div className="cw-empty">
          <div className="cw-empty-title">All caught up</div>
          <div style={{ fontSize: 13 }}>
            {reviewedTotal > 0
              ? `Reviewed ${reviewedTotal} connections this session.`
              : 'No connections to review right now.'}
          </div>
          <button
            style={{
              marginTop: 12,
              fontSize: 12,
              color: PURPLE,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
            onClick={refetch}
          >
            Check for new connections
          </button>
        </div>
      )}

      {/* Workshop card */}
      {!loading && !error && current && (
        <>
          {/* Session stats */}
          <div className="cw-session-stats">
            {VERDICT_CONFIG.map((v) => (
              sessionStats[v.key] > 0 ? (
                <span key={v.key} className="cw-stat">
                  <span className="cw-stat-dot" style={{ background: v.color }} />
                  {sessionStats[v.key]} {v.label.toLowerCase()}
                </span>
              ) : null
            ))}
            {reviewedTotal === 0 && (
              <span style={{ color: 'var(--cp-text-faint, #8A8279)' }}>No reviews yet</span>
            )}
          </div>

          {/* Nav pills */}
          <div className="cw-nav-pills">
            {edges.slice(0, Math.min(20, total)).map((edge, i) => (
              <span
                key={edge.edge_id}
                className={`cw-pill${i === 0 ? ' cw-pill--active' : ''}`}
              />
            ))}
            {total > 20 && <span className="cw-counter">+{total - 20} more</span>}
            <span className="cw-counter">{total} remaining</span>
          </div>

          {/* AnimatePresence crossfade */}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.edge_id}
              initial={CROSSFADE.initial}
              animate={CROSSFADE.animate}
              exit={CROSSFADE.exit}
              transition={spring}
            >
              {/* Bridge strip */}
              <div className="cw-bridge">
                <div className="cw-score-circle">
                  {Math.round(current.strength * 100)}
                </div>
                <div className="cw-bridge-content">
                  {current.reason && (
                    <div className="cw-bridge-reason">{current.reason}</div>
                  )}
                  <div className="cw-bridge-meta">
                    <span className="cw-meta-badge">{current.edge_type}</span>
                    <span className="cw-meta-badge">{current.engine}</span>
                  </div>
                </div>
              </div>

              {/* Provenance drawer */}
              <EngineProvenance
                passes={parsePassesFromEngine(current.engine)}
                score={current.strength}
                engine={current.engine}
              />

              {/* Side-by-side objects */}
              <div className="cw-objects">
                <div className="cw-object-side">
                  <div className="cw-object-label">
                    {(getObjectTypeIdentity(current.from_type).label ?? 'OBJECT').toUpperCase()}
                  </div>
                  <ObjectSide edge={current} side="from" onClick={(obj) => openDrawer(obj.slug)} />
                </div>
                <div className="cw-object-side">
                  <div className="cw-object-label">
                    {(getObjectTypeIdentity(current.to_type).label ?? 'OBJECT').toUpperCase()}
                  </div>
                  <ObjectSide edge={current} side="to" onClick={(obj) => openDrawer(obj.slug)} />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Verdict buttons */}
          <div className="cw-verdicts">
            {VERDICT_CONFIG.map((v) => (
              <motion.button
                key={v.key}
                className={`cw-verdict-btn ${v.cssClass}`}
                onClick={() => judge(v.key)}
                whileTap={{ scale: 0.97 }}
                transition={snappySpring}
              >
                {v.label}
                <span className="cw-shortcut">{v.shortcut}</span>
              </motion.button>
            ))}
          </div>
        </>
      )}
    </EngineShell>
  );
}

/* -- Object side renderer -- */

function ObjectSide({ edge, side, onClick }: { edge: ReviewQueueEdge; side: 'from' | 'to'; onClick?: (obj: RenderableObject) => void }) {
  const id = side === 'from' ? edge.from_object : edge.to_object;
  const title = side === 'from' ? edge.from_title : edge.to_title;
  const slug = side === 'from' ? edge.from_slug : edge.to_slug;
  const typeSlug = side === 'from' ? edge.from_type : edge.to_type;

  if (!title || !slug) {
    return (
      <div className="cw-error-panel">
        <span className="cw-error-label">COULD NOT LOAD OBJECT</span>
        <p>This object may be missing required fields. Your rating still counts.</p>
        <span className="cw-error-id">ID: {id}</span>
      </div>
    );
  }

  // Extended fields come from Option A backend enhancement (if available)
  const extra = edge as unknown as Record<string, unknown>;
  const obj: RenderableObject = {
    id,
    slug,
    title,
    object_type_slug: typeSlug,
    body: extra[`${side}_body`] as string | undefined,
    edge_count: extra[`${side}_edge_count`] as number | undefined,
  };

  return <ObjectRenderer object={obj} variant="module" onClick={onClick} />;
}

/* -- Helpers -- */

function parsePassesFromEngine(engine: string): string[] {
  return engine
    .toLowerCase()
    .split(/[+\s,]+/)
    .filter(Boolean);
}

'use client';

import { useState } from 'react';
import {
  getMockContentItems,
  getMostRecentItem,
  getMockTodayQueue,
  getMockStudioPulse,
  getMockWorkbenchData,
  computeItemMetrics,
} from '@/lib/studio-mock-data';
import {
  getContentTypeIdentity,
  getStage,
  STAGES,
  studioMix,
} from '@/lib/studio';
import type {
  StudioContentItem,
  StudioTodayQueueItem,
  StudioPulseInsight,
  StudioContentItemWithMetrics,
} from '@/lib/studio';
import StudioCard from './StudioCard';
import SectionLabel from '../SectionLabel';
import NewContentModal from './NewContentModal';

/**
 * Studio dashboard: writer's desk metaphor.
 *
 * Three-rail layout (two-column flex on desktop):
 *   Center: ON THE TABLE (hero), TODAY'S QUEUE, IN MOTION
 *   Right:  STUDIO PULSE, QUIET, QUICK CAPTURE
 *
 * Mobile (<1024px): single column, right rail stacks below center.
 */
export default function Dashboard() {
  const hero = getMostRecentItem();
  const todayQueue = getMockTodayQueue();
  const allItems = getMockContentItems();
  const pulse = getMockStudioPulse();
  const workbench = getMockWorkbenchData();

  /* Active items: drafting, revising, or production (exclude hero to avoid duplication) */
  const inMotion = allItems
    .filter(
      (i) =>
        ['drafting', 'revising', 'production'].includes(i.stage) &&
        i.id !== hero?.id,
    )
    .map((i) => ({ ...i, metrics: computeItemMetrics(i) }));

  /* Quiet items: untouched 7+ days */
  const quiet = allItems
    .map((i) => ({ ...i, metrics: computeItemMetrics(i) }))
    .filter((i) => i.metrics.daysSinceLastTouched >= 7)
    .sort((a, b) => b.metrics.daysSinceLastTouched - a.metrics.daysSinceLastTouched);

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
        {/* ── Center column ──────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {hero && <HeroCard item={hero} />}
          <TodayQueue items={todayQueue} />
          <InMotionSection items={inMotion} />
        </div>

        {/* ── Right rail ─────────────────────────────── */}
        <div className="studio-right-rail" style={{ width: 340, flexShrink: 0 }}>
          <PulseSection insights={pulse} workbench={workbench} />
          <QuietSection items={quiet} />
          <QuickCapture />
        </div>
      </div>
    </div>
  );
}

/* ── 1. ON THE TABLE: Active Project Hero ─────── */

function HeroCard({ item }: { item: StudioContentItem }) {
  const typeInfo = getContentTypeIdentity(item.contentType);
  const metrics = computeItemMetrics(item);

  return (
    <section style={{ marginBottom: '28px' }}>
      <SectionLabel variant="studio" hexColor="#B45A2D">
        ON THE TABLE
      </SectionLabel>
      <StudioCard
        typeColor={typeInfo.color}
        href={`/studio/${typeInfo.route}/${item.slug}`}
        style={{ padding: '20px 22px' }}
      >
        {/* Top row: title + word count */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            marginBottom: '10px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--studio-font-title)',
              fontSize: '26px',
              fontWeight: 700,
              color: 'var(--studio-text-bright)',
              lineHeight: 1.2,
            }}
          >
            {item.title}
          </div>
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--studio-text-3)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {item.wordCount.toLocaleString()}
          </span>
        </div>

        {/* Excerpt */}
        {item.excerpt && (
          <p
            style={{
              fontFamily: 'var(--studio-font-body)',
              fontSize: '14px',
              color: 'var(--studio-text-2)',
              lineHeight: 1.55,
              margin: '0 0 14px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.excerpt}
          </p>
        )}

        {/* Pipeline dots */}
        <PipelineDots currentStage={item.stage} typeColor={typeInfo.color} />

        {/* Next Move callout */}
        {item.nextMove && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              background: 'rgba(180, 90, 45, 0.08)',
              border: '1px solid rgba(180, 90, 45, 0.15)',
              borderRadius: '5px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '8.5px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase' as const,
                color: 'var(--studio-tc)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              NEXT MOVE
            </span>
            <span
              style={{
                fontFamily: 'var(--studio-font-body)',
                fontSize: '13px',
                color: 'var(--studio-text-1)',
                lineHeight: 1.4,
              }}
            >
              {item.nextMove}
            </span>
          </div>
        )}

        {/* Last session */}
        {item.lastSessionSummary && (
          <p
            style={{
              marginTop: '10px',
              fontFamily: 'var(--studio-font-body)',
              fontSize: '13px',
              color: 'var(--studio-text-3)',
              lineHeight: 1.4,
              fontStyle: 'italic',
            }}
          >
            {item.lastSessionSummary}
          </p>
        )}

        {/* Metadata: type + stage + days */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              color: typeInfo.color,
            }}
          >
            {typeInfo.label}
          </span>
          <span className="studio-stage-badge" data-stage={item.stage}>
            {getStage(item.stage).label}
          </span>
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '10px',
              color: 'var(--studio-text-3)',
              marginLeft: 'auto',
            }}
          >
            {metrics.daysSinceLastTouched === 0
              ? 'today'
              : `${metrics.daysSinceLastTouched}d ago`}
          </span>
        </div>
      </StudioCard>
    </section>
  );
}

/* ── Pipeline dots (connected stages) ─────────── */

function PipelineDots({
  currentStage,
  typeColor,
}: {
  currentStage: string;
  typeColor: string;
}) {
  const currentIdx = STAGES.findIndex((s) => s.slug === currentStage);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        margin: '10px 0 2px',
      }}
    >
      {STAGES.map((stage, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        const dotColor = isCurrent
          ? typeColor
          : isComplete
            ? stage.color
            : 'var(--studio-surface-hover)';

        return (
          <div
            key={stage.slug}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <div
              title={stage.label}
              style={{
                width: isCurrent ? '12px' : '10px',
                height: isCurrent ? '12px' : '10px',
                borderRadius: '50%',
                backgroundColor: dotColor,
                border: isCurrent
                  ? `2px solid ${typeColor}`
                  : '2px solid var(--studio-bg)',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            />
            {i < STAGES.length - 1 && (
              <div
                style={{
                  width: '16px',
                  height: '1px',
                  backgroundColor:
                    i < currentIdx
                      ? 'var(--studio-text-3)'
                      : 'var(--studio-surface-hover)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── 2. TODAY'S QUEUE ─────────────────────────── */

function TodayQueue({ items }: { items: StudioTodayQueueItem[] }) {
  if (items.length === 0) return null;

  return (
    <section style={{ marginBottom: '28px' }}>
      <SectionLabel variant="studio" hexColor="#3A8A9A">
        TODAY&apos;S QUEUE
      </SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((task) => {
          const typeInfo = getContentTypeIdentity(task.contentType);
          const stage = getStage(task.stage);
          return (
            <StudioCard
              key={task.id}
              typeColor={typeInfo.color}
              href={`/studio/${typeInfo.route}/${task.contentId}`}
            >
              <div
                style={{
                  fontFamily: 'var(--studio-font-body)',
                  fontSize: '14px',
                  color: 'var(--studio-text-1)',
                  marginBottom: '6px',
                  lineHeight: 1.4,
                }}
              >
                {task.task}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--studio-font-metadata)',
                    fontSize: '9px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase' as const,
                    color: 'var(--studio-text-3)',
                    backgroundColor: 'var(--studio-surface)',
                    border: '1px solid var(--studio-border)',
                    borderRadius: '3px',
                    padding: '1px 6px',
                  }}
                >
                  {task.contentTitle}
                </span>
                <span
                  className="studio-stage-badge"
                  data-stage={task.stage}
                >
                  {stage.label}
                </span>
              </div>
            </StudioCard>
          );
        })}
      </div>
    </section>
  );
}

/* ── 3. IN MOTION ─────────────────────────────── */

function InMotionSection({
  items,
}: {
  items: StudioContentItemWithMetrics[];
}) {
  if (items.length === 0) return null;

  return (
    <section style={{ marginBottom: '28px' }}>
      <SectionLabel variant="studio" hexColor="#D4AA4A">
        IN MOTION
      </SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item) => {
          const typeInfo = getContentTypeIdentity(item.contentType);
          const stage = getStage(item.stage);
          return (
            <StudioCard
              key={item.id}
              typeColor={typeInfo.color}
              href={`/studio/${typeInfo.route}/${item.slug}`}
            >
              {/* Type label + stage badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '6px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '9px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                    color: typeInfo.color,
                  }}
                >
                  {typeInfo.label}
                </span>
                <span
                  className="studio-stage-badge"
                  data-stage={item.stage}
                >
                  {stage.label}
                </span>
              </div>

              {/* Title */}
              <div
                style={{
                  fontFamily: 'var(--studio-font-title)',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--studio-text-bright)',
                  lineHeight: 1.3,
                  marginBottom: '4px',
                }}
              >
                {item.title}
              </div>

              {/* Excerpt (2-line clamp) */}
              {item.excerpt && (
                <p
                  style={{
                    fontFamily: 'var(--studio-font-body)',
                    fontSize: '13px',
                    fontStyle: 'italic',
                    color: 'var(--studio-text-2)',
                    lineHeight: 1.45,
                    margin: '0 0 8px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {item.excerpt}
                </p>
              )}

              {/* Bottom row: word count + last touched */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '10px',
                    color: 'var(--studio-text-3)',
                  }}
                >
                  {item.wordCount.toLocaleString()}w
                </span>
                <span
                  style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '10px',
                    color: 'var(--studio-text-3)',
                  }}
                >
                  {item.metrics.daysSinceLastTouched === 0
                    ? 'today'
                    : `${item.metrics.daysSinceLastTouched}d ago`}
                </span>
              </div>
            </StudioCard>
          );
        })}
      </div>
    </section>
  );
}

/* ── 4. STUDIO PULSE (right rail) ─────────────── */

const PULSE_ICONS: Record<StudioPulseInsight['type'], string> = {
  momentum: '\u2191',
  simmering: '\u25CB',
  quiet: '\u2026',
  ready: '\u2192',
  rich: '\u25C7',
};

const PULSE_COLORS: Record<StudioPulseInsight['type'], string> = {
  momentum: '#6A9A5A',
  simmering: '#D4AA4A',
  quiet: '#9A8E82',
  ready: '#3A8A9A',
  rich: '#B45A2D',
};

const PULSE_LABELS: Record<StudioPulseInsight['type'], string> = {
  momentum: 'MOMENTUM',
  simmering: 'SIMMERING',
  quiet: 'QUIET',
  ready: 'READY',
  rich: 'RESEARCH RICH',
};

function PulseSection({
  insights,
  workbench,
}: {
  insights: StudioPulseInsight[];
  workbench: { pipelineBreakdown: Record<string, number> };
}) {
  const drafting = workbench.pipelineBreakdown['drafting'] ?? 0;
  const revising = workbench.pipelineBreakdown['revising'] ?? 0;
  const published = workbench.pipelineBreakdown['published'] ?? 0;

  return (
    <section>
      <SectionLabel variant="studio" hexColor="#5A7A4A">
        STUDIO PULSE
      </SectionLabel>
      <StudioCard typeColor="#5A7A4A">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {insights.map((insight, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px' }}>
              <span
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '14px',
                  color: PULSE_COLORS[insight.type],
                  flexShrink: 0,
                  width: '16px',
                  textAlign: 'center',
                }}
              >
                {PULSE_ICONS[insight.type]}
              </span>
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: PULSE_COLORS[insight.type],
                    display: 'block',
                    marginBottom: '2px',
                  }}
                >
                  {PULSE_LABELS[insight.type]}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--studio-font-body)',
                    fontSize: '13px',
                    color: 'var(--studio-text-1)',
                    lineHeight: 1.4,
                    display: 'block',
                  }}
                >
                  {insight.message}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--studio-font-metadata)',
                    fontSize: '10px',
                    color: 'var(--studio-text-3)',
                    display: 'block',
                    marginTop: '2px',
                  }}
                >
                  {insight.detail}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Stat tiles */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid var(--studio-border)',
          }}
        >
          <StatTile label="Drafting" count={drafting} color="#D4AA4A" />
          <StatTile label="Revising" count={revising} color="#8A6A9A" />
          <StatTile label="Published" count={published} color="#6A9A5A" />
        </div>
      </StudioCard>
    </section>
  );
}

function StatTile({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        textAlign: 'center',
        padding: '8px 4px',
        borderRadius: '4px',
        backgroundColor: studioMix(color, 6),
      }}
    >
      <div
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '18px',
          fontWeight: 700,
          color,
        }}
      >
        {count}
      </div>
      <div
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '8px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          color: 'var(--studio-text-3)',
          marginTop: '2px',
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ── 5. QUIET (right rail) ────────────────────── */

function QuietSection({
  items,
}: {
  items: StudioContentItemWithMetrics[];
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <SectionLabel variant="studio" hexColor="#9A8E82">
        QUIET
      </SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.slice(0, 8).map((item) => {
          const typeInfo = getContentTypeIdentity(item.contentType);
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 0',
              }}
            >
              {/* Type dot */}
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: typeInfo.color,
                  flexShrink: 0,
                }}
              />
              {/* Title */}
              <span
                style={{
                  fontFamily: 'var(--studio-font-title)',
                  fontSize: '13px',
                  color: 'var(--studio-text-2)',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.title}
              </span>
              {/* Days silent */}
              <span
                style={{
                  fontFamily: 'var(--studio-font-metadata)',
                  fontSize: '10px',
                  color: 'var(--studio-gold)',
                  flexShrink: 0,
                }}
              >
                {item.metrics.daysSinceLastTouched}d
              </span>
              {/* Stage badge */}
              <span
                className="studio-stage-badge"
                data-stage={item.stage}
              >
                {getStage(item.stage).label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── 6. QUICK CAPTURE (right rail) ────────────── */

const CAPTURE_TYPES = [
  { label: 'Note', type: 'field-note', color: '#3A8A9A' },
  { label: 'Source', type: 'shelf', color: '#D4AA4A' },
  { label: 'Idea', type: 'essay', color: '#B45A2D' },
  { label: 'Script Beat', type: 'video', color: '#6A9A5A' },
] as const;

function QuickCapture() {
  const [modalType, setModalType] = useState<string | null>(null);

  return (
    <section>
      <SectionLabel variant="studio" hexColor="#B45A2D">
        QUICK CAPTURE
      </SectionLabel>
      <div className="studio-capture-grid">
        {CAPTURE_TYPES.map((cap) => (
          <button
            key={cap.type}
            type="button"
            className="studio-capture-btn"
            style={{
              backgroundColor: studioMix(cap.color, 8),
              color: cap.color,
            }}
            onClick={() => setModalType(cap.type)}
          >
            {cap.label}
          </button>
        ))}
      </div>

      {modalType && (
        <NewContentModal
          defaultType={modalType}
          onClose={() => setModalType(null)}
        />
      )}
    </section>
  );
}

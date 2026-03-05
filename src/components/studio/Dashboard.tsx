'use client';

import {
  getMockContentItems,
  getMostRecentItem,
  getMockTodayQueue,
  computeItemMetrics,
} from '@/lib/studio-mock-data';
import {
  getContentTypeIdentity,
  getStage,
  STAGES,
} from '@/lib/studio';
import type {
  StudioContentItem,
  StudioTodayQueueItem,
  StudioContentItemWithMetrics,
} from '@/lib/studio';
import StudioCard from './StudioCard';
import SectionLabel from '../SectionLabel';

/**
 * Studio dashboard center column.
 *
 * Workbench content for pulse, quiet/stuck, and quick capture now lives
 * in WorkbenchPanel dashboard mode so this view remains a single column.
 */
export default function Dashboard() {
  const hero = getMostRecentItem();
  const todayQueue = getMockTodayQueue();
  const allItems = getMockContentItems();

  const inMotion = allItems
    .filter(
      (item) =>
        ['drafting', 'revising', 'production'].includes(item.stage) &&
        item.id !== hero?.id,
    )
    .map((item) => ({ ...item, metrics: computeItemMetrics(item) }));

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ maxWidth: '880px' }}>
        {hero && <HeroCard item={hero} />}
        <TodayQueue items={todayQueue} />
        <InMotionSection items={inMotion} />
      </div>
    </div>
  );
}

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

        <PipelineDots currentStage={item.stage} typeColor={typeInfo.color} />

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

function PipelineDots({
  currentStage,
  typeColor,
}: {
  currentStage: string;
  typeColor: string;
}) {
  const currentIdx = STAGES.findIndex((stage) => stage.slug === currentStage);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        margin: '10px 0 2px',
      }}
    >
      {STAGES.map((stage, index) => {
        const isComplete = index < currentIdx;
        const isCurrent = index === currentIdx;
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
            {index < STAGES.length - 1 && (
              <div
                style={{
                  width: '16px',
                  height: '1px',
                  backgroundColor:
                    index < currentIdx
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

function TodayQueue({ items }: { items: StudioTodayQueueItem[] }) {
  if (items.length === 0) {
    return null;
  }

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
                <span className="studio-stage-badge" data-stage={task.stage}>
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

function InMotionSection({
  items,
}: {
  items: StudioContentItemWithMetrics[];
}) {
  if (items.length === 0) {
    return null;
  }

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
                <span className="studio-stage-badge" data-stage={item.stage}>
                  {stage.label}
                </span>
              </div>

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

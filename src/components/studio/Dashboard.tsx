'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  getMockContentItems,
  getMockTimeline,
  getMockTodayQueue,
  computeItemMetrics,
} from '@/lib/studio-mock-data';
import { getContentTypeIdentity, getStage } from '@/lib/studio';
import type {
  StudioContentItemWithMetrics,
  StudioTodayQueueItem,
  StudioTimelineEntry,
} from '@/lib/studio';
import StudioCard from './StudioCard';
import SectionLabel from '../SectionLabel';
import NewContentModal from './NewContentModal';

type ResearchTab = 'field-notes' | 'shelf';

export default function Dashboard() {
  const allItems = useMemo(() => getMockContentItems(), []);
  const timeline = useMemo(() => getMockTimeline(), []);
  const todayQueue = useMemo(() => getMockTodayQueue(), []);

  const itemsWithMetrics = useMemo<StudioContentItemWithMetrics[]>(
    () =>
      allItems.map((item) => ({
        ...item,
        metrics: computeItemMetrics(item),
      })),
    [allItems],
  );

  const activeCandidates = useMemo(
    () =>
      itemsWithMetrics.filter((item) =>
        ['research', 'drafting', 'revising', 'production'].includes(item.stage),
      ),
    [itemsWithMetrics],
  );

  const [activeItemId, setActiveItemId] = useState<string | null>(
    activeCandidates[0]?.id ?? null,
  );
  const [nextMoveById, setNextMoveById] = useState<Record<string, string>>({});
  const [captureType, setCaptureType] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [researchTab, setResearchTab] = useState<ResearchTab>('field-notes');
  const [sessionItemId, setSessionItemId] = useState<string | null>(null);

  const activeItem = useMemo(
    () => activeCandidates.find((item) => item.id === activeItemId) ?? null,
    [activeCandidates, activeItemId],
  );

  const inMotion = useMemo(
    () =>
      itemsWithMetrics.filter(
        (item) =>
          ['drafting', 'revising', 'production'].includes(item.stage) &&
          item.id !== activeItem?.id,
      ),
    [activeItem?.id, itemsWithMetrics],
  );

  const researchReady = useMemo(
    () =>
      itemsWithMetrics
        .filter(
          (item) => item.stage === 'research' && item.metrics.sourcesCollected >= 3,
        )
        .sort((a, b) => b.metrics.sourcesCollected - a.metrics.sourcesCollected),
    [itemsWithMetrics],
  );

  const researchRows = useMemo(() => {
    if (researchTab === 'field-notes') {
      return researchReady.filter((item) => item.contentType === 'field-note');
    }
    return researchReady.filter((item) => item.contentType === 'shelf');
  }, [researchReady, researchTab]);

  const miniTimeline = useMemo<StudioTimelineEntry[]>(() => {
    if (!activeItem) {
      return [];
    }
    return timeline.filter((entry) => entry.contentId === activeItem.id).slice(0, 3);
  }, [activeItem, timeline]);

  const activeNextMove =
    activeItem &&
    (nextMoveById[activeItem.id] !== undefined
      ? nextMoveById[activeItem.id]
      : activeItem.nextMove ?? '');

  const handleNextMoveChange = (value: string) => {
    if (!activeItem) {
      return;
    }
    setNextMoveById((prev) => ({
      ...prev,
      [activeItem.id]: value,
    }));
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: '980px' }}>
      <NowModule
        activeItem={activeItem}
        activeCandidates={activeCandidates}
        activeNextMove={activeNextMove ?? ''}
        miniTimeline={miniTimeline}
        chooserOpen={chooserOpen}
        setChooserOpen={setChooserOpen}
        setActiveItemId={setActiveItemId}
        setCaptureType={setCaptureType}
        onNextMoveChange={handleNextMoveChange}
        onStartSession={() => {
          if (activeItem) {
            setSessionItemId(activeItem.id);
          }
        }}
        sessionRunning={activeItem ? sessionItemId === activeItem.id : false}
      />

      <ResearchReadySection
        tab={researchTab}
        onTabChange={setResearchTab}
        rows={researchRows}
        onConvert={(itemId) => {
          setActiveItemId(itemId);
        }}
      />

      <TodayQueue items={todayQueue} />
      <InMotionSection items={inMotion} />

      {captureType && (
        <NewContentModal
          defaultType={captureType}
          onClose={() => setCaptureType(null)}
        />
      )}
    </div>
  );
}

function NowModule({
  activeItem,
  activeCandidates,
  activeNextMove,
  miniTimeline,
  chooserOpen,
  setChooserOpen,
  setActiveItemId,
  setCaptureType,
  onNextMoveChange,
  onStartSession,
  sessionRunning,
}: {
  activeItem: StudioContentItemWithMetrics | null;
  activeCandidates: StudioContentItemWithMetrics[];
  activeNextMove: string;
  miniTimeline: StudioTimelineEntry[];
  chooserOpen: boolean;
  setChooserOpen: (open: boolean) => void;
  setActiveItemId: (id: string | null) => void;
  setCaptureType: (type: string | null) => void;
  onNextMoveChange: (value: string) => void;
  onStartSession: () => void;
  sessionRunning: boolean;
}) {
  return (
    <section style={{ marginBottom: '28px' }}>
      <div style={{ marginBottom: '10px' }}>
        <div
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--studio-tc)',
            marginBottom: '6px',
          }}
        >
          NOW
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--studio-font-body)',
            fontSize: '14px',
            color: 'var(--studio-text-2)',
            lineHeight: 1.55,
            maxWidth: '74ch',
          }}
        >
          Your active thread. One project, the next step, and the fastest way to
          move it forward.
        </p>
      </div>

      {activeItem ? (
        <ActiveProjectCard
          item={activeItem}
          nextMove={activeNextMove}
          miniTimeline={miniTimeline}
          onNextMoveChange={onNextMoveChange}
          onAddFieldNote={() => setCaptureType('field-note')}
          onAddSource={() => setCaptureType('shelf')}
          onConvertToScript={() => setCaptureType('video')}
          onStartSession={onStartSession}
          sessionRunning={sessionRunning}
        />
      ) : (
        <EmptyNowState
          hasCandidates={activeCandidates.length > 0}
          chooserOpen={chooserOpen}
          candidates={activeCandidates}
          onChoose={() => setChooserOpen(true)}
          onSelectCandidate={(id) => {
            setActiveItemId(id);
            setChooserOpen(false);
          }}
          onNewProject={() => setCaptureType('project')}
        />
      )}
    </section>
  );
}

function ActiveProjectCard({
  item,
  nextMove,
  miniTimeline,
  onNextMoveChange,
  onAddFieldNote,
  onAddSource,
  onConvertToScript,
  onStartSession,
  sessionRunning,
}: {
  item: StudioContentItemWithMetrics;
  nextMove: string;
  miniTimeline: StudioTimelineEntry[];
  onNextMoveChange: (value: string) => void;
  onAddFieldNote: () => void;
  onAddSource: () => void;
  onConvertToScript: () => void;
  onStartSession: () => void;
  sessionRunning: boolean;
}) {
  const typeInfo = getContentTypeIdentity(item.contentType);
  const lastTouched =
    item.metrics.daysSinceLastTouched === 0
      ? 'today'
      : `${item.metrics.daysSinceLastTouched}d ago`;

  return (
    <StudioCard typeColor={typeInfo.color} style={{ padding: '20px 22px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '10px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--studio-font-title)',
            fontSize: '26px',
            lineHeight: 1.2,
            color: 'var(--studio-text-bright)',
            fontWeight: 700,
          }}
        >
          {item.title}
        </h2>
        <span className="studio-stage-badge" data-stage={item.stage}>
          {getStage(item.stage).label}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        <MetricChip label="Words" value={item.wordCount.toLocaleString()} />
        <MetricChip label="Last touched" value={lastTouched} />
        <MetricChip label="Linked" value={String(item.metrics.linkedNotes)} />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <div
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--studio-tc)',
            marginBottom: '6px',
          }}
        >
          Next move
        </div>
        <textarea
          className="studio-next-move-textarea"
          value={nextMove}
          onChange={(event) => onNextMoveChange(event.target.value)}
          placeholder="Define the next concrete step"
          rows={3}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '14px',
        }}
      >
        <Link
          href={`/studio/${typeInfo.route}/${item.slug}`}
          className="studio-dashboard-action studio-dashboard-action--primary"
        >
          Continue writing
        </Link>
        <button type="button" className="studio-dashboard-action" onClick={onAddFieldNote}>
          Add field note
        </button>
        <button type="button" className="studio-dashboard-action" onClick={onAddSource}>
          Add source
        </button>
        <button type="button" className="studio-dashboard-action" onClick={onConvertToScript}>
          Convert to script
        </button>
        <button type="button" className="studio-dashboard-action" onClick={onStartSession}>
          Start session
        </button>
      </div>

      {sessionRunning && (
        <p
          style={{
            margin: '0 0 14px',
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            color: '#6A9A5A',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Session started
        </p>
      )}

      <div
        style={{
          borderTop: '1px solid var(--studio-border)',
          paddingTop: '12px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--studio-text-3)',
            marginBottom: '8px',
          }}
        >
          Mini timeline
        </div>

        {miniTimeline.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {miniTimeline.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--studio-font-body)',
                    fontSize: '13px',
                    color: 'var(--studio-text-2)',
                  }}
                >
                  {entry.action}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '9px',
                    color: 'var(--studio-text-3)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatMiniTimelineDate(entry.occurredAt)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--studio-font-body)',
              fontSize: '12px',
              color: 'var(--studio-text-3)',
              fontStyle: 'italic',
            }}
          >
            No recent timeline events yet.
          </p>
        )}
      </div>
    </StudioCard>
  );
}

function MetricChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span
      style={{
        fontFamily: 'var(--studio-font-mono)',
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: 'var(--studio-text-2)',
        textTransform: 'uppercase',
        padding: '5px 8px',
        borderRadius: '5px',
        border: '1px solid var(--studio-border)',
        backgroundColor: 'var(--studio-surface)',
      }}
    >
      {label}: <span style={{ color: 'var(--studio-text-bright)' }}>{value}</span>
    </span>
  );
}

function EmptyNowState({
  hasCandidates,
  chooserOpen,
  candidates,
  onChoose,
  onSelectCandidate,
  onNewProject,
}: {
  hasCandidates: boolean;
  chooserOpen: boolean;
  candidates: StudioContentItemWithMetrics[];
  onChoose: () => void;
  onSelectCandidate: (id: string) => void;
  onNewProject: () => void;
}) {
  return (
    <StudioCard typeColor="#B45A2D" style={{ padding: '20px 22px' }}>
      <h2
        style={{
          margin: '0 0 8px',
          fontFamily: 'var(--studio-font-title)',
          fontSize: '28px',
          color: 'var(--studio-text-bright)',
          lineHeight: 1.2,
        }}
      >
        Pick one thing to push forward
      </h2>
      <p
        style={{
          margin: '0 0 14px',
          fontFamily: 'var(--studio-font-body)',
          fontSize: '14px',
          color: 'var(--studio-text-2)',
          lineHeight: 1.55,
        }}
      >
        Choose a project to make active, or start fresh. This page works best
        when it has a single thread.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button
          type="button"
          className="studio-dashboard-action"
          onClick={onChoose}
          disabled={!hasCandidates}
        >
          Choose active project
        </button>
        <button type="button" className="studio-dashboard-action" onClick={onNewProject}>
          New Project
        </button>
      </div>

      {chooserOpen && hasCandidates && (
        <div
          style={{
            borderTop: '1px solid var(--studio-border)',
            paddingTop: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {candidates.slice(0, 6).map((candidate) => {
            const type = getContentTypeIdentity(candidate.contentType);
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onSelectCandidate(candidate.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '5px',
                  border: '1px solid var(--studio-border)',
                  backgroundColor: 'var(--studio-surface)',
                  color: 'var(--studio-text-2)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--studio-font-title)',
                    fontSize: '15px',
                    color: 'var(--studio-text-bright)',
                  }}
                >
                  {candidate.title}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '9px',
                    color: type.color,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {type.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </StudioCard>
  );
}

function ResearchReadySection({
  tab,
  onTabChange,
  rows,
  onConvert,
}: {
  tab: ResearchTab;
  onTabChange: (next: ResearchTab) => void;
  rows: StudioContentItemWithMetrics[];
  onConvert: (itemId: string) => void;
}) {
  return (
    <section style={{ marginBottom: '28px' }}>
      <SectionLabel variant="studio" hexColor="#3A8A9A">
        RESEARCH READY TO BECOME SOMETHING
      </SectionLabel>

      <p
        style={{
          margin: '8px 0 12px',
          fontFamily: 'var(--studio-font-body)',
          fontSize: '14px',
          color: 'var(--studio-text-2)',
          lineHeight: 1.55,
          maxWidth: '72ch',
        }}
      >
        Notes and sources with enough fuel to write or script. Stop collecting.
        Start converting.
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <button
          type="button"
          className="studio-filter-pill"
          data-active={tab === 'field-notes' ? 'true' : 'false'}
          style={{ color: 'var(--studio-teal)' }}
          onClick={() => onTabChange('field-notes')}
        >
          From Field Notes
        </button>
        <button
          type="button"
          className="studio-filter-pill"
          data-active={tab === 'shelf' ? 'true' : 'false'}
          style={{ color: 'var(--studio-gold)' }}
          onClick={() => onTabChange('shelf')}
        >
          From Shelf
        </button>
      </div>

      {rows.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rows.map((row) => {
            const typeInfo = getContentTypeIdentity(row.contentType);
            const suggestedOutput = row.contentType === 'field-note' ? 'Essay' : 'Script';

            return (
              <StudioCard
                key={row.id}
                typeColor={typeInfo.color}
                style={{ padding: '12px 14px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--studio-font-title)',
                        fontSize: '17px',
                        color: 'var(--studio-text-bright)',
                        lineHeight: 1.3,
                      }}
                    >
                      {row.title}
                    </div>
                    <div
                      style={{
                        marginTop: '4px',
                        fontFamily: 'var(--studio-font-mono)',
                        fontSize: '9px',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--studio-text-3)',
                      }}
                    >
                      Linked: {row.metrics.linkedNotes} | Suggested output:{' '}
                      {suggestedOutput}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="studio-dashboard-action"
                    onClick={() => onConvert(row.id)}
                  >
                    Convert
                  </button>
                </div>
              </StudioCard>
            );
          })}
        </div>
      ) : (
        <p
          style={{
            margin: '0',
            fontFamily: 'var(--studio-font-body)',
            fontSize: '13px',
            color: 'var(--studio-text-3)',
            fontStyle: 'italic',
          }}
        >
          No items in this tab are ready yet.
        </p>
      )}
    </section>
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
                    textTransform: 'uppercase',
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
                    textTransform: 'uppercase',
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

function formatMiniTimelineDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

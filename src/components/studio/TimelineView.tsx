'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  getMockTimeline,
  groupTimelineByDate,
  generateDaySummary,
} from '@/lib/studio-mock-data';
import {
  getContentTypeIdentity,
  CONTENT_TYPES,
  STAGES,
  studioMix,
} from '@/lib/studio';
import type {
  StudioTimelineEntry,
  StudioDaySummary,
} from '@/lib/studio';
import type { TimelineDateGroup } from '@/lib/studio-mock-data';
import StudioCard from './StudioCard';
import SectionLabel from '../SectionLabel';

/**
 * Studio timeline: expandable card-based activity log.
 *
 * Features:
 *   Filter row: content type pills, stage dropdown, date range toggle
 *   Date groups: date header + day summary card + entry cards on a spine
 *   Expandable entries: collapsed (title, meta, chevron) / expanded (excerpt,
 *   action details, connections, notes, editor link)
 *
 * CSS classes from studio.css:
 *   .studio-timeline-spine, .studio-timeline-dot,
 *   .studio-timeline-expand, .studio-day-summary, .studio-filter-pill
 */
export default function TimelineView() {
  const timeline = useMemo(() => getMockTimeline(), []);

  /* ── Filter state ──────────────────────────── */
  const [typeFilters, setTypeFilters] = useState<Set<string>>(
    () => new Set(CONTENT_TYPES.map((t) => t.slug)),
  );
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  /* ── Filter logic ──────────────────────────── */
  const filtered = useMemo(() => {
    const now = new Date('2026-03-04T14:00:00Z');
    let cutoff: Date | null = null;
    if (dateRange === 'week') {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'month') {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return timeline.filter((e) => {
      if (!typeFilters.has(e.contentType)) return false;
      /* Stage filter: timeline entries don't carry stage data yet.
         When real API replaces mock, entries will include the content
         item's current stage and this filter will be wired up. */
      if (cutoff && new Date(e.occurredAt) < cutoff) return false;
      return true;
    });
  }, [timeline, typeFilters, stageFilter, dateRange]);

  const groups = useMemo(() => groupTimelineByDate(filtered), [filtered]);

  /* ── Toggle helpers ────────────────────────── */
  const toggleType = useCallback((slug: string) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div style={{ padding: '32px 40px' }}>
      <SectionLabel variant="studio" hexColor="#B45A2D">
        TIMELINE
      </SectionLabel>

      {/* ── Filter row ───────────────────────── */}
      <FilterRow
        typeFilters={typeFilters}
        toggleType={toggleType}
        stageFilter={stageFilter}
        setStageFilter={setStageFilter}
        dateRange={dateRange}
        setDateRange={setDateRange}
      />

      {/* ── Timeline body ────────────────────── */}
      <div style={{ marginTop: '20px', position: 'relative' }}>
        {/* Spine */}
        <div className="studio-timeline-spine" aria-hidden="true" />

        {groups.map((group) => (
          <DateGroup
            key={group.dateKey}
            group={group}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
          />
        ))}

        {groups.length === 0 && (
          <p
            style={{
              fontFamily: 'var(--studio-font-body)',
              fontSize: '14px',
              color: 'var(--studio-text-3)',
              paddingLeft: '24px',
              fontStyle: 'italic',
            }}
          >
            No activity matches current filters.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Filter row ──────────────────────────────── */

function FilterRow({
  typeFilters,
  toggleType,
  stageFilter,
  setStageFilter,
  dateRange,
  setDateRange,
}: {
  typeFilters: Set<string>;
  toggleType: (slug: string) => void;
  stageFilter: string | null;
  setStageFilter: (s: string | null) => void;
  dateRange: 'week' | 'month' | 'all';
  setDateRange: (d: 'week' | 'month' | 'all') => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        marginTop: '12px',
      }}
    >
      {/* Type pills */}
      {CONTENT_TYPES.map((ct) => (
        <button
          key={ct.slug}
          type="button"
          className="studio-filter-pill"
          data-active={typeFilters.has(ct.slug) ? 'true' : 'false'}
          style={{ color: ct.color }}
          onClick={() => toggleType(ct.slug)}
        >
          {ct.label}
        </button>
      ))}

      {/* Divider */}
      <span
        style={{
          width: '1px',
          height: '16px',
          backgroundColor: 'var(--studio-border)',
          margin: '0 4px',
        }}
      />

      {/* Stage dropdown */}
      <select
        value={stageFilter ?? ''}
        onChange={(e) => setStageFilter(e.target.value || null)}
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          backgroundColor: 'var(--studio-surface)',
          color: 'var(--studio-text-2)',
          border: '1px solid var(--studio-border)',
          borderRadius: '4px',
          padding: '3px 8px',
          cursor: 'pointer',
        }}
      >
        <option value="">All stages</option>
        {STAGES.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Divider */}
      <span
        style={{
          width: '1px',
          height: '16px',
          backgroundColor: 'var(--studio-border)',
          margin: '0 4px',
        }}
      />

      {/* Date range toggle */}
      {(['week', 'month', 'all'] as const).map((dr) => (
        <button
          key={dr}
          type="button"
          className="studio-filter-pill"
          data-active={dateRange === dr ? 'true' : 'false'}
          style={{ color: 'var(--studio-text-2)' }}
          onClick={() => setDateRange(dr)}
        >
          {dr === 'week' ? 'This week' : dr === 'month' ? 'This month' : 'All time'}
        </button>
      ))}
    </div>
  );
}

/* ── Date group with summary + entries ───────── */

function DateGroup({
  group,
  expandedIds,
  toggleExpand,
}: {
  group: TimelineDateGroup;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
}) {
  const summary = useMemo(
    () => generateDaySummary(group.entries),
    [group.entries],
  );

  return (
    <div style={{ marginBottom: '28px' }}>
      {/* Date header + rule */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          paddingLeft: '24px',
          marginBottom: '12px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            color: 'var(--studio-text-3)',
            whiteSpace: 'nowrap',
          }}
        >
          {group.dateLabel}
        </span>
        <span
          style={{
            flex: 1,
            height: '1px',
            backgroundColor: 'var(--studio-border)',
          }}
        />
      </div>

      {/* Day summary */}
      <DaySummaryCard summary={summary} />

      {/* Entry cards */}
      {group.entries.map((entry) => (
        <TimelineCard
          key={entry.id}
          entry={entry}
          expanded={expandedIds.has(entry.id)}
          onToggle={() => toggleExpand(entry.id)}
        />
      ))}
    </div>
  );
}

/* ── Day summary card ────────────────────────── */

function DaySummaryCard({ summary }: { summary: StudioDaySummary }) {
  return (
    <div className="studio-day-summary" style={{ marginLeft: '24px' }}>
      <span
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '8.5px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          color: 'var(--studio-tc)',
          display: 'block',
          marginBottom: '6px',
        }}
      >
        DAY SUMMARY
      </span>
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '6px',
        }}
      >
        <StatChip label="Pieces" value={summary.piecesTouched} />
        <StatChip
          label="Words"
          value={`${summary.wordsDelta >= 0 ? '+' : ''}${summary.wordsDelta}`}
        />
        <StatChip label="Stage changes" value={summary.stageChanges} />
      </div>
      <p
        style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '12px',
          color: 'var(--studio-text-2)',
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {summary.summaryText}
      </p>
    </div>
  );
}

function StatChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <span
      style={{
        fontFamily: 'var(--studio-font-mono)',
        fontSize: '10px',
        color: 'var(--studio-text-3)',
      }}
    >
      <span style={{ fontWeight: 700, color: 'var(--studio-text-1)' }}>
        {value}
      </span>{' '}
      {label}
    </span>
  );
}

/* ── Timeline entry card ─────────────────────── */

function TimelineCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: StudioTimelineEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const typeInfo = getContentTypeIdentity(entry.contentType);

  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: '24px',
        paddingBottom: '4px',
      }}
    >
      {/* Dot on spine */}
      <div
        className="studio-timeline-dot"
        style={{ backgroundColor: typeInfo.color }}
      />

      {/* Card container */}
      <StudioCard
        typeColor={typeInfo.color}
        onClick={onToggle}
        style={{ marginBottom: '6px' }}
      >
        {/* Collapsed row: title + chevron + time */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Title */}
            <div
              style={{
                fontFamily: 'var(--studio-font-title)',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--studio-text-bright)',
                lineHeight: 1.3,
                marginBottom: '4px',
              }}
            >
              {entry.contentTitle}
            </div>

            {/* Meta row: type + stage + word count */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '3px',
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
            </div>

            {/* Action summary */}
            <div
              style={{
                fontFamily: 'var(--studio-font-body)',
                fontSize: '12px',
                color: 'var(--studio-text-3)',
                lineHeight: 1.4,
              }}
            >
              {entry.action}
            </div>
          </div>

          {/* Right side: chevron + time */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '10px',
                color: 'var(--studio-text-3)',
                whiteSpace: 'nowrap',
              }}
            >
              {formatTime(entry.occurredAt)}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="var(--studio-text-3)"
              strokeWidth="1.5"
              strokeLinecap="round"
              style={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 200ms ease',
              }}
            >
              <path d="M3 4.5 L6 7.5 L9 4.5" />
            </svg>
          </div>
        </div>

        {/* ── Expanded content ───────────────── */}
        <div
          className="studio-timeline-expand"
          data-expanded={expanded ? 'true' : 'false'}
        >
          <div style={{ paddingTop: '10px' }}>
            {/* Detail text */}
            {entry.detail && (
              <p
                style={{
                  fontFamily: 'var(--studio-font-body)',
                  fontSize: '14px',
                  fontStyle: 'italic',
                  color: 'var(--studio-text-2)',
                  lineHeight: 1.5,
                  margin: '0 0 10px',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {entry.detail}
              </p>
            )}

            {/* Action line with dot */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: typeInfo.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--studio-font-metadata)',
                  fontSize: '11px',
                  color: 'var(--studio-text-2)',
                }}
              >
                {entry.action}
              </span>
            </div>

            {/* Connections */}
            {entry.connections && entry.connections.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginBottom: '8px',
                }}
              >
                {entry.connections.map((c) => (
                  <span
                    key={c.targetId}
                    style={{
                      fontFamily: 'var(--studio-font-mono)',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: '#3A8A9A',
                      backgroundColor: studioMix('#3A8A9A', 10),
                      border: `1px solid ${studioMix('#3A8A9A', 20)}`,
                      borderRadius: '10px',
                      padding: '2px 8px',
                    }}
                  >
                    {c.targetTitle}
                  </span>
                ))}
              </div>
            )}

            {/* Notes */}
            {entry.notes && entry.notes.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                {entry.notes.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      fontFamily: 'var(--studio-font-body)',
                      fontSize: '12px',
                      color: 'var(--studio-text-2)',
                      padding: '6px 10px',
                      backgroundColor: 'rgba(237, 231, 220, 0.04)',
                      borderLeft: '2px solid var(--studio-border)',
                      borderRadius: '0 4px 4px 0',
                      marginBottom: '4px',
                    }}
                  >
                    <span>{note.text}</span>
                    <span
                      style={{
                        fontFamily: 'var(--studio-font-mono)',
                        fontSize: '9px',
                        color: 'var(--studio-text-3)',
                        marginLeft: '8px',
                      }}
                    >
                      {formatDate(note.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Editor link */}
            <a
              href={`/studio/${typeInfo.route}/${entry.contentId}`}
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                color: 'var(--studio-tc)',
                textDecoration: 'none',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Open in editor &rarr;
            </a>
          </div>
        </div>
      </StudioCard>
    </div>
  );
}

/* ── Utilities ────────────────────────────────── */

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

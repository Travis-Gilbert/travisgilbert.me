'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  useApiData,
  fetchArtifacts,
  triggerExtraction,
} from '@/lib/commonplace-api';
import { useDrawer } from '@/lib/providers/drawer-provider';
import { useCapture } from '@/lib/providers/capture-provider';
import type { ApiArtifactListItem } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Artifact Browser View
   Triage + Exploration: polymorphic list by capture
   kind, 7-stage pipeline track, inline extraction.
   ───────────────────────────────────────────────── */

/** 7-stage epistemic pipeline. */
const PIPELINE_STAGES = [
  'captured',
  'parsed',
  'extracted',
  'reviewed',
  'promoted',
  'compiled',
  'learned',
] as const;

/** Visual identity per capture_kind. */
const CAPTURE_KIND_STYLES: Record<string, { color: string; label: string }> = {
  url: { color: '#2D5F6B', label: 'URL' },
  file: { color: '#B45A2D', label: 'File' },
  text: { color: '#8B6FA0', label: 'Text' },
};

type KindFilter = 'all' | 'url' | 'file' | 'text';
type StatusFilter = 'all' | 'captured' | 'parsed' | 'extracted' | 'failed';

export default function ArtifactBrowserView() {
  const { openDrawer } = useDrawer();
  const { captureVersion } = useCapture();
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [extractingIds, setExtractingIds] = useState<Set<number>>(new Set());
  const [activeStage, setActiveStage] = useState<string | null>(null);

  const { data: artifacts, loading, error, refetch } = useApiData(
    () => fetchArtifacts({
      capture_kind: kindFilter !== 'all' ? kindFilter : undefined,
      ingestion_status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
    [captureVersion, kindFilter, statusFilter],
  );

  /** Count artifacts per pipeline stage. */
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of PIPELINE_STAGES) counts[stage] = 0;
    if (artifacts) {
      for (const a of artifacts) {
        const s = a.ingestion_status;
        if (s in counts) counts[s] += 1;
      }
    }
    return counts;
  }, [artifacts]);

  const failedCount = useMemo(() => {
    if (!artifacts) return 0;
    return artifacts.filter((a) => a.ingestion_status === 'failed').length;
  }, [artifacts]);

  const filteredArtifacts = useMemo(() => {
    if (!artifacts) return [];
    let list = artifacts;

    // Pipeline stage filter
    if (activeStage) {
      list = list.filter((a) => a.ingestion_status === activeStage);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.source_url && a.source_url.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [artifacts, searchQuery, activeStage]);

  /** Group URL artifacts by domain. */
  const groupedArtifacts = useMemo(() => {
    const domains = new Map<string, ApiArtifactListItem[]>();
    const ungrouped: ApiArtifactListItem[] = [];

    for (const a of filteredArtifacts) {
      if (a.capture_kind === 'url' && a.source_url) {
        try {
          const domain = new URL(a.source_url).hostname.replace(/^www\./, '');
          if (!domains.has(domain)) domains.set(domain, []);
          domains.get(domain)!.push(a);
        } catch {
          ungrouped.push(a);
        }
      } else {
        ungrouped.push(a);
      }
    }

    // Only group domains with 2+ artifacts
    const groups: Array<{ domain?: string; items: ApiArtifactListItem[] }> = [];
    for (const [domain, items] of domains) {
      if (items.length >= 2) {
        groups.push({ domain, items });
      } else {
        ungrouped.push(...items);
      }
    }
    if (ungrouped.length > 0) {
      groups.push({ items: ungrouped });
    }
    return groups;
  }, [filteredArtifacts]);

  const handleExtract = useCallback(async (artifactId: number) => {
    setExtractingIds((prev) => new Set(prev).add(artifactId));
    try {
      await triggerExtraction(artifactId);
      refetch();
    } catch {
      // Silently fail; user can retry
    } finally {
      setExtractingIds((prev) => {
        const next = new Set(prev);
        next.delete(artifactId);
        return next;
      });
    }
  }, [refetch]);

  const handleToggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (loading) {
    return (
      <div className="cp-pane-content" style={containerStyle}>
        <div style={centeredStyle}>
          <div style={monoLabel}>LOADING ARTIFACTS...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-pane-content" style={containerStyle}>
        <div style={centeredStyle}>
          <div style={{ color: 'var(--cp-red)', fontSize: 13, marginBottom: 8 }}>{error.message}</div>
          <button onClick={refetch} style={actionBtnStyle('var(--cp-teal)')}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-pane-content" style={containerStyle}>
      {/* Header */}
      <div>
        <h2 style={titleStyle}>Artifacts</h2>
        <p style={subtitleStyle}>
          Captured content flowing through the epistemic pipeline.
        </p>
      </div>

      {/* Failed callout */}
      {failedCount > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: 6,
          background: 'color-mix(in srgb, var(--cp-red) 10%, var(--cp-surface))',
          border: '1px solid var(--cp-red-line)',
          fontSize: 12,
          color: 'var(--cp-text)',
        }}>
          <span>{failedCount} artifact{failedCount !== 1 ? 's' : ''} failed extraction</span>
          <button
            onClick={() => setActiveStage(activeStage === 'failed' ? null : 'failed')}
            style={{
              ...actionBtnStyle('var(--cp-red)'),
              fontSize: 11,
              padding: '2px 8px',
            }}
          >
            {activeStage === 'failed' ? 'Show all' : 'Show failed'}
          </button>
        </div>
      )}

      {/* Pipeline summary bar */}
      <PipelineSummaryBar
        stageCounts={stageCounts}
        activeStage={activeStage}
        onStageClick={(stage) => setActiveStage(activeStage === stage ? null : stage)}
      />

      {/* Filter bar */}
      <ArtifactFilterBar
        kindFilter={kindFilter}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
        onKindChange={setKindFilter}
        onStatusChange={setStatusFilter}
        onSearchChange={setSearchQuery}
      />

      {/* Artifact list */}
      {filteredArtifacts.length === 0 ? (
        <EmptyArtifacts hasAny={!!artifacts && artifacts.length > 0} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {groupedArtifacts.map((group, gi) => (
            <div key={group.domain ?? `ungrouped-${gi}`}>
              {group.domain && (
                <DomainGroupHeader domain={group.domain} count={group.items.length} />
              )}
              {group.items.map((artifact) => (
                <ArtifactRow
                  key={artifact.id}
                  artifact={artifact}
                  isExpanded={expandedId === artifact.id}
                  isExtracting={extractingIds.has(artifact.id)}
                  onToggle={() => handleToggleExpand(artifact.id)}
                  onExtract={() => handleExtract(artifact.id)}
                  onOpenObject={artifact.notebook_slug ? () => openDrawer(artifact.notebook_slug!) : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Pipeline Summary Bar ── */

function PipelineSummaryBar({
  stageCounts,
  activeStage,
  onStageClick,
}: {
  stageCounts: Record<string, number>;
  activeStage: string | null;
  onStageClick: (stage: string) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      padding: '10px 12px',
      borderRadius: 8,
      backgroundColor: 'transparent',
      border: 'none',
    }}>
      {PIPELINE_STAGES.map((stage, idx) => {
        const isActive = activeStage === stage;
        const count = stageCounts[stage] ?? 0;
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <button
              onClick={() => onStageClick(stage)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 4,
                flex: 1,
              }}
            >
              {/* Dot */}
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: count > 0 ? 'var(--cp-teal)' : 'var(--cp-text-faint)',
                border: isActive ? '2px solid var(--cp-text)' : '2px solid transparent',
                transition: 'all 150ms',
              }} />
              {/* Label */}
              <span style={{
                fontSize: 10,
                fontFamily: 'var(--cp-font-mono)',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.04em',
                color: isActive ? 'var(--cp-teal-light)' : 'var(--cp-teal)',
              }}>
                {stage.slice(0, 4)}
              </span>
              {/* Count */}
              <span style={{
                fontSize: 11,
                fontFamily: 'var(--cp-font-mono)',
                color: isActive ? 'var(--cp-text)' : 'var(--cp-text)',
                fontWeight: isActive ? 700 : 500,
              }}>
                {count}
              </span>
              {/* Active underline */}
              {isActive && (
                <div style={{
                  width: 16,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: 'var(--cp-teal)',
                }} />
              )}
            </button>
            {/* Connector line */}
            {idx < PIPELINE_STAGES.length - 1 && (
              <div style={{
                height: 1.5,
                flex: 1,
                minWidth: 8,
                backgroundColor: 'var(--cp-text-faint)',
                alignSelf: 'flex-start',
                marginTop: 5,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Domain Group Header ── */

function DomainGroupHeader({ domain, count }: { domain: string; count: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 14px',
      fontSize: 11,
      fontFamily: 'var(--cp-font-mono)',
      color: 'var(--cp-text-faint)',
      letterSpacing: '0.03em',
    }}>
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx={8} cy={8} r={6} />
        <path d="M2 8 Q8 4 14 8" />
      </svg>
      {domain}
      <span style={{ color: 'var(--cp-chrome-muted)' }}>({count})</span>
    </div>
  );
}

/* ── Filter Bar ── */

function ArtifactFilterBar({
  kindFilter,
  statusFilter,
  searchQuery,
  onKindChange,
  onStatusChange,
  onSearchChange,
}: {
  kindFilter: KindFilter;
  statusFilter: StatusFilter;
  searchQuery: string;
  onKindChange: (v: KindFilter) => void;
  onStatusChange: (v: StatusFilter) => void;
  onSearchChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by title or URL..."
        style={searchInputStyle}
      />

      {/* Filter rows */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {/* Kind filters */}
        {(['all', 'url', 'file', 'text'] as KindFilter[]).map((kind) => {
          const meta = kind === 'all' ? null : CAPTURE_KIND_STYLES[kind];
          return (
            <button
              key={kind}
              onClick={() => onKindChange(kind)}
              style={{
                padding: '3px 10px',
                borderRadius: 5,
                border: kindFilter === kind
                  ? `1px solid ${meta?.color ?? 'var(--cp-text-muted)'}`
                  : '1px solid transparent',
                backgroundColor: kindFilter === kind
                  ? `${meta?.color ?? 'var(--cp-text-muted)'}14`
                  : 'transparent',
                color: kindFilter === kind
                  ? (meta?.color ?? 'var(--cp-text)')
                  : 'var(--cp-text-faint)',
                fontSize: 11,
                fontFamily: 'var(--cp-font-mono)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {meta && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: meta.color,
                  opacity: kindFilter === kind ? 1 : 0.4,
                }} />
              )}
              {kind === 'all' ? 'All kinds' : meta!.label}
            </button>
          );
        })}

        <span style={{ borderLeft: '1px solid var(--cp-border)', margin: '0 4px' }} />

        {/* Status filters */}
        {(['all', 'captured', 'parsed', 'extracted', 'failed'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => onStatusChange(status)}
            style={{
              padding: '3px 10px',
              borderRadius: 5,
              border: statusFilter === status
                ? '1px solid var(--cp-text-muted)'
                : '1px solid transparent',
              backgroundColor: statusFilter === status
                ? 'var(--cp-text-muted)14'
                : 'transparent',
              color: statusFilter === status
                ? (status === 'failed' ? 'var(--cp-red)' : 'var(--cp-text)')
                : 'var(--cp-text-faint)',
              fontSize: 11,
              fontFamily: 'var(--cp-font-mono)',
              cursor: 'pointer',
            }}
          >
            {status === 'all' ? 'All stages' : status}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Stage Track (7-dot pipeline) ── */

export function StageTrack({
  status,
  failed,
}: {
  status: string;
  failed?: boolean;
}) {
  const currentIdx = PIPELINE_STAGES.indexOf(status as typeof PIPELINE_STAGES[number]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {PIPELINE_STAGES.map((stage, idx) => {
        const isReached = currentIdx >= idx;
        const isFailed = failed && idx === currentIdx;
        let dotColor = 'var(--cp-text-ghost)';
        if (isFailed) dotColor = 'var(--cp-red)';
        else if (isReached) dotColor = 'var(--cp-teal)';

        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div
              title={stage}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: dotColor,
                transition: 'background-color 0.2s ease',
              }}
            />
            {idx < PIPELINE_STAGES.length - 1 && (
              <div style={{
                width: 10,
                height: 1,
                backgroundColor: isReached ? 'var(--cp-teal)' : 'var(--cp-text-ghost)',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Extraction Summary ── */

export function ExtractionSummary({
  claims,
  entities,
  questions,
  rules,
  methods,
}: {
  claims: number;
  entities: number;
  questions: number;
  rules: number;
  methods: number;
}) {
  const items = [
    { label: 'claims', count: claims, color: '#B8623D' },
    { label: 'entities', count: entities, color: '#1A7A8A' },
    { label: 'questions', count: questions, color: '#7050A0' },
    { label: 'rules', count: rules, color: '#A08020' },
    { label: 'methods', count: methods, color: '#3858B8' },
  ].filter((i) => i.count > 0);

  if (items.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map((item) => (
        <span
          key={item.label}
          style={{
            fontSize: 10,
            fontFamily: 'var(--cp-font-mono)',
            padding: '2px 7px',
            borderRadius: 4,
            backgroundColor: `${item.color}14`,
            color: item.color,
            border: `1px solid ${item.color}28`,
          }}
        >
          {item.count} {item.label}
        </span>
      ))}
    </div>
  );
}

/* ── Artifact Row ── */

function ArtifactRow({
  artifact,
  isExpanded,
  isExtracting,
  onToggle,
  onExtract,
  onOpenObject,
}: {
  artifact: ApiArtifactListItem;
  isExpanded: boolean;
  isExtracting: boolean;
  onToggle: () => void;
  onExtract: () => void;
  onOpenObject?: () => void;
}) {
  const kindMeta = CAPTURE_KIND_STYLES[artifact.capture_kind] ?? { color: '#666', label: artifact.capture_kind };
  const isFailed = artifact.ingestion_status === 'failed';

  /** Extract domain from source_url for URL artifacts. */
  const subtitle = useMemo(() => {
    if (artifact.capture_kind === 'url' && artifact.source_url) {
      try {
        return new URL(artifact.source_url).hostname;
      } catch {
        return artifact.source_url;
      }
    }
    if (artifact.capture_kind === 'file' && artifact.parser_type) {
      return artifact.parser_type;
    }
    if (artifact.capture_kind === 'text' && artifact.raw_text_preview) {
      return artifact.raw_text_preview.slice(0, 60);
    }
    return null;
  }, [artifact]);

  return (
    <div
      style={{
        borderRadius: 6,
        backgroundColor: 'var(--cp-surface)',
        border: '1px solid var(--cp-border)',
        overflow: 'hidden',
      }}
    >
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left' as const,
        }}
      >
        {/* Capture kind icon */}
        <CaptureKindIcon kind={artifact.capture_kind} color={kindMeta.color} />

        {/* Title + subtitle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            color: 'var(--cp-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          }}>
            {artifact.title || 'Untitled artifact'}
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--cp-text-faint)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
            marginTop: 1,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}>
            {subtitle && <span>{subtitle}</span>}
            {subtitle && artifact.ingestion_status !== 'captured' && <span>|</span>}
            <span>{artifact.ingestion_status}</span>
          </div>
        </div>

        {/* Extraction badges (inline on collapsed row) */}
        {artifact.extraction_summary && (
          <div style={{ flexShrink: 0, display: 'flex', gap: 4 }}>
            {artifact.extraction_summary.claims > 0 && (
              <InlineBadge count={artifact.extraction_summary.claims} label="claims" color="#B8623D" />
            )}
            {artifact.extraction_summary.entities > 0 && (
              <InlineBadge count={artifact.extraction_summary.entities} label="entities" color="#1A7A8A" />
            )}
            {artifact.extraction_summary.questions > 0 && (
              <InlineBadge count={artifact.extraction_summary.questions} label="questions" color="#7050A0" />
            )}
          </div>
        )}

        {/* Expand chevron */}
        <svg
          width={12} height={12} viewBox="0 0 12 12"
          fill="none" stroke="var(--cp-text-faint)" strokeWidth={1.5}
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        >
          <path d="M3 4.5 L6 7.5 L9 4.5" />
        </svg>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <ArtifactDetail
          artifact={artifact}
          isExtracting={isExtracting}
          onExtract={onExtract}
          onOpenObject={onOpenObject}
        />
      )}
    </div>
  );
}

/* ── Inline Badge ── */

function InlineBadge({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10,
      fontFamily: 'var(--cp-font-mono)',
      color,
      whiteSpace: 'nowrap' as const,
    }}>
      {count} {label}
    </span>
  );
}

/* ── Capture Kind Icon ── */

function CaptureKindIcon({ kind, color }: { kind: string; color: string }) {
  const s = 16;
  const sw = 1.5;

  switch (kind) {
    case 'url':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ flexShrink: 0 }}>
          <circle cx={8} cy={8} r={6} />
          <path d="M2 8 Q8 4 14 8" />
          <path d="M2 8 Q8 12 14 8" />
          <line x1={8} y1={2} x2={8} y2={14} />
        </svg>
      );
    case 'file':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ flexShrink: 0 }}>
          <path d="M4 2 L10 2 L13 5 L13 14 L4 14 Z" />
          <path d="M10 2 L10 5 L13 5" />
        </svg>
      );
    default: // text
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ flexShrink: 0 }}>
          <line x1={3} y1={4} x2={13} y2={4} />
          <line x1={3} y1={7} x2={11} y2={7} />
          <line x1={3} y1={10} x2={13} y2={10} />
          <line x1={3} y1={13} x2={8} y2={13} />
        </svg>
      );
  }
}

/* ── Artifact Detail (expanded panel) ── */

function ArtifactDetail({
  artifact,
  isExtracting,
  onExtract,
  onOpenObject,
}: {
  artifact: ApiArtifactListItem;
  isExtracting: boolean;
  onExtract: () => void;
  onOpenObject?: () => void;
}) {
  const canExtract = artifact.ingestion_status === 'parsed' || artifact.ingestion_status === 'captured';
  const date = new Date(artifact.created_at);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--cp-border)' }}>
      <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Metadata */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <MetaItem label="Captured" value={dateStr} />
          <MetaItem label="Kind" value={artifact.capture_kind} />
          <MetaItem label="Parser" value={artifact.parser_type || 'none'} />
          {artifact.projection_count > 0 && (
            <MetaItem label="Projections" value={String(artifact.projection_count)} />
          )}
        </div>

        {/* Source URL (for URL artifacts) */}
        {artifact.source_url && (
          <div style={{ fontSize: 12, color: 'var(--cp-text-muted)', wordBreak: 'break-all' as const }}>
            {artifact.source_url}
          </div>
        )}

        {/* Pipeline stage track (larger) */}
        <div>
          <div style={{ ...monoLabel, color: 'var(--cp-text-faint)', marginBottom: 6 }}>PIPELINE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {PIPELINE_STAGES.map((stage, idx) => {
              const currentIdx = PIPELINE_STAGES.indexOf(
                artifact.ingestion_status as typeof PIPELINE_STAGES[number],
              );
              const isReached = currentIdx >= idx;
              const isCurrent = idx === currentIdx;
              const isFailed = artifact.ingestion_status === 'failed' && isCurrent;

              let dotColor = 'var(--cp-text-ghost)';
              if (isFailed) dotColor = 'var(--cp-red)';
              else if (isReached) dotColor = 'var(--cp-teal)';

              return (
                <div key={stage} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 4 }}>
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: dotColor,
                    border: isCurrent ? '2px solid var(--cp-text)' : '2px solid transparent',
                  }} />
                  <span style={{
                    fontSize: 9,
                    fontFamily: 'var(--cp-font-mono)',
                    color: isReached ? 'var(--cp-text-muted)' : 'var(--cp-text-faint)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.04em',
                  }}>
                    {stage.slice(0, 4)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Extraction summary */}
        {artifact.extraction_summary && (
          <div>
            <div style={{ ...monoLabel, color: 'var(--cp-text-faint)', marginBottom: 6 }}>EXTRACTED</div>
            <ExtractionSummary {...artifact.extraction_summary} />
          </div>
        )}

        {/* Preview text */}
        {artifact.raw_text_preview && (
          <div style={{
            fontSize: 12,
            color: 'var(--cp-text-muted)',
            lineHeight: 1.5,
            padding: '8px 10px',
            borderRadius: 5,
            backgroundColor: 'var(--cp-chrome-bg)',
            border: '1px solid var(--cp-border)',
            fontStyle: 'italic',
          }}>
            {artifact.raw_text_preview}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          {canExtract && (
            <button
              onClick={onExtract}
              disabled={isExtracting}
              style={{
                ...actionBtnStyle('var(--cp-teal)'),
                opacity: isExtracting ? 0.5 : 1,
              }}
            >
              {isExtracting ? 'Extracting...' : 'Extract'}
            </button>
          )}
          {artifact.ingestion_status === 'extracted' && onOpenObject && (
            <button
              onClick={onOpenObject}
              style={actionBtnStyle('var(--cp-teal)')}
            >
              Read
            </button>
          )}
          {artifact.ingestion_status === 'extracted' && !onOpenObject && (
            <span style={{ fontSize: 11, color: 'var(--cp-green)', fontFamily: 'var(--cp-font-mono)', alignSelf: 'center' }}>
              Extraction complete
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Metadata display item ── */

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...monoLabel, color: 'var(--cp-text-faint)', marginBottom: 2, fontSize: 9 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--cp-text-muted)', fontFamily: 'var(--cp-font-mono)' }}>{value}</div>
    </div>
  );
}

/* ── Empty state ── */

function EmptyArtifacts({ hasAny }: { hasAny: boolean }) {
  return (
    <div style={centeredStyle}>
      <div style={{ fontFamily: 'var(--cp-font-title)', fontSize: 18, color: 'var(--cp-text)', marginBottom: 6 }}>
        {hasAny ? 'No artifacts match filters' : 'No artifacts yet'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--cp-text-muted)', textAlign: 'center' as const, maxWidth: 300 }}>
        {hasAny
          ? 'Try adjusting the kind or status filters.'
          : 'Capture URLs, upload files, or paste text to create artifacts. They flow through the epistemic pipeline automatically.'}
      </div>
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
  gap: 12,
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


const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 12px',
  fontSize: 13,
  fontFamily: 'var(--cp-font-mono)',
  color: 'var(--cp-text)',
  backgroundColor: 'var(--cp-surface)',
  border: '1px solid var(--cp-border)',
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box' as const,
};

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    padding: '4px 12px',
    borderRadius: 5,
    border: `1px solid ${color}`,
    backgroundColor: 'transparent',
    color,
    fontSize: 12,
    fontFamily: 'var(--cp-font-mono)',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  };
}

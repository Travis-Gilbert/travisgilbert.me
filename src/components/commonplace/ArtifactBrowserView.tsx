'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  useApiData,
  fetchArtifacts,
  triggerExtraction,
} from '@/lib/commonplace-api';
import { useCommonPlace } from '@/lib/commonplace-context';
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
  const { captureVersion } = useCommonPlace();
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [extractingIds, setExtractingIds] = useState<Set<number>>(new Set());

  const { data: artifacts, loading, error, refetch } = useApiData(
    () => fetchArtifacts({
      capture_kind: kindFilter !== 'all' ? kindFilter : undefined,
      ingestion_status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
    [captureVersion, kindFilter, statusFilter],
  );

  const filteredArtifacts = useMemo(() => {
    if (!artifacts) return [];
    if (!searchQuery.trim()) return artifacts;
    const q = searchQuery.toLowerCase();
    return artifacts.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.source_url && a.source_url.toLowerCase().includes(q)),
    );
  }, [artifacts, searchQuery]);

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
          Extract to populate the promotion queue with claims,
          entities, and questions.
        </p>
      </div>

      {/* Filter bar */}
      <ArtifactFilterBar
        kindFilter={kindFilter}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
        onKindChange={setKindFilter}
        onStatusChange={setStatusFilter}
        onSearchChange={setSearchQuery}
      />

      {/* Stats */}
      <div style={statsBarStyle}>
        <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 13, color: 'var(--cp-text)' }}>
          {filteredArtifacts.length} artifact{filteredArtifacts.length !== 1 ? 's' : ''}
        </span>
        {artifacts && artifacts.length !== filteredArtifacts.length && (
          <span style={{ fontSize: 11, color: 'var(--cp-text-faint)', fontFamily: 'var(--cp-font-mono)' }}>
            {artifacts.length} total
          </span>
        )}
      </div>

      {/* Artifact list */}
      {filteredArtifacts.length === 0 ? (
        <EmptyArtifacts hasAny={!!artifacts && artifacts.length > 0} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredArtifacts.map((artifact) => (
            <ArtifactRow
              key={artifact.id}
              artifact={artifact}
              isExpanded={expandedId === artifact.id}
              isExtracting={extractingIds.has(artifact.id)}
              onToggle={() => handleToggleExpand(artifact.id)}
              onExtract={() => handleExtract(artifact.id)}
            />
          ))}
        </div>
      )}
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

        <span style={{ borderLeft: '1px solid var(--cp-chrome-line)', margin: '0 4px' }} />

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
        let dotColor = 'var(--cp-chrome-line)';
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
                backgroundColor: isReached ? 'var(--cp-teal)' : 'var(--cp-chrome-line)',
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
    { label: 'claims', count: claims, color: '#C4503C' },
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
}: {
  artifact: ApiArtifactListItem;
  isExpanded: boolean;
  isExtracting: boolean;
  onToggle: () => void;
  onExtract: () => void;
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
        border: '1px solid var(--cp-chrome-line)',
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
          {subtitle && (
            <div style={{
              fontSize: 11,
              color: 'var(--cp-text-faint)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const,
              marginTop: 1,
            }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Stage track */}
        <div style={{ flexShrink: 0 }}>
          <StageTrack status={artifact.ingestion_status} failed={isFailed} />
        </div>

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
        />
      )}
    </div>
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
}: {
  artifact: ApiArtifactListItem;
  isExtracting: boolean;
  onExtract: () => void;
}) {
  const canExtract = artifact.ingestion_status === 'parsed' || artifact.ingestion_status === 'captured';
  const date = new Date(artifact.created_at);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--cp-chrome-line)' }}>
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

              let dotColor = 'var(--cp-chrome-line)';
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
            border: '1px solid var(--cp-chrome-line)',
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
          {artifact.ingestion_status === 'extracted' && (
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

const statsBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 8,
  backgroundColor: 'var(--cp-surface)',
  border: '1px solid var(--cp-chrome-line)',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 12px',
  fontSize: 13,
  fontFamily: 'var(--cp-font-mono)',
  color: 'var(--cp-text)',
  backgroundColor: 'var(--cp-surface)',
  border: '1px solid var(--cp-chrome-line)',
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

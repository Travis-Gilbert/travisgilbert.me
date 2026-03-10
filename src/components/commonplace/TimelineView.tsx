'use client';

/**
 * TimelineView: chronological feed of captured objects.
 *
 * Layout: two-column grid (100px gutter + card body).
 * Left gutter: continuous 2px terracotta rail, type-colored dot markers,
 * short Courier Prime time label.
 * Right column: rich cards with type badge pill, full body text (not
 * truncated), connections 2-col grid, inline retrospective notes.
 *
 * GSAP ScrollTrigger animates cards as they enter the scroll container.
 * Respects prefers-reduced-motion: skip animations entirely if set.
 *
 * Dropped from prior version: the custom binary-search virtualizer
 * (MeasuredTimelineRow, findStartIndex, findEndIndex, rowHeights, spacers)
 * -- incompatible with GSAP ScrollTrigger which needs stable DOM nodes.
 *
 * Preserved from prior version:
 *   fetchFeed, groupNodesByDate, useApiData, postRetrospective,
 *   TimelineSearch, TimelineFilters, filter state, captureVersion refetch.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  fetchFeed,
  groupNodesByDate,
  useApiData,
  postRetrospective,
} from '@/lib/commonplace-api';
import { useCommonPlace } from '@/lib/commonplace-context';
import type { MockNode } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import TimelineSearch from './TimelineSearch';
import type { TimelineFilters } from './TimelineSearch';
import RetroNote from './RetroNote';
import type { RetroTrigger } from './RetroNote';

/* ─────────────────────────────────────────────────
   Utilities
   ───────────────────────────────────────────────── */

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function deriveEntityChips(node: MockNode): string[] {
  const raw = `${node.title} ${node.summary ?? ''}`;
  const tokens = raw
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const titleText = node.title.toLowerCase();
  const preferred = tokens.filter((token) => {
    if (token.length < 3) return false;
    if (/^[A-Z]{2,}$/.test(token)) return true;
    if (/^[A-Z][A-Za-z0-9'-]{2,}$/.test(token)) return true;
    return false;
  });

  const fallback = tokens.filter((token) => {
    if (token.length < 4) return false;
    if (preferred.includes(token)) return false;
    return titleText.includes(token.toLowerCase());
  });

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const token of [...preferred, ...fallback]) {
    const normalized = token.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(token);
    if (deduped.length >= 5) break;
  }
  return deduped;
}

interface RetroPromptConfig {
  trigger: RetroTrigger;
  prompt: string;
  relatedNodes: string[];
  dismissKey: string;
}

function daysSince(iso: string): number {
  const now = Date.now();
  const then = new Date(iso).getTime();
  return Math.floor((now - then) / (24 * 60 * 60 * 1000));
}

function buildContextualRetroPrompt(node: MockNode, allNodes: MockNode[]): RetroPromptConfig | null {
  const typeInfo = getObjectTypeIdentity(node.objectType);
  const connected = node.edges
    .map((edge) => {
      const otherId = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
      const other = allNodes.find((candidate) => candidate.id === otherId);
      return other ? { other, edge } : null;
    })
    .filter((value): value is { other: MockNode; edge: MockNode['edges'][number] } => !!value);

  const tension = connected.find(
    ({ edge }) =>
      edge.edge_type?.toLowerCase().includes('counter') ||
      edge.edge_type?.toLowerCase().includes('tension') ||
      edge.reason?.toLowerCase().includes('contradict'),
  );
  if (tension) {
    const explanation = tension.edge.reason ? `: ${tension.edge.reason}` : '.';
    return {
      trigger: 'tension',
      prompt: `${node.title} may contradict ${tension.other.title}${explanation} Worth investigating?`,
      relatedNodes: [node.title, tension.other.title],
      dismissKey: `tension:${node.objectSlug}:${tension.edge.id}`,
    };
  }

  if (node.objectType === 'hunch') {
    const sourceLinks = connected.filter(({ other }) => other.objectType === 'source');
    if (sourceLinks.length >= 3) {
      return {
        trigger: 'hunch-sources',
        prompt: `This Hunch now has ${sourceLinks.length} supporting sources. Is it ready to become an essay?`,
        relatedNodes: sourceLinks.slice(0, 3).map(({ other }) => other.title),
        dismissKey: `hunch-sources:${node.objectSlug}:${sourceLinks.length}`,
      };
    }
  }

  const staleDays = daysSince(node.capturedAt);
  if (staleDays >= 30 && node.edgeCount >= 2) {
    return {
      trigger: 'dormant',
      prompt: `This ${typeInfo.label} has connected to ${node.edgeCount} objects while it sat dormant for ${staleDays} days. Has your thinking changed?`,
      relatedNodes: connected.slice(0, 3).map(({ other }) => other.title),
      dismissKey: `dormant:${node.objectSlug}:${node.edgeCount}`,
    };
  }

  const connectedTypes = new Set(connected.map(({ other }) => other.objectType));
  if (connected.length >= 2 && connectedTypes.size >= 2) {
    const first = connected[0];
    const second = connected[1];
    if (!first || !second) return null;
    const reason = first?.edge.reason || second?.edge.reason || 'an inferred bridge';
    return {
      trigger: 'bridge',
      prompt: `${first.other.title} and ${second.other.title} just connected through ${reason}. Did you expect this?`,
      relatedNodes: [first.other.title, second.other.title],
      dismissKey: `bridge:${node.objectSlug}:${first.edge.id}:${second.edge.id}`,
    };
  }

  return null;
}

/* ─────────────────────────────────────────────────
   ConnectionPill
   ───────────────────────────────────────────────── */

function ConnectionPill({
  edge,
  node,
  allNodes,
  onOpenDrawer,
}: {
  edge: MockNode['edges'][number];
  node: MockNode;
  allNodes: MockNode[];
  onOpenDrawer: (slug: string) => void;
}) {
  const isSource = edge.sourceId === node.id;
  const otherId = isSource ? edge.targetId : edge.sourceId;
  const other = allNodes.find((n) => n.id === otherId);
  const otherInfo = other ? getObjectTypeIdentity(other.objectType) : null;

  return (
    <button
      type="button"
      className="cp-tl-connection-pill"
      onClick={() => {
        if (other) onOpenDrawer(other.objectSlug);
      }}
      title={edge.reason ?? undefined}
      style={{ borderColor: otherInfo ? `${otherInfo.color}55` : 'var(--cp-border)' }}
    >
      {/* Directional arrow */}
      <svg
        width={7}
        height={7}
        viewBox="0 0 7 7"
        fill="none"
        aria-hidden="true"
        style={{
          flexShrink: 0,
          opacity: 0.6,
          color: otherInfo?.color ?? 'var(--cp-text-faint)',
        }}
      >
        {isSource ? (
          <path
            d="M1 3.5h5M3.5 1.5L5.5 3.5 3.5 5.5"
            stroke="currentColor"
            strokeWidth={1.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M6 3.5H1M3.5 1.5L1.5 3.5 3.5 5.5"
            stroke="currentColor"
            strokeWidth={1.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {/* Other object type label */}
      {otherInfo && (
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8.5,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: otherInfo.color,
            flexShrink: 0,
          }}
        >
          {otherInfo.label}
        </span>
      )}

      {/* Other object title */}
      <span
        style={{
          fontFamily: 'var(--cp-font-body)',
          fontSize: 11.5,
          color: 'var(--cp-text-muted)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {other?.title ?? String(otherId)}
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────────
   TimelineCard
   ───────────────────────────────────────────────── */

function TimelineCard({
  node,
  allNodes,
  onOpenDrawer,
}: {
  node: MockNode;
  allNodes: MockNode[];
  onOpenDrawer: (slug: string) => void;
}) {
  const typeInfo = getObjectTypeIdentity(node.objectType);
  const entityChips = useMemo(() => deriveEntityChips(node), [node]);
  const contextualRetro = useMemo(
    () => buildContextualRetroPrompt(node, allNodes),
    [node, allNodes],
  );
  const [retroOpen, setRetroOpen] = useState(false);
  const [retroText, setRetroText] = useState('');
  const [retroSaved, setRetroSaved] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveRetro = async () => {
    if (!retroText.trim()) return;
    setSaving(true);
    try {
      await postRetrospective(String(node.id), retroText.trim());
      setRetroSaved(retroText.trim());
      setRetroText('');
      setRetroOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cp-timeline-card" data-type={node.objectType}>
      {/* Left gutter: continuous rail + dot marker + time label */}
      <div className="cp-tl-gutter" aria-hidden="true">
        <div className="cp-tl-rail" />
        <div
          className="cp-tl-dot"
          style={{
            backgroundColor: typeInfo.color,
            boxShadow: `0 0 5px ${typeInfo.color}44`,
          }}
        />
        <span className="cp-tl-time">{formatShortTime(node.capturedAt)}</span>
      </div>

      {/* Right column: rich card body */}
      <div className="cp-tl-body">
        <div className="cp-tl-type-row">
          {/* Type badge pill */}
          <span
            className="cp-tl-type-badge"
            style={{
              color: typeInfo.color,
              borderColor: `${typeInfo.color}40`,
            }}
          >
            {typeInfo.label}
          </span>

          {node.edgeCount > 0 && (
            <span className="cp-tl-connection-count" title={`${node.edgeCount} connections`}>
              {node.edgeCount} {node.edgeCount === 1 ? 'CONNECTION' : 'CONNECTIONS'}
            </span>
          )}
        </div>

        {/* Title: clickable, opens ObjectDrawer */}
        <div
          className="cp-tl-title"
          role="button"
          tabIndex={0}
          onClick={() => onOpenDrawer(node.objectSlug)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onOpenDrawer(node.objectSlug);
          }}
        >
          {node.title}
        </div>

        {/* Full body text, not truncated */}
        {node.summary && <div className="cp-tl-summary">{node.summary}</div>}

        {entityChips.length > 0 && (
          <div className="cp-tl-entities" aria-label="Entity chips">
            {entityChips.map((entity) => (
              <span
                key={`${node.id}-${entity.toLowerCase()}`}
                className="cp-tl-entity-chip"
              >
                {entity}
              </span>
            ))}
          </div>
        )}

        {/* Connections: 2-col grid of connection pills */}
        {node.edgeCount > 0 && (
          <div className="cp-tl-connections">
            <div className="cp-tl-section-label">CONNECTIONS ({node.edgeCount})</div>
            <div className="cp-tl-connections-grid">
              {node.edges.map((edge) => (
                <ConnectionPill
                  key={edge.id}
                  edge={edge}
                  node={node}
                  allNodes={allNodes}
                  onOpenDrawer={onOpenDrawer}
                />
              ))}
            </div>
          </div>
        )}

        {contextualRetro && (
          <RetroNote
            trigger={contextualRetro.trigger}
            prompt={contextualRetro.prompt}
            relatedNodes={contextualRetro.relatedNodes}
            dismissKey={contextualRetro.dismissKey}
            adjacentNodeId={node.id}
            onSubmit={(text) => {
              void postRetrospective(String(node.id), text);
            }}
          />
        )}

        {/* Retrospective notes */}
        <div className="cp-tl-retro">
          {retroSaved && <div className="cp-tl-retro-text">{retroSaved}</div>}

          {retroOpen ? (
            <div className="cp-tl-retro-form">
              <textarea
                className="cp-tl-retro-textarea"
                value={retroText}
                onChange={(e) => setRetroText(e.target.value)}
                placeholder="Retrospective note..."
                rows={2}
                autoFocus
              />
              <div className="cp-tl-retro-actions">
                <button
                  type="button"
                  className="cp-tl-retro-save"
                  onClick={handleSaveRetro}
                  disabled={saving || !retroText.trim()}
                >
                  {saving ? 'Saving' : 'Save'}
                </button>
                <button
                  type="button"
                  className="cp-tl-retro-cancel"
                  onClick={() => {
                    setRetroOpen(false);
                    setRetroText('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="cp-tl-retro-add"
              onClick={() => setRetroOpen(true)}
            >
              + Add note
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   TimelineView (main export)
   ───────────────────────────────────────────────── */

export default function TimelineView() {
  const [filters, setFilters] = useState<TimelineFilters>({
    query: '',
    activeTypes: new Set<string>(),
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const { captureVersion, openDrawer } = useCommonPlace();

  const { data: feed, loading, error, refetch } = useApiData(fetchFeed, [captureVersion]);

  // Full unfiltered node list kept for connection lookups within ConnectionPill
  const allNodes: MockNode[] = feed ?? [];

  // Apply search text and type filters
  const filteredNodes = useMemo<MockNode[]>(() => {
    let nodes = allNodes;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.summary?.toLowerCase().includes(q) ?? false),
      );
    }
    if (filters.activeTypes.size > 0) {
      nodes = nodes.filter((n) => filters.activeTypes.has(n.objectType));
    }
    return nodes;
  }, [allNodes, filters]);

  // Group filtered nodes by calendar date for the date-section layout
  const dateGroups = useMemo(() => groupNodesByDate(filteredNodes), [filteredNodes]);

  // GSAP ScrollTrigger: fade + rise each card as it enters the scroll container.
  // Dynamic import keeps GSAP out of the SSR bundle (window access on import).
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || dateGroups.length === 0) return;

    // Honor prefers-reduced-motion: show cards immediately, skip animations
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Guard against the effect re-running before the previous Promise resolves
    let killed = false;
    const triggers: { kill: () => void }[] = [];

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (killed) return;

        gsap.registerPlugin(ScrollTrigger);

        const cards = Array.from(
          container.querySelectorAll<HTMLElement>('.cp-timeline-card'),
        );

        cards.forEach((card) => {
          gsap.set(card, { opacity: 0, y: 16 });

          const trigger = ScrollTrigger.create({
            trigger: card,
            scroller: container,
            start: 'top 92%',
            onEnter: () => {
              gsap.to(card, { opacity: 1, y: 0, duration: 0.42, ease: 'power2.out' });
            },
          });

          triggers.push(trigger);
        });
      },
    );

    return () => {
      killed = true;
      triggers.forEach((t) => t.kill());
    };
  }, [dateGroups]);

  /* Loading */
  if (loading) {
    return (
      <div className="cp-timeline-root">
        <div className="cp-loading-state">
          <div className="cp-loading-spinner" aria-label="Loading timeline" />
        </div>
      </div>
    );
  }

  /* Error */
  if (error) {
    return (
      <div className="cp-timeline-root">
        <div className="cp-error-banner">
          <span>Failed to load timeline.</span>
          <button type="button" onClick={refetch} className="cp-error-retry">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-timeline-root">
      <TimelineSearch
        filters={filters}
        onChange={setFilters}
        resultCount={filteredNodes.length}
      />

      <div ref={scrollRef} className="cp-timeline-scroll">
        {dateGroups.length === 0 ? (
          <div className="cp-empty-state">
            <p>No objects match the current filters.</p>
          </div>
        ) : (
          dateGroups.map((group) => (
            <div key={group.dateKey} className="cp-tl-date-group">
              {/* Date header row: gutter spacer + date label */}
              <div className="cp-tl-date-row">
                <div className="cp-tl-gutter-spacer" aria-hidden="true">
                  <div className="cp-tl-rail" />
                </div>
                <div className="cp-tl-date-label-text">
                  {group.dateLabel}
                </div>
              </div>

              {/* Rich cards for this date */}
              {group.nodes.map((node) => (
                <TimelineCard
                  key={`node-${node.id}`}
                  node={node}
                  allNodes={allNodes}
                  onOpenDrawer={openDrawer}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

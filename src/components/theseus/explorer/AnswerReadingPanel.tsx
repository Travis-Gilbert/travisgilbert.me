'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { TheseusResponse, EvidenceNode, NarrativeSection, StructuredVisualRegion } from '@/lib/theseus-types';
import type { StageEvent } from '@/lib/theseus-api';
import Markdown from './Markdown';
import ConfidenceBar from './ConfidenceBar';
import ObjectInspectorTabs from './ObjectInspectorTabs';

/**
 * Build the Code Explorer deep link target from a response.
 * Extracts the entity from answer_classification when available,
 * otherwise returns the bare /theseus/code route.
 */
function buildCodeExplorerHref(response: TheseusResponse): string {
  const entity = response.answer_classification?.extracted_entity;
  if (entity) {
    return `/theseus/code?symbol=${encodeURIComponent(entity)}`;
  }
  return '/theseus/code';
}

interface AnswerReadingPanelProps {
  response: TheseusResponse;
  drilldownId: string | null;
  onDrilldown: (id: string) => void;
  onBack: () => void;
  /** Stage event from the current ask run; used by the Why tab. */
  retrievalData?: StageEvent | null;
}

function extractSources(response: TheseusResponse): EvidenceNode[] {
  const seen = new Set<string>();
  const sources: EvidenceNode[] = [];

  for (const section of response.sections) {
    if (section.type !== 'evidence_path') continue;
    for (const node of section.nodes) {
      if (seen.has(node.object_id)) continue;
      if (node.epistemic_role === 'substantive' || node.epistemic_role === 'contextual') {
        seen.add(node.object_id);
        sources.push(node);
      }
    }
  }

  // Web evidence arrives in TWO places in the response:
  //   1. `web_evidence` sections (emitted by run_ask_pipeline for the
  //      compose_engine path)
  //   2. Objects in the `objects` section with metadata.web_source=true
  //      and synthetic ids like "web-0" (emitted by run_ask_pipeline
  //      for the v2 async path via ask_async_task)
  //
  // Pull from BOTH so web results surface regardless of which backend
  // path produced the response. SourceItem detects web items via
  // epistemic_role='web' and renders the WEB badge + hostname.

  // Path 1: web_evidence sections
  let webIdx = 0;
  for (const section of response.sections) {
    if (section.type !== 'web_evidence') continue;
    const syntheticId = `web-section-${webIdx++}`;
    if (seen.has(syntheticId)) continue;
    seen.add(syntheticId);
    sources.push({
      object_id: syntheticId,
      title: section.title || section.url || 'Web result',
      epistemic_role: 'web',
      gradual_strength: section.relevance ?? 0.5,
      object_type: 'source',
      object_type_color: '#2D5F6B',
      slug: syntheticId,
      body_preview: section.snippet,
      edge_count: 0,
      metadata: {
        url: section.url,
        snippet: section.snippet,
        web_source: true,
        stance_vs_graph: section.stance_vs_graph,
      },
    } as unknown as EvidenceNode);
  }

  // Path 2: objects section items with metadata.web_source
  for (const section of response.sections) {
    if (section.type !== 'objects') continue;
    for (const obj of section.objects) {
      const meta = obj.metadata as Record<string, unknown> | undefined;
      if (!meta?.web_source) continue;
      const objId = String(obj.id);
      if (seen.has(objId)) continue;
      seen.add(objId);
      sources.push({
        object_id: objId,
        title: obj.title || 'Web result',
        epistemic_role: 'web',
        gradual_strength: obj.score ?? 0.5,
        object_type: 'source',
        object_type_color: '#2D5F6B',
        slug: objId,
        body_preview: obj.summary,
        edge_count: 0,
        metadata: {
          url: meta.url as string | undefined,
          snippet: obj.summary,
          web_source: true,
        },
      } as unknown as EvidenceNode);
    }
  }

  return sources.sort((a, b) => b.gradual_strength - a.gradual_strength);
}

function getNarrativeText(response: TheseusResponse): string {
  return response.sections
    .filter((s): s is NarrativeSection => s.type === 'narrative')
    .map((s) => s.content)
    .join('\n\n');
}

function getSourceCount(response: TheseusResponse): number {
  return response.sections.filter((s) => s.type === 'evidence_path').length;
}

function findDrilldownNode(
  response: TheseusResponse,
  nodeId: string,
): EvidenceNode | undefined {
  for (const section of response.sections) {
    if (section.type !== 'evidence_path') continue;
    const found = section.nodes.find((n) => n.object_id === nodeId);
    if (found) return found;
  }
  return undefined;
}

function SourceItem({
  node,
  onClick,
}: {
  node: EvidenceNode;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isWeb = node.epistemic_role === 'web';
  const url = isWeb ? (node.metadata?.url as string | undefined) : undefined;
  const hostname = url
    ? (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })()
    : undefined;

  const handleClick = () => {
    if (isWeb && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    onClick();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 6,
        cursor: 'pointer',
        background: hovered ? 'var(--vie-panel-card)' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      {/* Relevance dot. Web sources get a distinct hue. */}
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          marginTop: 6,
          background: isWeb ? 'var(--vie-amber, #c49a4a)' : 'var(--vie-teal-ink)',
          opacity: node.gradual_strength,
          flexShrink: 0,
        }}
      />

      {/* Title and role */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: 'var(--vie-ink-2)', lineHeight: 1.4 }}>
          {node.title}
        </div>
        {isWeb && hostname && (
          <div
            style={{
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 10,
              color: 'var(--vie-ink-4)',
              marginTop: 2,
              opacity: 0.9,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {hostname}
          </div>
        )}
        {!isWeb && node.epistemic_role && (
          <div
            style={{
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 10,
              color: 'var(--vie-ink-4)',
              marginTop: 2,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {node.epistemic_role}
          </div>
        )}
      </div>

      {/* WEB badge for web sources, relevance percentage otherwise */}
      {isWeb ? (
        <span
          style={{
            fontFamily: 'var(--vie-font-mono)',
            fontSize: 9,
            color: 'var(--vie-amber, #c49a4a)',
            border: '1px solid var(--vie-amber, #c49a4a)',
            borderRadius: 3,
            padding: '1px 5px',
            marginTop: 2,
            flexShrink: 0,
            letterSpacing: '0.05em',
          }}
        >
          WEB
        </span>
      ) : (
        <span
          style={{
            fontFamily: 'var(--vie-font-mono)',
            fontSize: 10,
            color: 'var(--vie-ink-4)',
            marginTop: 2,
            flexShrink: 0,
          }}
        >
          {Math.round(node.gradual_strength * 100)}%
        </span>
      )}
    </div>
  );
}

export default function AnswerReadingPanel({
  response,
  drilldownId,
  onDrilldown,
  onBack,
  retrievalData,
}: AnswerReadingPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [displayed, setDisplayed] = useState<string | null>(drilldownId);

  // Crossfade transition on drilldown change
  useEffect(() => {
    if (drilldownId !== displayed) {
      setFadingOut(true);
      const timer = setTimeout(() => {
        setDisplayed(drilldownId);
        setFadingOut(false);
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [drilldownId, displayed]);

  const allSources = extractSources(response);
  const drilldownNode = displayed ? findDrilldownNode(response, displayed) : null;

  // Resolve drilldown via structured_visual regions if available
  const drilldownRegion: StructuredVisualRegion | undefined = displayed
    ? response.structured_visual?.regions?.find((r) => r.id === displayed)
    : undefined;

  // Use region title/label as drilldown title when available
  const drilldownTitle = drilldownRegion?.label ?? drilldownNode?.title;
  const isDrilldownActive = drilldownNode !== null || drilldownRegion !== undefined;

  // Filter sources: by region's linked_evidence, by node match, or show all
  const visibleSources = (() => {
    if (drilldownRegion?.linked_evidence) {
      const linkedSet = new Set(drilldownRegion.linked_evidence);
      return allSources.filter((s) => linkedSet.has(s.object_id));
    }
    if (drilldownNode) {
      return allSources.filter((s) => s.object_id === drilldownNode.object_id);
    }
    return allSources;
  })();

  const narrativeText = getNarrativeText(response);
  const sourceCount = getSourceCount(response);
  const confidenceValue = Math.round(response.confidence.combined * 100);

  return (
    <div
      ref={scrollRef}
      data-interactive
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'var(--vie-panel-bg)',
        borderLeft: '1px solid var(--vie-panel-border)',
      }}
    >
      <div
        style={{
          maxWidth: 540,
          width: '100%',
          margin: '0 auto',
          padding: '36px 32px 48px',
          flex: 1,
          opacity: fadingOut ? 0 : 1,
          transform: fadingOut ? 'translateY(6px)' : 'translateY(0)',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
        }}
      >
        {/* Back button (drilldown active) */}
        {isDrilldownActive && (
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--vie-ink-3)',
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 10.5,
              cursor: 'pointer',
              padding: 0,
              marginBottom: 22,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--vie-ink-1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--vie-ink-3)';
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>&larr;</span>
            Back to synthesis
          </button>
        )}

        {/* Query title */}
        <h1
          style={{
            fontFamily: 'var(--vie-font-title)',
            fontSize: isDrilldownActive ? 24 : 22,
            fontWeight: 400,
            color: 'var(--vie-ink-1)',
            marginBottom: 18,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          {isDrilldownActive ? drilldownTitle : response.query}
        </h1>

        {/* Metadata bar (synthesis view only) */}
        {!isDrilldownActive && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 24,
              paddingBottom: 18,
              borderBottom: '1px solid var(--vie-panel-border)',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--vie-font-mono)',
                fontSize: 10.5,
                color: 'var(--vie-teal-ink)',
                letterSpacing: '0.03em',
              }}
            >
              {response.metadata.objects_searched} nodes
            </span>
            <span
              style={{
                fontFamily: 'var(--vie-font-mono)',
                fontSize: 10.5,
                color: 'var(--vie-ink-3)',
              }}
            >
              {sourceCount} sources
            </span>
            {response.answer_type === 'code' && (
              <Link
                href={buildCodeExplorerHref(response)}
                style={{
                  fontFamily: 'var(--vie-font-mono)',
                  fontSize: 10.5,
                  color: 'var(--vie-teal-ink)',
                  letterSpacing: '0.03em',
                  textDecoration: 'none',
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--vie-teal-ink)',
                  textTransform: 'uppercase',
                }}
              >
                View in Code Explorer
              </Link>
            )}
            <div style={{ flex: 1 }} />
            <ConfidenceBar value={confidenceValue} />
          </div>
        )}

        {/* Synthesis / Drilldown body. In drilldown mode with a real
            object_id (not a synthetic web-N / region id), render the
            five-tab object inspector (overview/evidence/tensions/claims/why)
            so the previously-separate dark ContextPanel is absorbed into
            this light reading panel. */}
        {isDrilldownActive && displayed && !displayed.startsWith('web-') && !drilldownRegion ? (
          <ObjectInspectorTabs
            nodeId={displayed}
            retrievalData={retrievalData}
            onSelectNode={onDrilldown}
          />
        ) : (
          <div
            style={{
              fontFamily: 'var(--vie-font-body)',
              fontSize: 15,
              color: 'var(--vie-ink-2)',
              lineHeight: 1.82,
            }}
          >
            <Markdown
              text={
                isDrilldownActive && drilldownNode
                  ? drilldownNode.claims.join('\n\n')
                  : narrativeText
              }
            />
          </div>
        )}

        {/* Sources list */}
        <div style={{ marginTop: 44 }}>
          <div
            style={{
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 10.5,
              color: 'var(--vie-ink-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 10,
              fontWeight: 400,
            }}
          >
            Sources
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {visibleSources.map((source) => (
              <SourceItem
                key={source.object_id}
                node={source}
                onClick={() => onDrilldown(source.object_id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { TheseusResponse, EvidenceNode, NarrativeSection, StructuredVisualRegion } from '@/lib/theseus-types';
import Markdown from './Markdown';
import ConfidenceBar from './ConfidenceBar';

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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
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
      {/* Relevance dot */}
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          marginTop: 6,
          background: 'var(--vie-teal-ink)',
          opacity: node.gradual_strength,
          flexShrink: 0,
        }}
      />

      {/* Title and role */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: 'var(--vie-ink-2)', lineHeight: 1.4 }}>
          {node.title}
        </div>
        {node.epistemic_role && (
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

      {/* Relevance percentage */}
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
    </div>
  );
}

export default function AnswerReadingPanel({
  response,
  drilldownId,
  onDrilldown,
  onBack,
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

        {/* Synthesis / Drilldown body */}
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

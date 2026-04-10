'use client';

import Link from 'next/link';
import type { EvidenceNode, EvidenceEdge, TheseusObject } from '@/lib/theseus-types';

interface EvidencePreviewProps {
  type: 'evidence';
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  query?: string;
  objects?: never;
}

interface ObjectsPreviewProps {
  type: 'objects';
  objects: TheseusObject[];
  query?: string;
  nodes?: never;
  edges?: never;
}

type VisualPreviewCardProps = EvidencePreviewProps | ObjectsPreviewProps;

/**
 * Build an Explorer URL with scene params so the Explorer can
 * pre-highlight the referenced nodes when arriving from chat.
 */
function buildExplorerHref(opts: {
  query?: string;
  objectIds?: string[];
  highlight?: 'reasoning' | 'none';
}): string {
  const params = new URLSearchParams();
  if (opts.query) params.set('q', opts.query);
  if (opts.objectIds && opts.objectIds.length > 0) {
    params.set('focus', opts.objectIds.slice(0, 20).join(','));
  }
  if (opts.highlight && opts.highlight !== 'none') {
    params.set('highlight', opts.highlight);
  }
  const qs = params.toString();
  return qs ? `/theseus/explorer?${qs}` : '/theseus/explorer';
}

/** Map object type to VIE color token */
function typeColor(objectType: string): string {
  switch (objectType) {
    case 'source': return 'var(--vie-type-source)';
    case 'concept': return 'var(--vie-type-concept)';
    case 'person': return 'var(--vie-type-person)';
    case 'hunch': return 'var(--vie-type-hunch)';
    default: return 'var(--vie-type-note)';
  }
}

function EvidencePreview({ nodes, edges, query }: { nodes: EvidenceNode[]; edges: EvidenceEdge[]; query?: string }) {
  const supportCount = edges.filter((e) => e.relation === 'supports').length;
  const contradictCount = edges.filter((e) => e.relation === 'contradicts').length;
  const totalStrength = nodes.reduce((sum, n) => sum + n.gradual_strength, 0);
  const avgStrength = nodes.length > 0 ? totalStrength / nodes.length : 0;

  const explorerHref = buildExplorerHref({
    query,
    objectIds: nodes.map((n) => n.object_id),
    highlight: 'reasoning',
  });

  return (
    <Link href={explorerHref} className="theseus-preview-card" data-type="evidence">
      {/* Mini node display */}
      <div className="theseus-preview-nodes">
        {nodes.slice(0, 6).map((node) => (
          <span
            key={node.object_id}
            className="theseus-preview-node"
            style={{ borderColor: typeColor(node.object_type) }}
            title={node.title}
          >
            {node.title.slice(0, 2).toUpperCase()}
          </span>
        ))}
        {nodes.length > 6 && (
          <span className="theseus-preview-node theseus-preview-node-more">
            +{nodes.length - 6}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="theseus-preview-stats">
        <span>{nodes.length} nodes</span>
        <span>{edges.length} edges</span>
        {supportCount > 0 && <span className="theseus-preview-support">{supportCount} supporting</span>}
        {contradictCount > 0 && <span className="theseus-preview-contradict">{contradictCount} contradicting</span>}
      </div>

      {/* Strength bar */}
      <div className="theseus-preview-bar">
        <div
          className="theseus-preview-bar-fill"
          style={{ width: `${Math.round(avgStrength * 100)}%` }}
        />
      </div>

      <span className="theseus-preview-explore">Explore in graph</span>
    </Link>
  );
}

function ObjectsPreview({ objects, query }: { objects: TheseusObject[]; query?: string }) {
  const explorerHref = buildExplorerHref({
    query,
    objectIds: objects.map((o) => o.id),
  });

  // Group by type
  const typeCounts = new Map<string, number>();
  for (const obj of objects) {
    const t = obj.object_type ?? 'note';
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }

  return (
    <Link href={explorerHref} className="theseus-preview-card" data-type="objects">
      <div className="theseus-preview-type-chips">
        {[...typeCounts.entries()].map(([type, count]) => (
          <span
            key={type}
            className="theseus-preview-type-chip"
            style={{ borderColor: typeColor(type) }}
          >
            {count} {type}{count > 1 ? 's' : ''}
          </span>
        ))}
      </div>

      {/* Top object titles */}
      <div className="theseus-preview-titles">
        {objects.slice(0, 4).map((obj) => (
          <span key={obj.id} className="theseus-preview-title-item">
            {obj.title}
          </span>
        ))}
        {objects.length > 4 && (
          <span className="theseus-preview-title-more">
            and {objects.length - 4} more
          </span>
        )}
      </div>

      <span className="theseus-preview-explore">Explore in graph</span>
    </Link>
  );
}

export default function VisualPreviewCard(props: VisualPreviewCardProps) {
  if (props.type === 'evidence') {
    return <EvidencePreview nodes={props.nodes} edges={props.edges} query={props.query} />;
  }
  return <ObjectsPreview objects={props.objects} query={props.query} />;
}

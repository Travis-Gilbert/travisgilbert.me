'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { Editor } from '@tiptap/react';
import type { StudioContentItem } from '@/lib/studio';
import type { ResearchTrailSource, MentionBacklink } from '@/lib/studio-api';

/* ── Node / Link types ────────────────────── */

interface MapNode {
  id: string;
  label: string;
  kind: 'self' | 'essay' | 'field-note' | 'source' | 'mention' | 'wiki';
  stage?: string;
}

interface MapLink {
  source: string;
  target: string;
  kind: 'mention' | 'wiki' | 'source' | 'tag';
}

/* ── Node shapes and colors by kind ──────── */

const KIND_COLORS: Record<string, string> = {
  self: '#B45A2D',
  essay: '#B45A2D',
  'field-note': '#2D5F6B',
  source: '#3A8A9A',
  mention: '#8A6A9A',
  wiki: '#C49A4A',
};

const EDGE_DASH: Record<string, string> = {
  mention: 'none',
  wiki: '4 2',
  source: '2 2',
  tag: '1 3',
};

/* ── Force simulation (synchronous 200 iterations) ──── */

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  mapNode: MapNode;
}

function runLayout(
  nodes: MapNode[],
  links: MapLink[],
  width: number,
  height: number,
): { simNodes: SimNode[]; simLinks: d3.SimulationLinkDatum<SimNode>[] } {
  if (nodes.length === 0) return { simNodes: [], simLinks: [] };

  const simNodes: SimNode[] = nodes.map((n) => ({ id: n.id, mapNode: n }));
  const simLinks: d3.SimulationLinkDatum<SimNode>[] = links.map((l) => ({
    source: l.source,
    target: l.target,
  }));

  const sim = d3
    .forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      d3
        .forceLink<SimNode, d3.SimulationLinkDatum<SimNode>>(simLinks)
        .id((d) => d.id)
        .distance(50),
    )
    .force('charge', d3.forceManyBody().strength(-30))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide<SimNode>().radius(14))
    .stop();

  for (let i = 0; i < 200; i++) sim.tick();
  return { simNodes, simLinks };
}

/* ── Component ──────────────────────────── */

interface RelationshipMapProps {
  contentItem: StudioContentItem | null;
  editor: Editor | null;
  /** Research trail sources from ResearchMode fetch */
  sources: ResearchTrailSource[];
  /** Mention backlinks from ResearchMode fetch */
  backlinks: MentionBacklink[];
  stageColor?: string;
}

/**
 * Mini D3 force graph showing connections from the current document:
 *   mentions (solid), wiki links (dashed), research sources (dotted),
 *   shared-tag items (faint dotted).
 *
 * Current document is the center node (larger, stage-colored).
 * Click a node to navigate to its content.
 */
export default function RelationshipMap({
  contentItem,
  editor,
  sources,
  backlinks,
  stageColor,
}: RelationshipMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 300, height: 260 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  /* Observe container size */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Extract wiki-link titles from editor content */
  const wikiTitles = useMemo(() => {
    if (!editor) return [] as string[];
    const text = editor.getText();
    const matches = text.match(/\[\[([^\]]+)\]\]/g);
    if (!matches) return [] as string[];
    return [...new Set(matches.map((m) => m.slice(2, -2)))];
  }, [editor]);

  /* Build graph data */
  const { nodes, links } = useMemo(() => {
    if (!contentItem) return { nodes: [] as MapNode[], links: [] as MapLink[] };

    const nodeMap = new Map<string, MapNode>();
    const linkArr: MapLink[] = [];

    /* Center node: current document */
    const selfId = `self:${contentItem.slug}`;
    nodeMap.set(selfId, {
      id: selfId,
      label: contentItem.title || 'Untitled',
      kind: 'self',
      stage: contentItem.stage,
    });

    /* Mention backlinks */
    for (const bl of backlinks) {
      const nid = `mention:${bl.sourceSlug}`;
      if (!nodeMap.has(nid)) {
        nodeMap.set(nid, {
          id: nid,
          label: bl.sourceTitle,
          kind: bl.sourceType === 'field-note' ? 'field-note' : 'essay',
        });
      }
      linkArr.push({ source: nid, target: selfId, kind: 'mention' });
    }

    /* Wiki links */
    for (const title of wikiTitles) {
      const nid = `wiki:${title.toLowerCase()}`;
      if (!nodeMap.has(nid)) {
        nodeMap.set(nid, { id: nid, label: title, kind: 'wiki' });
      }
      linkArr.push({ source: selfId, target: nid, kind: 'wiki' });
    }

    /* Research sources (first 12 max to avoid crowding) */
    for (const src of sources.slice(0, 12)) {
      const nid = `source:${src.id}`;
      if (!nodeMap.has(nid)) {
        nodeMap.set(nid, {
          id: nid,
          label: src.title.length > 30 ? src.title.slice(0, 28) + '...' : src.title,
          kind: 'source',
        });
      }
      linkArr.push({ source: selfId, target: nid, kind: 'source' });
    }

    return { nodes: Array.from(nodeMap.values()), links: linkArr };
  }, [contentItem, backlinks, wikiTitles, sources]);

  /* Run force layout */
  const { simNodes, simLinks } = useMemo(
    () => runLayout(nodes, links, size.width, size.height),
    [nodes, links, size.width, size.height],
  );

  /* Handle node click: navigate to related content */
  const handleNodeClick = useCallback((node: MapNode) => {
    if (node.kind === 'self') return;
    if (node.kind === 'essay' || node.kind === 'field-note' || node.kind === 'mention') {
      const slug = node.id.replace(/^mention:/, '');
      const ct = node.kind === 'field-note' ? 'field-notes' : 'essays';
      window.open(`/studio/${ct}/${slug}`, '_blank');
    }
    if (node.kind === 'wiki') {
      const title = node.id.replace(/^wiki:/, '');
      window.open(`/commonplace?q=${encodeURIComponent(title)}`, '_blank');
    }
    if (node.kind === 'source') {
      /* Source cards don't have a dedicated route; no-op */
    }
  }, []);

  const selfColor = stageColor ?? '#B45A2D';

  if (!contentItem || nodes.length <= 1) {
    return (
      <div className="relationship-map-empty">
        <p>No connections found yet.</p>
        <p>
          Add @mentions, [[wiki links]], or research sources
          to see your content graph.
        </p>
      </div>
    );
  }

  return (
    <div className="relationship-map" ref={containerRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size.width} ${size.height}`}
        width={size.width}
        height={size.height}
      >
        {/* Edges */}
        {simLinks.map((link, i) => {
          const src = link.source as SimNode;
          const tgt = link.target as SimNode;
          const origLink = links[i];
          const color = KIND_COLORS[origLink?.kind ?? 'mention'] ?? '#9A8E82';
          const dash = EDGE_DASH[origLink?.kind ?? 'mention'] ?? 'none';

          return (
            <line
              key={`edge-${i}`}
              x1={src.x ?? 0}
              y1={src.y ?? 0}
              x2={tgt.x ?? 0}
              y2={tgt.y ?? 0}
              stroke={color}
              strokeOpacity={0.25}
              strokeWidth={1}
              strokeDasharray={dash}
            />
          );
        })}

        {/* Nodes */}
        {simNodes.map((sn) => {
          const n = sn.mapNode;
          const isSelf = n.kind === 'self';
          const isHovered = hoveredId === n.id;
          const r = isSelf ? 10 : 6;
          const fill = isSelf ? selfColor : KIND_COLORS[n.kind] ?? '#9A8E82';

          return (
            <g
              key={n.id}
              transform={`translate(${sn.x ?? 0}, ${sn.y ?? 0})`}
              style={{ cursor: n.kind !== 'self' ? 'pointer' : 'default' }}
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleNodeClick(n)}
            >
              {/* Node shape */}
              {n.kind === 'source' ? (
                /* Diamond for sources */
                <rect
                  x={-5}
                  y={-5}
                  width={10}
                  height={10}
                  fill={fill}
                  fillOpacity={isHovered ? 0.9 : 0.7}
                  transform="rotate(45)"
                  rx={1}
                />
              ) : n.kind === 'wiki' ? (
                /* Square for wiki links */
                <rect
                  x={-5}
                  y={-5}
                  width={10}
                  height={10}
                  fill={fill}
                  fillOpacity={isHovered ? 0.9 : 0.7}
                  rx={2}
                />
              ) : (
                /* Circle for self, essays, field notes, mentions */
                <circle
                  r={r}
                  fill={fill}
                  fillOpacity={isHovered || isSelf ? 0.9 : 0.65}
                  stroke={isSelf ? fill : 'none'}
                  strokeWidth={isSelf ? 2 : 0}
                  strokeOpacity={0.3}
                />
              )}

              {/* Label on hover or always for self */}
              {(isHovered || isSelf) && (
                <text
                  y={isSelf ? r + 12 : -10}
                  textAnchor="middle"
                  className="relationship-map-label"
                  style={{ fill: 'rgba(237, 231, 220, 0.85)' }}
                >
                  {n.label.length > 24 ? n.label.slice(0, 22) + '...' : n.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="relationship-map-legend">
        <span className="relationship-map-legend-item">
          <span className="relationship-map-legend-dot" style={{ background: KIND_COLORS.mention }} />
          mentions
        </span>
        <span className="relationship-map-legend-item">
          <span className="relationship-map-legend-dot relationship-map-legend-dot--square" style={{ background: KIND_COLORS.wiki }} />
          wiki
        </span>
        <span className="relationship-map-legend-item">
          <span className="relationship-map-legend-dot relationship-map-legend-dot--diamond" style={{ background: KIND_COLORS.source }} />
          sources
        </span>
      </div>
    </div>
  );
}

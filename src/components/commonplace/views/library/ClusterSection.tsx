'use client';

import { useState, useMemo } from 'react';
import * as d3 from 'd3';
import { getObjectTypeIdentity, type ClusterResponse, type GraphLink, type GraphNode } from '@/lib/commonplace';
import { hexToRgb } from './library-data';

/* Types are co-located with ClusterForceTree below */

/* ─────────────────────────────────────────────────
   ClusterSection (grid of cluster cards)
   ───────────────────────────────────────────────── */

interface ClusterSectionProps {
  clusters?: ClusterResponse[];
  graphData?: { nodes: GraphNode[]; links: GraphLink[] } | null;
  /** Map from object ID to its type slug, built from graph nodes */
  objectTypeMap?: Map<number, string>;
  onOpenObject?: (id: number) => void;
}

export default function ClusterSection({
  clusters,
  graphData,
  objectTypeMap,
  onOpenObject,
}: ClusterSectionProps) {
  if (!clusters || clusters.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.7px',
          textTransform: 'uppercase' as const,
          color: 'rgba(26, 24, 22, 0.28)',
        }}>
          Clusters
        </span>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 400,
          letterSpacing: '0.7px',
          textTransform: 'uppercase' as const,
          color: 'rgba(26, 24, 22, 0.18)',
        }}>
          Natural groups from shared connections
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        {clusters.map((cluster) => (
          <ClusterCard
            key={`${cluster.type}:${cluster.label}`}
            cluster={cluster}
            graphData={graphData}
            objectTypeMap={objectTypeMap}
            onOpenObject={onOpenObject}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Individual cluster card with force tree
   ───────────────────────────────────────────────── */

function ClusterCard({
  cluster,
  graphData,
  objectTypeMap,
  onOpenObject,
}: {
  cluster: ClusterResponse;
  graphData?: { nodes: GraphNode[]; links: GraphLink[] } | null;
  objectTypeMap?: Map<number, string>;
  onOpenObject?: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const color = cluster.color || getObjectTypeIdentity(cluster.type).color;
  const rgb = hexToRgb(color);

  // Extract edges for this cluster from graph data
  const clusterEdges = useMemo(() => {
    if (!graphData?.links) return [];
    const memberIds = new Set(cluster.members.map((m) => m.id));

    return graphData.links
      .map((link) => {
        const sourceId =
          typeof link.source === 'string'
            ? parseInt(link.source.replace('object:', ''), 10)
            : (link.source as { objectRef?: number }).objectRef ?? 0;
        const targetId =
          typeof link.target === 'string'
            ? parseInt(link.target.replace('object:', ''), 10)
            : (link.target as { objectRef?: number }).objectRef ?? 0;
        return { from: sourceId, to: targetId };
      })
      .filter((e) => memberIds.has(e.from) && memberIds.has(e.to));
  }, [graphData, cluster.members]);

  // Determine if we have enough data for a force tree
  const hasForceTree = cluster.members.length >= 3 && clusterEdges.length > 0;

  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      style={{
        all: 'unset',
        cursor: 'pointer',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 10,
        overflow: 'hidden',
        background: `rgba(${rgb},0.02)`,
        border: `1px solid rgba(${rgb},0.08)`,
        transition: 'background 200ms ease, border-color 200ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `rgba(${rgb},0.04)`;
        e.currentTarget.style.borderColor = `rgba(${rgb},0.14)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `rgba(${rgb},0.02)`;
        e.currentTarget.style.borderColor = `rgba(${rgb},0.08)`;
      }}
    >
      {/* Force tree or type dot fallback */}
      <div
        style={{
          background: `linear-gradient(180deg, rgba(${rgb},0.03) 0%, transparent 100%)`,
          display: 'flex',
          justifyContent: 'center',
          padding: '12px 12px 4px',
        }}
      >
        {hasForceTree ? (
          <ClusterForceTree
            members={cluster.members}
            edges={clusterEdges}
            color={color}
          />
        ) : (
          <TypeDotComposition cluster={cluster} objectTypeMap={objectTypeMap} />
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '10px 16px 14px' }}>
        <h4
          style={{
            fontFamily: 'var(--cp-font-title)',
            fontSize: 14.5,
            fontWeight: 600,
            color: '#2A2520',
            margin: '0 0 4px',
            lineHeight: 1.3,
          }}
        >
          {cluster.label || getObjectTypeIdentity(cluster.type).label}
        </h4>
        <p
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 11.5,
            fontWeight: 300,
            color: '#6A6560',
            margin: '0 0 8px',
            lineHeight: 1.45,
          }}
        >
          {buildClusterDescription(cluster)}
        </p>

        {/* Stats + type dots */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9.5,
            color: '#8A8279',
          }}
        >
          <span>{cluster.members.length} objects</span>
          <span className="cp-meta-sep" style={{ background: 'rgba(0,0,0,0.1)' }} />
          <span>{clusterEdges.length} edges</span>
          <span className="cp-meta-sep" style={{ background: 'rgba(0,0,0,0.1)' }} />
          <div style={{ display: 'flex', gap: 3 }}>
            {getMemberTypes(cluster, objectTypeMap).map((slug) => (
              <span
                key={slug}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: getObjectTypeIdentity(slug).color,
                  opacity: 0.7,
                }}
              />
            ))}
          </div>
        </div>

        {/* Expanded member list */}
        {expanded && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: `1px solid rgba(${rgb},0.1)`,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {cluster.members.map((member) => {
              const typeSlug = objectTypeMap?.get(member.id) ?? cluster.type;
              const mIdentity = getObjectTypeIdentity(typeSlug);
              return (
                <div
                  key={member.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenObject?.(member.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      onOpenObject?.(member.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: mIdentity.color,
                      opacity: 0.7,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--cp-font-body)',
                      fontSize: 11.5,
                      color: '#5C554D',
                    }}
                  >
                    {member.title}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────
   ClusterForceTree: uses the same hub/leaf/spine model
   as the main site ForceTree.tsx, adapted for thumbnails.
   Constructs synthetic sub-hubs from flat graph data by
   promoting well-connected nodes to intermediate hubs.
   ───────────────────────────────────────────────── */

const TREE_W = 320;
const TREE_H = 220;

interface FTNode extends d3.SimulationNodeDatum {
  id: number;
  isHub: boolean;
}
interface FTLink extends d3.SimulationLinkDatum<FTNode> {
  isSpine: boolean;
}

function ClusterForceTree({
  members,
  edges,
  color,
}: {
  members: ClusterResponse['members'];
  edges: Array<{ from: number; to: number }>;
  color: string;
}) {
  const layout = useMemo(() => {
    // 0. Build full adjacency first, then BFS-sample a connected subgraph.
    //    This ensures the sampled nodes are actually connected to each other,
    //    producing visible branching instead of scattered disconnected dots.
    const MAX_NODES = 25;

    const fullAdj = new Map<number, Set<number>>();
    for (const m of members) fullAdj.set(m.id, new Set());
    for (const e of edges) {
      fullAdj.get(e.from)?.add(e.to);
      fullAdj.get(e.to)?.add(e.from);
    }

    // Find root (most connected)
    const rootMem = [...members].sort((a, b) =>
      (fullAdj.get(b.id)?.size ?? 0) - (fullAdj.get(a.id)?.size ?? 0)
    )[0];
    const startId = rootMem?.id ?? members[0]?.id ?? 0;

    // BFS from root, collecting up to MAX_NODES connected members
    const collected = new Set<number>();
    const bfsQ: number[] = [startId];
    collected.add(startId);
    while (bfsQ.length > 0 && collected.size < MAX_NODES) {
      const cur = bfsQ.shift()!;
      for (const nId of (fullAdj.get(cur) ?? [])) {
        if (!collected.has(nId) && collected.size < MAX_NODES) {
          collected.add(nId);
          bfsQ.push(nId);
        }
      }
    }

    const pool = members.filter((m) => collected.has(m.id));
    const poolEdges = edges.filter((e) => collected.has(e.from) && collected.has(e.to));

    // 1. Build adjacency for sampled pool
    const adj = new Map<number, Set<number>>();
    for (const m of pool) adj.set(m.id, new Set());
    for (const e of poolEdges) {
      adj.get(e.from)?.add(e.to);
      adj.get(e.to)?.add(e.from);
    }

    // 2. Identify root and sub-hubs (degree >= 3 within the sampled pool)
    const rootId = startId;
    const HUB_THRESHOLD = 3;
    const hubIds = new Set<number>();
    hubIds.add(rootId);
    for (const m of pool) {
      if ((adj.get(m.id)?.size ?? 0) >= HUB_THRESHOLD && m.id !== rootId) {
        hubIds.add(m.id);
      }
    }
    // Ensure at least 2 hubs for branching (promote next best if only root)
    if (hubIds.size < 2 && pool.length > 3) {
      const candidates = [...pool]
        .filter((m) => m.id !== rootId)
        .sort((a, b) => b.edge_count - a.edge_count);
      for (const c of candidates.slice(0, Math.min(3, candidates.length))) {
        hubIds.add(c.id);
      }
    }

    // 3. Assign leaves to nearest hub via adjacency (or root as fallback)
    const leafToHub = new Map<number, number>();
    for (const m of pool) {
      if (hubIds.has(m.id)) continue;
      const neighbors = adj.get(m.id) ?? new Set();
      let bestHub = rootId;
      for (const nId of neighbors) {
        if (hubIds.has(nId)) { bestHub = nId; break; }
      }
      leafToHub.set(m.id, bestHub);
    }

    // 4. Build ForceTree-style nodes and links
    const nodeMap = new Map<number, number>(); // memberId -> index
    const ftNodes: FTNode[] = [];
    const ftLinks: FTLink[] = [];

    // Add hub nodes first
    for (const m of pool) {
      if (!hubIds.has(m.id)) continue;
      nodeMap.set(m.id, ftNodes.length);
      ftNodes.push({ id: m.id, isHub: true });
    }

    // Spine links: connect sub-hubs to root (or nearest hub via edges)
    for (const hubId of hubIds) {
      if (hubId === rootId) continue;
      const neighbors = adj.get(hubId) ?? new Set();
      let parentHub = rootId;
      for (const nId of neighbors) {
        if (hubIds.has(nId) && nId !== hubId) { parentHub = nId; break; }
      }
      const si = nodeMap.get(parentHub);
      const ti = nodeMap.get(hubId);
      if (si !== undefined && ti !== undefined) {
        ftLinks.push({ source: si, target: ti, isSpine: true });
      }
    }

    // Add leaf nodes + hub-to-leaf links
    for (const m of pool) {
      if (hubIds.has(m.id)) continue;
      const idx = ftNodes.length;
      nodeMap.set(m.id, idx);
      ftNodes.push({ id: m.id, isHub: false });
      const hubIdx = nodeMap.get(leafToHub.get(m.id) ?? rootId);
      if (hubIdx !== undefined) {
        ftLinks.push({ source: hubIdx, target: idx, isSpine: false });
      }
    }

    // 5. Force simulation (same model as main site ForceTree.tsx, scaled for thumbnail)
    const simulation = d3
      .forceSimulation(ftNodes)
      .force(
        'link',
        d3
          .forceLink<FTNode, FTLink>(ftLinks)
          .id((_, i) => i)
          .distance((d) => (d.isSpine ? 40 : 12))
          .strength((d) => (d.isSpine ? 0.4 : 0.9)),
      )
      .force(
        'charge',
        d3.forceManyBody<FTNode>().strength((d) => (d.isHub ? -120 : -8)),
      )
      .force('x', d3.forceX().strength(0.02))
      .force('y', d3.forceY().strength(0.02))
      .force(
        'collision',
        d3
          .forceCollide<FTNode>()
          .radius((d) => (d.isHub ? 10 : 4))
          .strength(0.8),
      )
      .stop();

    for (let i = 0; i < 350; i++) simulation.tick();

    // 6. Extract positions
    const resolvedEdges = ftLinks.map((link) => {
      const s = link.source as unknown as FTNode;
      const t = link.target as unknown as FTNode;
      return {
        sx: s.x ?? 0, sy: s.y ?? 0,
        tx: t.x ?? 0, ty: t.y ?? 0,
        isSpine: link.isSpine,
      };
    });

    return { nodes: ftNodes, edges: resolvedEdges };
  }, [members, edges]);

  // Auto-fit viewBox from bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of layout.nodes) {
    const x = n.x ?? 0, y = n.y ?? 0;
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  const pad = 16;
  const vbW = Math.max(maxX - minX + pad * 2, 60);
  const vbH = Math.max(maxY - minY + pad * 2, 40);

  return (
    <svg
      width={TREE_W}
      height={TREE_H}
      viewBox={`${minX - pad} ${minY - pad} ${vbW} ${vbH}`}
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
    >
      {/* Links: spine (hub-hub) thicker, leaf (hub-leaf) thinner */}
      {layout.edges.map((edge, i) => (
        <line
          key={i}
          x1={edge.sx} y1={edge.sy}
          x2={edge.tx} y2={edge.ty}
          stroke={color}
          strokeOpacity={edge.isSpine ? 0.15 : 0.1}
          strokeWidth={edge.isSpine ? 1.2 : 0.7}
        />
      ))}
      {/* Nodes: hubs = hollow + halo, leaves = filled */}
      {layout.nodes.map((node, i) => {
        const nx = node.x ?? 0, ny = node.y ?? 0;
        const r = node.isHub ? 5.5 : 3;
        return (
          <g key={`${node.id}-${i}`}>
            {node.isHub && (
              <circle cx={nx} cy={ny} r={r + 6}
                fill={color} fillOpacity={0.06} />
            )}
            <circle cx={nx} cy={ny} r={r}
              fill={node.isHub ? 'var(--cp-surface, #F5F0E8)' : color}
              fillOpacity={node.isHub ? 1 : 0.8}
              stroke={color}
              strokeWidth={node.isHub ? 1.8 : 0.5}
              strokeOpacity={node.isHub ? 0.9 : 0.4}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────────
   Fallback: type dot composition (no force tree)
   ───────────────────────────────────────────────── */

function TypeDotComposition({
  cluster,
  objectTypeMap,
}: {
  cluster: ClusterResponse;
  objectTypeMap?: Map<number, string>;
}) {
  const types = getMemberTypes(cluster, objectTypeMap);
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        height: 160,
      }}
    >
      {types.map((slug) => {
        const identity = getObjectTypeIdentity(slug);
        return (
          <div
            key={slug}
            className="cp-type-halo"
            style={{
              width: 24,
              height: 24,
              background: `radial-gradient(circle, ${identity.color}20 0%, transparent 70%)`,
            }}
          >
            <span
              className="cp-type-halo-dot"
              style={{ width: 8, height: 8, background: identity.color }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────── */

function getMemberTypes(
  cluster: ClusterResponse,
  objectTypeMap?: Map<number, string>,
): string[] {
  const seen = new Set<string>();
  for (const m of cluster.members) {
    const slug = objectTypeMap?.get(m.id) ?? cluster.type;
    seen.add(slug);
  }
  return Array.from(seen);
}

function buildClusterDescription(cluster: ClusterResponse): string {
  const preview = cluster.members.find((m) => m.body_preview.trim());
  if (preview?.body_preview) {
    const text = preview.body_preview;
    return text.length > 140 ? `${text.slice(0, 139).trimEnd()}\u2026` : text;
  }
  const titles = cluster.members
    .map((m) => m.title)
    .filter(Boolean)
    .slice(0, 3);
  if (titles.length === 0) return 'Objects collecting around a shared thread.';
  return `${titles.join(' \u00B7 ')}${cluster.members.length > 3 ? ' \u00B7 more' : ''}`;
}

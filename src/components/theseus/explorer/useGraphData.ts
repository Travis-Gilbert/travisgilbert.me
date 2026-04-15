'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  forceRadial,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { getGraphData } from '@/lib/theseus-api';
import type { GraphData } from '@/lib/theseus-types';

const TYPE_COLORS: Record<string, string> = {
  source: '#2D5F6B',
  concept: '#7B5EA7',
  person: '#C4503C',
  hunch: '#C49A4A',
  note: '#9a958d',
};

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stripObjectPrefix(id: string): string {
  if (id.startsWith('object:')) return id.slice(7);
  return id;
}

/** mulberry32 seeded PRNG (matches GalaxyExplainer / galaxyGenerator). */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** djb2 hash to derive a stable seed from a string ID. */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/** Visual properties for ExplorerCanvas, computed once per node at data load. */
export interface ExplorerNode {
  id: string;
  x: number;
  y: number;
  title: string;
  objectType: string;
  epistemicRole?: string;
  edgeCount: number;
  radius: number;
  brightness: number;
  pulseOffset: number;
  driftPhase: number;
  community: number;
}

export interface ExplorerEdge {
  source: string;
  target: string;
  strength: number;
  edgeType: string;
  reason: string;
}

/** Compute per-node visual properties using seeded PRNG keyed on node ID. */
function computeVisualProps(id: string, edgeCount: number, clusterId: number): Pick<ExplorerNode, 'radius' | 'brightness' | 'pulseOffset' | 'driftPhase' | 'community'> {
  const rng = mulberry32(djb2(id));
  return {
    radius: clamp(1.5, 1.5 + Math.sqrt(edgeCount) * 0.4, 6),
    brightness: 0.15 + rng() * 0.25,
    pulseOffset: rng() * Math.PI * 2,
    driftPhase: rng() * Math.PI * 2,
    community: clusterId,
  };
}

/**
 * Prune weak edges to reduce visual density.
 * Keep top N edges per node by strength, drop the rest.
 */
function pruneWeakEdges(g: Graph, maxEdgesPerNode: number) {
  const edgesToDrop: string[] = [];

  g.forEachNode((node) => {
    const edges = g.edges(node);
    if (edges.length <= maxEdgesPerNode) return;

    // Sort by strength descending, drop the weakest
    const sorted = edges
      .map((e) => ({ key: e, strength: (g.getEdgeAttribute(e, 'strength') as number) ?? 0 }))
      .sort((a, b) => b.strength - a.strength);

    for (let i = maxEdgesPerNode; i < sorted.length; i++) {
      edgesToDrop.push(sorted[i].key);
    }
  });

  const dropped = new Set(edgesToDrop);
  for (const key of dropped) {
    if (g.hasEdge(key)) g.dropEdge(key);
  }
}

/**
 * Milestone callback fired by the fetch paths so an external terminal stream
 * (see useTerminalStream / TerminalStream) can display honest status.
 * Kept to a minimal shape so the hook stays UI-agnostic.
 */
export type GraphDataMilestone =
  | { kind: 'start'; label: string; detail?: string }
  | { kind: 'loaded'; label: string; detail?: string }
  | { kind: 'done'; label: string; detail?: string }
  | { kind: 'error'; label: string; detail?: string };

export interface UseGraphDataOptions {
  onMilestone?: (event: GraphDataMilestone) => void;
}

export interface UseGraphDataReturn {
  graph: Graph;
  loading: boolean;
  graphData: GraphData | null;
  explorerNodes: ExplorerNode[];
  explorerEdges: ExplorerEdge[];
  loadNeighborhood: (centerId: string, hops?: number) => Promise<void>;
  loadTopNodes: (limit?: number) => Promise<void>;
  loadSubgraph: (nodeIds: string[]) => Promise<void>;
}

export function useGraphData(options: UseGraphDataOptions = {}): UseGraphDataReturn {
  const { onMilestone } = options;
  const milestoneRef = useRef(onMilestone);
  milestoneRef.current = onMilestone;
  const emit = useCallback((event: GraphDataMilestone) => {
    milestoneRef.current?.(event);
  }, []);
  const graphRef = useRef<Graph>(new Graph({ multi: true, type: 'undirected' }));
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  const mergeGraphData = useCallback((data: GraphData) => {
    const g = graphRef.current;

    for (const node of data.nodes) {
      const id = stripObjectPrefix(node.id);
      const color = TYPE_COLORS[node.object_type] ?? '#9a958d';
      // D3 standard: use sqrt scale for area-correct node sizing
      const size = clamp(3, 3 + Math.sqrt(node.edge_count) * 1.2, 22);

      g.mergeNode(id, {
        label: node.title,
        size,
        color,
        x: g.hasNode(id) ? g.getNodeAttribute(id, 'x') : (Math.random() - 0.5) * 500,
        y: g.hasNode(id) ? g.getNodeAttribute(id, 'y') : (Math.random() - 0.5) * 500,
        object_type: node.object_type,
        body_preview: node.body_preview,
        edge_count: node.edge_count,
        status: node.status,
        slug: node.slug,
      });
    }

    for (const edge of data.edges) {
      const source = stripObjectPrefix(edge.source);
      const target = stripObjectPrefix(edge.target);

      if (!g.hasNode(source) || !g.hasNode(target)) continue;
      // Skip self-loops
      if (source === target) continue;

      const edgeKey = edge.id || `${source}-${target}-${edge.edge_type}`;
      g.mergeEdgeWithKey(edgeKey, source, target, {
        color: 'rgba(255, 255, 255, 0.06)',
        size: clamp(0.3, edge.strength * 1.5, 2),
        edge_type: edge.edge_type,
        strength: edge.strength,
        reason: edge.reason,
      });
    }

    // Prune weak edges: keep at most 8 strongest per node to prevent hairball
    if (g.order > 30) {
      pruneWeakEdges(g, 8);
    }

    // d3-force layout: clusters by object type, respects edge connections.
    // Runs to completion (not continuously) per spec.
    if (g.order > 0) {
      const nodeCount = g.order;

      // Cluster centroids: each type gets an angular position on a ring
      const TYPE_ORDER = ['source', 'concept', 'person', 'hunch', 'note'];
      const clusterAngle = (type: string) => {
        const idx = TYPE_ORDER.indexOf(type);
        return idx >= 0
          ? (idx / TYPE_ORDER.length) * Math.PI * 2 - Math.PI / 2
          : Math.PI; // unknown types at bottom
      };
      const clusterRadius = Math.min(250, 80 + nodeCount * 1.2);

      // Build simulation nodes
      interface SimNode extends SimulationNodeDatum {
        nodeId: string;
        objectType: string;
        edgeCount: number;
      }
      const simNodes: SimNode[] = [];
      const nodeIndexMap = new Map<string, number>();
      let i = 0;
      g.forEachNode((id, attrs) => {
        const type = (attrs.object_type as string) ?? 'note';
        const angle = clusterAngle(type);
        // Initialize near cluster centroid with some jitter
        const jitter = () => (Math.random() - 0.5) * clusterRadius * 0.4;
        simNodes.push({
          nodeId: id,
          objectType: type,
          edgeCount: (attrs.edge_count as number) ?? 0,
          x: Math.cos(angle) * clusterRadius + jitter(),
          y: Math.sin(angle) * clusterRadius + jitter(),
        });
        nodeIndexMap.set(id, i++);
      });

      // Build simulation links from edges
      const simLinks: SimulationLinkDatum<SimNode>[] = [];
      g.forEachEdge((_key, attrs, source, target) => {
        const si = nodeIndexMap.get(source);
        const ti = nodeIndexMap.get(target);
        if (si !== undefined && ti !== undefined) {
          simLinks.push({
            source: si,
            target: ti,
          });
        }
      });

      // Custom cluster force: gently pull nodes toward their type centroid
      function forceCluster(alpha: number) {
        for (const node of simNodes) {
          const angle = clusterAngle(node.objectType);
          const cx = Math.cos(angle) * clusterRadius;
          const cy = Math.sin(angle) * clusterRadius;
          const strength = 0.15 * alpha;
          node.vx = (node.vx ?? 0) + (cx - (node.x ?? 0)) * strength;
          node.vy = (node.vy ?? 0) + (cy - (node.y ?? 0)) * strength;
        }
      }

      const iterations = nodeCount > 200 ? 300 : nodeCount > 50 ? 200 : 150;

      const sim = forceSimulation<SimNode>(simNodes)
        .force('link', forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks)
          .distance(40)
          .strength(0.3))
        .force('charge', forceManyBody<SimNode>()
          .strength(-30)
          .distanceMax(300))
        .force('collide', forceCollide<SimNode>()
          .radius((d) => 4 + Math.sqrt(d.edgeCount) * 0.5)
          .strength(0.7))
        .force('cluster', forceCluster)
        .force('centerX', forceX<SimNode>(0).strength(0.02))
        .force('centerY', forceY<SimNode>(0).strength(0.02))
        .stop();

      // Run to completion
      sim.tick(iterations);

      // Write positions back to graphology
      for (const sn of simNodes) {
        if (g.hasNode(sn.nodeId)) {
          g.setNodeAttribute(sn.nodeId, 'x', sn.x ?? 0);
          g.setNodeAttribute(sn.nodeId, 'y', sn.y ?? 0);
        }
      }
    }

    setGraphData(data);
  }, []);

  const loadNeighborhood = useCallback(async (centerId: string, hops = 2) => {
    setLoading(true);
    emit({ kind: 'start', label: `fetching neighborhood (${hops} hops)` });
    const result = await getGraphData({ center: centerId, hops, limit: 80 });
    if (result.ok) {
      emit({
        kind: 'loaded',
        label: 'neighborhood received',
        detail: `${result.nodes.length} nodes, ${result.edges.length} edges`,
      });
      mergeGraphData(result);
      emit({
        kind: 'done',
        label: 'graph ready',
        detail: `${result.nodes.length} nodes`,
      });
    } else {
      emit({ kind: 'error', label: 'failed to load neighborhood' });
    }
    setLoading(false);
  }, [mergeGraphData, emit]);

  const loadTopNodes = useCallback(async (limit = 30) => {
    setLoading(true);
    emit({ kind: 'start', label: `loading top ${limit} nodes` });
    const result = await getGraphData({ limit });
    if (result.ok) {
      emit({
        kind: 'loaded',
        label: 'nodes received',
        detail: `${result.nodes.length} nodes`,
      });
      mergeGraphData(result);
      emit({
        kind: 'done',
        label: 'graph ready',
        detail: `${result.nodes.length} nodes, ${result.edges.length} edges`,
      });
    } else {
      emit({ kind: 'error', label: 'failed to load nodes' });
    }
    setLoading(false);
  }, [mergeGraphData, emit]);

  const loadSubgraph = useCallback(async (nodeIds: string[]) => {
    setLoading(true);
    const batch = nodeIds.slice(0, 10);
    emit({
      kind: 'start',
      label: `loading subgraph`,
      detail: `${batch.length} centers`,
    });
    const results = await Promise.all(
      batch.map((id) => getGraphData({ center: id, hops: 1, limit: 30 })),
    );
    let totalNodes = 0;
    for (const result of results) {
      if (result.ok) {
        totalNodes += result.nodes.length;
        mergeGraphData(result);
      }
    }
    emit({
      kind: 'done',
      label: 'subgraph ready',
      detail: `${totalNodes} nodes`,
    });
    setLoading(false);
  }, [mergeGraphData, emit]);

  // Derive ExplorerNode[] and ExplorerEdge[] from the graphology graph.
  // Positions are from ForceAtlas2 (computed once per mergeGraphData).
  // Normalized to a 0-1 coordinate space; ExplorerCanvas maps to viewport.
  // Uses useEffect + state (not useMemo) to avoid accessing graphRef during render.
  const [explorerNodes, setExplorerNodes] = useState<ExplorerNode[]>([]);
  const [explorerEdges, setExplorerEdges] = useState<ExplorerEdge[]>([]);

  useEffect(() => {
    const g = graphRef.current;
    if (!graphData || g.order === 0) {
      setExplorerNodes([]);
      setExplorerEdges([]);
      return;
    }

    // Collect raw positions
    const rawNodes: { id: string; x: number; y: number; title: string; objectType: string; edgeCount: number; clusterId: number }[] = [];
    g.forEachNode((id, attrs) => {
      rawNodes.push({
        id,
        x: attrs.x as number,
        y: attrs.y as number,
        title: (attrs.label as string) ?? '',
        objectType: (attrs.object_type as string) ?? 'note',
        edgeCount: (attrs.edge_count as number) ?? 0,
        clusterId: (attrs.cluster_id as number) ?? 0,
      });
    });

    // Normalize positions: fit to [0.1, 0.9] range (10% padding each side)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of rawNodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const nodes: ExplorerNode[] = rawNodes.map((n) => {
      const normX = 0.1 + ((n.x - minX) / rangeX) * 0.8;
      const normY = 0.1 + ((n.y - minY) / rangeY) * 0.8;
      const visual = computeVisualProps(n.id, n.edgeCount, n.clusterId);
      return {
        id: n.id,
        x: normX,
        y: normY,
        title: n.title,
        objectType: n.objectType,
        edgeCount: n.edgeCount,
        ...visual,
      };
    });

    const edges: ExplorerEdge[] = [];
    g.forEachEdge((_key, attrs, source, target) => {
      edges.push({
        source,
        target,
        strength: (attrs.strength as number) ?? 0.5,
        edgeType: (attrs.edge_type as string) ?? '',
        reason: (attrs.reason as string) ?? '',
      });
    });

    setExplorerNodes(nodes);
    setExplorerEdges(edges);
  }, [graphData]);

  return {
    graph: graphRef.current,
    loading,
    graphData,
    explorerNodes,
    explorerEdges,
    loadNeighborhood,
    loadTopNodes,
    loadSubgraph,
  };
}

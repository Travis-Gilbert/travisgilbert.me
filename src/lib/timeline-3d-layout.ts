/**
 * timeline-3d-layout.ts
 *
 * Pure D3 layout computation for the 3D timeline scene.
 * No React. Consumes MockNode[] from the feed API, produces
 * position arrays that Three.js components render.
 *
 * Axis convention:
 *   X = lateral spread within date clusters
 *   Y = type lanes (vertical) + importance elevation
 *   Z = time depth (near = recent, far = older)
 */

import * as d3 from 'd3';
import { OBJECT_TYPES } from '@/lib/commonplace';
import type { MockNode, MockEdge } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Output types
   ───────────────────────────────────────────────── */

export interface TimelineNode3D {
  id: string;
  objectRef: number;
  objectSlug: string;
  objectType: string;
  title: string;
  summary: string;
  capturedAt: string;
  edgeCount: number;
  edges: MockEdge[];
  position: [number, number, number];
  radius: number;
  color: string;
}

export interface TimelineEdge3D {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePos: [number, number, number];
  targetPos: [number, number, number];
  reason: string;
  edgeType?: string;
}

export interface TimelineDateMarker {
  label: string;
  dateKey: string;
  position: [number, number, number];
}

/** Choreography phase for GSAP camera animation */
export interface ChoreographyPhase {
  /** Normalized scroll progress start (0..1) */
  start: number;
  /** Normalized scroll progress end (0..1) */
  end: number;
  type: 'entry' | 'dense' | 'sparse' | 'hotspot' | 'exit';
  /** Camera target position at the phase midpoint */
  cameraPosition: [number, number, number];
  /** Camera look-at target */
  cameraTarget: [number, number, number];
}

export interface Timeline3DLayout {
  nodes: TimelineNode3D[];
  edges: TimelineEdge3D[];
  dateMarkers: TimelineDateMarker[];
  phases: ChoreographyPhase[];
  /** Total Z depth of the timeline corridor */
  zExtent: [number, number];
  /** Suggested scroll container height in px */
  scrollHeight: number;
}

/* ─────────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────────── */

/** Pixels of scroll per date group */
const SCROLL_PER_GROUP = 600;

/** Z-axis spacing: world units per date group */
const Z_PER_GROUP = 8;

/** Type lane Y positions (spread evenly from 0.5 to 4.5) */
const TYPE_LANE_MAP = new Map(
  OBJECT_TYPES.map((t, i) => [
    t.slug,
    0.5 + (i / Math.max(OBJECT_TYPES.length - 1, 1)) * 4,
  ]),
);

/** Type color lookup */
const TYPE_COLOR_MAP = new Map(
  OBJECT_TYPES.map((t) => [t.slug, t.color]),
);

/** Dense cluster threshold */
const DENSE_THRESHOLD = 5;

/* ─────────────────────────────────────────────────
   Main layout function
   ───────────────────────────────────────────────── */

export function computeTimeline3DLayout(
  feedNodes: MockNode[],
): Timeline3DLayout {
  if (feedNodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      dateMarkers: [],
      phases: [],
      zExtent: [0, 0],
      scrollHeight: 0,
    };
  }

  /* ── Group by date ── */
  const dateGroupMap = new Map<string, MockNode[]>();
  for (const node of feedNodes) {
    const key = node.capturedAt.slice(0, 10);
    const existing = dateGroupMap.get(key);
    if (existing) existing.push(node);
    else dateGroupMap.set(key, [node]);
  }

  /** Sorted newest first (most recent = nearest in Z) */
  const sortedDateKeys = Array.from(dateGroupMap.keys()).sort(
    (a, b) => b.localeCompare(a),
  );

  const groupCount = sortedDateKeys.length;

  /* ── Time to Z scale ── */
  const timeExtent = d3.extent(feedNodes, (n) => new Date(n.capturedAt).getTime()) as [number, number];
  const zScale = d3.scaleLinear()
    .domain([timeExtent[1], timeExtent[0]])  // newest = near (small Z), oldest = far (large Z)
    .range([2, groupCount * Z_PER_GROUP]);

  /* ── Edge count to radius scale ── */
  const maxEdges = d3.max(feedNodes, (n) => n.edgeCount) ?? 1;
  const radiusScale = d3.scaleSqrt()
    .domain([0, Math.max(maxEdges, 1)])
    .range([0.2, 0.6]);

  /* ── Compute node positions ── */
  const nodeById = new Map<string, TimelineNode3D>();
  const nodes: TimelineNode3D[] = [];

  // Seed for deterministic jitter (djb2)
  let jitterSeed = 5381;
  function nextJitter(): number {
    jitterSeed = ((jitterSeed << 5) + jitterSeed + 0x45d9f3b) & 0x7fffffff;
    return (jitterSeed / 0x7fffffff) * 2 - 1; // range [-1, 1]
  }

  for (const node of feedNodes) {
    const t = new Date(node.capturedAt).getTime();
    const z = zScale(t);
    const baseY = TYPE_LANE_MAP.get(node.objectType) ?? 2.5;
    // Slight Y elevation for more connected objects
    const elevationBoost = Math.min(node.edgeCount * 0.15, 1.0);
    const y = baseY + elevationBoost;
    // X jitter within date cluster
    const x = nextJitter() * 1.5;

    const radius = radiusScale(node.edgeCount);
    const color = TYPE_COLOR_MAP.get(node.objectType) ?? '#9A8E82';

    const node3d: TimelineNode3D = {
      id: node.id,
      objectRef: node.objectRef,
      objectSlug: node.objectSlug,
      objectType: node.objectType,
      title: node.title,
      summary: node.summary,
      capturedAt: node.capturedAt,
      edgeCount: node.edgeCount,
      edges: node.edges,
      position: [x, y, z],
      radius,
      color,
    };

    nodes.push(node3d);
    nodeById.set(node.id, node3d);
  }

  /* ── Compute edges ── */
  const edges: TimelineEdge3D[] = [];
  const seenEdges = new Set<string>();

  for (const node of feedNodes) {
    for (const edge of node.edges) {
      if (seenEdges.has(edge.id)) continue;
      seenEdges.add(edge.id);

      const source = nodeById.get(edge.sourceId);
      const target = nodeById.get(edge.targetId);
      if (!source || !target) continue;

      edges.push({
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        sourcePos: source.position,
        targetPos: target.position,
        reason: edge.reason,
        edgeType: edge.edge_type,
      });
    }
  }

  /* ── Date markers ── */
  const dateMarkers: TimelineDateMarker[] = sortedDateKeys.map((key) => {
    const groupNodes = dateGroupMap.get(key)!;
    const avgZ = d3.mean(groupNodes, (n) => {
      const node3d = nodeById.get(n.id);
      return node3d?.position[2] ?? 0;
    }) ?? 0;

    return {
      label: formatDateLabel(key),
      dateKey: key,
      position: [-3.5, 0.3, avgZ],
    };
  });

  /* ── Choreography phases ── */
  const phases = computeChoreographyPhases(
    sortedDateKeys,
    dateGroupMap,
    zScale,
    groupCount,
  );

  const zMax = groupCount * Z_PER_GROUP;

  return {
    nodes,
    edges,
    dateMarkers,
    phases,
    zExtent: [2, zMax],
    scrollHeight: groupCount * SCROLL_PER_GROUP,
  };
}

/* ─────────────────────────────────────────────────
   Choreography phases
   ───────────────────────────────────────────────── */

function computeChoreographyPhases(
  sortedDateKeys: string[],
  dateGroupMap: Map<string, MockNode[]>,
  zScale: d3.ScaleLinear<number, number>,
  groupCount: number,
): ChoreographyPhase[] {
  const phases: ChoreographyPhase[] = [];
  const totalGroups = groupCount;
  if (totalGroups === 0) return phases;

  // Entry phase: first 10% of scroll
  phases.push({
    start: 0,
    end: 0.08,
    type: 'entry',
    cameraPosition: [0, 6, -2],
    cameraTarget: [0, 2, 20],
  });

  // Body phases based on density
  const bodyStart = 0.08;
  const bodyEnd = 0.92;
  const bodyRange = bodyEnd - bodyStart;

  for (let i = 0; i < totalGroups; i++) {
    const key = sortedDateKeys[i];
    const groupNodes = dateGroupMap.get(key) ?? [];
    const frac = i / Math.max(totalGroups - 1, 1);
    const progressStart = bodyStart + frac * bodyRange;
    const progressEnd = bodyStart + Math.min((i + 1) / totalGroups, 1) * bodyRange;

    const avgTime = d3.mean(groupNodes, (n) => new Date(n.capturedAt).getTime()) ?? Date.now();
    const z = zScale(avgTime);

    const isDense = groupNodes.length >= DENSE_THRESHOLD;
    // Count cross-group edges
    const edgeCount = groupNodes.reduce((sum, n) => sum + n.edgeCount, 0);
    const isHotspot = edgeCount > groupNodes.length * 3;

    if (isDense) {
      phases.push({
        start: progressStart,
        end: progressEnd,
        type: 'dense',
        cameraPosition: [-1.5, 5, z - 4],
        cameraTarget: [0, 2.5, z],
      });
    } else if (isHotspot) {
      phases.push({
        start: progressStart,
        end: progressEnd,
        type: 'hotspot',
        cameraPosition: [1.5, 3.5, z - 3],
        cameraTarget: [0, 2.5, z],
      });
    } else {
      phases.push({
        start: progressStart,
        end: progressEnd,
        type: 'sparse',
        cameraPosition: [0, 3, z - 2],
        cameraTarget: [0, 2, z + 2],
      });
    }
  }

  // Exit phase: last 8% of scroll
  const zMax = groupCount * 8;
  phases.push({
    start: 0.92,
    end: 1.0,
    type: 'exit',
    cameraPosition: [0, 3, zMax - 2],
    cameraTarget: [0, 2, zMax + 5],
  });

  return phases;
}

/* ─────────────────────────────────────────────────
   Date label formatting
   ───────────────────────────────────────────────── */

function formatDateLabel(dateKey: string): string {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

  if (dateKey === todayStr) return 'TODAY';
  if (dateKey === yesterdayStr) return 'YESTERDAY';

  const d = new Date(dateKey + 'T12:00:00Z');
  return d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase();
}

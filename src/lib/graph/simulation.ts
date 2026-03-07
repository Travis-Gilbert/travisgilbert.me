/**
 * D3 force simulation presets and synchronous runner.
 *
 * Every force graph on the site uses the same pattern:
 *   1. Configure forces
 *   2. .stop()
 *   3. Run N ticks synchronously (instant layout, no animation jank)
 *   4. Clamp positions within bounds
 *
 * This module extracts that into a single function with named presets.
 */

import * as d3 from 'd3';

// ── Types ───────────────────────────────────────────────────────────

export interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  radius: number;
  /** Optional: if > 0, node is pushed to radial ring when disconnected */
  connectionCount?: number;
}

export interface SimulationEdge extends d3.SimulationLinkDatum<SimulationNode> {
  weight?: number;
}

export interface SimulationOptions {
  /** Link distance in pixels */
  linkDistance: number;
  /** Link strength (0 to 1). Omit to use D3 default (~0.5) */
  linkStrength?: number;
  /** Many-body charge strength (negative = repulsion) */
  chargeStrength: number;
  /** Extra pixels added to node radius for collision detection */
  collisionPadding: number;
  /** Number of synchronous ticks (default 300) */
  iterations: number;
  /** Boundary padding in pixels (default 20) */
  boundaryPadding: number;
  /** Push disconnected nodes to radial ring at this fraction of viewport */
  radialFraction?: number;
  /** Strength of radial force for disconnected nodes (default 0.3) */
  radialStrength?: number;
  /** Center force strength (default D3's 1.0). Set lower for popup/compact */
  centerStrength?: number;
  /** Enable type-based clustering (for CommonPlace knowledge map) */
  cluster?: {
    /** Map from node id to cluster index (0-based) */
    getClusterIndex: (node: SimulationNode) => number;
    /** Total number of clusters */
    clusterCount: number;
    /** Cluster strength (default 0.08) */
    strength?: number;
  };
}

// ── Presets ──────────────────────────────────────────────────────────

/** Full-page ConnectionMap: moderate spacing, radial fallback for isolates */
export const PRESET_SPREAD: SimulationOptions = {
  linkDistance: 90,
  chargeStrength: -150,
  collisionPadding: 6,
  iterations: 300,
  boundaryPadding: 20,
  radialFraction: 0.35,
  radialStrength: 0.3,
};

/** Modal popup: tighter layout, stronger links, more collision space */
export const PRESET_COMPACT: SimulationOptions = {
  linkDistance: 110,
  linkStrength: 0.7,
  chargeStrength: -200,
  collisionPadding: 14,
  iterations: 300,
  boundaryPadding: 28,
  centerStrength: 0.3,
};

/** CommonPlace KnowledgeMap: dense graph, tight collision, optional clustering */
export const PRESET_KNOWLEDGE: SimulationOptions = {
  linkDistance: 80,
  chargeStrength: -120,
  collisionPadding: 4,
  iterations: 300,
  boundaryPadding: 10,
};

/** Studio TimelineGraph: strong repulsion, dynamic link distance by weight */
export const PRESET_STUDIO: SimulationOptions = {
  linkDistance: 140,
  chargeStrength: -360,
  collisionPadding: 9,
  iterations: 300,
  boundaryPadding: 24,
};

/** SourceGraph: moderate, fixed collision. Note: SourceGraph uses continuous
 *  simulation (.on('tick')), not synchronous. This preset is for reference. */
export const PRESET_SOURCE_GRAPH: SimulationOptions = {
  linkDistance: 80,
  chargeStrength: -200,
  collisionPadding: 12,
  iterations: 0, // continuous, not synchronous
  boundaryPadding: 20,
};

// ── Runner ──────────────────────────────────────────────────────────

/**
 * Configure and run a D3 force simulation synchronously.
 * Returns positioned nodes (mutated in place with x, y set).
 *
 * @param nodes   Array of simulation nodes (must have `id` and `radius`)
 * @param edges   Array of edges referencing node ids
 * @param width   Container width in pixels
 * @param height  Container height in pixels
 * @param options Simulation configuration (use a preset or custom)
 */
export function runSynchronousSimulation<
  N extends SimulationNode,
  E extends d3.SimulationLinkDatum<N> & { weight?: number },
>(
  nodes: N[],
  edges: E[],
  width: number,
  height: number,
  options: SimulationOptions,
): N[] {
  if (nodes.length === 0) return nodes;

  const {
    linkDistance,
    linkStrength,
    chargeStrength,
    collisionPadding,
    iterations,
    boundaryPadding,
    radialFraction,
    radialStrength = 0.3,
    centerStrength,
    cluster,
  } = options;

  const simulation = d3
    .forceSimulation<N>(nodes)
    .force(
      'link',
      (() => {
        const link = d3
          .forceLink<N, E>(edges)
          .id((d) => d.id)
          .distance(linkDistance);
        if (linkStrength !== undefined) link.strength(linkStrength);
        return link;
      })(),
    )
    .force('charge', d3.forceManyBody().strength(chargeStrength))
    .force(
      'center',
      centerStrength !== undefined
        ? d3.forceCenter(width / 2, height / 2).strength(centerStrength)
        : d3.forceCenter(width / 2, height / 2),
    )
    .force(
      'collision',
      d3.forceCollide<N>().radius((d) => d.radius + collisionPadding),
    )
    .stop();

  // Radial force: push disconnected nodes to outer ring
  if (radialFraction !== undefined) {
    const radialDist = Math.min(width, height) * radialFraction;
    simulation.force(
      'radial',
      d3
        .forceRadial<N>(
          (d) => ((d.connectionCount ?? 0) === 0 ? radialDist : 0),
          width / 2,
          height / 2,
        )
        .strength((d) => ((d.connectionCount ?? 0) === 0 ? radialStrength : 0)),
    );
  }

  // Type-based clustering (CommonPlace)
  if (cluster) {
    const str = cluster.strength ?? 0.08;
    simulation.force(
      'clusterX',
      d3
        .forceX<N>((d) => {
          const idx = cluster.getClusterIndex(d);
          const angle = (idx / cluster.clusterCount) * Math.PI * 2;
          return width / 2 + Math.cos(angle) * width * 0.2;
        })
        .strength(str),
    );
    simulation.force(
      'clusterY',
      d3
        .forceY<N>((d) => {
          const idx = cluster.getClusterIndex(d);
          const angle = (idx / cluster.clusterCount) * Math.PI * 2;
          return height / 2 + Math.sin(angle) * height * 0.2;
        })
        .strength(str),
    );
  }

  // Run synchronously
  for (let i = 0; i < iterations; i++) simulation.tick();

  // Clamp to bounds
  const pad = boundaryPadding;
  for (const node of nodes) {
    node.x = Math.max(pad + node.radius, Math.min(width - pad - node.radius, node.x ?? 0));
    node.y = Math.max(pad + node.radius, Math.min(height - pad - node.radius, node.y ?? 0));
  }

  return nodes;
}

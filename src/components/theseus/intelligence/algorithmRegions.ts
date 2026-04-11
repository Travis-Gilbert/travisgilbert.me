/**
 * Algorithm region definitions for the Intelligence Panel galaxy.
 * Data only: no rendering code.
 */

export type AlgorithmId = 'anti-conspiracy' | 'ppr' | 'community' | 'tms' | 'belief';

export interface Algorithm {
  id: AlgorithmId;
  label: string;
  description: string;
  angle: number;
}

/** 5 algorithms evenly spaced around the galaxy center, starting at 0 radians. */
export const ALGORITHMS: Algorithm[] = [
  {
    id: 'anti-conspiracy' as const,
    label: 'Anti-Conspiracy Constraint',
    description:
      'Knowledge built on a single source is fragile. The anti-conspiracy constraint scores every claim across five fitness dimensions: source independence, temporal spread, author diversity, domain breadth, and methodological variety. Claims that fail these checks receive low confidence scores and appear red. The constraint ensures that what the graph "knows" is corroborated, not just repeated.',
    angle: (0 / 5) * Math.PI * 2,
  },
  {
    id: 'ppr' as const,
    label: 'Personalized PageRank',
    description:
      'Personalized PageRank simulates a random walk that starts at a seed node, wanders along edges, and periodically teleports back to the seed. Nodes the walk visits frequently rank highest. The result is a personalized importance score: not which nodes are globally central, but which are most connected to a specific starting point.',
    angle: (1 / 5) * Math.PI * 2,
  },
  {
    id: 'community' as const,
    label: 'Leiden Community Detection',
    description:
      'The Leiden algorithm partitions the graph into communities by optimizing modularity: it groups nodes that connect to each other more often than random chance would predict. Each community represents a cluster of related knowledge. Cross-community edges, shown in amber, reveal where ideas bridge otherwise separate domains.',
    angle: (2 / 5) * Math.PI * 2,
  },
  {
    id: 'tms' as const,
    label: 'TMS What-If Retraction',
    description:
      'A Truth Maintenance System tracks the logical dependencies between beliefs. When you retract a piece of evidence, the TMS traces every belief that depended on it and withdraws justification. Nodes that lose their support fade out. The cascade reveals which parts of your knowledge are load-bearing and which would survive without a given source.',
    angle: (3 / 5) * Math.PI * 2,
  },
  {
    id: 'belief' as const,
    label: 'Belief Propagation',
    description:
      'Each node sends confidence estimates to its neighbors, and each neighbor updates its own belief based on what it receives. This exchange repeats until the network reaches a stable consensus. The result is a calibrated confidence score for every node, informed not just by local evidence but by the structure of the entire graph.',
    angle: (4 / 5) * Math.PI * 2,
  },
];

export const COMMUNITY_COLORS: string[] = [
  '#4A8A96',
  '#C49A4A',
  '#C4503C',
  '#7B8EA0',
  '#8B6B4A',
  '#5B8A6B',
  '#9B6B8A',
];

/**
 * Returns the algorithm whose angular sector contains the mouse position,
 * or null if the mouse is too close to center (< 60px) or too far (> maxRadius * 1.1).
 */
export function findHoveredAlgorithm(
  mouseX: number,
  mouseY: number,
  centerX: number,
  centerY: number,
  maxRadius: number,
): Algorithm | null {
  const dx = mouseX - centerX;
  const dy = mouseY - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 60 || dist > maxRadius * 1.1) return null;

  const mouseAngle = Math.atan2(dy, dx);
  // Normalize to [0, 2PI)
  const normalizedAngle = ((mouseAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  const sectorSize = (Math.PI * 2) / 5;

  for (const algo of ALGORITHMS) {
    // Compute angular distance (wrapped)
    let diff = normalizedAngle - algo.angle;
    diff = ((diff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;

    if (Math.abs(diff) < sectorSize / 2) {
      return algo;
    }
  }

  return null;
}

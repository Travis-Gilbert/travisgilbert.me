/**
 * Mock data generator for CommonPlace timeline and network views.
 *
 * Produces 35 to 45 mock objects across all 10 types with realistic
 * titles, dates spanning ~2 weeks, and deterministic edges. Uses the
 * same djb2 + LCG PRNG from HeroAccents so builds are stable (SSG safe).
 *
 * When the Django API is ready, this file is replaced by a single
 * fetch call. The MockNode/MockEdge shapes mirror the API response.
 */

import { OBJECT_TYPES } from '@/lib/commonplace';
import type { MockNode, MockEdge } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Deterministic PRNG (same pattern as HeroAccents)
   ───────────────────────────────────────────────── */

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function createRng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}

/* ─────────────────────────────────────────────────
   Title pools per object type
   ───────────────────────────────────────────────── */

const TITLES: Record<string, string[]> = {
  note: [
    'Thinking about pattern languages in digital spaces',
    'The feel of handwritten margins vs typed annotations',
    'Why do some tools invite slowness?',
    'Notes on the studio vs. the factory',
    'What makes a "living" document?',
    'Observation: sidewalks as negotiated space',
    'On the gap between capturing and understanding',
  ],
  source: [
    'How Buildings Learn (Stewart Brand)',
    'A Pattern Language (Christopher Alexander)',
    'The Design of Everyday Things (Don Norman)',
    'Seeing Like a State (James C. Scott)',
    'The Death and Life of Great American Cities (Jane Jacobs)',
    'Thinking in Systems (Donella Meadows)',
  ],
  person: [
    'Christopher Alexander',
    'Jane Jacobs',
    'Stewart Brand',
    'Ursula K. Le Guin',
    'Richard Sennett',
    'Donella Meadows',
  ],
  place: [
    'The High Line, NYC',
    'Kyoto Station Platform 0',
    'Bibliotheca Alexandrina',
    'Detroit Eastern Market',
    'Copenhagen Superkilen',
  ],
  organization: [
    'Long Now Foundation',
    'Dark Matter Labs',
    'Project for Public Spaces',
    'Civic Software Foundation',
    'Urban Institute',
  ],
  concept: [
    'Desire Paths',
    'Pace Layering',
    'Shearing Layers',
    'Legibility vs. Illegibility',
    'Boundary Objects',
    'Wicked Problems',
    'Convivial Tools',
  ],
  quote: [
    '"A city is not a tree." (Alexander)',
    '"The street finds its own uses for things." (Gibson)',
    '"We shape our buildings; thereafter they shape us." (Churchill)',
    '"Design is a plan for arranging elements." (Eames)',
    '"The medium is the message." (McLuhan)',
  ],
  hunch: [
    'What if knowledge graphs are more like gardens than libraries?',
    'Connection engines might work better with slower feedback loops',
    'The best tools disappear into the work itself',
    'Maybe "capture" is the wrong metaphor entirely',
    'Temporal proximity matters more than topic similarity',
  ],
  script: [
    'Auto-tag extraction pipeline',
    'Weekly digest email generator',
    'RSS feed to capture bridge',
    'Entity co-occurrence detector',
  ],
  task: [
    'Review backlinked sources from last week',
    'Tag untagged nodes from February',
    'Write retrospective for Q1 research threads',
    'Export network snapshot for presentation',
    'Consolidate duplicate person entries',
  ],
};

const SUMMARIES: Record<string, string[]> = {
  note: [
    'Rough sketch of how spatial metaphors shape how we think about organizing information.',
    'Comparing the affordances of paper margins with digital annotation systems.',
    'Some tools encourage careful, deliberate input. Others reward speed. Why?',
    'The factory produces outputs. The studio produces process. Different optimization targets.',
    'Documents that grow and change over time vs. documents that are "finished."',
  ],
  source: [
    'Essential reading on adaptive architecture and the time dimension of buildings.',
    'The foundational text on design patterns as a shared language.',
    'Explores the psychology of good and bad design through everyday objects.',
    'How large-scale planning schemes fail by prioritizing legibility over local knowledge.',
  ],
  person: [
    'Architect and design theorist. Pattern language, timeless way of building.',
    'Urban activist and writer. Eyes on the street, mixed-use neighborhoods.',
    'Writer and organizer. Whole Earth Catalog, Long Now Foundation, How Buildings Learn.',
  ],
  place: [
    'Elevated linear park built on former freight rail lines. Adaptive reuse exemplar.',
    'The platform where the local Nara line departs. Threshold between city scales.',
    'Modern revival of the ancient library. Knowledge infrastructure as civic statement.',
  ],
  organization: [
    'Fostering long-term thinking and responsibility. The 10,000 Year Clock.',
    'Working on the institutional and infrastructural conditions for system change.',
    'Helping people create and sustain public spaces that build community.',
  ],
  concept: [
    'Paths worn by actual foot traffic, revealing desire over design intent.',
    'Different components of a system change at different rates.',
    'Buildings as layered systems: site, structure, skin, services, space plan, stuff.',
    'The tension between making systems readable for outsiders and functional for inhabitants.',
  ],
  quote: [
    'On the difference between natural, overlapping city structures and artificial tree hierarchies.',
    'Technology always gets repurposed by its users in unexpected ways.',
    'The feedback loop between designed environments and human behavior.',
  ],
  hunch: [
    'Gardens require tending, attention, and seasonal rhythms. Libraries require cataloging.',
    'Instant feedback optimizes for volume. Delayed feedback optimizes for quality.',
    'Invisible tools let you focus on the work, not the tool.',
  ],
  script: [
    'Extracts entities and suggests type classifications from incoming text.',
    'Compiles a digest of new connections and resurfaced items each Friday.',
  ],
  task: [
    'Several backlinked sources need review and potential connection to active threads.',
    'About 15 nodes from February are missing type tags.',
  ],
};

/* ─────────────────────────────────────────────────
   Edge reason templates
   ───────────────────────────────────────────────── */

const EDGE_REASONS = [
  'Both discuss adaptive systems',
  'Shared interest in urban design',
  'Referenced in the same source',
  'Mentioned in conversation about legibility',
  'Temporal proximity (captured within minutes)',
  'Part of the same research thread',
  'Co-occurring entities detected by engine',
  'User linked these manually',
  'Similar themes around participatory design',
  'Both relate to infrastructure as culture',
  'Connected through the pattern language tradition',
  'Explores the same tension between order and emergence',
];

/* ─────────────────────────────────────────────────
   Generator
   ───────────────────────────────────────────────── */

const MOCK_SEED = 'commonplace-mock-2026';

let _cachedNodes: MockNode[] | null = null;
let _cachedEdges: MockEdge[] | null = null;

/**
 * Generate (or return cached) mock objects spanning ~14 days.
 * Deterministic: same output every call and every build.
 */
export function getMockData(): { nodes: MockNode[]; edges: MockEdge[] } {
  if (_cachedNodes && _cachedEdges) {
    return { nodes: _cachedNodes, edges: _cachedEdges };
  }

  const rng = createRng(hashString(MOCK_SEED));
  const now = new Date('2026-03-04T14:00:00Z').getTime();
  const DAY = 86400000;

  const nodes: MockNode[] = [];
  const nodeIds: string[] = [];

  /* Distribute objects across types with some randomness */
  for (const objType of OBJECT_TYPES) {
    const titles = TITLES[objType.slug] ?? ['Untitled'];
    const summaries = SUMMARIES[objType.slug] ?? [''];
    const count = Math.floor(rng() * 3) + 2; // 2 to 4 per type

    for (let i = 0; i < count && i < titles.length; i++) {
      const id = `mock-${objType.slug}-${i}`;
      /* Spread captures over 14 days with some clustering */
      const daysAgo = rng() * 14;
      const hoursOffset = rng() * 24;
      const capturedAt = new Date(
        now - daysAgo * DAY - hoursOffset * 3600000
      ).toISOString();

      nodes.push({
        id,
        objectType: objType.slug,
        title: titles[i],
        summary: summaries[i % summaries.length] ?? '',
        capturedAt,
        edgeCount: 0,
        edges: [],
      });
      nodeIds.push(id);
    }
  }

  /* Generate edges (roughly 30 to 50) */
  const edges: MockEdge[] = [];
  const edgeSet = new Set<string>();
  const targetEdgeCount = Math.floor(rng() * 20) + 30;

  for (let e = 0; e < targetEdgeCount; e++) {
    const srcIdx = Math.floor(rng() * nodeIds.length);
    let tgtIdx = Math.floor(rng() * nodeIds.length);
    /* Avoid self-edges */
    if (srcIdx === tgtIdx) tgtIdx = (tgtIdx + 1) % nodeIds.length;

    const src = nodeIds[srcIdx];
    const tgt = nodeIds[tgtIdx];
    const key = [src, tgt].sort().join('::');

    if (edgeSet.has(key)) continue;
    edgeSet.add(key);

    const reason = EDGE_REASONS[Math.floor(rng() * EDGE_REASONS.length)];
    const edge: MockEdge = {
      id: `edge-${edges.length}`,
      sourceId: src,
      targetId: tgt,
      reason,
      createdAt: new Date(now - rng() * 14 * DAY).toISOString(),
    };
    edges.push(edge);
  }

  /* Attach edges to nodes and compute counts */
  for (const edge of edges) {
    const srcNode = nodes.find((n) => n.id === edge.sourceId);
    const tgtNode = nodes.find((n) => n.id === edge.targetId);
    if (srcNode) {
      srcNode.edges.push(edge);
      srcNode.edgeCount++;
    }
    if (tgtNode) {
      tgtNode.edges.push(edge);
      tgtNode.edgeCount++;
    }
  }

  /* Sort nodes by capturedAt descending (newest first) */
  nodes.sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
  );

  _cachedNodes = nodes;
  _cachedEdges = edges;

  return { nodes, edges };
}

/* ─────────────────────────────────────────────────
   Grouping helpers
   ───────────────────────────────────────────────── */

export interface DateGroup {
  dateLabel: string;
  dateKey: string;
  nodes: MockNode[];
}

/**
 * Group nodes by date for timeline display.
 * Returns groups sorted newest first with relative labels.
 */
export function groupNodesByDate(nodes: MockNode[]): DateGroup[] {
  const now = new Date('2026-03-04T14:00:00Z');
  const todayStr = toDateKey(now);
  const yesterdayStr = toDateKey(new Date(now.getTime() - 86400000));

  const groups = new Map<string, MockNode[]>();

  for (const node of nodes) {
    const key = toDateKey(new Date(node.capturedAt));
    const existing = groups.get(key);
    if (existing) existing.push(node);
    else groups.set(key, [node]);
  }

  const result: DateGroup[] = [];
  for (const [key, groupNodes] of groups) {
    let dateLabel: string;
    if (key === todayStr) dateLabel = 'Today';
    else if (key === yesterdayStr) dateLabel = 'Yesterday';
    else dateLabel = formatDateLabel(key);

    result.push({ dateLabel, dateKey: key, nodes: groupNodes });
  }

  /* Sort groups newest first */
  result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  return result;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Notebook workspace utilities: intensity-to-config mapping,
 * deployment mode detection, engine pass metadata, and module definitions.
 */

/** Semantic labels for intensity sliders (1-5) */
export const INTENSITY_LABELS = [
  'minimal',
  'conservative',
  'balanced',
  'aggressive',
  'maximum',
] as const;

/** Maps 3 high-level intensity sliders to concrete engine_config values. */
export function mapIntensityToConfig(
  discovery: number,
  pruning: number,
  organization: number,
) {
  return {
    passes: {
      bm25: { top_k: [10, 15, 20, 30, 50][discovery - 1] },
      sbert: { min_cosine: [0.8, 0.72, 0.65, 0.55, 0.4][discovery - 1] },
    },
    self_organize: {
      decay_half_life_days: [120, 90, 60, 30, 14][pruning - 1],
      min_edge_strength: [0.1, 0.08, 0.05, 0.03, 0.01][pruning - 1],
    },
    community: {
      resolution: [0.5, 0.8, 1.0, 1.5, 2.0][organization - 1],
      min_cluster_size: [8, 6, 5, 4, 3][organization - 1],
    },
  };
}

/** Reverse-maps engine_config values to closest intensity slider positions. */
export function configToIntensity(config: Record<string, unknown>): {
  discovery: number;
  pruning: number;
  organization: number;
} {
  const passes = (config?.passes ?? {}) as Record<
    string,
    Record<string, number>
  >;
  const community = (config?.community ??
    (config?.post_passes as Record<string, unknown>)?.community ??
    {}) as Record<string, number>;
  const selfOrg = (config?.self_organize ?? {}) as Record<string, number>;

  // Discovery: map from bm25.top_k
  const topK = passes?.bm25?.top_k ?? 20;
  const discoveryMap = [10, 15, 20, 30, 50];
  const discovery = (discoveryMap.findIndex((v) => topK <= v) + 1) || 3;

  // Pruning: map from decay half-life
  const halfLife = selfOrg?.decay_half_life_days ?? 60;
  const pruningMap = [120, 90, 60, 30, 14];
  const pruning = (pruningMap.findIndex((v) => halfLife >= v) + 1) || 3;

  // Organization: map from community resolution
  const resolution = community?.resolution ?? 1.0;
  const orgMap = [0.5, 0.8, 1.0, 1.5, 2.0];
  const organization = (orgMap.findIndex((v) => resolution <= v) + 1) || 3;

  return { discovery, pruning, organization };
}

/** The 7 engine passes with metadata. */
export const ENGINE_PASSES = [
  {
    key: 'adaptive_ner',
    name: 'Named Entity Recognition',
    source: 'engine.py',
    pass: 1,
    requiresPyTorch: false,
  },
  {
    key: 'shared_entity',
    name: 'Shared Entity',
    source: 'engine.py',
    pass: 2,
    requiresPyTorch: false,
  },
  {
    key: 'bm25',
    name: 'BM25 / TF-IDF',
    source: 'engine.py',
    pass: 3,
    requiresPyTorch: false,
  },
  {
    key: 'sbert',
    name: 'SBERT Semantic',
    source: 'engine.py',
    pass: 4,
    requiresPyTorch: true,
  },
  {
    key: 'nli',
    name: 'NLI Stance Detection',
    source: 'engine.py',
    pass: 5,
    requiresPyTorch: true,
  },
  {
    key: 'temporal_kge',
    name: 'KGE Embeddings',
    source: 'engine.py',
    pass: 6,
    requiresPyTorch: true,
  },
  {
    key: 'causal',
    name: 'Causal Inference',
    source: 'engine.py',
    pass: 7,
    requiresPyTorch: true,
  },
] as const;

/** The 4 post-passes. */
export const POST_PASSES = [
  { key: 'community', name: 'Community Detection', source: 'community.py' },
  { key: 'gap_analysis', name: 'Gap Analysis', source: 'gap_analysis.py' },
  {
    key: 'temporal_evolution',
    name: 'Temporal Evolution',
    source: 'temporal_evolution.py',
  },
  { key: 'synthesis', name: 'Cluster Synthesis', source: 'synthesis.py' },
] as const;

/** Module definitions for V1. */
export const NOTEBOOK_MODULES = [
  {
    key: 'inquiry',
    name: 'Inquiry Engine',
    description: 'Question-driven external research',
    icon: 'search',
  },
  {
    key: 'claims',
    name: 'Claim Extraction',
    description: 'NLI stance detection on sources',
    icon: 'page',
  },
  {
    key: 'temporal',
    name: 'Temporal Analysis',
    description: 'Sliding-window graph dynamics',
    icon: 'timer',
  },
  {
    key: 'resurface',
    name: 'Resurface',
    description: 'Serendipitous object rediscovery',
    icon: 'sparks',
  },
  {
    key: 'export',
    name: 'Export Pipeline',
    description: 'Markdown and JSON archive output',
    icon: 'download',
  },
] as const;

/** Extract a 2-letter abbreviation from a notebook name. */
export function getNotebookAbbrev(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

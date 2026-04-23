'use client';

// Three-class scene director.
//
// The old nine-class vizPlanner (dispatching into bespoke stipple renderers)
// is replaced by this predictor which answers one question: should the
// answer render as a graph, as a chart, or as plain text?
//
// Keyword-based rules are the cold-start path. A future revision can swap
// in USE + KNN like the old planner; for now the three-way split is coarse
// enough that a tiny rule set beats model latency.

export type VizMode = 'graph' | 'chart' | 'text' | 'simulation';

export type ChartKind =
  | 'bar' | 'line' | 'heatmap' | 'scatter' | 'timeline' | 'map';

export interface VizPrediction {
  mode: VizMode;
  confidence: number;     // 0..1, approximate
  chartKind?: ChartKind;
  shouldWarmCosmograph: boolean;
  shouldWarmMosaic: boolean;
}

/** Phrases that signal the user wants Theseus to compose a system from
 *  primitives rather than describe or explain. Mirrors the backend's
 *  _SIMULATION_SIGNALS list in answer_router.py so pre-warming fires on the
 *  same queries the backend will classify as `simulation`. */
const SIMULATION_KEYWORDS = [
  'simulate ', 'simulation of', 'simulation for',
  'model the ', 'design the ideal',
  'build a system that', 'build the system',
  'ideal hardware for', 'ideal architecture for',
  'ideal setup for', 'ideal peer',
  'configure the best', 'configure the ideal',
  'what would the ideal', 'what would an ideal',
  'if i wanted to build',
];

/** Phrases that, when present, push a query toward the graph surface.
 *  Tuned for concept-space and relation-space queries. */
const GRAPH_KEYWORDS = [
  'connect', 'connection', 'connected', 'network', 'graph',
  'neighborhood', 'neighbour', 'neighbor', 'cluster', 'community',
  'related', 'relate', 'relationship', 'adjacent', 'link', 'linked',
  'between', 'among', 'across',
  'who', 'what influences', 'influenced', 'influence',
  'map of', 'map out', 'map the',
  'structure', 'structured',
  'explore', 'navigate',
  'hub', 'bridge', 'path from', 'path to', 'pathway',
];

/** Phrases that push toward a chart (Mosaic) surface. */
const CHART_KEYWORDS = [
  'trend', 'trending', 'over time', 'over the last', 'since',
  'rate', 'velocity', 'frequency', 'count of', 'how many', 'how often',
  'compare', 'comparison', 'vs', 'versus',
  'distribution', 'histogram', 'spread', 'range of',
  'correlation', 'correlate', 'relationship between',
  'heatmap', 'heat map',
  'by month', 'by week', 'by day', 'by year', 'by quarter',
  'breakdown', 'by category', 'by type', 'by cluster',
  'top 10', 'top ten', 'ranking', 'rank',
];

/** Maps chart-kind keywords to specific chart marks. */
const CHART_KIND_HINTS: Array<{ kind: ChartKind; patterns: string[] }> = [
  { kind: 'timeline', patterns: ['over time', 'over the last', 'timeline', 'evolution of', 'since'] },
  { kind: 'heatmap',  patterns: ['heatmap', 'heat map', 'by X and Y', 'matrix'] },
  { kind: 'line',     patterns: ['trend', 'rate', 'velocity'] },
  { kind: 'bar',      patterns: ['top ', 'ranking', 'by type', 'by category', 'count of'] },
  { kind: 'scatter',  patterns: ['correlation', 'correlate', 'vs ', 'versus '] },
  { kind: 'map',      patterns: ['where', 'location', 'geographic', 'map of'] },
];

function scoreKeywords(text: string, keywords: string[]): number {
  const lc = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lc.includes(kw)) hits += 1;
  }
  return hits;
}

function detectChartKind(text: string): ChartKind | undefined {
  const lc = text.toLowerCase();
  for (const hint of CHART_KIND_HINTS) {
    for (const pat of hint.patterns) {
      if (lc.includes(pat)) return hint.kind;
    }
  }
  return undefined;
}

/** Predict the viz mode for a query. */
export function predictVizType(query: string): VizPrediction {
  const trimmed = (query ?? '').trim();
  if (trimmed.length === 0) {
    return {
      mode: 'text',
      confidence: 0,
      shouldWarmCosmograph: false,
      shouldWarmMosaic: false,
    };
  }

  // Simulation wins before graph/chart because simulations warm BOTH
  // Cosmograph (construction sequence) and Mosaic (budget chart in mixed
  // mode). Score needs only one hit because the keywords are specific
  // verbs ("simulate the ideal ..."), not ambient nouns like "connect".
  const simulationScore = scoreKeywords(trimmed, SIMULATION_KEYWORDS);
  if (simulationScore > 0) {
    return {
      mode: 'simulation',
      confidence: Math.min(1, simulationScore / 2),
      shouldWarmCosmograph: true,
      shouldWarmMosaic: true,
    };
  }

  const graphScore = scoreKeywords(trimmed, GRAPH_KEYWORDS);
  const chartScore = scoreKeywords(trimmed, CHART_KEYWORDS);
  const maxScore = Math.max(graphScore, chartScore);

  if (maxScore === 0) {
    return {
      mode: 'text',
      confidence: 0.5,
      shouldWarmCosmograph: false,
      shouldWarmMosaic: false,
    };
  }

  if (graphScore > chartScore) {
    return {
      mode: 'graph',
      confidence: Math.min(1, graphScore / 3),
      shouldWarmCosmograph: true,
      shouldWarmMosaic: false,
    };
  }

  return {
    mode: 'chart',
    confidence: Math.min(1, chartScore / 3),
    chartKind: detectChartKind(trimmed),
    shouldWarmCosmograph: false,
    shouldWarmMosaic: true,
  };
}

/** No-op placeholder for training feedback. Batches after V2 may wire this
 *  into a learned model, but the rule-based predictor does not train. */
export function trainFromFeedback(
  _query: string,
  _actual: VizMode,
  _rendered: VizMode,
): void {
  // intentionally empty
}

/** Keep the existing warm-up signal path functional so TheseusShell's
 *  early useEffect does not error after vizPlanner is removed. */
export async function warmUpModels(): Promise<void> {
  // No heavy models to warm up in the rule-based predictor. The call is
  // kept for compatibility with the pre-V2 Shell bootstrap sequence.
}

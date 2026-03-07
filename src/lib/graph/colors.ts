/**
 * Shared color constants for all D3 graph visualizations.
 *
 * Three palettes:
 *   NODE_COLORS    content types (essay, field-note, project, shelf)
 *   SOURCE_COLORS  source types (book, article, paper, ...)
 *   ROLE_COLORS    source roles (primary, background, inspiration, ...)
 *   SIGNAL_COLORS  connection signals (shared_sources, shared_tags, ...)
 *
 * Plus edge base color and heatmap scale.
 */

// ── Content type node colors ────────────────────────────────────────

export const NODE_COLORS: Record<string, string> = {
  essay: '#B45A2D',
  'field-note': '#2D5F6B',
  project: '#C49A4A',
  shelf: '#5A7A4A',
};

// ── Source type colors (13 types) ───────────────────────────────────

export const SOURCE_COLORS: Record<string, string> = {
  book: '#C49A4A',
  article: '#B45A2D',
  paper: '#6B4A8A',
  video: '#A44A3A',
  podcast: '#5A7A4A',
  dataset: '#2D5F6B',
  document: '#8A7A5A',
  report: '#5A6A7A',
  map: '#4A7A5A',
  archive: '#7A6A4A',
  interview: '#6A5A7A',
  website: '#5A7A8A',
  other: '#6A5E52',
};

// ── Combined node color lookup (source types + content types) ───────

export const ALL_NODE_COLORS: Record<string, string> = {
  ...SOURCE_COLORS,
  ...NODE_COLORS,
  // API returns underscored content types; map them too
  field_note: '#2D5F6B',
};

// ── Edge role colors (source to content relationship) ───────────────

export const ROLE_COLORS: Record<string, string> = {
  primary: '#B45A2D',
  background: '#9A8E82',
  inspiration: '#C49A4A',
  data: '#2D5F6B',
  counterargument: '#A44A3A',
  methodology: '#5A7A4A',
  reference: '#6A5E52',
};

// ── Connection signal colors (research API 4-signal system) ─────────

export const SIGNAL_COLORS: Record<string, string> = {
  shared_sources: '#B45A2D',
  shared_tags: '#C49A4A',
  shared_threads: '#2D5F6B',
  semantic: '#6B5A7A',
};

// ── Edge base color (warm parchment gray, used as rgb() components) ─

export const EDGE_RGB = '140, 130, 120';

// ── Heatmap scale (parchment to terracotta) ─────────────────────────

export const HEATMAP_EMPTY = '#E8E0D6';
export const HEATMAP_SCALE = ['#D4C4B0', '#C49A4A', '#B4783A', '#B45A2D'];

// ── Chart series palette (cycling colors for treemaps, bar charts) ───

export const CHART_SERIES = ['#B45A2D', '#2D5F6B', '#C49A4A', '#5A7A4A'];

// ── Utility functions ───────────────────────────────────────────────

/**
 * Resolve a node color by type string. Checks content types first,
 * then source types, then falls back to warm gray.
 */
export function getNodeColor(type: string): string {
  return ALL_NODE_COLORS[type] ?? '#6A5E52';
}

/**
 * Given a signals object from the connection API, return the color
 * of the highest-scoring non-null signal.
 */
export function getDominantSignalColor(
  signals: Record<string, { score: number; detail: string } | null>,
): string {
  let best = '';
  let bestScore = -1;

  for (const [key, value] of Object.entries(signals)) {
    if (value && value.score > bestScore) {
      bestScore = value.score;
      best = key;
    }
  }

  return SIGNAL_COLORS[best] ?? EDGE_RGB.replace(/(\d+), (\d+), (\d+)/, '#8C827A');
}

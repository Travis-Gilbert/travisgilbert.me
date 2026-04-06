/**
 * e4bVision.ts
 *
 * Frontend vision agent that classifies user queries into visual answer types
 * and generates optimized image search queries for the stippling pipeline.
 *
 * This runs client-side as a fast keyword classifier with optional TF.js USE
 * embedding fallback (reuses vizPlanner's model). It bridges the gap between
 * user intent and the TargetGenerator/ImageTracer/VisionTracer pipeline.
 *
 * Named "e4b" after the 4B parameter model that runs this classification on
 * the backend. This frontend module mirrors that classification so the UI
 * can start warming vision models and preparing renderers speculatively.
 *
 * Pipeline:
 *   query -> classify() -> { answer_type, search_query }
 *   search result image -> prepareForTracing() -> ImageTraceOptions for TF.js
 */

import type { AnswerType, AnswerClassification } from '@/lib/theseus-types';

/* ─────────────────────────────────────────────────
   Signal dictionaries for keyword classification
   ───────────────────────────────────────────────── */

const GEOGRAPHIC_SIGNALS = [
  'neighborhood', 'district', 'area in', 'city', 'town',
  'country', 'region', 'where to live', 'best places',
  'map of', 'located', 'geography', 'neighborhoods in',
  'best areas of', 'near me',
] as const;

const PORTRAIT_SIGNALS = [
  'who is', 'who was', 'biography', 'life of',
  'tell me about', 'portrait of',
] as const;

const DIAGRAM_SIGNALS = [
  'how does', 'how do', 'mechanism', 'process of',
  'structure of', 'anatomy of', 'works',
  'explain how', 'what happens when',
] as const;

const COMPARISON_SIGNALS = [
  'compare', ' vs ', 'versus', 'difference between',
  'which is better', 'pros and cons',
] as const;

const TIMELINE_SIGNALS = [
  'history of', 'timeline', 'evolution of',
  'when did', 'chronology', 'over time',
] as const;

const HIERARCHY_SIGNALS = [
  'types of', 'categories', 'kinds of',
  'taxonomy', 'classification', 'breakdown',
] as const;

/* ─────────────────────────────────────────────────
   Answer types that require image search
   ───────────────────────────────────────────────── */

const IMAGE_SEARCH_TYPES: ReadonlySet<AnswerType> = new Set([
  'geographic',
  'portrait',
  'diagram',
]);

/* ─────────────────────────────────────────────────
   TF.js tracing options per answer type
   ───────────────────────────────────────────────── */

export interface ImageTraceConfig {
  /** Whether to attempt face mesh (portrait) or go straight to Sobel */
  preferVision: boolean;
  /** Adaptive contrast boost for map tiles */
  contrastBoost: boolean;
  /** Maximum dots to request from the tracer */
  maxDots: number;
  /** Weight multiplier for traced targets (controls dot brightness) */
  weightMultiplier: number;
}

const TRACE_CONFIG: Record<string, ImageTraceConfig> = {
  geographic: {
    preferVision: false,
    contrastBoost: true,
    maxDots: 3000,
    weightMultiplier: 1.0,
  },
  portrait: {
    preferVision: true,
    contrastBoost: false,
    maxDots: 5000,
    weightMultiplier: 1.2,
  },
  diagram: {
    preferVision: false,
    contrastBoost: false,
    maxDots: 2500,
    weightMultiplier: 0.9,
  },
};

/* ─────────────────────────────────────────────────
   Search query generators
   ───────────────────────────────────────────────── */

function extractLocation(query: string): string | null {
  // Match capitalized proper nouns after location prepositions
  const patterns = [
    /(?:in|of|around|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /(?:neighborhoods|districts|areas)\s+(?:in|of)\s+(.+?)(?:\?|$)/i,
  ];
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractPersonName(query: string): string | null {
  const patterns = [
    /who (?:is|was)\s+(.+?)(?:\?|$)/i,
    /(?:about|biography of)\s+(.+?)(?:\?|$)/i,
    /(?:tell me about)\s+(.+?)(?:\?|$)/i,
  ];
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractSubject(query: string): string | null {
  const patterns = [
    /how (?:does|do)\s+(.+?)\s+work/i,
    /(?:explain|structure of|anatomy of)\s+(.+?)(?:\?|$)/i,
    /(?:process of|mechanism of)\s+(.+?)(?:\?|$)/i,
  ];
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function buildGeoSearchQuery(query: string): string {
  const location = extractLocation(query);
  if (location) {
    return `${location} street grid map high contrast black white`;
  }
  return `${query} map diagram high contrast`;
}

function buildPortraitSearchQuery(query: string): string {
  const name = extractPersonName(query);
  if (name) {
    return `${name} portrait photo high contrast black white`;
  }
  return `${query} portrait high contrast`;
}

function buildDiagramSearchQuery(query: string): string {
  const subject = extractSubject(query);
  if (subject) {
    return `${subject} diagram schematic high contrast`;
  }
  return `${query} diagram illustration`;
}

/* ─────────────────────────────────────────────────
   Core classification
   ───────────────────────────────────────────────── */

function matchSignals(q: string, signals: readonly string[]): boolean {
  for (const signal of signals) {
    if (q.includes(signal)) return true;
  }
  return false;
}

/**
 * Classify a user query into an answer type with optional image search query.
 *
 * Fast path: keyword matching (< 1ms).
 * Returns the classification immediately; the backend classification
 * (when available) takes precedence via `resolveClassification()`.
 */
export function classify(query: string): AnswerClassification {
  const q = query.toLowerCase();

  if (matchSignals(q, GEOGRAPHIC_SIGNALS)) {
    return {
      answer_type: 'geographic',
      search_query: buildGeoSearchQuery(query),
      confidence: 0.7,
      reasoning: 'Geographic signals detected (location qualifiers)',
    };
  }

  if (matchSignals(q, PORTRAIT_SIGNALS)) {
    return {
      answer_type: 'portrait',
      search_query: buildPortraitSearchQuery(query),
      confidence: 0.7,
      reasoning: 'Portrait signals detected (person/biographical intent)',
    };
  }

  if (matchSignals(q, DIAGRAM_SIGNALS)) {
    return {
      answer_type: 'diagram',
      search_query: buildDiagramSearchQuery(query),
      confidence: 0.7,
      reasoning: 'Diagram signals detected (mechanism/process question)',
    };
  }

  if (matchSignals(q, COMPARISON_SIGNALS)) {
    return {
      answer_type: 'comparison',
      search_query: null,
      confidence: 0.7,
      reasoning: 'Comparison signals detected',
    };
  }

  if (matchSignals(q, TIMELINE_SIGNALS)) {
    return {
      answer_type: 'timeline',
      search_query: null,
      confidence: 0.7,
      reasoning: 'Timeline signals detected',
    };
  }

  if (matchSignals(q, HIERARCHY_SIGNALS)) {
    return {
      answer_type: 'hierarchy',
      search_query: null,
      confidence: 0.7,
      reasoning: 'Hierarchy signals detected',
    };
  }

  return {
    answer_type: 'explanation',
    search_query: null,
    confidence: 0.5,
    reasoning: 'Default classification (no specific signals)',
  };
}

/**
 * Resolve the final answer type: backend classification wins if present,
 * otherwise use the frontend e4b classification.
 */
export function resolveClassification(
  backendType: AnswerType | undefined,
  backendClassification: AnswerClassification | undefined,
  frontendClassification: AnswerClassification,
): AnswerClassification {
  if (backendClassification && backendType) {
    return backendClassification;
  }
  if (backendType) {
    return { ...frontendClassification, answer_type: backendType };
  }
  return frontendClassification;
}

/**
 * Whether this answer type needs an image to trace into stipple targets.
 */
export function needsImageSearch(answerType: AnswerType): boolean {
  return IMAGE_SEARCH_TYPES.has(answerType);
}

/**
 * Get the TF.js tracing configuration for an answer type.
 * Controls whether VisionTracer (face mesh) or ImageTracer (Sobel) runs,
 * plus contrast boost and dot budget.
 */
export function getTraceConfig(answerType: AnswerType): ImageTraceConfig {
  return TRACE_CONFIG[answerType] ?? {
    preferVision: false,
    contrastBoost: false,
    maxDots: 2000,
    weightMultiplier: 1.0,
  };
}

/**
 * Validate an image URL is suitable for stippling.
 * Checks dimensions and aspect ratio without downloading the full image.
 */
export async function validateImageForStippling(
  url: string,
): Promise<{ valid: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = window.setTimeout(() => {
      img.src = '';
      resolve({ valid: false, reason: 'Image load timeout (5s)' });
    }, 5000);

    img.onload = () => {
      window.clearTimeout(timeout);
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      if (w < 200 || h < 200) {
        resolve({ valid: false, reason: `Too small: ${w}x${h} (min 200x200)` });
        return;
      }

      const aspect = w / h;
      if (aspect < 0.5 || aspect > 2.0) {
        resolve({ valid: false, reason: `Bad aspect ratio: ${aspect.toFixed(2)} (need 0.5 to 2.0)` });
        return;
      }

      resolve({ valid: true });
    };

    img.onerror = () => {
      window.clearTimeout(timeout);
      resolve({ valid: false, reason: 'Failed to load image' });
    };

    img.src = url;
  });
}

/* ─────────────────────────────────────────────────
   Answer type -> VizType mapping
   ───────────────────────────────────────────────── */

import { ANSWER_TYPE_TO_VIZ, type VizType } from '@/lib/theseus-viz/vizPlanner';

/**
 * Map an AnswerType to the corresponding VizType for renderer selection.
 * Uses the canonical map from vizPlanner (single source of truth).
 */
export function answerTypeToVizType(answerType: AnswerType): VizType {
  return ANSWER_TYPE_TO_VIZ[answerType] ?? 'graph-native';
}

/* ─────────────────────────────────────────────────
   Dot coloring strategies per answer type
   ───────────────────────────────────────────────── */

export interface DotColorStrategy {
  /**
   * Given a dot's weight (0.0 to 1.0) and optional metadata,
   * return an RGB color override for that dot.
   */
  colorForWeight(weight: number, nodeType?: string): [number, number, number];
}

/** Geographic: teal/amber color ramp based on region score */
const geographicColors: DotColorStrategy = {
  colorForWeight(weight) {
    return lerpRgb([45, 95, 107], [196, 154, 74], weight);
  },
};

/**
 * Portrait: warm skin tones mapped to VisionTracer weight bands.
 * 0.00 to 0.25 = silhouette (cool gray)
 * 0.25 to 0.50 = structural features (warm mid)
 * 0.50 to 0.75 = interior mesh (warm light)
 * 0.75 to 1.00 = depth detail (bright warm)
 */
const portraitColors: DotColorStrategy = {
  colorForWeight(weight) {
    if (weight < 0.25) return [120, 115, 110]; // cool gray silhouette
    if (weight < 0.50) return [180, 130, 100]; // warm mid (features)
    if (weight < 0.75) return [210, 170, 140]; // warm light (mesh)
    return [230, 200, 170]; // bright warm (depth detail)
  },
};

/** Diagram: brightness ramp from dim to bright teal */
const diagramColors: DotColorStrategy = {
  colorForWeight(weight) {
    return lerpRgb([45, 95, 107], [130, 200, 210], weight);
  },
};

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const s = Math.min(1, Math.max(0, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * s),
    Math.round(a[1] + (b[1] - a[1]) * s),
    Math.round(a[2] + (b[2] - a[2]) * s),
  ];
}

/**
 * Get the dot coloring strategy for an answer type.
 * Returns null for layout types (they use existing TYPE_COLORS).
 */
export function getColorStrategy(answerType: AnswerType): DotColorStrategy | null {
  switch (answerType) {
    case 'geographic': return geographicColors;
    case 'portrait': return portraitColors;
    case 'diagram': return diagramColors;
    default: return null;
  }
}

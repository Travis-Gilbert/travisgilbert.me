/**
 * Tier-1 focus dimming helpers (Stage 5). Ports the three-tier opacity
 * scheme from references/atlas-explorer.jsx (lines 393-419 for nodes,
 * 354-374 for edges) onto the cosmos.gl canvas.
 *
 * Pure data, no React / cosmos.gl deps so the constants are unit-
 * testable in isolation. Re-exported from CosmosGraphCanvas.tsx so
 * existing call sites that imported from there keep working.
 */

/** Per-tier point alpha (RGBA channel 3) when a focus is active.
 *  `defaultNoFocus` applies when no focusedId is set; the value is
 *  intentionally below 1.0 so the ambient bloom reads as background
 *  context, not as the answer. */
export const TIER_OPACITIES = {
  focused: 1.0,
  neighbor: 0.75,
  hover: 0.85,
  dimmed: 0.25,
  defaultNoFocus: 0.55,
} as const;

/** Per-tier size multiplier applied on top of the baseline degree-
 *  scaled size. Halo radii intentionally exceed 1x: cosmos.gl renders
 *  points as filled discs and the brass-halo look is achieved by the
 *  oversized fill at low alpha. */
export const TIER_SIZE_MULT = {
  focused: 4.6,
  neighbor: 3.0,
  hover: 3.6,
  dimmed: 2.4,
  defaultNoFocus: 2.4,
} as const;

/** Per-tier edge styling when a focus is active. Ports atlas-explorer
 *  lines 366-371 (incident vs hovered vs dimmed strokes). RGB values
 *  approximate the var(--paper-pencil) / var(--paper-ink) /
 *  var(--paper-ink-2) tokens at the default theme. */
export const EDGE_TIER_COLORS = {
  // var(--paper-pencil) at 0.85 alpha; the focus-incident edges.
  incident: { r: 0.71, g: 0.55, b: 0.30, a: 0.85, width: 0.95 },
  // var(--paper-ink) at 0.55 alpha; hover-incident edges (when not focus).
  hovered: { r: 0.16, g: 0.14, b: 0.12, a: 0.55, width: 0.95 },
  // var(--paper-ink-2) at 0.10 alpha; everything else when focus is set.
  dimmed: { r: 0.43, g: 0.39, b: 0.34, a: 0.10, width: 0.5 },
  // var(--paper-ink-2) at 0.28 alpha; ambient layer when no focus is set.
  defaultNoFocus: { r: 0.43, g: 0.39, b: 0.34, a: 0.28, width: 0.5 },
} as const;

export type EdgeTier = keyof typeof EDGE_TIER_COLORS;

/** Return the tier alpha for a single point id. Pure: no DOM / cosmos.gl
 *  reads. The neighborIds set is the 1-hop neighbor frontier of
 *  focusedId; the caller is responsible for populating it. */
export function focusOpacityFor(
  pointId: string,
  focusedId: string | null,
  hoverId: string | null,
  neighborIds: Set<string>,
): number {
  if (!focusedId) return TIER_OPACITIES.defaultNoFocus;
  if (pointId === focusedId) return TIER_OPACITIES.focused;
  if (pointId === hoverId) return TIER_OPACITIES.hover;
  if (neighborIds.has(pointId)) return TIER_OPACITIES.neighbor;
  return TIER_OPACITIES.dimmed;
}

/** Return the tier size multiplier for a single point id. Same key
 *  set as focusOpacityFor; the two are usually called together. */
export function focusSizeMultFor(
  pointId: string,
  focusedId: string | null,
  hoverId: string | null,
  neighborIds: Set<string>,
): number {
  if (!focusedId) return TIER_SIZE_MULT.defaultNoFocus;
  if (pointId === focusedId) return TIER_SIZE_MULT.focused;
  if (pointId === hoverId) return TIER_SIZE_MULT.hover;
  if (neighborIds.has(pointId)) return TIER_SIZE_MULT.neighbor;
  return TIER_SIZE_MULT.dimmed;
}

/** Resolve the edge tier for a single link. The incidentLinks set
 *  carries `${src}|${tgt}` keys produced from links incident to
 *  focusedId; the helper checks both orientations defensively. */
export function linkTierFor(
  src: string,
  tgt: string,
  focusedId: string | null,
  hoverId: string | null,
  incidentLinks: Set<string>,
): EdgeTier {
  if (!focusedId) return 'defaultNoFocus';
  if (incidentLinks.has(`${src}|${tgt}`) || incidentLinks.has(`${tgt}|${src}`)) {
    return 'incident';
  }
  if (src === hoverId || tgt === hoverId) return 'hovered';
  return 'dimmed';
}

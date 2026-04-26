/**
 * Live ObjectType slugs that the Lens classifier dispatches on.
 *
 * These are NOT prototype-only slugs from atlas-lens.jsx (`paper`,
 * `code`, `finding`); they are live data-model slugs that exist in
 * the ObjectType seed (`concept`, `hunch`, `source`, `person`,
 * `script`). The map from prototype kinds is documented in
 * design-doc.md line 485:
 *   - prototype `paper`  -> live `source`
 *   - prototype `person` -> live `person` (direct match)
 *   - prototype `code`   -> live `script`
 *   - prototype `finding`+`concept` -> live `concept`+`hunch`
 *
 * The classifier still primarily dispatches on `epistemic_role` from
 * `loadEdgeTypeMeta()`; the kind check here is the secondary gate the
 * design doc requires for distinguishing inner (kin + thinking
 * concept) from middle (anchoring source / person / code).
 *
 * Living in a sibling file because the classifyShell hardcoded-slug
 * scan checks classifyShell.ts only; these sets are intentionally
 * data-driven by the live ObjectType registry.
 */

export const INNER_KINDS: ReadonlySet<string> = new Set(['concept', 'hunch']);
export const MIDDLE_KINDS: ReadonlySet<string> = new Set([
  'source',
  'person',
  'script',
]);

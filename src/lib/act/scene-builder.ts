/**
 * EvidenceCockpit scene builder + validator (Website-side TypeScript port).
 *
 * Mirrors `anti-conspirarcy-theorem/browser-extension/src/inference/a2ui.js`
 * (which itself mirrors `theseus_acc/a2ui.py`). The deterministic builder
 * converts a Website `AnalysisResult` into the same scene shape the Python
 * builder emits; the strict validator is the security boundary that rejects
 * Gemma scene-generator output that drops props, alters scores, or invents
 * claim ids.
 *
 * Source shape contract: `docs/a2ui-scene-schema.md` in the standalone repo.
 */

import type { AccAction, AccPenalty, AccRule, AnalysisResult, ScoredClaim } from './index';
import {
  ALWAYS_PRESENT_COMPONENTS,
  CALIBRATION_SOURCES,
  COMPONENT_CALIBRATION_BADGE,
  COMPONENT_CLAIM_CARD,
  COMPONENT_CONTRADICTION_PANEL,
  COMPONENT_NEXT_CHECKS,
  COMPONENT_PENALTY_LIST,
  COMPONENT_RULE_CHECKLIST,
  COMPONENT_SOURCE_COLLAPSE_PANEL,
  COMPONENT_TRAIT_RADAR,
  REQUIRED_PROPS_BY_COMPONENT,
  SCENE_NAME,
  SCENE_REQUIRED_FIELDS,
  SCENE_VERSION,
  type CalibrationSource,
  type ClaimState,
  type ComponentType,
  type PenaltyEntry,
  type RuleChecklistEntry,
  type SceneComponent,
  type SceneDirective,
  type SourceCollapseProps,
} from './scene-schema';

const ALGORITHM_VERSION_FALLBACK = '2.1.0';

const CANONICAL_TRAIT_KEYS = [
  'root_depth',
  'source_independence',
  'support_ratio',
  'claim_specificity',
  'temporal_spread',
  'evidence_volume',
  'falsifiability',
  'rhetorical_pressure',
  'source_quality',
  'contradiction_load',
  'citation_chain_collapse',
] as const;

/** Default weights for the eleven canonical traits. Mirrors theseus_acc. */
const DEFAULT_TRAIT_WEIGHTS: Record<string, number> = {
  root_depth: 0.14,
  source_independence: 0.14,
  support_ratio: 0.105,
  claim_specificity: 0.084,
  temporal_spread: 0.126,
  evidence_volume: 0.105,
  falsifiability: 0.06,
  rhetorical_pressure: 0.06,
  source_quality: 0.06,
  contradiction_load: 0.06,
  citation_chain_collapse: 0.06,
};

function round6(n: number): number {
  return Number(Number(n).toFixed(6));
}

function clamp01(n: number): number {
  return round6(Math.max(0, Math.min(1, Number(n))));
}

function firstFinite(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (value != null && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

/**
 * Normalize feature names so the canonical trait keys are populated even
 * when the scorer emits alias names (e.g. `claim_falsifiability`,
 * `rhetorical_red_flags`, `consensus_alignment`).
 */
function withCanonicalTraits(features: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...(features || {}) };
  const external = firstFinite(out.external_support_ratio);
  const consensus = firstFinite(out.consensus_alignment);
  if (out.support_ratio == null) {
    if (external != null && consensus != null) {
      out.support_ratio = clamp01(Math.min(external, consensus));
    } else if (external != null || consensus != null) {
      out.support_ratio = clamp01(external ?? consensus ?? 0);
    }
  }
  const aliases: Record<string, number | null> = {
    falsifiability: firstFinite(out.falsifiability, out.claim_falsifiability),
    rhetorical_pressure: firstFinite(out.rhetorical_pressure, out.rhetorical_red_flags),
    source_quality: firstFinite(out.source_quality, out.source_tier),
    contradiction_load: firstFinite(out.contradiction_load, out.consensus_alignment, 1),
    citation_chain_collapse: firstFinite(out.citation_chain_collapse, out.citation_chain_closure),
  };
  for (const [key, value] of Object.entries(aliases)) {
    if (out[key] == null && value != null) {
      out[key] = clamp01(value);
    }
  }
  return out;
}

function makeComponent<T extends ComponentType>(
  type: T,
  claimId: string,
  props: object,
): SceneComponent {
  return {
    type,
    id: `${type}.${claimId}`,
    props,
  } as SceneComponent;
}

interface BuildOptions {
  calibrationSource?: CalibrationSource;
  threshold?: number;
  /**
   * Caller-supplied weights to surface inside TraitRadar.props.weights.
   * When omitted, the builder uses the canonical default weights so the
   * validator's required-prop check still passes and the radar has
   * meaningful weight rings.
   */
  weights?: Record<string, number>;
}

/**
 * Build a deterministic EvidenceCockpit scene from an `AnalysisResult`.
 *
 * Returns a JSON-serializable `SceneDirective` ready for the catalog
 * dispatcher. The output is identical in shape to what the Python
 * builder + standalone browser extension produce.
 */
export function buildEvidenceScene(
  analysis: AnalysisResult,
  options: BuildOptions = {},
): SceneDirective {
  const calibrationSource: CalibrationSource = options.calibrationSource ?? 'deterministic';
  const threshold = typeof options.threshold === 'number' ? options.threshold : 0.55;

  if (!CALIBRATION_SOURCES.includes(calibrationSource)) {
    throw new Error(`invalid calibrationSource: ${calibrationSource}`);
  }

  const weights = options.weights ?? DEFAULT_TRAIT_WEIGHTS;
  const components: SceneComponent[] = [];
  const claims = Array.isArray(analysis?.claims) ? analysis.claims : [];
  const overallTraits = analysis?.features ? { ...analysis.features } : {};
  const algorithmVersion = analysis?.algorithm_version || ALGORITHM_VERSION_FALLBACK;

  if (!claims.length) {
    components.push(
      ...buildComponentsForRecord({
        claimId: 'article_overall',
        claimText: '',
        record: {
          score: analysis?.overall_score ?? 0,
          verdict: analysis?.verdict ?? 'unreliable',
          rules: analysis?.rules ?? [],
          penalties: analysis?.penalties ?? [],
          actions: analysis?.actions ?? [],
          feature_breakdown: overallTraits,
          linear_score: analysis?.linear_score ?? 0,
          geometric_core: analysis?.geometric_core ?? 0,
          penalty_total: analysis?.penalty_total ?? 0,
          support_strength: analysis?.support_strength,
          epistemic_risk: analysis?.epistemic_risk,
          claim_state: analysis?.claim_state,
          verification_gap: analysis?.verification_gap,
          diagnostics: analysis?.diagnostics,
        },
        weights,
        calibrationSource,
        threshold,
        algorithmVersion,
      }),
    );
  } else {
    for (const claim of claims) {
      components.push(
        ...buildComponentsForRecord({
          claimId: claim.id,
          claimText: claim.text || '',
          record: claim,
          weights,
          calibrationSource,
          threshold,
          algorithmVersion,
        }),
      );
    }
  }

  return {
    scene: SCENE_NAME,
    version: SCENE_VERSION,
    acc_version: algorithmVersion,
    claim_count: claims.length || 1,
    threshold,
    summary: '',
    components,
  };
}

interface RecordShape {
  score?: number | null;
  verdict?: string;
  rules?: AccRule[];
  penalties?: AccPenalty[];
  actions?: AccAction[];
  feature_breakdown?: Record<string, number>;
  linear_score?: number;
  geometric_core?: number;
  penalty_total?: number;
  support_strength?: number;
  epistemic_risk?: number;
  claim_state?: string;
  verification_gap?: string;
  diagnostics?: Record<string, number | string | boolean>;
}

interface BuildArgs {
  claimId: string;
  claimText: string;
  record: RecordShape;
  weights: Record<string, number>;
  calibrationSource: CalibrationSource;
  threshold: number;
  algorithmVersion: string;
}

function buildComponentsForRecord(args: BuildArgs): SceneComponent[] {
  const { claimId, claimText, record, weights, calibrationSource, threshold, algorithmVersion } =
    args;
  const features = record.feature_breakdown || {};
  const list: SceneComponent[] = [];

  list.push(
    makeComponent(COMPONENT_CLAIM_CARD, claimId, {
      claim_id: claimId,
      claim_text: claimText,
      claim_state: classifyClaimState(record, threshold),
      support_strength: round6(supportStrengthFromRecord(record)),
      epistemic_risk: round6(epistemicRiskFromRecord(record)),
      verification_gap: verificationGapFromRecord(record),
    }),
  );

  const collapseProps = sourceCollapsePropsFromRecord(record, features);
  if (collapseProps) {
    list.push(makeComponent(COMPONENT_SOURCE_COLLAPSE_PANEL, claimId, collapseProps));
  }

  list.push(
    makeComponent(COMPONENT_TRAIT_RADAR, claimId, {
      traits: roundFeatures(features),
      weights: roundWeights(weights),
    }),
  );

  list.push(
    makeComponent(COMPONENT_RULE_CHECKLIST, claimId, {
      rules: (record.rules || []).map(roundRule),
    }),
  );

  if ((record.penalties || []).length) {
    list.push(
      makeComponent(COMPONENT_PENALTY_LIST, claimId, {
        penalties: (record.penalties || []).map(roundPenalty),
        penalty_total: round6(record.penalty_total || 0),
      }),
    );
  }

  const contradictionCount = inferContradictionCount(features);
  if (contradictionCount > 0) {
    list.push(
      makeComponent(COMPONENT_CONTRADICTION_PANEL, claimId, {
        contradiction_count: contradictionCount,
      }),
    );
  }

  list.push(
    makeComponent(COMPONENT_NEXT_CHECKS, claimId, {
      actions: (record.actions || []).map((action) => ({
        id: action.id,
        priority: (action.priority === 'high' ? 'high' : 'medium') as 'high' | 'medium',
        reason: action.reason,
      })),
    }),
  );

  list.push(
    makeComponent(COMPONENT_CALIBRATION_BADGE, claimId, {
      source: calibrationSource,
      score: round6(record.score || 0),
      threshold: round6(threshold),
      version: algorithmVersion,
    }),
  );

  return list;
}

function supportStrengthFromRecord(record: RecordShape): number {
  if (Number.isFinite(Number(record.support_strength))) {
    return clamp01(record.support_strength ?? 0);
  }
  const linear = Number(record.linear_score || 0);
  const core = Number(record.geometric_core || 0);
  return clamp01(0.65 * linear + 0.35 * core);
}

function epistemicRiskFromRecord(record: RecordShape): number {
  if (Number.isFinite(Number(record.epistemic_risk))) {
    return clamp01(record.epistemic_risk ?? 0);
  }
  const features = withCanonicalTraits(record.feature_breakdown || {});
  const penalty = Math.min(1, Number(record.penalty_total || 0) / 0.45);
  const indep = 1 - clamp01(features.source_independence || 0);
  const rootless = 1 - clamp01(features.root_depth || 0);
  const thin = 1 - clamp01(features.evidence_volume || 0);
  return clamp01(0.4 * penalty + 0.3 * indep + 0.2 * rootless + 0.1 * thin);
}

function verificationGapFromRecord(record: RecordShape): string {
  if (typeof record.verification_gap === 'string') {
    return record.verification_gap;
  }
  const features = withCanonicalTraits(record.feature_breakdown || {});
  const independence = Number(features.source_independence ?? 1);
  const root = Number(features.root_depth ?? 0);
  const contradiction = Number(features.contradiction_load ?? features.consensus_alignment ?? 1);
  const evidence = Number(features.evidence_volume ?? 0);
  const specificity = Number(features.claim_specificity ?? 0);
  const temporal = Number(features.temporal_spread ?? 1);

  if (record.score == null && (record.rules || []).length === 0) {
    return 'No supporting evidence has been linked yet.';
  }
  if (independence < 0.35 && (record.feature_breakdown?.evidence_volume ?? 0) > 0) {
    return 'Multiple citations trace back to fewer canonical origins. Find an independent primary source.';
  }
  if (root < 0.25) {
    return 'Needs a verified or reviewed primary root.';
  }
  if (contradiction < 0.5) {
    return 'Contradiction pressure outweighs support. Adjudicate before promoting.';
  }
  if (evidence < 0.3) {
    return 'Direct support volume is too low. Gather more evidence.';
  }
  if (specificity < 0.25) {
    return 'Claim is too vague to adjudicate cleanly. Sharpen with concrete anchors.';
  }
  if (temporal < 0.15 && evidence >= 0.5) {
    return 'Evidence collapses into a narrow time window. Broaden temporal sampling.';
  }
  return '';
}

function classifyClaimState(record: RecordShape, threshold: number): ClaimState {
  if (typeof record.claim_state === 'string' && record.claim_state) {
    return record.claim_state as ClaimState;
  }
  const features = withCanonicalTraits(record.feature_breakdown || {});
  const score = Number(record.score || 0);
  const independence = Number(features.source_independence ?? 1);
  const evidence = Number(features.evidence_volume ?? 0);
  const root = Number(features.root_depth ?? 0);
  const closure = Number(
    features.citation_chain_collapse ?? features.citation_chain_closure ?? 1,
  );
  const contradiction = Number(features.contradiction_load ?? features.consensus_alignment ?? 1);
  const specificity = Number(features.claim_specificity ?? 0);
  const branchCount = Number(
    (record.rules || []).find((r) => r.id === 'requires_independent_sources')?.value ?? 0,
  );

  if (score >= Math.max(0.65, threshold) && independence >= 0.5 && root >= 0.25 && contradiction >= 0.5) {
    return 'well_supported';
  }
  if (closure < 0.5 && independence < 0.5) {
    return 'source_collapsed';
  }
  if (contradiction < 0.5) {
    return 'contradicted';
  }
  if (evidence < 0.3 || branchCount === 0) {
    return 'under_evidenced';
  }
  if (root < 0.25) {
    return 'rootless';
  }
  if (specificity < 0.25) {
    return 'vague';
  }
  if (score < threshold) {
    return 'suspect';
  }
  return 'unresolved';
}

function sourceCollapsePropsFromRecord(
  record: RecordShape,
  features: Record<string, number>,
): SourceCollapseProps | null {
  const diagnosticsVisible = Number(record.diagnostics?.visible_source_count || 0);
  if (record.diagnostics && diagnosticsVisible >= 2) {
    const collapseRatio = clamp01(
      Number(record.diagnostics.source_collapse_ratio ?? 0),
    );
    if (collapseRatio <= 0) {
      return null;
    }
    return {
      visible_source_count: diagnosticsVisible,
      canonical_origin_count: Number(record.diagnostics.canonical_origin_count || 0),
      source_collapse_ratio: round6(collapseRatio),
      warning:
        collapseRatio >= 0.5
          ? 'Many citations trace back to fewer canonical origins. Find an independent primary source.'
          : 'Some citations share canonical origins. Worth verifying independence.',
    };
  }
  const normalized = withCanonicalTraits(features);
  const closure = Number(
    normalized.citation_chain_collapse ?? normalized.citation_chain_closure ?? 1,
  );
  if (closure >= 0.7) {
    return null;
  }
  const independence = clamp01(normalized.source_independence ?? 1);
  const visible = Math.max(
    2,
    Math.round((record.feature_breakdown?.evidence_volume ?? 0) * 8) || 2,
  );
  const collapseRatio = clamp01(1 - closure);
  const canonical = Math.max(1, Math.round(visible * (1 - collapseRatio)));
  let warning: string;
  if (collapseRatio >= 0.5) {
    warning =
      'Many citations trace back to fewer canonical origins. Find an independent primary source.';
  } else if (collapseRatio >= 0.25) {
    warning = 'Some citations share canonical origins. Worth verifying independence.';
  } else {
    warning = 'Citations appear to come from independent canonical origins.';
  }
  return {
    visible_source_count: visible,
    canonical_origin_count: canonical,
    source_collapse_ratio: round6(collapseRatio),
    warning,
    independence_proxy: round6(independence),
  };
}

function inferContradictionCount(features: Record<string, number>): number {
  const normalized = withCanonicalTraits(features);
  const contradiction = Number(normalized?.contradiction_load ?? 1);
  if (contradiction >= 0.5) {
    return 0;
  }
  return Math.max(1, Math.round((1 - contradiction) * 3));
}

function roundFeatures(features: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  const normalized = withCanonicalTraits(features);
  for (const k of CANONICAL_TRAIT_KEYS) {
    const v = normalized[k];
    if (v == null) continue;
    out[k] = round6(v);
  }
  return out;
}

function roundWeights(weights: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights || {})) {
    if (typeof v === 'number') out[k] = round6(v);
  }
  return out;
}

function roundRule(rule: AccRule): RuleChecklistEntry {
  return {
    id: rule.id,
    passed: Boolean(rule.passed),
    value: rule.value == null ? null : round6(rule.value),
    threshold: round6(rule.threshold),
    reason: rule.reason,
  };
}

function roundPenalty(penalty: AccPenalty): PenaltyEntry {
  return {
    id: penalty.id,
    severity: round6(penalty.severity),
    weight: round6(penalty.weight),
    impact: round6(penalty.impact),
    reason: penalty.reason,
  };
}

/* ── Validator ─────────────────────────────────────────────────────────── */

/**
 * Strict validator. Returns a list of human-readable error strings.
 * An empty list means the scene is valid.
 *
 * This is the security boundary the Gemma scene generator (future PR4)
 * is checked against: it rejects model output that drops props, alters
 * scores, invents claim ids, or invents component types.
 */
export function validateEvidenceScene(scene: unknown): string[] {
  const errors: string[] = [];
  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
    return ['scene is not a JSON object'];
  }
  const obj = scene as Record<string, unknown>;

  for (const field of SCENE_REQUIRED_FIELDS) {
    if (!(field in obj)) {
      errors.push(`scene missing required field: ${field}`);
    }
  }

  if (obj.scene !== SCENE_NAME) {
    errors.push(`scene name must be "${SCENE_NAME}"`);
  }

  if (!Array.isArray(obj.components)) {
    errors.push('components must be a list');
    return errors;
  }

  const claimCardIds = new Set<string>();
  const componentsByClaim = new Map<string, Set<string>>();

  obj.components.forEach((component: unknown, index: number) => {
    if (!component || typeof component !== 'object' || Array.isArray(component)) {
      errors.push(`component[${index}] is not a JSON object`);
      return;
    }
    const c = component as Record<string, unknown>;
    const type = c.type;
    const id = c.id;
    const props = c.props;

    if (typeof type !== 'string') {
      errors.push(`component[${index}] missing type`);
      return;
    }
    if (typeof id !== 'string') {
      errors.push(`component[${index}] missing id`);
    }
    if (!props || typeof props !== 'object' || Array.isArray(props)) {
      errors.push(`component[${index}] (${type}) missing props`);
      return;
    }

    const required = (REQUIRED_PROPS_BY_COMPONENT as Record<string, readonly string[] | undefined>)[type];
    if (!required) {
      errors.push(`component[${index}] unknown type "${type}"`);
      return;
    }
    const propsObj = props as Record<string, unknown>;
    for (const propName of required) {
      if (!(propName in propsObj)) {
        errors.push(`component[${index}] (${type}) missing prop: ${propName}`);
      }
    }

    if (type === COMPONENT_CALIBRATION_BADGE) {
      const source = propsObj.source as string;
      if (!CALIBRATION_SOURCES.includes(source as CalibrationSource)) {
        errors.push(
          `component[${index}] CalibrationBadge has invalid source "${source}"`,
        );
      }
    }

    if (type === COMPONENT_CLAIM_CARD) {
      const claimId = propsObj.claim_id;
      if (typeof claimId === 'string') {
        claimCardIds.add(claimId);
      }
    } else if (typeof id === 'string' && id.includes('.')) {
      const claimId = id.slice(id.indexOf('.') + 1);
      if (!componentsByClaim.has(claimId)) {
        componentsByClaim.set(claimId, new Set());
      }
      componentsByClaim.get(claimId)!.add(type);
    }
  });

  if (typeof obj.claim_count === 'number' && obj.claim_count !== claimCardIds.size) {
    errors.push(
      `claim_count ${obj.claim_count} does not match number of ClaimCards ${claimCardIds.size}`,
    );
  }

  for (const claimId of claimCardIds) {
    const present = componentsByClaim.get(claimId) ?? new Set<string>();
    for (const componentType of ALWAYS_PRESENT_COMPONENTS) {
      if (componentType === COMPONENT_CLAIM_CARD) continue;
      if (!present.has(componentType)) {
        errors.push(`claim "${claimId}" missing required component: ${componentType}`);
      }
    }
  }

  return errors;
}

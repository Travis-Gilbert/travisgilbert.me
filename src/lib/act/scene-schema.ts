/**
 * EvidenceCockpit A2UI scene schema (Website-side TypeScript port).
 *
 * Mirrors `anti-conspirarcy-theorem/browser-extension/src/inference/schemas.js`
 * byte-for-byte on names, versions, and required-props lists. The Python
 * source of truth is `theseus_acc/schemas.py`. The schema document is
 * `anti-conspirarcy-theorem/docs/a2ui-scene-schema.md`.
 *
 * Any change here must be propagated to schemas.js + schemas.py + the
 * schema doc on the standalone repo, or the validator will reject
 * cross-repo output.
 */

export const SCENE_NAME = 'EvidenceCockpit' as const;
export const SCENE_VERSION = '0.1.0' as const;

export const SCENE_REQUIRED_FIELDS = [
  'scene',
  'version',
  'claim_count',
  'components',
] as const;

export const COMPONENT_CLAIM_CARD = 'ClaimCard' as const;
export const COMPONENT_SOURCE_COLLAPSE_PANEL = 'SourceCollapsePanel' as const;
export const COMPONENT_TRAIT_RADAR = 'TraitRadar' as const;
export const COMPONENT_RULE_CHECKLIST = 'RuleChecklist' as const;
export const COMPONENT_PENALTY_LIST = 'PenaltyList' as const;
export const COMPONENT_CONTRADICTION_PANEL = 'ContradictionPanel' as const;
export const COMPONENT_NEXT_CHECKS = 'NextChecks' as const;
export const COMPONENT_CALIBRATION_BADGE = 'CalibrationBadge' as const;
export const COMPONENT_MODEL_EXPLANATION_PANEL = 'ModelExplanationPanel' as const;

export type ComponentType =
  | typeof COMPONENT_CLAIM_CARD
  | typeof COMPONENT_SOURCE_COLLAPSE_PANEL
  | typeof COMPONENT_TRAIT_RADAR
  | typeof COMPONENT_RULE_CHECKLIST
  | typeof COMPONENT_PENALTY_LIST
  | typeof COMPONENT_CONTRADICTION_PANEL
  | typeof COMPONENT_NEXT_CHECKS
  | typeof COMPONENT_CALIBRATION_BADGE
  | typeof COMPONENT_MODEL_EXPLANATION_PANEL;

export const CLAIM_CARD_REQUIRED_PROPS = [
  'claim_id',
  'claim_text',
  'claim_state',
  'support_strength',
  'epistemic_risk',
  'verification_gap',
] as const;

export const SOURCE_COLLAPSE_REQUIRED_PROPS = [
  'visible_source_count',
  'canonical_origin_count',
  'source_collapse_ratio',
  'warning',
] as const;

export const TRAIT_RADAR_REQUIRED_PROPS = ['traits', 'weights'] as const;
export const RULE_CHECKLIST_REQUIRED_PROPS = ['rules'] as const;
export const PENALTY_LIST_REQUIRED_PROPS = ['penalties', 'penalty_total'] as const;
export const CONTRADICTION_PANEL_REQUIRED_PROPS = ['contradiction_count'] as const;
export const NEXT_CHECKS_REQUIRED_PROPS = ['actions'] as const;
export const CALIBRATION_BADGE_REQUIRED_PROPS = [
  'source',
  'score',
  'threshold',
  'version',
] as const;
export const MODEL_EXPLANATION_REQUIRED_PROPS = ['summary'] as const;

export const REQUIRED_PROPS_BY_COMPONENT: Record<ComponentType, readonly string[]> = {
  [COMPONENT_CLAIM_CARD]: CLAIM_CARD_REQUIRED_PROPS,
  [COMPONENT_SOURCE_COLLAPSE_PANEL]: SOURCE_COLLAPSE_REQUIRED_PROPS,
  [COMPONENT_TRAIT_RADAR]: TRAIT_RADAR_REQUIRED_PROPS,
  [COMPONENT_RULE_CHECKLIST]: RULE_CHECKLIST_REQUIRED_PROPS,
  [COMPONENT_PENALTY_LIST]: PENALTY_LIST_REQUIRED_PROPS,
  [COMPONENT_CONTRADICTION_PANEL]: CONTRADICTION_PANEL_REQUIRED_PROPS,
  [COMPONENT_NEXT_CHECKS]: NEXT_CHECKS_REQUIRED_PROPS,
  [COMPONENT_CALIBRATION_BADGE]: CALIBRATION_BADGE_REQUIRED_PROPS,
  [COMPONENT_MODEL_EXPLANATION_PANEL]: MODEL_EXPLANATION_REQUIRED_PROPS,
};

export type CalibrationSource = 'deterministic' | 'model-adjusted';
export const CALIBRATION_SOURCES: readonly CalibrationSource[] = [
  'deterministic',
  'model-adjusted',
];

/** The five components emitted for every claim by the deterministic builder. */
export const ALWAYS_PRESENT_COMPONENTS: readonly ComponentType[] = [
  COMPONENT_CLAIM_CARD,
  COMPONENT_TRAIT_RADAR,
  COMPONENT_RULE_CHECKLIST,
  COMPONENT_NEXT_CHECKS,
  COMPONENT_CALIBRATION_BADGE,
];

export type ClaimState =
  | 'well_supported'
  | 'source_collapsed'
  | 'contradicted'
  | 'rootless'
  | 'under_evidenced'
  | 'vague'
  | 'suspect'
  | 'unresolved';

export const CLAIM_STATES: readonly ClaimState[] = [
  'well_supported',
  'source_collapsed',
  'contradicted',
  'rootless',
  'under_evidenced',
  'vague',
  'suspect',
  'unresolved',
];

/* ── Component prop shapes ────────────────────────────────────────────── */

export interface ClaimCardProps {
  claim_id: string;
  claim_text: string;
  claim_state: ClaimState;
  support_strength: number;
  epistemic_risk: number;
  verification_gap: string;
}

export interface SourceCollapseProps {
  visible_source_count: number;
  canonical_origin_count: number;
  source_collapse_ratio: number;
  warning: string;
  independence_proxy?: number;
}

export interface TraitRadarProps {
  traits: Record<string, number>;
  weights: Record<string, number>;
}

export interface RuleChecklistEntry {
  id: string;
  passed: boolean;
  value: number | null;
  threshold: number;
  reason: string;
}

export interface RuleChecklistProps {
  rules: RuleChecklistEntry[];
}

export interface PenaltyEntry {
  id: string;
  severity: number;
  weight: number;
  impact: number;
  reason: string;
}

export interface PenaltyListProps {
  penalties: PenaltyEntry[];
  penalty_total: number;
}

export interface ContradictionPanelProps {
  contradiction_count: number;
}

export interface NextChecksAction {
  id: string;
  priority: 'high' | 'medium';
  reason: string;
}

export interface NextChecksProps {
  actions: NextChecksAction[];
}

export interface CalibrationBadgeProps {
  source: CalibrationSource;
  score: number;
  threshold: number;
  version: string;
}

export interface ModelExplanationPanelProps {
  summary: string;
  citations?: string[];
}

export type SceneComponent =
  | { type: typeof COMPONENT_CLAIM_CARD; id: string; props: ClaimCardProps }
  | { type: typeof COMPONENT_SOURCE_COLLAPSE_PANEL; id: string; props: SourceCollapseProps }
  | { type: typeof COMPONENT_TRAIT_RADAR; id: string; props: TraitRadarProps }
  | { type: typeof COMPONENT_RULE_CHECKLIST; id: string; props: RuleChecklistProps }
  | { type: typeof COMPONENT_PENALTY_LIST; id: string; props: PenaltyListProps }
  | { type: typeof COMPONENT_CONTRADICTION_PANEL; id: string; props: ContradictionPanelProps }
  | { type: typeof COMPONENT_NEXT_CHECKS; id: string; props: NextChecksProps }
  | { type: typeof COMPONENT_CALIBRATION_BADGE; id: string; props: CalibrationBadgeProps }
  | {
      type: typeof COMPONENT_MODEL_EXPLANATION_PANEL;
      id: string;
      props: ModelExplanationPanelProps;
    };

export interface SceneDirective {
  scene: typeof SCENE_NAME;
  version: string;
  acc_version: string;
  claim_count: number;
  threshold: number;
  summary: string;
  components: SceneComponent[];
}

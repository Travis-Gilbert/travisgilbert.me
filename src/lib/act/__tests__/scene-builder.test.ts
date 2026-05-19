/**
 * Tests for the EvidenceCockpit A2UI scene builder + validator.
 *
 * Mirrors the rejection conditions enumerated in
 * `anti-conspirarcy-theorem/docs/a2ui-scene-schema.md` under
 * "Validation rules", and the round-trip tests from
 * `anti-conspirarcy-theorem/tests/test_a2ui_scene.py`. The validator is
 * the security boundary against Gemma scene-generator output, so every
 * rejection path gets a test.
 */

import { describe, expect, it } from 'vitest';
import type { AnalysisResult, ScoredClaim } from '../index';
import { buildEvidenceScene, validateEvidenceScene } from '../scene-builder';
import {
  ALWAYS_PRESENT_COMPONENTS,
  COMPONENT_CALIBRATION_BADGE,
  COMPONENT_CLAIM_CARD,
  COMPONENT_CONTRADICTION_PANEL,
  COMPONENT_NEXT_CHECKS,
  COMPONENT_PENALTY_LIST,
  COMPONENT_RULE_CHECKLIST,
  COMPONENT_SOURCE_COLLAPSE_PANEL,
  COMPONENT_TRAIT_RADAR,
  SCENE_NAME,
} from '../scene-schema';

/* ── Fixtures ──────────────────────────────────────────────────────── */

function baseClaim(overrides: Partial<ScoredClaim> = {}): ScoredClaim {
  return {
    id: 'claim_001',
    text: 'A test claim.',
    char_start: 0,
    char_end: 14,
    score: 0.62,
    verdict: 'mixed',
    linear_score: 0.6,
    geometric_core: 0.55,
    penalty_total: 0.08,
    rules: [
      {
        id: 'requires_independent_sources',
        passed: true,
        value: 3,
        threshold: 2,
        reason: 'Claim has at least two distinct supporting source ids.',
      },
    ],
    penalties: [],
    actions: [
      {
        id: 'request_independent_source',
        priority: 'medium',
        reason: 'Add an independent source branch before promotion.',
      },
    ],
    support_strength: 0.62,
    epistemic_risk: 0.18,
    claim_state: 'unresolved',
    verification_gap: '',
    diagnostics: {
      visible_source_count: 3,
      canonical_origin_count: 2,
      source_collapse_ratio: 0.33,
    },
    feature_breakdown: {
      root_depth: 0.71,
      source_independence: 0.78,
      support_ratio: 0.6,
      claim_specificity: 0.55,
      temporal_spread: 0.7,
      evidence_volume: 0.62,
      falsifiability: 0.65,
      rhetorical_pressure: 0.85,
      source_quality: 0.7,
      contradiction_load: 0.9,
      citation_chain_collapse: 0.8,
    },
    rationale: '',
    mini_graph_svg: '',
    ...overrides,
  };
}

function baseAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    title: 'Test article',
    source_label: 'Test article',
    source_type: 'text',
    content_type: 'factual',
    word_count: 800,
    overall_score: 0.58,
    verdict: 'mixed',
    linear_score: 0.58,
    geometric_core: 0.5,
    penalty_total: 0.08,
    rules: [],
    penalties: [],
    actions: [],
    support_strength: 0.55,
    epistemic_risk: 0.22,
    claim_state: 'unresolved',
    verification_gap: '',
    diagnostics: {},
    features: {
      root_depth: 0.7,
      source_independence: 0.75,
      support_ratio: 0.6,
      claim_specificity: 0.55,
      temporal_spread: 0.7,
      evidence_volume: 0.62,
    },
    claims: [baseClaim()],
    trustworthy_count: 0,
    mixed_count: 1,
    unreliable_count: 0,
    algorithm_version: '2.1.0',
    ...overrides,
  };
}

/* ── Builder: shape contract ───────────────────────────────────────── */

describe('buildEvidenceScene', () => {
  it('produces a valid scene from a baseline AnalysisResult', () => {
    const scene = buildEvidenceScene(baseAnalysis());
    const errors = validateEvidenceScene(scene);
    expect(errors).toEqual([]);
  });

  it('emits all five always-present components per claim', () => {
    const scene = buildEvidenceScene(baseAnalysis());
    const claimId = 'claim_001';
    for (const type of ALWAYS_PRESENT_COMPONENTS) {
      expect(
        scene.components.some(
          (c) => c.type === type && c.id === `${type}.${claimId}`,
        ),
      ).toBe(true);
    }
  });

  it('omits SourceCollapsePanel when independence is high and closure is good', () => {
    const scene = buildEvidenceScene(
      baseAnalysis({
        claims: [
          baseClaim({
            diagnostics: { visible_source_count: 4, canonical_origin_count: 4, source_collapse_ratio: 0 },
            feature_breakdown: {
              ...baseClaim().feature_breakdown,
              source_independence: 0.95,
              citation_chain_collapse: 0.95,
            },
          }),
        ],
      }),
    );
    const hasCollapse = scene.components.some(
      (c) => c.type === COMPONENT_SOURCE_COLLAPSE_PANEL,
    );
    expect(hasCollapse).toBe(false);
  });

  it('emits SourceCollapsePanel when diagnostics show source collapse', () => {
    const scene = buildEvidenceScene(
      baseAnalysis({
        claims: [
          baseClaim({
            diagnostics: {
              visible_source_count: 8,
              canonical_origin_count: 1,
              source_collapse_ratio: 0.875,
            },
          }),
        ],
      }),
    );
    const collapse = scene.components.find(
      (c) => c.type === COMPONENT_SOURCE_COLLAPSE_PANEL,
    );
    expect(collapse).toBeDefined();
    if (collapse && collapse.type === COMPONENT_SOURCE_COLLAPSE_PANEL) {
      expect(collapse.props.visible_source_count).toBe(8);
      expect(collapse.props.canonical_origin_count).toBe(1);
      expect(collapse.props.warning).toContain('canonical origins');
    }
  });

  it('emits PenaltyList only when penalties fired', () => {
    const sceneNoPenalty = buildEvidenceScene(baseAnalysis());
    expect(sceneNoPenalty.components.some((c) => c.type === COMPONENT_PENALTY_LIST)).toBe(false);

    const sceneWithPenalty = buildEvidenceScene(
      baseAnalysis({
        claims: [
          baseClaim({
            penalties: [
              {
                id: 'single_source_collapse',
                severity: 0.83,
                weight: 0.2,
                impact: 0.166,
                reason: 'Supporting evidence collapses into fewer than two distinct sources.',
              },
            ],
            penalty_total: 0.166,
          }),
        ],
      }),
    );
    expect(
      sceneWithPenalty.components.some((c) => c.type === COMPONENT_PENALTY_LIST),
    ).toBe(true);
  });

  it('emits ContradictionPanel only when contradiction_load is low', () => {
    const sceneClean = buildEvidenceScene(baseAnalysis());
    expect(
      sceneClean.components.some((c) => c.type === COMPONENT_CONTRADICTION_PANEL),
    ).toBe(false);

    const sceneContradicted = buildEvidenceScene(
      baseAnalysis({
        claims: [
          baseClaim({
            feature_breakdown: {
              ...baseClaim().feature_breakdown,
              contradiction_load: 0.15,
            },
          }),
        ],
      }),
    );
    const panel = sceneContradicted.components.find(
      (c) => c.type === COMPONENT_CONTRADICTION_PANEL,
    );
    expect(panel).toBeDefined();
    if (panel && panel.type === COMPONENT_CONTRADICTION_PANEL) {
      expect(panel.props.contradiction_count).toBeGreaterThanOrEqual(1);
    }
  });

  it('synthesizes an article_overall claim when no claims were extracted', () => {
    const scene = buildEvidenceScene(baseAnalysis({ claims: [] }));
    expect(scene.claim_count).toBe(1);
    const card = scene.components.find((c) => c.type === COMPONENT_CLAIM_CARD);
    expect(card).toBeDefined();
    if (card && card.type === COMPONENT_CLAIM_CARD) {
      expect(card.props.claim_id).toBe('article_overall');
    }
  });

  it('produces traits keyed to all eleven canonical traits where present', () => {
    const scene = buildEvidenceScene(baseAnalysis());
    const radar = scene.components.find((c) => c.type === COMPONENT_TRAIT_RADAR);
    expect(radar).toBeDefined();
    if (radar && radar.type === COMPONENT_TRAIT_RADAR) {
      const traitKeys = Object.keys(radar.props.traits);
      expect(traitKeys).toContain('root_depth');
      expect(traitKeys).toContain('source_independence');
      expect(traitKeys).toContain('contradiction_load');
      expect(traitKeys).toContain('citation_chain_collapse');
    }
  });

  it('round-trips: built scene passes the validator with no errors', () => {
    const tricky = baseAnalysis({
      claims: [
        baseClaim({
          penalties: [
            {
              id: 'single_source_collapse',
              severity: 0.83,
              weight: 0.2,
              impact: 0.166,
              reason: 'collapse',
            },
          ],
          penalty_total: 0.166,
          feature_breakdown: {
            ...baseClaim().feature_breakdown,
            contradiction_load: 0.2,
            source_independence: 0.3,
            citation_chain_collapse: 0.3,
          },
        }),
      ],
    });
    expect(validateEvidenceScene(buildEvidenceScene(tricky))).toEqual([]);
  });

  it('emits CalibrationBadge with the calibration source the caller passed', () => {
    const scene = buildEvidenceScene(baseAnalysis(), {
      calibrationSource: 'model-adjusted',
    });
    const badge = scene.components.find((c) => c.type === COMPONENT_CALIBRATION_BADGE);
    expect(badge).toBeDefined();
    if (badge && badge.type === COMPONENT_CALIBRATION_BADGE) {
      expect(badge.props.source).toBe('model-adjusted');
    }
  });

  it('rejects invalid calibration sources at build time', () => {
    expect(() =>
       
      buildEvidenceScene(baseAnalysis(), { calibrationSource: 'forged' as any }),
    ).toThrow();
  });
});

/* ── Validator: rejection enumeration ──────────────────────────────── */

describe('validateEvidenceScene rejection conditions', () => {
  it('rejects non-object scenes', () => {
    expect(validateEvidenceScene(null)).toEqual(['scene is not a JSON object']);
    expect(validateEvidenceScene([])).toEqual(['scene is not a JSON object']);
    expect(validateEvidenceScene('string')).toEqual(['scene is not a JSON object']);
  });

  it('rejects scenes missing envelope fields', () => {
    const errors = validateEvidenceScene({ scene: SCENE_NAME, version: '0.1.0' });
    expect(errors.some((e) => e.includes('claim_count'))).toBe(true);
    expect(errors.some((e) => e.includes('components'))).toBe(true);
  });

  it('rejects scenes with the wrong scene name', () => {
    const scene = buildEvidenceScene(baseAnalysis());
    const tampered = { ...scene, scene: 'NotEvidenceCockpit' as typeof SCENE_NAME };
    expect(validateEvidenceScene(tampered)).toContain('scene name must be "EvidenceCockpit"');
  });

  it('rejects scenes where components is not a list', () => {
    expect(validateEvidenceScene({ scene: SCENE_NAME, version: '0.1.0', claim_count: 0, components: 'no' })).toContain(
      'components must be a list',
    );
  });

  it('rejects components with unknown type', () => {
    const scene = buildEvidenceScene(baseAnalysis());
    const tampered = {
      ...scene,
      components: [
        ...scene.components,
         
        { type: 'FakeComponent', id: 'FakeComponent.x', props: {} } as any,
      ],
    };
    const errors = validateEvidenceScene(tampered);
    expect(errors.some((e) => e.includes('unknown type'))).toBe(true);
  });

  it('rejects components missing required props', () => {
    const scene = buildEvidenceScene(baseAnalysis());
    const tampered = {
      ...scene,
      components: scene.components.map((c, i) => {
        if (i === 0 && c.type === COMPONENT_CLAIM_CARD) {
          const stripped = { ...c.props };
          delete (stripped as Partial<typeof stripped>).claim_text;
          return { ...c, props: stripped } as typeof c;
        }
        return c;
      }),
    };
    const errors = validateEvidenceScene(tampered);
    expect(errors.some((e) => e.includes('missing prop: claim_text'))).toBe(true);
  });

  it('rejects CalibrationBadge with an invalid source value', () => {
    const scene = buildEvidenceScene(baseAnalysis());
    const tampered = {
      ...scene,
      components: scene.components.map((c) => {
        if (c.type === COMPONENT_CALIBRATION_BADGE) {
          return {
            ...c,
            props: {
              ...c.props,
              source: 'forged',
            },
             
          } as any;
        }
        return c;
      }),
    };
    const errors = validateEvidenceScene(tampered);
    expect(errors.some((e) => e.includes('CalibrationBadge has invalid source'))).toBe(true);
  });

  it('rejects scenes where claim_count does not match number of ClaimCards', () => {
    const scene = buildEvidenceScene(baseAnalysis());
    const tampered = { ...scene, claim_count: 99 };
    const errors = validateEvidenceScene(tampered);
    expect(errors.some((e) => e.includes('claim_count'))).toBe(true);
  });

  it('rejects scenes where a claim is missing a required always-present component', () => {
    const scene = buildEvidenceScene(baseAnalysis());
    const tampered = {
      ...scene,
      components: scene.components.filter((c) => c.type !== COMPONENT_RULE_CHECKLIST),
    };
    const errors = validateEvidenceScene(tampered);
    expect(errors.some((e) => e.includes('missing required component: RuleChecklist'))).toBe(true);
  });

  it('rejects component entries that are not JSON objects', () => {
    const errors = validateEvidenceScene({
      scene: SCENE_NAME,
      version: '0.1.0',
      claim_count: 0,
       
      components: ['not an object' as any],
    });
    expect(errors.some((e) => e.includes('is not a JSON object'))).toBe(true);
  });
});

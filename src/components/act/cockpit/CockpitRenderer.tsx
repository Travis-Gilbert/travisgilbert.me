'use client';

/**
 * EvidenceCockpit catalog renderer.
 *
 * Consumes a `SceneDirective` from `src/lib/act/scene-builder.ts` and
 * renders it as React. The dispatcher groups components by claim id so
 * the visual stack matches the schema doc's "reading order":
 *   ClaimCard -> [SourceCollapsePanel] -> TraitRadar -> RuleChecklist
 *   -> [PenaltyList] -> [ContradictionPanel] -> NextChecks
 *   -> [ModelExplanationPanel] -> CalibrationBadge
 *
 * Animations: per-claim group fades and slides in; `useReducedMotion`
 * collapses to a snap when the user prefers reduced motion.
 *
 * Schema contract: `anti-conspirarcy-theorem/docs/a2ui-scene-schema.md`.
 */

import { motion, useReducedMotion } from 'motion/react';
import { FEATURE_LABELS } from '@/lib/act';
import {
  COMPONENT_CALIBRATION_BADGE,
  COMPONENT_CLAIM_CARD,
  COMPONENT_CONTRADICTION_PANEL,
  COMPONENT_MODEL_EXPLANATION_PANEL,
  COMPONENT_NEXT_CHECKS,
  COMPONENT_PENALTY_LIST,
  COMPONENT_RULE_CHECKLIST,
  COMPONENT_SOURCE_COLLAPSE_PANEL,
  COMPONENT_TRAIT_RADAR,
  type CalibrationBadgeProps,
  type ClaimCardProps,
  type ContradictionPanelProps,
  type ModelExplanationPanelProps,
  type NextChecksProps,
  type PenaltyListProps,
  type RuleChecklistProps,
  type SceneComponent,
  type SceneDirective,
  type SourceCollapseProps,
  type TraitRadarProps,
} from '@/lib/act/scene-schema';
import styles from './Cockpit.module.css';

/* ── Top-level dispatcher ──────────────────────────────────────────── */

export interface CockpitRendererProps {
  scene: SceneDirective;
}

interface ClaimGroup {
  claimId: string;
  components: SceneComponent[];
}

/**
 * Group scene components by claim id so the renderer can stack them as
 * cohesive cards. Component ids use the `<Type>.<claim_id>` convention;
 * the dispatcher extracts the claim id and groups accordingly.
 */
function groupByClaim(components: SceneComponent[]): ClaimGroup[] {
  const order: string[] = [];
  const groups = new Map<string, SceneComponent[]>();
  for (const component of components) {
    const dot = component.id.indexOf('.');
    const claimId = dot >= 0 ? component.id.slice(dot + 1) : component.id;
    if (!groups.has(claimId)) {
      groups.set(claimId, []);
      order.push(claimId);
    }
    groups.get(claimId)!.push(component);
  }
  return order.map((claimId) => ({ claimId, components: groups.get(claimId)! }));
}

export function CockpitRenderer({ scene }: CockpitRendererProps) {
  const reducedMotion = useReducedMotion();
  const claims = groupByClaim(scene.components);

  return (
    <div className={styles.cockpit}>
      {claims.map((group, claimIndex) => {
        const sorted = sortForReading(group.components);
        return (
          <motion.section
            key={group.claimId}
            className={styles.claimGroup}
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.4,
              delay: reducedMotion ? 0 : claimIndex * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {sorted.map((component, i) => (
              <ComponentSlot
                key={component.id}
                component={component}
                claimIndex={claimIndex}
                slotIndex={i}
                reducedMotion={Boolean(reducedMotion)}
              />
            ))}
          </motion.section>
        );
      })}
    </div>
  );
}

/* ── Reading-order sort ────────────────────────────────────────────── */

const READING_ORDER: Record<string, number> = {
  [COMPONENT_CLAIM_CARD]: 0,
  [COMPONENT_SOURCE_COLLAPSE_PANEL]: 1,
  [COMPONENT_TRAIT_RADAR]: 2,
  [COMPONENT_RULE_CHECKLIST]: 3,
  [COMPONENT_PENALTY_LIST]: 4,
  [COMPONENT_CONTRADICTION_PANEL]: 5,
  [COMPONENT_NEXT_CHECKS]: 6,
  [COMPONENT_MODEL_EXPLANATION_PANEL]: 7,
  [COMPONENT_CALIBRATION_BADGE]: 8,
};

function sortForReading(components: SceneComponent[]): SceneComponent[] {
  return [...components].sort((a, b) => {
    const aIdx = READING_ORDER[a.type] ?? 99;
    const bIdx = READING_ORDER[b.type] ?? 99;
    return aIdx - bIdx;
  });
}

/* ── Slot dispatcher (one component) ───────────────────────────────── */

interface SlotProps {
  component: SceneComponent;
  claimIndex: number;
  slotIndex: number;
  reducedMotion: boolean;
}

function ComponentSlot({ component, claimIndex, slotIndex, reducedMotion }: SlotProps) {
  const transition = {
    duration: reducedMotion ? 0 : 0.32,
    delay: reducedMotion ? 0 : claimIndex * 0.06 + slotIndex * 0.04,
    ease: [0.22, 1, 0.36, 1] as const,
  };
  const initial = reducedMotion ? false : { opacity: 0, y: 6 };
  const animate = { opacity: 1, y: 0 };

  switch (component.type) {
    case COMPONENT_CLAIM_CARD:
      return (
        <motion.div initial={initial} animate={animate} transition={transition}>
          <ClaimCard {...component.props} claimIndex={claimIndex} />
        </motion.div>
      );
    case COMPONENT_SOURCE_COLLAPSE_PANEL:
      return (
        <motion.div initial={initial} animate={animate} transition={transition}>
          <SourceCollapsePanel {...component.props} />
        </motion.div>
      );
    case COMPONENT_TRAIT_RADAR:
      return (
        <motion.div initial={initial} animate={animate} transition={transition}>
          <TraitRadar {...component.props} />
        </motion.div>
      );
    case COMPONENT_RULE_CHECKLIST:
      return (
        <motion.div initial={initial} animate={animate} transition={transition}>
          <RuleChecklist {...component.props} />
        </motion.div>
      );
    case COMPONENT_PENALTY_LIST:
      return (
        <motion.div initial={initial} animate={animate} transition={transition}>
          <PenaltyList {...component.props} />
        </motion.div>
      );
    case COMPONENT_CONTRADICTION_PANEL:
      return (
        <motion.div initial={initial} animate={animate} transition={transition}>
          <ContradictionPanel {...component.props} />
        </motion.div>
      );
    case COMPONENT_NEXT_CHECKS:
      return (
        <motion.div initial={initial} animate={animate} transition={transition}>
          <NextChecks {...component.props} />
        </motion.div>
      );
    case COMPONENT_MODEL_EXPLANATION_PANEL:
      return (
        <motion.div initial={initial} animate={animate} transition={transition}>
          <ModelExplanationPanel {...component.props} />
        </motion.div>
      );
    case COMPONENT_CALIBRATION_BADGE:
      return (
        <motion.div initial={initial} animate={animate} transition={transition}>
          <CalibrationBadge {...component.props} />
        </motion.div>
      );
    default:
      return null;
  }
}

/* ── 9 renderers ───────────────────────────────────────────────────── */

const CLAIM_STATE_LABEL: Record<string, string> = {
  well_supported: 'Well supported',
  source_collapsed: 'Source-collapsed',
  contradicted: 'Contradicted',
  rootless: 'Rootless',
  under_evidenced: 'Under-evidenced',
  vague: 'Vague',
  suspect: 'Suspect',
  unresolved: 'Unresolved',
};

function fmt(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(decimals);
}

function ClaimCard({
  claim_id,
  claim_text,
  claim_state,
  support_strength,
  epistemic_risk,
  verification_gap,
  claimIndex,
}: ClaimCardProps & { claimIndex: number }) {
  const stateLabel = CLAIM_STATE_LABEL[claim_state] ?? claim_state;
  return (
    <div className={styles.claimCard}>
      <div className={styles.claimCardHead}>
        <span className={styles.claimNum}>
          Claim {String(claimIndex + 1).padStart(2, '0')} · {claim_id}
        </span>
        <span className={styles.claimState} data-state={claim_state}>
          {stateLabel}
        </span>
      </div>
      <p className={styles.claimText}>{claim_text || <em>Article-level overall</em>}</p>
      <div className={styles.claimMetrics}>
        <div className={styles.metricRow}>
          <span className={styles.metricKey}>Support</span>
          <span className={styles.metricValue}>{fmt(support_strength)}</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricKey}>Risk</span>
          <span className={styles.metricValue}>{fmt(epistemic_risk)}</span>
        </div>
      </div>
      {verification_gap ? (
        <div className={styles.gapBand} role="note">
          {verification_gap}
        </div>
      ) : null}
    </div>
  );
}

function SourceCollapsePanel({
  visible_source_count,
  canonical_origin_count,
  source_collapse_ratio,
  warning,
}: SourceCollapseProps) {
  return (
    <div className={styles.collapsePanel}>
      <div className={styles.sectionHead}>
        <h4 className={styles.sectionTitle}>Source collapse</h4>
        <span className={styles.sectionMeta}>{fmt(source_collapse_ratio, 2)} collapse ratio</span>
      </div>
      <div className={styles.collapseCounts}>
        <div className={styles.collapseCell}>
          <span className={styles.collapseLabel}>Visible</span>
          <span className={styles.collapseValue}>{visible_source_count}</span>
        </div>
        <div className={styles.collapseCell}>
          <span className={styles.collapseLabel}>Canonical</span>
          <span className={styles.collapseValue}>{canonical_origin_count}</span>
        </div>
        <div className={styles.collapseCell}>
          <span className={styles.collapseLabel}>Ratio</span>
          <span className={styles.collapseRatio}>{fmt(source_collapse_ratio, 2)}</span>
        </div>
      </div>
      <p className={styles.collapseWarning}>{warning}</p>
    </div>
  );
}

/* The 11 canonical trait keys in the order the schema doc defines them. */
const RADAR_KEYS = [
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

function shortLabel(key: string): string {
  return (FEATURE_LABELS[key] ?? key)
    .replace(/Citation chain collapse/i, 'Chain closure')
    .replace(/Rhetorical pressure/i, 'Rhetoric')
    .replace(/Source independence/i, 'Source indep')
    .replace(/Citation chain closure/i, 'Chain closure');
}

function TraitRadar({ traits, weights }: TraitRadarProps) {
  const present = RADAR_KEYS.filter((k) => typeof traits[k] === 'number');
  const n = present.length || 11;
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 24;
  const rings = [0.25, 0.5, 0.75, 1];

  const pointFor = (idx: number, magnitude: number) => {
    const angle = (Math.PI * 2 * idx) / n - Math.PI / 2;
    const m = Math.max(0, Math.min(1, magnitude));
    return [cx + Math.cos(angle) * r * m, cy + Math.sin(angle) * r * m] as const;
  };

  const traitPolygon = present
    .map((k, i) => {
      const [x, y] = pointFor(i, traits[k] ?? 0);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  /* Normalize weights to a max of 1 for the polygon ring, so the
     dashed weight outline reads as a "weight envelope" rather than a
     literal trait reading. */
  const maxWeight = Math.max(0.001, ...present.map((k) => weights[k] ?? 0));
  const weightPolygon = present
    .map((k, i) => {
      const w = (weights[k] ?? 0) / maxWeight;
      const [x, y] = pointFor(i, w);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div>
      <div className={styles.sectionHead}>
        <h4 className={styles.sectionTitle}>11-axis trait radar</h4>
        <span className={styles.sectionMeta}>signal: traits · ghost: weights</span>
      </div>
      <div className={styles.radarWrap}>
        <svg
          className={styles.radarSvg}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="Trait radar"
        >
          {rings.map((rr) => (
            <circle
              key={rr}
              className={styles.radarGrid}
              cx={cx}
              cy={cy}
              r={r * rr}
            />
          ))}
          {present.map((_, i) => {
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
            return (
              <line
                key={i}
                className={styles.radarAxis}
                x1={cx}
                y1={cy}
                x2={cx + Math.cos(angle) * r}
                y2={cy + Math.sin(angle) * r}
              />
            );
          })}
          <polygon className={styles.radarPolyWeight} points={weightPolygon} />
          <polygon className={styles.radarPolyTrait} points={traitPolygon} />
          {present.map((k, i) => {
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
            const x = cx + Math.cos(angle) * (r + 12);
            const y = cy + Math.sin(angle) * (r + 12);
            return (
              <text
                key={k}
                className={styles.radarLabel}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {shortLabel(k).toUpperCase()}
              </text>
            );
          })}
        </svg>
        <div className={styles.radarLegend}>
          {present.map((k) => (
            <div key={k}>
              <span className={styles.radarLegendName}>{shortLabel(k)}</span>
              <span className={styles.radarLegendValue}>{fmt(traits[k] ?? 0, 2)}</span>
              <span className={styles.radarLegendWeight}>w={fmt(weights[k] ?? 0, 3)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RuleChecklist({ rules }: RuleChecklistProps) {
  return (
    <div>
      <div className={styles.sectionHead}>
        <h4 className={styles.sectionTitle}>Rule checklist</h4>
        <span className={styles.sectionMeta}>
          {rules.filter((r) => r.passed).length} / {rules.length} passed
        </span>
      </div>
      <ul className={styles.ruleList}>
        {rules.map((rule) => (
          <li key={rule.id} className={styles.ruleRow} data-passed={String(rule.passed)}>
            <span className={styles.ruleMark} data-passed={String(rule.passed)}>
              {rule.passed ? '✓' : '×'}
            </span>
            <span className={styles.ruleReason}>{rule.reason}</span>
            <span className={styles.ruleMargin}>
              {rule.value == null ? '—' : fmt(rule.value, 2)} / {fmt(rule.threshold, 2)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PenaltyList({ penalties, penalty_total }: PenaltyListProps) {
  return (
    <div>
      <div className={styles.sectionHead}>
        <h4 className={styles.sectionTitle}>Penalties</h4>
        <span className={styles.penaltyTotal}>total impact −{fmt(penalty_total, 3)}</span>
      </div>
      <ul className={styles.penaltyList}>
        {penalties.map((p) => (
          <li key={p.id} className={styles.penaltyRow}>
            <span className={styles.penaltyReason}>{p.reason}</span>
            <span className={styles.penaltyImpact}>−{fmt(p.impact, 3)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContradictionPanel({ contradiction_count }: ContradictionPanelProps) {
  return (
    <div className={styles.contradictionPanel}>
      <span className={styles.contradictionCount}>{contradiction_count}</span>
      <span className={styles.contradictionLabel}>
        contradicting source{contradiction_count === 1 ? '' : 's'} on record. Adjudicate before
        promoting this claim.
      </span>
    </div>
  );
}

function NextChecks({ actions }: NextChecksProps) {
  if (!actions.length) return null;
  return (
    <div>
      <div className={styles.sectionHead}>
        <h4 className={styles.sectionTitle}>Next checks</h4>
        <span className={styles.sectionMeta}>{actions.length} action{actions.length === 1 ? '' : 's'}</span>
      </div>
      <ul className={styles.checkList}>
        {actions.map((a) => (
          <li key={a.id} className={styles.checkRow} data-priority={a.priority}>
            <span className={styles.checkPriority}>{a.priority}</span>
            <span className={styles.checkReason}>{a.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModelExplanationPanel({ summary, citations }: ModelExplanationPanelProps) {
  return (
    <div className={styles.modelPanel}>
      <div className={styles.sectionHead}>
        <h4 className={styles.sectionTitle}>Model summary</h4>
        <span className={styles.sectionMeta}>Gemma · model-adjusted</span>
      </div>
      <p className={styles.modelSummary}>{summary}</p>
      {citations && citations.length ? (
        <div className={styles.modelCitations}>
          {citations.map((c) => (
            <span key={c} className={styles.modelCitation}>
              {c}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CalibrationBadge({ source, score, threshold, version }: CalibrationBadgeProps) {
  const suspect = score < threshold;
  return (
    <div className={styles.badge} data-suspect={String(suspect)}>
      <div className={styles.badgeMain}>
        <span className={styles.badgeScore}>{fmt(score, 2)}</span>
        <span className={styles.badgeThreshold}>
          threshold {fmt(threshold, 2)} · {suspect ? 'below' : 'above'}
        </span>
      </div>
      <div className={styles.badgeMeta}>
        <div className={styles.badgeSource} data-source={source}>
          {source}
        </div>
        <div>ACC v{version}</div>
      </div>
    </div>
  );
}

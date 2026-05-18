import { getParentOrg, getTier } from "./domain-list.js";
// Path shim for Next.js layout. Upstream is "../shared/config.js" relative
// to browser-extension/src/inference/scoring.js. Only the path differs;
// the named export is identical.
import { ALGORITHM_VERSION } from "./shared/config.js";
import { renderClaimMiniGraph } from "./mini-graph-render.js";

export const ACC_V21_WEIGHTS = {
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

export const FACTUAL_WEIGHTS = { ...ACC_V21_WEIGHTS };

export const OPINION_WEIGHTS = {
  root_depth: 0.105,
  source_independence: 0.126,
  support_ratio: 0.075,
  claim_specificity: 0.07,
  temporal_spread: 0.105,
  evidence_volume: 0.085,
  falsifiability: 0.18,
  rhetorical_pressure: 0.09,
  source_quality: 0.045,
  contradiction_load: 0.06,
  citation_chain_collapse: 0.059,
};

export const REFERENCE_WEIGHTS = {
  root_depth: 0.08,
  source_independence: 0.08,
  support_ratio: 0.05,
  claim_specificity: 0.15,
  temporal_spread: 0.07,
  evidence_volume: 0.08,
  falsifiability: 0.22,
  rhetorical_pressure: 0.09,
  source_quality: 0.06,
  contradiction_load: 0.08,
  citation_chain_collapse: 0.04,
};

export const CANONICAL_FEATURE_KEYS = [
  "root_depth",
  "source_independence",
  "support_ratio",
  "claim_specificity",
  "temporal_spread",
  "evidence_volume",
  "falsifiability",
  "rhetorical_pressure",
  "source_quality",
  "contradiction_load",
  "citation_chain_collapse",
];

const LEGACY_FEATURE_KEYS = [
  "claim_specificity",
  "root_depth",
  "source_independence",
  "evidence_volume",
  "external_support_ratio",
  "temporal_spread",
  "consensus_alignment",
  "source_tier",
  "rhetorical_red_flags",
  "citation_chain_closure",
  "claim_falsifiability",
];

const FEATURE_KEYS = CANONICAL_FEATURE_KEYS;
const ALL_FEATURE_KEYS = [...LEGACY_FEATURE_KEYS, ...CANONICAL_FEATURE_KEYS];

const PER_CLAIM_FEATURE_KEYS = [
  "claim_specificity",
  "root_depth",
  "support_ratio",
  "evidence_volume",
  "temporal_spread",
  "contradiction_load",
  "source_quality",
  "citation_chain_collapse",
  "falsifiability",
];

const CITATION_DEPTH_SCORES = {
  direct_primary: 3,
  indirect_primary: 2,
  secondary: 1,
  unanchored: 0,
};

const SOURCE_TIER_WEIGHTS = {
  primary: 1.0,
  secondary: 0.7,
  tertiary: 0.4,
  self_referential: 0.1,
};

const FALSIFIABILITY_WEIGHTS = {
  falsifiable: 1.0,
  vague: 0.6,
  unfalsifiable: 0.0,
};

const TAVILY_TIER_WEIGHTS = {
  1: 1.0,
  2: 0.6,
  3: 0.3,
  4: 0.1,
  5: -0.5,
};

export function round6(n) {
  return Number(Number(n).toFixed(6));
}

function assertWeightProfiles() {
  const profiles = [FACTUAL_WEIGHTS, OPINION_WEIGHTS, REFERENCE_WEIGHTS];
  for (const profile of profiles) {
    const sum = round6(Object.values(profile).reduce((acc, value) => round6(acc + value), 0));
    if (sum !== 1) {
      throw new Error(`Weight profile must sum to 1.0, got ${sum}`);
    }
  }
}

assertWeightProfiles();

function clamp01(n) {
  return round6(Math.max(0, Math.min(1, Number(n))));
}

function isFiniteFeature(value) {
  return value != null && Number.isFinite(Number(value));
}

function firstFinite(...values) {
  for (const value of values) {
    if (isFiniteFeature(value)) {
      return Number(value);
    }
  }
  return null;
}

function supportRatioFromLegacy(features) {
  const external = firstFinite(features.external_support_ratio);
  const consensus = firstFinite(features.consensus_alignment);
  if (external == null && consensus == null) {
    return null;
  }
  if (external == null) {
    return clamp01(consensus);
  }
  if (consensus == null) {
    return clamp01(external);
  }
  return clamp01(Math.min(external, consensus));
}

function withCanonicalFeatures(features) {
  const out = { ...(features || {}) };
  const aliases = {
    support_ratio: supportRatioFromLegacy(out),
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

function mean(values, defaultValue = 0) {
  if (!values.length) {
    return round6(defaultValue);
  }
  return round6(values.reduce((acc, value) => round6(acc + value), 0) / values.length);
}

function toTavilyResult(tavilyResult) {
  if (tavilyResult == null) {
    return null;
  }
  if (typeof tavilyResult !== "object") {
    return null;
  }
  const byClaimId = tavilyResult.by_claim_id ?? tavilyResult;
  if (!byClaimId || typeof byClaimId !== "object" || Array.isArray(byClaimId)) {
    return null;
  }
  return { by_claim_id: byClaimId };
}

function getWeightsForContentType(contentType) {
  const normalized = String(contentType || "").trim().toLowerCase();
  if (normalized === "factual") {
    return { ...FACTUAL_WEIGHTS };
  }
  if (normalized === "opinion") {
    return { ...OPINION_WEIGHTS };
  }
  if (normalized === "reference") {
    return { ...REFERENCE_WEIGHTS };
  }
  throw new Error(`Unknown content type: ${contentType}`);
}

function scoreToVerdict(score) {
  if (score >= 0.7) {
    return "trustworthy";
  }
  if (score >= 0.4) {
    return "mixed";
  }
  return "unreliable";
}

function sourceIndex(extraction) {
  const index = {};
  for (const source of extraction.cited_sources || []) {
    index[source.id] = {
      domain: source.domain,
      tier: source.tier,
    };
  }
  return index;
}

function allCitations(extraction) {
  const refs = [];
  for (const claim of extraction.claims || []) {
    refs.push(...(claim.cited_source_refs || []));
  }
  return refs;
}

function claimSpecificity(extraction) {
  const perClaim = [];
  for (const claim of extraction.claims || []) {
    const anchorCount = (claim.specificity_anchors || []).length;
    perClaim.push(round6(Math.min(round6(anchorCount / 3), 1)));
  }
  return mean(perClaim, 0);
}

function rootDepth(extraction) {
  const perClaim = [];
  for (const claim of extraction.claims || []) {
    const score = CITATION_DEPTH_SCORES[claim.citation_kind] ?? 0;
    perClaim.push(round6(score / 3));
  }
  return mean(perClaim, 0);
}

function sourceIndependence(extraction) {
  const sourceMap = sourceIndex(extraction);
  const citations = allCitations(extraction);
  const total = citations.length;
  if (total === 0) {
    return 0.1;
  }

  const parentCounts = new Map();
  for (const ref of citations) {
    const source = sourceMap[ref] || {};
    const parent = getParentOrg(source.domain);
    parentCounts.set(parent, (parentCounts.get(parent) || 0) + 1);
  }
  const maxShare = round6(Math.max(...Array.from(parentCounts.values())) / total);
  return clamp01(round6(1 - maxShare));
}

function externalSupportRatio(articleLevel) {
  const list = articleLevel?.checkable_facts_per_paragraph || [];
  const totalCheckable = round6(list.reduce((acc, value) => round6(acc + value), 0));
  const totalParagraphs = list.length;
  const ratio = round6(totalCheckable / Math.max(totalParagraphs, 1));
  return clamp01(Math.min(ratio, 1));
}

function saturatingVolume(units, scale) {
  return clamp01(round6(1 - Math.exp(-Number(units || 0) / Math.max(scale, 0.000001))));
}

function evidenceVolume(extraction) {
  const citations = allCitations(extraction);
  const distinctRefs = new Set(citations).size;
  const sourceCount = (extraction.cited_sources || []).length;
  const checkableFacts = (extraction.article_level?.checkable_facts_per_paragraph || []).reduce(
    (acc, value) => round6(acc + value),
    0,
  );
  const claimCount = (extraction.claims || []).length;
  const units = round6(distinctRefs + sourceCount * 0.5 + Math.min(checkableFacts, Math.max(1, claimCount) * 3));
  return saturatingVolume(units, 8);
}

function evidenceVolumeForClaim(claim, tavilyResult) {
  const refs = new Set(claim.cited_source_refs || []);
  const anchors = (claim.specificity_anchors || []).length;
  const tavilyRows = tavilyResult?.by_claim_id?.[claim.id]?.length || 0;
  const units = round6(refs.size + anchors * 0.5 + tavilyRows * 0.75);
  return saturatingVolume(units, 4);
}

function parseDate(raw) {
  if (!raw) {
    return null;
  }
  const text = String(raw).trim();
  if (!text) {
    return null;
  }
  const d = new Date(text.slice(0, 10));
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

function temporalForClaim(claim, tavilyResult) {
  if (!tavilyResult) {
    return null;
  }
  const rows = tavilyResult.by_claim_id?.[claim.id] || [];
  if (!rows.length) {
    return null;
  }
  let dates = rows.map((row) => parseDate(row.published_date)).filter(Boolean);
  if (!dates.length) {
    return null;
  }
  dates = dates.sort((a, b) => a.getTime() - b.getTime());
  const oldest = dates[0];
  const newest = dates[dates.length - 1];
  const years = round6((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  const longevity = round6(Math.min(round6(years / 3), 1));

  let diversityRaw = 0;
  for (const row of rows) {
    diversityRaw = round6(diversityRaw + (TAVILY_TIER_WEIGHTS[getTier(row.domain)] ?? 0.1));
  }
  const diversity = clamp01(round6(diversityRaw / 5));
  return clamp01(round6(longevity * diversity));
}

function temporalSpread(extraction, tavilyResult) {
  const ordered = [...(extraction.claims || [])].sort((a, b) => {
    const byAnchors = (b.specificity_anchors || []).length - (a.specificity_anchors || []).length;
    if (byAnchors !== 0) {
      return byAnchors;
    }
    return String(a.id).localeCompare(String(b.id));
  });

  const topClaims = ordered.slice(0, 3);
  const spreads = [];
  for (const claim of topClaims) {
    const score = temporalForClaim(claim, tavilyResult);
    if (score != null) {
      spreads.push(score);
    }
  }
  if (!spreads.length) {
    return null;
  }
  return mean(spreads);
}

function consensusAlignment(extraction) {
  let total = 0;
  let unengaged = 0;
  for (const claim of extraction.claims || []) {
    if (claim.contradicts_consensus == null) {
      continue;
    }
    total += 1;
    if (claim.contradicts_consensus && !claim.engages_consensus) {
      unengaged += 1;
    }
  }
  if (total === 0) {
    return null;
  }
  const score = round6(1 - round6(unengaged / total));
  return clamp01(score);
}

function sourceTier(extraction) {
  const known = (extraction.cited_sources || []).filter((source) => source.tier !== "unknown");
  if (!known.length) {
    return 0.3;
  }
  const weights = known.map((source) => SOURCE_TIER_WEIGHTS[source.tier] ?? 0.3);
  return mean(weights);
}

function rhetoricalRedFlags(articleLevel) {
  const flags = articleLevel.rhetorical_red_flags;
  const weighted = round6(
    round6(2 * flags.urgency_framing) +
      round6(2 * flags.suppressed_truth_narrative) +
      round6(1.5 * flags.appeal_to_hidden_knowledge) +
      round6(1 * flags.emotional_appeal_decoupled) +
      round6(1 * flags.identity_based_dismissal) +
      round6(1 * flags.false_precision),
  );
  const penalty = round6(Math.min(round6(weighted / 6), 1));
  return clamp01(round6(1 - penalty));
}

function topSourceShare(claim, extraction) {
  if (!(claim.cited_source_refs || []).length) {
    return 0;
  }
  const map = sourceIndex(extraction);
  const parentCounts = new Map();
  for (const ref of claim.cited_source_refs || []) {
    const source = map[ref] || {};
    const parent = getParentOrg(source.domain);
    parentCounts.set(parent, (parentCounts.get(parent) || 0) + 1);
  }
  return round6(Math.max(...Array.from(parentCounts.values())) / claim.cited_source_refs.length);
}

function citationChainClosure(extraction) {
  const citations = allCitations(extraction);
  if (!(extraction.claims || []).length) {
    return 1;
  }

  const map = sourceIndex(extraction);
  const parentCounts = new Map();
  for (const ref of citations) {
    const source = map[ref] || {};
    const parent = getParentOrg(source.domain);
    parentCounts.set(parent, (parentCounts.get(parent) || 0) + 1);
  }
  let topShare = 0;
  if (citations.length && parentCounts.size) {
    topShare = round6(Math.max(...Array.from(parentCounts.values())) / citations.length);
  }

  let selfReinforcing = 0;
  for (const claim of extraction.claims || []) {
    selfReinforcing += claim.citation_chain_markers.self_reinforcing_citations;
  }

  const closureScore = round6(selfReinforcing + (topShare > 0.5 ? 1 : 0));
  const penalty = round6(Math.min(round6(closureScore / 3), 1));
  return clamp01(round6(1 - penalty));
}

function claimFalsifiability(extraction) {
  const weights = (extraction.claims || []).map((claim) => FALSIFIABILITY_WEIGHTS[claim.falsifiability] ?? 0);
  return mean(weights, 0);
}

const ACC_RULE_THRESHOLDS = {
  source_independence: 0.35,
  evidence_volume: 0.3,
  root_depth: 0.25,
  temporal_spread: 0.15,
  support_ratio: 0.5,
  claim_specificity: 0.25,
};

const ACC_PENALTY_WEIGHTS = {
  single_source_collapse: 0.2,
  thin_evidence: 0.18,
  rootless_claim: 0.16,
  contradiction_pressure: 0.14,
  temporal_collapse: 0.1,
  vague_claim: 0.08,
};

const ACTION_BY_PENALTY = {
  single_source_collapse: ["request_independent_source", "Add an independent source branch before promotion."],
  thin_evidence: ["gather_more_evidence", "Collect more direct support for this claim."],
  rootless_claim: ["seek_primary_root", "Trace support back to a reviewed or primary root."],
  contradiction_pressure: ["resolve_contradiction", "Adjudicate contradiction before trusting the claim."],
  temporal_collapse: ["broaden_temporal_sampling", "Check evidence across a wider time window."],
  vague_claim: ["sharpen_claim", "Rewrite the claim with concrete anchors."],
};

function hasFeature(features, key) {
  return isFiniteFeature(features[key]);
}

function ruleForFeature({ id, features, key, threshold, reason, passWhenMissing = true }) {
  if (!hasFeature(features, key)) {
    return { id, passed: passWhenMissing, value: null, threshold, reason };
  }
  const value = Number(features[key]);
  return { id, passed: value >= threshold, value: round6(value), threshold, reason };
}

function evaluateAccRules(features) {
  const temporalKnown = hasFeature(features, "temporal_spread");
  const evidence = hasFeature(features, "evidence_volume") ? Number(features.evidence_volume) : 0;
  return [
    ruleForFeature({
      id: "requires_independent_sources",
      features,
      key: "source_independence",
      threshold: ACC_RULE_THRESHOLDS.source_independence,
      reason: "Claim has independent source support.",
    }),
    ruleForFeature({
      id: "requires_evidence_volume",
      features,
      key: "evidence_volume",
      threshold: ACC_RULE_THRESHOLDS.evidence_volume,
      reason: "Claim has enough direct support volume to evaluate.",
    }),
    ruleForFeature({
      id: "requires_rooted_support",
      features,
      key: "root_depth",
      threshold: ACC_RULE_THRESHOLDS.root_depth,
      reason: "Support reaches a primary, reviewed, or well-rooted source.",
    }),
    {
      id: "requires_temporal_spread",
      passed: !temporalKnown || evidence < 0.5 || Number(features.temporal_spread) >= ACC_RULE_THRESHOLDS.temporal_spread,
      value: temporalKnown ? round6(Number(features.temporal_spread)) : null,
      threshold: ACC_RULE_THRESHOLDS.temporal_spread,
      reason: "Evidence does not collapse into a single time window.",
    },
    ruleForFeature({
      id: "requires_support_over_contradiction",
      features,
      key: "support_ratio",
      threshold: ACC_RULE_THRESHOLDS.support_ratio,
      reason: "Support is at least balanced against contradiction pressure.",
    }),
    ruleForFeature({
      id: "requires_specific_claim",
      features,
      key: "claim_specificity",
      threshold: ACC_RULE_THRESHOLDS.claim_specificity,
      reason: "Claim text has enough concrete anchors to test.",
    }),
  ];
}

function severityBelow(value, threshold) {
  if (value == null || threshold <= 0 || value >= threshold) {
    return 0;
  }
  return clamp01(round6((threshold - value) / threshold));
}

function evaluateAccPenalties(features, rules) {
  const byId = Object.fromEntries(rules.map((rule) => [rule.id, rule]));
  const candidates = [
    [
      "single_source_collapse",
      severityBelow(byId.requires_independent_sources.value, ACC_RULE_THRESHOLDS.source_independence),
      "Supporting evidence collapses into too little source independence.",
    ],
    [
      "thin_evidence",
      severityBelow(byId.requires_evidence_volume.value, ACC_RULE_THRESHOLDS.evidence_volume),
      "Direct support volume is too low for confident scoring.",
    ],
    [
      "rootless_claim",
      severityBelow(byId.requires_rooted_support.value, ACC_RULE_THRESHOLDS.root_depth),
      "Support does not reach a primary, reviewed, or well-rooted source.",
    ],
    [
      "contradiction_pressure",
      severityBelow(byId.requires_support_over_contradiction.value, ACC_RULE_THRESHOLDS.support_ratio),
      "Contradiction pressure is too high relative to support.",
    ],
    [
      "temporal_collapse",
      byId.requires_temporal_spread.passed
        ? 0
        : severityBelow(features.temporal_spread, ACC_RULE_THRESHOLDS.temporal_spread),
      "Evidence is concentrated in a narrow time window.",
    ],
    [
      "vague_claim",
      severityBelow(byId.requires_specific_claim.value, ACC_RULE_THRESHOLDS.claim_specificity),
      "Claim is too vague to adjudicate cleanly.",
    ],
  ];

  const penalties = [];
  for (const [id, severity, reason] of candidates) {
    if (severity <= 0) {
      continue;
    }
    const weight = ACC_PENALTY_WEIGHTS[id];
    penalties.push({ id, severity, weight, impact: clamp01(round6(severity * weight)), reason });
  }
  return penalties;
}

function recommendActions(penalties, score, threshold = 0.55) {
  const actions = [];
  const seen = new Set();
  const ordered = [...penalties].sort((a, b) => b.impact - a.impact || a.id.localeCompare(b.id));
  for (const penalty of ordered) {
    const [id, reason] = ACTION_BY_PENALTY[penalty.id];
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    actions.push({ id, priority: penalty.impact >= 0.12 ? "high" : "medium", reason });
  }
  if (score < threshold && !seen.has("defer_promotion")) {
    actions.push({
      id: "defer_promotion",
      priority: "high",
      reason: "Do not promote this claim until failed ACC checks are resolved.",
    });
  }
  return actions;
}

function diagnosticsFromFeatures(features) {
  const normalized = withCanonicalFeatures(features);
  const evidence = clamp01(normalized.evidence_volume ?? 0);
  const visible = evidence > 0 ? Math.max(1, Math.round(evidence * 8)) : 0;
  const collapseRatio = clamp01(1 - clamp01(normalized.citation_chain_collapse ?? 1));
  const canonical = visible > 1 ? Math.max(1, Math.round(visible * (1 - collapseRatio))) : visible;
  const root = clamp01(normalized.root_depth ?? 0);
  const contradiction = clamp01(normalized.contradiction_load ?? 1);
  const supportBranches = evidence > 0 ? Math.max(1, visible) : 0;

  return {
    support_branch_count: supportBranches,
    visible_source_count: visible,
    canonical_origin_count: canonical,
    source_collapse_ratio: collapseRatio,
    verified_root_count: root >= 0.65 ? 2 : root >= 0.25 ? 1 : 0,
    contradiction_count: contradiction >= 0.5 ? 0 : Math.max(1, Math.round((1 - contradiction) * 3)),
    source_independence_confidence: supportBranches <= 0 ? 0 : supportBranches === 1 ? 0.35 : clamp01(1 - Math.exp(-supportBranches / 3)),
  };
}

function verificationGapFromFeatures(features, diagnostics) {
  const normalized = withCanonicalFeatures(features);
  const visible = Number(diagnostics.visible_source_count || 0);
  const collapse = Number(diagnostics.source_collapse_ratio || 0);
  const verifiedRoots = Number(diagnostics.verified_root_count || 0);
  const branches = Number(diagnostics.support_branch_count || 0);
  const contradictions = Number(diagnostics.contradiction_count || 0);
  const support = clamp01(normalized.support_ratio ?? 0);
  const evidence = clamp01(normalized.evidence_volume ?? 0);
  const specificity = clamp01(normalized.claim_specificity ?? 0);
  const temporal = clamp01(normalized.temporal_spread ?? 1);

  if (visible >= 3 && collapse >= 0.5) {
    return "Multiple citations trace back to fewer canonical origins. Find an independent primary source.";
  }
  if (branches === 0) {
    return "No supporting evidence has been linked yet.";
  }
  if (verifiedRoots === 0) {
    return "Needs a verified or reviewed primary root.";
  }
  if (contradictions > 0 && support < 0.5) {
    return "Contradiction pressure outweighs support. Adjudicate before promoting.";
  }
  if (evidence < 0.3) {
    return "Direct support volume is too low. Gather more evidence.";
  }
  if (specificity < 0.25) {
    return "Claim is too vague to adjudicate cleanly. Sharpen with concrete anchors.";
  }
  if (temporal < 0.15 && evidence >= 0.5) {
    return "Evidence collapses into a narrow time window. Broaden temporal sampling.";
  }
  return "";
}

function classifyClaimStateFromFeatures(score, threshold, features, diagnostics) {
  const normalized = withCanonicalFeatures(features);
  const visible = Number(diagnostics.visible_source_count || 0);
  const collapse = Number(diagnostics.source_collapse_ratio || 0);
  const verifiedRoots = Number(diagnostics.verified_root_count || 0);
  const branches = Number(diagnostics.support_branch_count || 0);
  const contradictions = Number(diagnostics.contradiction_count || 0);
  const support = clamp01(normalized.support_ratio ?? 0);
  const evidence = clamp01(normalized.evidence_volume ?? 0);
  const specificity = clamp01(normalized.claim_specificity ?? 0);

  if (score >= Math.max(0.65, threshold) && visible >= 2 && verifiedRoots >= 1 && contradictions === 0) {
    return "well_supported";
  }
  if (visible >= 3 && collapse >= 0.5) {
    return "source_collapsed";
  }
  if (contradictions > 0 && support < 0.5) {
    return "contradicted";
  }
  if (evidence < 0.3 || branches === 0) {
    return "under_evidenced";
  }
  if (branches > 0 && verifiedRoots === 0) {
    return "rootless";
  }
  if (specificity < 0.25) {
    return "vague";
  }
  if (score < threshold) {
    return "suspect";
  }
  return "unresolved";
}

function geometricCore(features, weights) {
  const entries = Object.entries(weights).filter(([key, weight]) => weight > 0 && hasFeature(features, key));
  const total = entries.reduce((acc, [, weight]) => round6(acc + weight), 0);
  if (!entries.length || total <= 0) {
    return 0;
  }

  let logSum = 0;
  for (const [key, weight] of entries) {
    const value = Math.max(0.001, clamp01(features[key]));
    logSum += round6((weight / total) * Math.log(value));
  }
  return clamp01(round6(Math.exp(logSum)));
}

function computeAccV2Assessment(features, weights, linearScore) {
  const normalizedFeatures = withCanonicalFeatures(features);
  const core = geometricCore(normalizedFeatures, weights);
  const rules = evaluateAccRules(normalizedFeatures);
  const penalties = evaluateAccPenalties(normalizedFeatures, rules);
  const penaltyTotal = round6(Math.min(0.45, penalties.reduce((acc, penalty) => round6(acc + penalty.impact), 0)));
  const score = clamp01(round6(0.65 * linearScore + 0.35 * core - penaltyTotal));
  const diagnostics = diagnosticsFromFeatures(normalizedFeatures);
  const supportStrength = clamp01(round6(0.65 * linearScore + 0.35 * core));
  const risk = clamp01(
    round6(
      0.3 * Math.min(1, penaltyTotal / 0.45) +
        0.25 * diagnostics.source_collapse_ratio +
        0.15 * Math.min(1, diagnostics.contradiction_count / 3) +
        0.15 * (1 - Math.min(1, diagnostics.verified_root_count / 2)) +
        0.15 * (1 - clamp01(normalizedFeatures.evidence_volume ?? 0)),
    ),
  );
  return {
    score,
    linear_score: round6(linearScore),
    geometric_core: core,
    penalty_total: penaltyTotal,
    rules,
    penalties,
    actions: recommendActions(penalties, score),
    support_strength: supportStrength,
    epistemic_risk: risk,
    claim_state: classifyClaimStateFromFeatures(score, 0.55, normalizedFeatures, diagnostics),
    verification_gap: verificationGapFromFeatures(normalizedFeatures, diagnostics),
    diagnostics,
  };
}

function claimLevelFeatures(claim, extraction, tavilyResult) {
  const index = sourceIndex(extraction);

  const f1 = round6(Math.min(round6((claim.specificity_anchors || []).length / 3), 1));
  const f2 = round6((CITATION_DEPTH_SCORES[claim.citation_kind] ?? 0) / 3);
  const f5 = temporalForClaim(claim, tavilyResult);

  let f6;
  if (claim.contradicts_consensus == null) {
    f6 = null;
  } else {
    f6 = claim.contradicts_consensus && !claim.engages_consensus ? 0 : 1;
  }

  const sourceWeights = [];
  for (const ref of claim.source_tier_refs || []) {
    const source = index[ref];
    if (!source) {
      continue;
    }
    const tier = source.tier || "unknown";
    if (tier === "unknown") {
      continue;
    }
    sourceWeights.push(SOURCE_TIER_WEIGHTS[tier] ?? 0.3);
  }
  const f7 = mean(sourceWeights, 0.3);
  const claimEvidence = evidenceVolumeForClaim(claim, tavilyResult);

  const closureScore = round6(
    claim.citation_chain_markers.self_reinforcing_citations + (topSourceShare(claim, extraction) > 0.5 ? 1 : 0),
  );
  const f9 = clamp01(round6(1 - Math.min(round6(closureScore / 3), 1)));

  const f10 = FALSIFIABILITY_WEIGHTS[claim.falsifiability] ?? 0;

  return withCanonicalFeatures({
    claim_specificity: f1,
    root_depth: f2,
    evidence_volume: claimEvidence,
    external_support_ratio: f6 == null ? claimEvidence : clamp01(Math.min(claimEvidence, f6)),
    temporal_spread: f5,
    consensus_alignment: f6,
    source_tier: f7,
    citation_chain_closure: f9,
    claim_falsifiability: round6(f10),
  });
}

export function computeFeatureScores(extraction, tavilyResult) {
  const tavily = toTavilyResult(tavilyResult);
  const features = withCanonicalFeatures({
    claim_specificity: claimSpecificity(extraction),
    root_depth: rootDepth(extraction),
    source_independence: sourceIndependence(extraction),
    evidence_volume: evidenceVolume(extraction),
    external_support_ratio: externalSupportRatio(extraction.article_level),
    temporal_spread: temporalSpread(extraction, tavily),
    consensus_alignment: consensusAlignment(extraction),
    source_tier: sourceTier(extraction),
    rhetorical_red_flags: rhetoricalRedFlags(extraction.article_level),
    citation_chain_closure: citationChainClosure(extraction),
    claim_falsifiability: claimFalsifiability(extraction),
  });

  for (const key of ALL_FEATURE_KEYS) {
    if (features[key] != null) {
      features[key] = round6(features[key]);
    }
  }
  return features;
}

export function computeOverallScore(features, profileWeights) {
  const normalizedFeatures = withCanonicalFeatures(features);
  const available = {};
  const missing = [];
  for (const key of Object.keys(profileWeights)) {
    if (normalizedFeatures[key] == null) {
      missing.push(key);
    } else {
      available[key] = normalizedFeatures[key];
    }
  }

  let effectiveWeights;
  if (missing.length) {
    const missingWeight = round6(missing.reduce((acc, key) => round6(acc + profileWeights[key]), 0));
    const availableWeight = round6(Object.keys(available).reduce((acc, key) => round6(acc + profileWeights[key]), 0));
    const scale = round6(1 + round6(missingWeight / availableWeight));
    effectiveWeights = {};
    for (const key of Object.keys(available)) {
      effectiveWeights[key] = round6(profileWeights[key] * scale);
    }
  } else {
    effectiveWeights = {};
    for (const key of Object.keys(available)) {
      effectiveWeights[key] = round6(profileWeights[key]);
    }
  }

  let raw = 0;
  for (const [key, value] of Object.entries(available)) {
    raw = round6(raw + round6(value * effectiveWeights[key]));
  }

  const assessment = computeAccV2Assessment(available, effectiveWeights, clamp01(raw));
  return { ...assessment, verdict: scoreToVerdict(assessment.score) };
}

export function computePerClaimScore(claimFeatures, profileWeights) {
  const normalizedFeatures = withCanonicalFeatures(claimFeatures);
  const eligible = {};
  for (const key of PER_CLAIM_FEATURE_KEYS) {
    if (normalizedFeatures[key] != null) {
      eligible[key] = normalizedFeatures[key];
    }
  }
  if (!Object.keys(eligible).length) {
    const assessment = computeAccV2Assessment({}, {}, 0);
    return { ...assessment, verdict: "unreliable" };
  }

  const baseTotal = round6(PER_CLAIM_FEATURE_KEYS.reduce((acc, key) => round6(acc + profileWeights[key]), 0));
  const renormalized = {};
  for (const key of PER_CLAIM_FEATURE_KEYS) {
    renormalized[key] = round6(profileWeights[key] / baseTotal);
  }

  const missing = PER_CLAIM_FEATURE_KEYS.filter((key) => !(key in eligible));
  let weights;
  if (missing.length) {
    const missingWeight = round6(missing.reduce((acc, key) => round6(acc + renormalized[key]), 0));
    const availableWeight = round6(Object.keys(eligible).reduce((acc, key) => round6(acc + renormalized[key]), 0));
    const scale = round6(1 + round6(missingWeight / availableWeight));
    weights = {};
    for (const key of Object.keys(eligible)) {
      weights[key] = round6(renormalized[key] * scale);
    }
  } else {
    weights = { ...renormalized };
  }

  let raw = 0;
  for (const [key, value] of Object.entries(eligible)) {
    raw = round6(raw + round6(value * weights[key]));
  }

  const assessment = computeAccV2Assessment(eligible, weights, clamp01(raw));
  return { ...assessment, verdict: scoreToVerdict(assessment.score) };
}

function buildClaimFeatureSet(claimOnlyFeatures, articleFeatures) {
  const merged = { ...articleFeatures };
  for (const [key, value] of Object.entries(claimOnlyFeatures)) {
    merged[key] = value;
  }
  return withCanonicalFeatures(merged);
}

function claimRationale(claimFeatures, verdict) {
  const ranked = FEATURE_KEYS.map((key) => [key, claimFeatures[key] == null ? 0.5 : Number(claimFeatures[key])]).sort(
    (a, b) => a[1] - b[1],
  );
  const lowest = ranked.slice(0, 2).map((item) => item[0]).join(", ");
  const highest = ranked.slice(-2).map((item) => item[0]).join(", ");
  if (verdict === "trustworthy") {
    return `Trustworthy signal: strong ${highest}. Minor weakness: ${lowest}.`.slice(0, 240);
  }
  if (verdict === "mixed") {
    return `Mixed signal: strengths in ${highest}, weaknesses in ${lowest}.`.slice(0, 240);
  }
  return `Unreliable signal: weak ${lowest}; limited support from ${highest}.`.slice(0, 240);
}

function tavilyCallsMade(extraction, tavilyResult) {
  if (!tavilyResult) {
    return 0;
  }
  const ordered = [...(extraction.claims || [])].sort((a, b) => {
    const byAnchors = (b.specificity_anchors || []).length - (a.specificity_anchors || []).length;
    if (byAnchors !== 0) {
      return byAnchors;
    }
    return String(a.id).localeCompare(String(b.id));
  });
  const topIds = new Set(ordered.slice(0, 3).map((claim) => claim.id));
  let count = 0;
  for (const claimId of topIds) {
    if (claimId in tavilyResult.by_claim_id) {
      count += 1;
    }
  }
  return count;
}

export function scoreText(extraction, tavilyResult, contentType, contentConfidence) {
  let normalizedType = String(contentType || "factual").trim().toLowerCase();
  const confidence = clamp01(contentConfidence);
  const tavily = toTavilyResult(tavilyResult);

  if (normalizedType === "fiction" && confidence > 0.7) {
    return {
      overall_score: null,
      verdict: "fiction",
      content_type: "fiction",
      weight_profile_used: null,
      features: null,
      claims: [],
      meta: {
        algorithm_version: ALGORITHM_VERSION,
        model_version: "unknown",
        runtime: "python",
        tavily_calls_made: 0,
        elapsed_ms: 0,
        content_classifier_confidence: confidence,
      },
    };
  }

  if (!["factual", "opinion", "reference"].includes(normalizedType)) {
    normalizedType = "factual";
  }

  const profileWeights = getWeightsForContentType(normalizedType);
  const articleFeatures = computeFeatureScores(extraction, tavily);
  const overall = computeOverallScore(articleFeatures, profileWeights);

  const claims = [];
  for (const claim of extraction.claims || []) {
    const claimOnly = claimLevelFeatures(claim, extraction, tavily);
    const claimBreakdown = buildClaimFeatureSet(claimOnly, articleFeatures);
    const claimScore = computePerClaimScore(claimOnly, profileWeights);

    const result = {
      id: claim.id,
      text: claim.text,
      char_start: claim.char_start,
      char_end: claim.char_end,
      score: claimScore.score,
      verdict: claimScore.verdict,
      linear_score: claimScore.linear_score,
      geometric_core: claimScore.geometric_core,
      penalty_total: claimScore.penalty_total,
      rules: claimScore.rules,
      penalties: claimScore.penalties,
      actions: claimScore.actions,
      support_strength: claimScore.support_strength,
      epistemic_risk: claimScore.epistemic_risk,
      claim_state: claimScore.claim_state,
      verification_gap: claimScore.verification_gap,
      diagnostics: claimScore.diagnostics,
      feature_breakdown: claimBreakdown,
      rationale: claimRationale(claimBreakdown, claimScore.verdict),
      mini_graph_svg: "",
    };

    result.mini_graph_svg = renderClaimMiniGraph(result);
    claims.push(result);
  }

  return {
    overall_score: overall.score,
    verdict: overall.verdict,
    linear_score: overall.linear_score,
    geometric_core: overall.geometric_core,
    penalty_total: overall.penalty_total,
    rules: overall.rules,
    penalties: overall.penalties,
    actions: overall.actions,
    support_strength: overall.support_strength,
    epistemic_risk: overall.epistemic_risk,
    claim_state: overall.claim_state,
    verification_gap: overall.verification_gap,
    diagnostics: overall.diagnostics,
    content_type: normalizedType,
    weight_profile_used: normalizedType,
    features: articleFeatures,
    claims,
    meta: {
      algorithm_version: ALGORITHM_VERSION,
      model_version: "unknown",
      runtime: "python",
      tavily_calls_made: tavilyCallsMade(extraction, tavily),
      elapsed_ms: 0,
      content_classifier_confidence: confidence,
    },
  };
}

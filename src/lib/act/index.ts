/**
 * /act analyzer public API.
 *
 * Bridges the heuristic extractor (TypeScript) with the canonical ACC
 * scoring port (JavaScript, contract-tested against the Python
 * reference). The page imports `analyzeDocument` and gets a normalized,
 * page-friendly result.
 *
 * Pipeline:
 *   raw text
 *     -> extractFromText() (heuristic; will be Gemma 4B GL-Fusion in Phase 2)
 *     -> scoreText()       (canonical ACC v2: linear + geometric - penalties)
 *     -> normalize()       (shape adjustments for the parchment UI)
 */

// scoring.js is the canonical port from anti-conspirarcy-theorem.
// It is imported as JS to preserve contract-test parity with the
// upstream tests in browser-extension/tests/contract.test.js. The
// implicit-any is acceptable here because the scoring contract is
// validated by upstream tests, not by TS types in this codebase.
// @ts-expect-error scoring.js ships without type declarations on purpose.
import { scoreText } from './scoring.js';
import { extractFromText, extractWithGemma, type ContentType } from './extract';
export { MLCRunner } from './mlc-runner';
export type { LoadProgress, ModelDescriptor, RunnerState } from './mlc-runner';

export type { ContentType } from './extract';

export type Verdict = 'trustworthy' | 'mixed' | 'unreliable' | 'fiction';

export interface AccRule {
  id: string;
  passed: boolean;
  value: number | null;
  threshold: number;
  reason: string;
}

export interface AccPenalty {
  id: string;
  weight: number;
  reason: string;
}

export interface AccAction {
  id: string;
  guidance: string;
}

export interface ScoredClaim {
  id: string;
  text: string;
  char_start: number;
  char_end: number;
  score: number;
  verdict: Verdict;
  linear_score: number;
  geometric_core: number;
  penalty_total: number;
  rules: AccRule[];
  penalties: AccPenalty[];
  actions: AccAction[];
  feature_breakdown: Record<string, number>;
  rationale: string;
  mini_graph_svg: string;
}

export interface AnalysisResult {
  title: string;
  source_label: string;
  source_type: 'url' | 'document' | 'text';
  content_type: ContentType;
  word_count: number;
  overall_score: number | null;
  verdict: Verdict;
  linear_score: number;
  geometric_core: number;
  penalty_total: number;
  rules: AccRule[];
  penalties: AccPenalty[];
  actions: AccAction[];
  features: Record<string, number> | null;
  claims: ScoredClaim[];
  trustworthy_count: number;
  mixed_count: number;
  unreliable_count: number;
  algorithm_version: string;
}

export const FEATURE_LABELS: Record<string, string> = {
  claim_specificity: 'Claim specificity',
  root_depth: 'Root depth',
  source_independence: 'Source independence',
  evidence_volume: 'Evidence volume',
  external_support_ratio: 'External support ratio',
  temporal_spread: 'Temporal spread',
  consensus_alignment: 'Consensus alignment',
  source_tier: 'Source tier',
  rhetorical_red_flags: 'Rhetorical red flags',
  citation_chain_closure: 'Citation chain closure',
  claim_falsifiability: 'Falsifiability',
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  trustworthy: 'Trustworthy',
  mixed: 'Mixed',
  unreliable: 'Unreliable',
  fiction: 'Fiction',
};

export const MAX_TEXT_LENGTH = 30000;
export const MAX_FILE_BYTES = 1_000_000;

interface RawScoreResult {
  overall_score: number | null;
  verdict: string;
  linear_score: number;
  geometric_core: number;
  penalty_total: number;
  rules: AccRule[];
  penalties: AccPenalty[];
  actions: AccAction[];
  content_type: ContentType;
  features: Record<string, number> | null;
  claims: Array<ScoredClaim & { verdict: string }>;
  meta: {
    algorithm_version: string;
    [key: string]: unknown;
  };
}

function urlSafeLabel(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function scoreFromExtraction(
  text: string,
  title: string,
  sourceType: AnalysisResult['source_type'],
  extractionResult: ReturnType<typeof extractFromText>,
): AnalysisResult {
  const { extraction, content_type, content_confidence } = extractionResult;
  const raw = scoreText(extraction, null, content_type, content_confidence) as RawScoreResult;
  return finalizeAnalysis(raw, text, title, sourceType);
}

export function analyzeDocument(
  rawText: string,
  title: string,
  sourceType: AnalysisResult['source_type'],
): AnalysisResult {
  const text = rawText.slice(0, MAX_TEXT_LENGTH);
  return scoreFromExtraction(text, title, sourceType, extractFromText(text));
}

/**
 * LLM-preferred analysis. Calls Gemma 4B if loaded; falls back to the
 * heuristic extractor otherwise. Caller passes a model-readiness flag
 * to avoid awaiting an unavailable engine.
 */
export async function analyzeDocumentAsync(
  rawText: string,
  title: string,
  sourceType: AnalysisResult['source_type'],
  preferModel = true,
): Promise<{ result: AnalysisResult; usedModel: boolean }> {
  const text = rawText.slice(0, MAX_TEXT_LENGTH);
  if (preferModel) {
    try {
      const extraction = await extractWithGemma(text);
      const result = scoreFromExtraction(text, title, sourceType, extraction);
      return { result, usedModel: true };
    } catch {
      // Fall through to heuristic.
    }
  }
  return {
    result: scoreFromExtraction(text, title, sourceType, extractFromText(text)),
    usedModel: false,
  };
}

function finalizeAnalysis(
  raw: RawScoreResult,
  text: string,
  title: string,
  sourceType: AnalysisResult['source_type'],
): AnalysisResult {

  const claims: ScoredClaim[] = (raw.claims || []).map((c) => ({
    ...c,
    verdict: c.verdict as Verdict,
  }));
  void text;

  const trustworthyCount = claims.filter((c) => c.verdict === 'trustworthy').length;
  const mixedCount = claims.filter((c) => c.verdict === 'mixed').length;
  const unreliableCount = claims.filter((c) => c.verdict === 'unreliable').length;

  return {
    title,
    source_label: sourceType === 'url' ? urlSafeLabel(title) : title,
    source_type: sourceType,
    content_type: raw.content_type,
    word_count: normalizeWhitespace(text).split(/\s+/).filter(Boolean).length,
    overall_score: raw.overall_score,
    verdict: raw.verdict as Verdict,
    linear_score: raw.linear_score,
    geometric_core: raw.geometric_core,
    penalty_total: raw.penalty_total,
    rules: raw.rules || [],
    penalties: raw.penalties || [],
    actions: raw.actions || [],
    features: raw.features,
    claims,
    trustworthy_count: trustworthyCount,
    mixed_count: mixedCount,
    unreliable_count: unreliableCount,
    algorithm_version: raw.meta.algorithm_version,
  };
}

export function formatScore(score: number | null): string {
  if (score == null || Number.isNaN(score)) return '—';
  return `${Math.round(score * 100)}%`;
}

export { normalizeWhitespace, urlSafeLabel };

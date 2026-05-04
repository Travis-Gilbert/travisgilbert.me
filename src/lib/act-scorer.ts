/**
 * Anti-Conspiracy Constraint (ACC) heuristic scorer.
 *
 * Browser-side port of the canonical Python ACC algorithm in
 * `anti-conspirarcy-theorem/theseus_acc/algorithm.py`. Runs entirely
 * client-side so /act has no server-side ACC dependency. The Python
 * package remains the offline reference implementation; this port
 * trades exact graph traversal for sentence-level heuristics that are
 * fast enough to run on every keystroke if needed.
 */

export type Verdict = 'strong' | 'mixed' | 'suspect';

export interface ClaimFeatures {
  evidenceVolume: number;
  sourceIndependence: number;
  supportRatio: number;
  specificity: number;
  temporalSpread: number;
  rhetoricalPressure: number;
}

export interface ClaimTrace {
  id: string;
  text: string;
  verdict: Verdict;
  score: number;
  features: ClaimFeatures;
  reasons: string[];
  actions: string[];
}

export interface AnalysisResult {
  title: string;
  sourceLabel: string;
  sourceType: 'url' | 'document' | 'text';
  wordCount: number;
  claimCount: number;
  suspectCount: number;
  mixedCount: number;
  strongCount: number;
  averageScore: number;
  claims: ClaimTrace[];
}

export const FEATURE_LABELS: Record<keyof ClaimFeatures, string> = {
  evidenceVolume: 'Evidence volume',
  sourceIndependence: 'Source independence',
  supportRatio: 'Support ratio',
  specificity: 'Specificity',
  temporalSpread: 'Temporal spread',
  rhetoricalPressure: 'Rhetorical pressure',
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  strong: 'Strong',
  mixed: 'Mixed',
  suspect: 'Suspect',
};

export const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as Array<keyof ClaimFeatures>;
export const MAX_TEXT_LENGTH = 30000;
export const MAX_FILE_BYTES = 1_000_000;

const MAX_CLAIMS = 18;

export function analyzeText(
  text: string,
  title: string,
  sourceType: AnalysisResult['sourceType'],
): AnalysisResult {
  const sentences = extractClaims(text);
  const claims = sentences.slice(0, MAX_CLAIMS).map((sentence, index) => scoreClaim(sentence, index));
  const strongCount = claims.filter((c) => c.verdict === 'strong').length;
  const mixedCount = claims.filter((c) => c.verdict === 'mixed').length;
  const suspectCount = claims.filter((c) => c.verdict === 'suspect').length;
  const averageScore = claims.length
    ? claims.reduce((sum, c) => sum + c.score, 0) / claims.length
    : 0;

  return {
    title,
    sourceLabel: sourceType === 'url' ? urlSafeLabel(title) : title,
    sourceType,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    claimCount: claims.length,
    suspectCount,
    mixedCount,
    strongCount,
    averageScore,
    claims,
  };
}

function extractClaims(text: string): string[] {
  const sentences = normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => {
      const words = s.split(/\s+/).filter(Boolean);
      return words.length >= 8 && words.length <= 80;
    });
  return sentences.length > 0 ? sentences : [normalizeWhitespace(text).slice(0, 420)];
}

function scoreClaim(text: string, index: number): ClaimTrace {
  const lower = text.toLowerCase();
  const sourceMatches = text.match(/\b([a-z0-9-]+\.)+[a-z]{2,}\b/gi) ?? [];
  const yearMatches = text.match(/\b(19|20)\d{2}\b/g) ?? [];
  const numberMatches = text.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
  const properNounMatches = text.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g) ?? [];
  const citationMarkers = [
    'according to', 'reported', 'study', 'court', 'filing',
    'dataset', 'interview', 'research', 'survey', 'records',
  ].filter((m) => lower.includes(m)).length;
  const rhetoricMarkers = [
    'hidden', 'they do not want', "they don't want", 'wake up', 'the truth',
    'cover up', 'everyone knows', 'mainstream media', 'secretly', 'puppet',
    'globalist', 'hoax',
  ].filter((m) => lower.includes(m)).length;

  const totalSources = new Set(sourceMatches.map((s) => s.toLowerCase())).size;
  const evidenceVolume = clamp01((citationMarkers + totalSources + numberMatches.length * 0.35) / 5);
  const sourceIndependence = clamp01((totalSources + citationMarkers * 0.55) / 4);
  const supportRatio = clamp01((citationMarkers + sourceMatches.length + (lower.includes('because') ? 1 : 0)) / 4);
  const specificity = clamp01((yearMatches.length + numberMatches.length + properNounMatches.length * 0.35) / 5);
  const temporalSpread = clamp01(new Set(yearMatches).size / 3);
  const rhetoricalPressure = clamp01((rhetoricMarkers + (text.match(/!/g) ?? []).length * 0.5) / 4);

  const score = clamp01(
    evidenceVolume * 0.22 +
      sourceIndependence * 0.18 +
      supportRatio * 0.18 +
      specificity * 0.18 +
      temporalSpread * 0.1 +
      (1 - rhetoricalPressure) * 0.14,
  );
  const verdict: Verdict = score < 0.55 || rhetoricalPressure > 0.62
    ? 'suspect'
    : score < 0.74
      ? 'mixed'
      : 'strong';

  const features: ClaimFeatures = {
    evidenceVolume,
    sourceIndependence,
    supportRatio,
    specificity,
    temporalSpread,
    rhetoricalPressure,
  };
  const reasons = buildReasons(features);
  const actions = buildActions(verdict, reasons);

  return {
    id: `claim-${index + 1}`,
    text,
    verdict,
    score,
    features,
    reasons,
    actions,
  };
}

function buildReasons(features: ClaimFeatures): string[] {
  const reasons: string[] = [];
  if (features.evidenceVolume < 0.4) reasons.push('Low evidence volume: the claim has few explicit sources, citations, or measurable anchors.');
  if (features.sourceIndependence < 0.4) reasons.push('Weak source independence: support appears to come from a narrow source family.');
  if (features.supportRatio < 0.4) reasons.push('Thin support ratio: the claim asserts more than it directly supports.');
  if (features.specificity > 0.68) reasons.push('Strong specificity: named entities, years, or quantities make the claim easier to check.');
  if (features.temporalSpread > 0.55) reasons.push('Temporal spread is visible: the claim references more than one time anchor.');
  if (features.rhetoricalPressure > 0.45) reasons.push('Rhetorical pressure is elevated: persuasive framing is doing some of the work.');
  if (reasons.length === 0) reasons.push('Balanced trace: no single feature dominates the result.');
  return reasons;
}

function buildActions(verdict: Verdict, reasons: string[]): string[] {
  if (verdict === 'strong') {
    return ['Preserve the cited source chain and compare it with nearby claims.'];
  }
  if (verdict === 'mixed') {
    return ['Find one independent source and one primary record before trusting the claim.'];
  }
  return reasons.some((r) => r.includes('Rhetorical'))
    ? ['Separate the factual assertion from the persuasive framing, then look for primary evidence.']
    : ['Ask for an independent source, a date, and the document that anchors the assertion.'];
}

export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function urlSafeLabel(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

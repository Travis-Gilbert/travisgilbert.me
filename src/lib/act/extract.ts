/**
 * Extractor: raw text -> ACC `extraction` object.
 *
 * Produces the structured input shape that `scoring.js::scoreText`
 * expects (claims with char positions, source domains with tiers,
 * article-level rhetorical flag counts, etc.).
 *
 * Two paths:
 *   1. extractWithGemma() — preferred when the gemma-4b-gl-fusion-v1
 *      MLC artifact has loaded in the browser. The model returns
 *      structured JSON which we validate and normalize.
 *   2. extractFromText() — fast, deterministic heuristic. Used as the
 *      cold-start path (model not yet loaded) AND as the fallback
 *      whenever the LLM returns malformed JSON or is unavailable.
 *
 * The canonical ACC scoring lives in scoring.js; this module only
 * builds the *input* to that algorithm. Quality of extraction is
 * upstream — the algorithm itself is the source of truth.
 */

import { getTier } from './domain-list.js';
import { MLCRunner } from './mlc-runner';

export type CitationKind =
  | 'direct_primary'
  | 'indirect_primary'
  | 'secondary'
  | 'unanchored';

export type Falsifiability = 'falsifiable' | 'vague' | 'unfalsifiable';

export type SourceTier =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'self_referential'
  | 'unknown';

export interface ExtractedSource {
  id: string;
  domain: string;
  name: string;
  tier: SourceTier;
}

export interface ExtractedClaim {
  id: string;
  text: string;
  char_start: number;
  char_end: number;
  citation_chain_markers: {
    self_reinforcing_citations: number;
    total_citation_chains_described: number;
  };
  citation_kind: CitationKind;
  cited_source_refs: string[];
  contradicts_consensus: boolean;
  engages_consensus: boolean;
  falsifiability: Falsifiability;
  source_tier_refs: string[];
  specificity_anchors: string[];
}

export interface ArticleLevel {
  checkable_facts_per_paragraph: number[];
  rhetorical_red_flags: {
    appeal_to_hidden_knowledge: number;
    emotional_appeal_decoupled: number;
    false_precision: number;
    identity_based_dismissal: number;
    suppressed_truth_narrative: number;
    urgency_framing: number;
  };
}

export interface Extraction {
  article_level: ArticleLevel;
  cited_sources: ExtractedSource[];
  claims: ExtractedClaim[];
}

export type ContentType = 'factual' | 'opinion' | 'reference' | 'fiction';

export interface ExtractionResult {
  extraction: Extraction;
  content_type: ContentType;
  content_confidence: number;
}

const DOMAIN_RE = /\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/gi;
const YEAR_RE = /\b(?:19|20)\d{2}\b/g;
const PERCENT_RE = /\b\d+(?:\.\d+)?%/g;
const NUMBER_RE = /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g;
const PROPER_NOUN_RE = /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g;
const SENTENCE_RE = /[^.!?]+[.!?]+/g;

const URGENCY_MARKERS = [
  /\bwake up\b/gi,
  /\bbefore it'?s too late\b/gi,
  /\bnow more than ever\b/gi,
  /\bact (?:now|today|immediately)\b/gi,
];
const SUPPRESSED_TRUTH_MARKERS = [
  /\bthey (?:do not|don'?t) want you to (?:know|see)\b/gi,
  /\bcover[\s-]?up\b/gi,
  /\bthe truth is being\b/gi,
  /\b(?:hidden|suppressed) truth\b/gi,
];
const HIDDEN_KNOWLEDGE_MARKERS = [
  /\bsecretly\b/gi,
  /\bbehind the scenes\b/gi,
  /\bthey don'?t tell you\b/gi,
  /\binsider knows\b/gi,
];
const EMOTIONAL_APPEAL_MARKERS = [
  /\boutrage(?:ous|d)?\b/gi,
  /\bshocking\b/gi,
  /\bdevastating\b/gi,
  /\bsickening\b/gi,
];
const IDENTITY_DISMISSAL_MARKERS = [
  /\bglobalist[s]?\b/gi,
  /\belite[s]?\b/gi,
  /\bsheeple\b/gi,
  /\bmainstream media\b/gi,
  /\b(?:liberal|conservative) media\b/gi,
];

const CITATION_PHRASES = [
  /\baccording to\b/i,
  /\bas reported by\b/i,
  /\bcited in\b/i,
  /\bin a (?:study|paper|filing|report)\b/i,
  /\b(?:study|research) (?:by|from)\b/i,
];

const CONSENSUS_ENGAGE_MARKERS = [
  /\bscientists agree\b/i,
  /\bstudies confirm\b/i,
  /\bresearch shows\b/i,
  /\b(?:peer[\s-]?reviewed|consensus)\b/i,
  /\b(?:replicated|reproduced) by\b/i,
];
const CONSENSUS_CONTRADICT_MARKERS = [
  /\b(?:contrary to|despite) (?:popular|common) belief\b/i,
  /\bactually\b/i,
  /\bthe real truth\b/i,
  /\b(?:experts|scientists) are wrong\b/i,
];

const FALSIFIABLE_MARKERS = [
  /\bwould change my mind if\b/i,
  /\b(?:can be|could be) (?:tested|verified|measured|reproduced)\b/i,
  /\bif .{2,40} then\b/i,
];
const VAGUE_MARKERS = [
  /\bmany people\b/i,
  /\bsome say\b/i,
  /\bsomehow\b/i,
  /\bsort of\b/i,
];

const PRIMARY_TIERS = new Set([1, 2]);
const SECONDARY_TIERS = new Set([3]);

interface SentenceSpan {
  text: string;
  start: number;
  end: number;
  paragraphIdx: number;
}

function splitSentences(text: string): SentenceSpan[] {
  const out: SentenceSpan[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let cursor = 0;
  for (let pi = 0; pi < paragraphs.length; pi += 1) {
    const para = paragraphs[pi];
    for (const match of para.matchAll(SENTENCE_RE)) {
      const sentence = match[0].trim();
      if (sentence.split(/\s+/).filter(Boolean).length >= 6) {
        const offsetInPara = match.index ?? 0;
        const start = cursor + offsetInPara;
        const end = start + match[0].length;
        out.push({ text: sentence, start, end, paragraphIdx: pi });
      }
    }
    const tail = para.replace(SENTENCE_RE, '').trim();
    if (tail && tail.split(/\s+/).filter(Boolean).length >= 8) {
      const start = cursor + para.length - tail.length;
      out.push({ text: tail, start, end: cursor + para.length, paragraphIdx: pi });
    }
    cursor += para.length + 2;
  }
  return out;
}

function uniqueDomains(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(DOMAIN_RE)) {
    const host = match[1].toLowerCase();
    if (host.endsWith('.txt') || host.endsWith('.md') || host.endsWith('.html')) continue;
    found.add(host);
  }
  return [...found];
}

function tierToLabel(tier: number): SourceTier {
  if (PRIMARY_TIERS.has(tier)) return 'primary';
  if (SECONDARY_TIERS.has(tier)) return 'secondary';
  if (tier === 4) return 'tertiary';
  if (tier === 5) return 'self_referential';
  return 'unknown';
}

function citationKindFor(domains: string[]): CitationKind {
  if (!domains.length) return 'unanchored';
  const tiers = domains.map((d) => getTier(d));
  if (tiers.some((t) => PRIMARY_TIERS.has(t))) return 'direct_primary';
  if (tiers.some((t) => SECONDARY_TIERS.has(t))) return 'indirect_primary';
  if (tiers.some((t) => t === 4)) return 'secondary';
  return 'unanchored';
}

function classifyFalsifiability(sentence: string): Falsifiability {
  if (FALSIFIABLE_MARKERS.some((re) => re.test(sentence))) return 'falsifiable';
  const hasYear = sentence.match(YEAR_RE) !== null;
  const hasPercent = sentence.match(PERCENT_RE) !== null;
  const hasNumber = sentence.match(NUMBER_RE) !== null;
  if (hasYear || hasPercent || hasNumber) return 'falsifiable';
  if (VAGUE_MARKERS.some((re) => re.test(sentence))) return 'vague';
  return 'vague';
}

function specificityAnchors(sentence: string): string[] {
  const anchors = new Set<string>();
  for (const m of sentence.match(YEAR_RE) ?? []) anchors.add(m);
  for (const m of sentence.match(PERCENT_RE) ?? []) anchors.add(m);
  for (const m of (sentence.match(PROPER_NOUN_RE) ?? []).slice(0, 4)) anchors.add(m);
  return [...anchors].slice(0, 6);
}

function consensusStance(sentence: string): { engages: boolean; contradicts: boolean } {
  const engages = CONSENSUS_ENGAGE_MARKERS.some((re) => re.test(sentence));
  const contradicts = CONSENSUS_CONTRADICT_MARKERS.some((re) => re.test(sentence));
  return { engages, contradicts };
}

function citationChainMarkers(
  sentence: string,
  refs: string[],
): { self_reinforcing_citations: number; total_citation_chains_described: number } {
  const totalChains = CITATION_PHRASES.filter((re) => re.test(sentence)).length;
  const seen = new Map<string, number>();
  for (const ref of refs) {
    seen.set(ref, (seen.get(ref) || 0) + 1);
  }
  let selfReinforcing = 0;
  for (const count of seen.values()) {
    if (count > 1) selfReinforcing += count - 1;
  }
  return {
    total_citation_chains_described: totalChains,
    self_reinforcing_citations: selfReinforcing,
  };
}

function classifyContent(text: string): { type: ContentType; confidence: number } {
  // Lightweight heuristic. The MLC Gemma path replaces this once shipped.
  const opinionMarkers = /\b(?:I think|in my view|I believe|seems to me)\b/i;
  const refMarkers = /\b(?:see also|references?:|bibliography|\[\d+\])\b/i;
  if (opinionMarkers.test(text)) return { type: 'opinion', confidence: 0.6 };
  if (refMarkers.test(text)) return { type: 'reference', confidence: 0.55 };
  return { type: 'factual', confidence: 0.55 };
}

function countMarkers(text: string, markers: RegExp[]): number {
  let total = 0;
  for (const re of markers) {
    const matches = text.match(re);
    if (matches) total += matches.length;
  }
  return total;
}

export function extractFromText(rawText: string): ExtractionResult {
  const text = rawText.trim();
  const paragraphs = text.split(/\n{2,}/);
  const sentences = splitSentences(text);

  const articleDomains = uniqueDomains(text);
  const sources: ExtractedSource[] = articleDomains.map((domain, idx) => {
    const tier = getTier(domain);
    return {
      id: `s${idx}`,
      domain,
      name: domain,
      tier: tierToLabel(tier),
    };
  });
  const domainToId = new Map(sources.map((s) => [s.domain, s.id]));

  const checkableFactsPerParagraph = new Array(Math.max(1, paragraphs.length)).fill(0);
  const claims: ExtractedClaim[] = sentences.slice(0, 18).map((s, idx) => {
    const sentenceDomains = uniqueDomains(s.text);
    const refs = sentenceDomains
      .map((d) => domainToId.get(d))
      .filter((id): id is string => Boolean(id));
    const { engages, contradicts } = consensusStance(s.text);
    if (s.paragraphIdx < checkableFactsPerParagraph.length) {
      checkableFactsPerParagraph[s.paragraphIdx] += 1;
    }
    return {
      id: `c${idx}`,
      text: s.text,
      char_start: s.start,
      char_end: s.end,
      citation_chain_markers: citationChainMarkers(s.text, refs),
      citation_kind: citationKindFor(sentenceDomains),
      cited_source_refs: refs,
      contradicts_consensus: contradicts,
      engages_consensus: engages,
      falsifiability: classifyFalsifiability(s.text),
      source_tier_refs: refs,
      specificity_anchors: specificityAnchors(s.text),
    };
  });

  const articleLevel: ArticleLevel = {
    checkable_facts_per_paragraph: checkableFactsPerParagraph,
    rhetorical_red_flags: {
      urgency_framing: countMarkers(text, URGENCY_MARKERS),
      suppressed_truth_narrative: countMarkers(text, SUPPRESSED_TRUTH_MARKERS),
      appeal_to_hidden_knowledge: countMarkers(text, HIDDEN_KNOWLEDGE_MARKERS),
      emotional_appeal_decoupled: countMarkers(text, EMOTIONAL_APPEAL_MARKERS),
      identity_based_dismissal: countMarkers(text, IDENTITY_DISMISSAL_MARKERS),
      false_precision: 0,
    },
  };

  const numberMatches = text.match(NUMBER_RE) ?? [];
  const pctMatches = text.match(PERCENT_RE) ?? [];
  const totalNums = numberMatches.length + pctMatches.length;
  if (sources.length === 0 && totalNums >= 3) {
    articleLevel.rhetorical_red_flags.false_precision = Math.min(totalNums, 4);
  }

  const { type, confidence } = classifyContent(text);

  return {
    extraction: {
      article_level: articleLevel,
      cited_sources: sources,
      claims,
    },
    content_type: type,
    content_confidence: confidence,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Gemma 4B path
// ─────────────────────────────────────────────────────────────────────

interface GemmaExtractionPayload {
  content_type?: string;
  content_confidence?: number;
  article_level?: ArticleLevel;
  cited_sources?: ExtractedSource[];
  claims?: ExtractedClaim[];
}

const VALID_CONTENT_TYPES: ContentType[] = ['factual', 'opinion', 'reference', 'fiction'];
const VALID_CITATION_KINDS: CitationKind[] = [
  'direct_primary',
  'indirect_primary',
  'secondary',
  'unanchored',
];
const VALID_FALSIFIABILITY: Falsifiability[] = ['falsifiable', 'vague', 'unfalsifiable'];
const VALID_SOURCE_TIERS: SourceTier[] = [
  'primary',
  'secondary',
  'tertiary',
  'self_referential',
  'unknown',
];

/**
 * Validate the model's extraction JSON. Anything missing or malformed
 * falls through to a heuristic-extraction merge. We never crash; the
 * algorithm gets *some* valid input no matter what the model emits.
 */
function normalizeGemmaExtraction(
  raw: unknown,
  fallback: ExtractionResult,
): ExtractionResult {
  if (!raw || typeof raw !== 'object') return fallback;
  const payload = raw as GemmaExtractionPayload;

  const claims = Array.isArray(payload.claims) ? payload.claims : null;
  if (!claims || claims.length === 0) return fallback;

  const fallbackTextLength = fallback.extraction.claims.reduce(
    (max, c) => Math.max(max, c.char_end ?? 0),
    0,
  );

  const safeClaims: ExtractedClaim[] = claims
    .slice(0, 18)
    .map((c, idx) => {
      const text = typeof c.text === 'string' ? c.text : '';
      if (!text) return null;
      const charStart = Number.isFinite(c.char_start) ? Math.max(0, Number(c.char_start)) : 0;
      const charEnd = Number.isFinite(c.char_end)
        ? Math.min(fallbackTextLength || charStart + text.length, Number(c.char_end))
        : charStart + text.length;
      const refs = Array.isArray(c.cited_source_refs)
        ? c.cited_source_refs.map((r) => String(r)).filter(Boolean)
        : [];
      const tierRefs = Array.isArray(c.source_tier_refs)
        ? c.source_tier_refs.map((r) => String(r)).filter(Boolean)
        : refs;
      const anchors = Array.isArray(c.specificity_anchors)
        ? c.specificity_anchors.map((a) => String(a)).filter(Boolean).slice(0, 8)
        : [];
      const citation: CitationKind = VALID_CITATION_KINDS.includes(c.citation_kind as CitationKind)
        ? (c.citation_kind as CitationKind)
        : 'unanchored';
      const falsifiability: Falsifiability = VALID_FALSIFIABILITY.includes(
        c.falsifiability as Falsifiability,
      )
        ? (c.falsifiability as Falsifiability)
        : 'vague';
      const chainMarkers = (c.citation_chain_markers ?? {}) as {
        self_reinforcing_citations?: number;
        total_citation_chains_described?: number;
      };
      return {
        id: typeof c.id === 'string' && c.id ? c.id : `c${idx}`,
        text,
        char_start: charStart,
        char_end: charEnd,
        citation_chain_markers: {
          self_reinforcing_citations: Number(chainMarkers.self_reinforcing_citations ?? 0) || 0,
          total_citation_chains_described:
            Number(chainMarkers.total_citation_chains_described ?? 0) || 0,
        },
        citation_kind: citation,
        cited_source_refs: refs,
        source_tier_refs: tierRefs,
        specificity_anchors: anchors,
        contradicts_consensus: Boolean(c.contradicts_consensus),
        engages_consensus: Boolean(c.engages_consensus),
        falsifiability,
      };
    })
    .filter((c): c is ExtractedClaim => c !== null);

  if (safeClaims.length === 0) return fallback;

  const sources: ExtractedSource[] = Array.isArray(payload.cited_sources)
    ? payload.cited_sources
        .map((s, idx): ExtractedSource | null => {
          const domain = typeof s.domain === 'string' ? s.domain.toLowerCase() : '';
          if (!domain) return null;
          const tierLabel: SourceTier = VALID_SOURCE_TIERS.includes(s.tier as SourceTier)
            ? (s.tier as SourceTier)
            : 'unknown';
          // Reconcile against the local tier table when the model's tier
          // disagrees with the canonical domain map.
          const localTier = getTier(domain);
          const finalTier = tierLabel === 'unknown' && localTier <= 2 ? 'primary' : tierLabel;
          return {
            id: typeof s.id === 'string' && s.id ? s.id : `s${idx}`,
            domain,
            name: typeof s.name === 'string' && s.name ? s.name : domain,
            tier: finalTier,
          };
        })
        .filter((s): s is ExtractedSource => s !== null)
    : fallback.extraction.cited_sources;

  const articleLevel: ArticleLevel = {
    checkable_facts_per_paragraph: Array.isArray(
      payload.article_level?.checkable_facts_per_paragraph,
    )
      ? payload.article_level.checkable_facts_per_paragraph.map(
          (n) => Number(n) || 0,
        )
      : fallback.extraction.article_level.checkable_facts_per_paragraph,
    rhetorical_red_flags: {
      appeal_to_hidden_knowledge:
        Number(payload.article_level?.rhetorical_red_flags?.appeal_to_hidden_knowledge ?? 0) || 0,
      emotional_appeal_decoupled:
        Number(payload.article_level?.rhetorical_red_flags?.emotional_appeal_decoupled ?? 0) || 0,
      false_precision:
        Number(payload.article_level?.rhetorical_red_flags?.false_precision ?? 0) || 0,
      identity_based_dismissal:
        Number(payload.article_level?.rhetorical_red_flags?.identity_based_dismissal ?? 0) || 0,
      suppressed_truth_narrative:
        Number(payload.article_level?.rhetorical_red_flags?.suppressed_truth_narrative ?? 0) || 0,
      urgency_framing:
        Number(payload.article_level?.rhetorical_red_flags?.urgency_framing ?? 0) || 0,
    },
  };

  const contentType: ContentType = VALID_CONTENT_TYPES.includes(payload.content_type as ContentType)
    ? (payload.content_type as ContentType)
    : fallback.content_type;
  const confidence = Number.isFinite(payload.content_confidence)
    ? Math.max(0, Math.min(1, Number(payload.content_confidence)))
    : 0.85;

  return {
    extraction: { article_level: articleLevel, cited_sources: sources, claims: safeClaims },
    content_type: contentType,
    content_confidence: confidence,
  };
}

/**
 * LLM-driven extraction with deterministic fallback. Returns the
 * heuristic result if the model is not loaded, errors, or returns
 * unusable JSON.
 */
export async function extractWithGemma(rawText: string): Promise<ExtractionResult> {
  const fallback = extractFromText(rawText);
  const runner = MLCRunner.get();
  if (runner.getState() !== 'ready') {
    return fallback;
  }
  try {
    const payload = await runner.extractFeatures(rawText);
    return normalizeGemmaExtraction(payload, fallback);
  } catch {
    return fallback;
  }
}

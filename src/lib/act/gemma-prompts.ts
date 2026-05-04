/**
 * Prompt templates for the gemma-4b-gl-fusion-v1 client-side runner.
 *
 * The LoRA on s3://models/gemma-4b-gl-fusion-v1/ was trained against
 * synthesis-style prompts of the form:
 *
 *   Query: {q}
 *
 *   Evidence:
 *   {ev}
 *
 *   Synthesize the evidence to answer the query.
 *
 * (See modal_app/gl_fusion_train.py:_normalize_example.) That training
 * is for synthesis, not claim extraction. We piggyback the same
 * template structure so the model stays in-distribution, but we ask it
 * to "synthesize" a structured JSON inventory of the document — its
 * job is then JSON formatting + claim selection rather than free-form
 * paragraph composition.
 *
 * The canonical ACC scorer in src/lib/act/scoring.js does the
 * heavy reasoning. The model only needs to produce a clean
 * `extraction` object; downstream scoring handles the rest. This
 * matches the user's reasoning that "most of the work is the
 * algorithm itself."
 */

const EXTRACTION_SCHEMA_DESCRIPTION = `{
  "content_type": "factual" | "opinion" | "reference" | "fiction",
  "content_confidence": number in [0, 1],
  "article_level": {
    "checkable_facts_per_paragraph": [number, ...],
    "rhetorical_red_flags": {
      "appeal_to_hidden_knowledge": int,
      "emotional_appeal_decoupled": int,
      "false_precision": int,
      "identity_based_dismissal": int,
      "suppressed_truth_narrative": int,
      "urgency_framing": int
    }
  },
  "cited_sources": [
    {
      "id": "s0",
      "domain": "example.com",
      "name": "Display name",
      "tier": "primary" | "secondary" | "tertiary" | "self_referential" | "unknown"
    }
  ],
  "claims": [
    {
      "id": "c0",
      "text": "verbatim sentence",
      "char_start": int,
      "char_end": int,
      "specificity_anchors": [string, ...],
      "citation_kind": "direct_primary" | "indirect_primary" | "secondary" | "unanchored",
      "cited_source_refs": ["s0", ...],
      "source_tier_refs": ["s0", ...],
      "contradicts_consensus": boolean,
      "engages_consensus": boolean,
      "falsifiability": "falsifiable" | "vague" | "unfalsifiable",
      "citation_chain_markers": {
        "self_reinforcing_citations": int,
        "total_citation_chains_described": int
      }
    }
  ]
}`;

const EXTRACTION_INSTRUCTIONS = `Extract a structured claim inventory from the document. For each declarative claim that could be checked against external evidence, capture its verbatim text, the sources it references (if any), and the rhetorical posture it takes.

Rules:
- Use ONLY information present in the document. Do not invent sources, dates, or numbers.
- char_start/char_end are integer offsets into the document text.
- Pick at most 12 claims. Prefer claims with concrete anchors (numbers, dates, named entities) over vague generalizations.
- "specificity_anchors" lists the proper nouns, numbers, percentages, or dates that make a claim checkable.
- "citation_kind": direct_primary if the claim is supported by a tier-1 source it names, indirect_primary if a tier-2 source, secondary if only tier-3+, unanchored if no source is named.
- "rhetorical_red_flags" counts go up by one for each instance of the named rhetorical move in the article body.

Output valid JSON matching the schema. Do not wrap the JSON in code fences. Do not write any prose before or after the JSON.`;

export function buildExtractionPrompt(documentText: string): string {
  return [
    'Query: Build a structured claim inventory from the following document.',
    '',
    'Evidence:',
    documentText,
    '',
    'Synthesize the evidence as a JSON object matching this schema:',
    EXTRACTION_SCHEMA_DESCRIPTION,
    '',
    EXTRACTION_INSTRUCTIONS,
  ].join('\n');
}

const CLASSIFY_INSTRUCTIONS = `Classify the document by its rhetorical mode. Return JSON only, no prose, matching:

{
  "content_type": "factual" | "opinion" | "reference" | "fiction",
  "content_confidence": number in [0, 1],
  "rationale": "one short sentence"
}

Definitions:
- factual: declarative empirical claims that can be checked against external sources
- opinion: normative or stance-laden writing where the author's view is the point
- reference: documentation, instructions, or factual lookup material
- fiction: narrative or imaginative writing not intended to assert empirical fact`;

export function buildClassifyPrompt(documentText: string): string {
  return [
    'Query: Classify this document by rhetorical mode.',
    '',
    'Evidence:',
    documentText.slice(0, 4000),
    '',
    CLASSIFY_INSTRUCTIONS,
  ].join('\n');
}

/**
 * Strip common LLM "wrapping" so JSON.parse succeeds on outputs that
 * leaked code fences or chat-template residue. Returns the inner JSON
 * substring, or the original text if no wrapping was found.
 */
export function unwrapJsonOutput(raw: string): string {
  const trimmed = raw.trim();
  // Code-fenced JSON: ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  // First { ... last } heuristic: model often prepends a sentence.
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

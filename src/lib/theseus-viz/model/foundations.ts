/**
 * Pluggable registry of foundation encoders. Keyed by logical name so
 * swapping to bge-small, gte-small, or a Theseus-fine-tuned checkpoint
 * later is a single-line change. Dimensions are the embedding width the
 * model emits: the DirectiveAdapter feature vector length depends on it.
 */

export type FoundationName = 'semantic-mini' | 'semantic-bge-small' | 'semantic-gte-small';

export interface FoundationSpec {
  /** Hugging Face repo id loadable by @huggingface/transformers. */
  repoId: string;
  /** Embedding dimensionality emitted by the model. */
  dim: number;
  /** Sequence-token cap; inputs longer than this get truncated. */
  maxTokens: number;
  /** Short human description surfaced in dev tooling / console. */
  description: string;
}

export const FOUNDATION_REGISTRY: Record<FoundationName, FoundationSpec> = {
  'semantic-mini': {
    repoId: 'Xenova/all-MiniLM-L6-v2',
    dim: 384,
    maxTokens: 256,
    description: 'MiniLM-L6 Q8 (~23MB). Matches the SBERT model Theseus uses server-side.',
  },
  'semantic-bge-small': {
    repoId: 'Xenova/bge-small-en-v1.5',
    dim: 384,
    maxTokens: 512,
    description: 'BGE-small v1.5 Q8 (~33MB). Higher retrieval quality; swap-in drop-in for MiniLM.',
  },
  'semantic-gte-small': {
    repoId: 'Xenova/gte-small',
    dim: 384,
    maxTokens: 512,
    description: 'GTE-small Q8 (~33MB). Alternative to BGE for experimentation.',
  },
};

/** Default foundation. Override by reading from env / feature-flag when
 *  the DirectiveAdapter calls {@link getActiveFoundation}. */
export const DEFAULT_FOUNDATION: FoundationName = 'semantic-mini';

export function getActiveFoundation(): FoundationSpec {
  const spec = FOUNDATION_REGISTRY[DEFAULT_FOUNDATION];
  if (!spec) throw new Error(`Unknown foundation '${DEFAULT_FOUNDATION}'`);
  return spec;
}

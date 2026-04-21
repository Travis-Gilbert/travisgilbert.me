/**
 * FoundationEncoder — thin lazy-loading wrapper around a Transformers.js
 * sentence encoder pipeline. One singleton per foundation name. First
 * call downloads and caches the model (~23-33MB depending on variant);
 * subsequent calls are ~1-5ms pure inference.
 *
 * Never throws: on load failure (WebGPU absent, network error, OPFS
 * quota exceeded) it returns `null` from {@link embed} so the caller
 * falls through to the rule-based ordering. Callers should treat the
 * encoder as strictly additive.
 */

'use client';

import {
  FOUNDATION_REGISTRY,
  type FoundationName,
  type FoundationSpec,
} from './foundations';

type PipelineOutput = { data: Float32Array | number[] };
type FeatureExtractor = (
  input: string,
  options?: { pooling?: 'mean' | 'cls'; normalize?: boolean },
) => Promise<PipelineOutput>;

interface LoadedFoundation {
  name: FoundationName;
  spec: FoundationSpec;
  pipe: FeatureExtractor;
}

const loaders = new Map<FoundationName, Promise<LoadedFoundation | null>>();

async function loadFoundation(name: FoundationName): Promise<LoadedFoundation | null> {
  const spec = FOUNDATION_REGISTRY[name];
  if (!spec) {
    console.warn('[FoundationEncoder] unknown foundation', name);
    return null;
  }
  try {
    const { pipeline } = await import('@huggingface/transformers');
    // `feature-extraction` is the standard sentence-embedding task in
    // Transformers.js. The library negotiates WebGPU first, falls back
    // to WASM automatically. 'fp16' keeps size small; upcast is implicit.
    const pipe = (await pipeline('feature-extraction', spec.repoId, {
      dtype: 'q8',
    })) as unknown as FeatureExtractor;
    if (typeof console !== 'undefined') {
      console.info(`[FoundationEncoder] loaded ${name} (${spec.description})`);
    }
    return { name, spec, pipe };
  } catch (err) {
    console.warn('[FoundationEncoder] load failed; rule-based fallback will be used', err);
    return null;
  }
}

/** Lazy-load (or return cached) the named foundation. Safe to call many
 *  times — the promise is memoized per name so concurrent callers share
 *  the single download. */
export function ensureFoundation(name: FoundationName): Promise<LoadedFoundation | null> {
  let pending = loaders.get(name);
  if (!pending) {
    pending = loadFoundation(name);
    loaders.set(name, pending);
  }
  return pending;
}

/** Embed a single text into the foundation's native dimensionality.
 *  Returns null if the foundation isn't loaded (or failed to load). */
export async function embed(name: FoundationName, text: string): Promise<Float32Array | null> {
  const loaded = await ensureFoundation(name);
  if (!loaded) return null;
  try {
    const out = await loaded.pipe(text, { pooling: 'mean', normalize: true });
    return out.data instanceof Float32Array ? out.data : Float32Array.from(out.data);
  } catch (err) {
    console.warn('[FoundationEncoder] embed failed', err);
    return null;
  }
}

/** Embed several texts in one batch via parallel calls. Transformers.js
 *  pipelines aren't reentrant; serialize internally. */
export async function embedBatch(
  name: FoundationName,
  texts: string[],
): Promise<Array<Float32Array | null>> {
  const loaded = await ensureFoundation(name);
  if (!loaded) return texts.map(() => null);
  const out: Array<Float32Array | null> = [];
  for (const text of texts) {
    try {
      const row = await loaded.pipe(text, { pooling: 'mean', normalize: true });
      out.push(row.data instanceof Float32Array ? row.data : Float32Array.from(row.data));
    } catch (err) {
      console.warn('[FoundationEncoder] batch embed failed for one item', err);
      out.push(null);
    }
  }
  return out;
}

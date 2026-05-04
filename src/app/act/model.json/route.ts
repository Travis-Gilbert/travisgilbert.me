import { NextResponse } from 'next/server';

/**
 * Public descriptor for the /act WebLLM artifact.
 *
 * Browser code (`@mlc-ai/web-llm` via src/lib/act/mlc-runner.ts) reads
 * this JSON to discover where to fetch the model. The actual large
 * artifacts (params shards, tokenizer, .wasm) live on the public
 * bucket pointed at by NEXT_PUBLIC_ACT_MODEL_BASE_URL — Next.js cannot
 * reasonably proxy multi-gigabyte downloads through a serverless
 * function (timeout limits), so the descriptor exposes direct URLs and
 * the bucket needs CORS configured for travisgilbert.me + localhost.
 *
 * The descriptor itself is small JSON and can be served from Vercel's
 * edge with a long cache. Browsers see CORS-friendly URLs.
 */

const MODEL_ID = 'gemma-4-e4b-epistemic-dpo-v1-q4f16_1-MLC';
const MODEL_LIB_NAME = 'gemma-4-e4b-q4f16_1-ctx4k_cs1k-webgpu';

// Public CORS-friendly base URL where the MLC compile output was uploaded.
// Set via env var so we can swap S3/R2/CloudFront origins without a code
// change. Falls back to the Vercel-relative path (which expects a Next.js
// proxy route to be added later) if the env var is unset.
const PUBLIC_BASE = (
  process.env.NEXT_PUBLIC_ACT_MODEL_BASE_URL ||
  'https://travisgilbert.me/act/resolve/main'
).replace(/\/+$/, '');

const ACT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=300, s-maxage=3600',
  'Cross-Origin-Resource-Policy': 'cross-origin',
} as const;

export function GET() {
  return NextResponse.json(
    {
      model_id: MODEL_ID,
      model_url: PUBLIC_BASE,
      model_lib_url: `${PUBLIC_BASE}/${MODEL_LIB_NAME}.wasm`,
      resolve_base_url: `${PUBLIC_BASE}/`,
      // Provenance metadata: lets the page show what's running.
      base_model: 'google/gemma-4-E4B-it',
      lora_source: 's3://models/gemma-4b-gl-fusion-v1',
      training: '804 SFT examples + 375 DPO pairs (epistemic ranking)',
      quantization: 'q4f16_1',
      algorithm_version: '2.0.0',
    },
    { headers: ACT_HEADERS },
  );
}

export function HEAD() {
  return new Response(null, { headers: ACT_HEADERS });
}

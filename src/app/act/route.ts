import { NextResponse } from 'next/server';

const MODEL_ID = 'gemma-2-2b-it-q4f16_1-MLC';
const MODEL_URL = 'https://travisgilbert.me/act';
const MODEL_LIB_URL =
  'https://travisgilbert.me/act/gemma-2-2b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm';
const RESOLVE_BASE_URL = 'https://travisgilbert.me/act/resolve/main/';
const UPSTREAM_MODEL_URL = 'https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC';
const UPSTREAM_MODEL_LIB_URL =
  'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/gemma-2-2b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm';

const ACT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=300, s-maxage=3600',
  'Cross-Origin-Resource-Policy': 'cross-origin',
} as const;

export function GET() {
  return NextResponse.json(
    {
      model_id: MODEL_ID,
      model_url: MODEL_URL,
      model_lib_url: MODEL_LIB_URL,
      resolve_base_url: RESOLVE_BASE_URL,
      upstream_model_url: UPSTREAM_MODEL_URL,
      upstream_model_lib_url: UPSTREAM_MODEL_LIB_URL,
    },
    { headers: ACT_HEADERS },
  );
}

export function HEAD() {
  return new Response(null, { headers: ACT_HEADERS });
}

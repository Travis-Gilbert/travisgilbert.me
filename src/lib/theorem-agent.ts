import { gqlTheoremAgent } from '@/lib/commonplace-graphql';

export type TheoremAgentMode = 'ask' | 'research';

export interface TheoremAgentClaim {
  text: string;
  provenance: string;
}

export interface TheoremAgentRunInput {
  task: string;
  mode?: TheoremAgentMode;
  claims?: TheoremAgentClaim[];
  bindingId?: string;
  tenant?: string;
  requestTimeoutMs?: number;
}

export interface TheoremAgentRunResult {
  mode: TheoremAgentMode;
  task: string;
  answer: string;
  answerKind: 'MODEL' | 'EMPTY';
  bindingId: string;
  runId?: string;
  heads: string[];
  claims: TheoremAgentClaim[];
  alignmentVerdict?: unknown;
  evidenceCount: number;
  raw?: unknown;
}

export interface TheoremAgentNormalizedInput {
  task: string;
  mode: TheoremAgentMode;
  claims: TheoremAgentClaim[];
  bindingId: string;
  tenant: string;
  requestTimeoutMs: number;
}

const DEFAULT_TENANT = 'Travis-Gilbert';
const DEFAULT_BINDING_PREFIX = 'agent:theorem';
const DEFAULT_TIMEOUT_MS = 60_000;
const THEOREM_AGENT_PROXY_PATH = '/api/theorem/agent';

export async function runTheoremAgent(input: TheoremAgentRunInput): Promise<TheoremAgentRunResult> {
  const normalized = normalizeInput(input);
  try {
    return await runTheoremAgentProductFallback(normalized);
  } catch (err) {
    if (!isProductRouteFallbackEligible(err)) {
      throw err;
    }
    return runTheoremAgentGraphql(normalized);
  }
}

async function runTheoremAgentGraphql(normalized: TheoremAgentNormalizedInput): Promise<TheoremAgentRunResult> {
  const timeout = timeoutController(normalized.requestTimeoutMs);
  try {
    const raw = await gqlTheoremAgent(
      {
        task: normalized.task,
        mode: normalized.mode,
        bindingId: normalized.bindingId,
        tenant: normalized.tenant,
        claims: normalized.claims,
      },
      timeout.signal,
    );
    return normalizeTheoremAgentProductResponse(raw, normalized);
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error(`Theorem agent timed out after ${normalized.requestTimeoutMs}ms`);
    }
    throw err;
  } finally {
    timeout.clear();
  }
}

async function runTheoremAgentProductFallback(normalized: TheoremAgentNormalizedInput): Promise<TheoremAgentRunResult> {
  const raw = await callTheoremAgentEndpoint(THEOREM_AGENT_PROXY_PATH, normalized);
  return normalizeTheoremAgentProductResponse(raw, normalized);
}

export async function callTheoremAgentEndpoint(endpoint: string, input: TheoremAgentNormalizedInput, headers: HeadersInit = {}): Promise<unknown> {
  const timeout = timeoutController(input.requestTimeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(buildTheoremAgentProductRequest(input)),
      cache: 'no-store',
      signal: timeout.signal,
    });
    if (!res.ok) throw new Error(await responseErrorMessage(res));
    return res.json();
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error(`Theorem agent timed out after ${input.requestTimeoutMs}ms`);
    }
    throw err;
  } finally {
    timeout.clear();
  }
}

export function buildTheoremAgentProductRequest(input: TheoremAgentNormalizedInput): unknown {
  return {
    tenant: input.tenant,
    tenant_slug: input.tenant,
    binding_id: input.bindingId,
    task: input.task,
    mode: input.mode,
    claims: input.claims,
  };
}

export function normalizeTheoremAgentProductResponse(raw: unknown, input: TheoremAgentNormalizedInput): TheoremAgentRunResult {
  const { payload, isError } = structuredPayload(raw);
  if (isError || typeof payload.error === 'string') {
    const message = text(payload.message) ?? text(payload.error) ?? 'Theorem agent returned an error.';
    throw new Error(message);
  }

  const result = asRecord(payload.result) ?? payload;
  const receipts = asArray(result.invocation_receipts).map(asRecord).filter(nonNullable);
  const directClaims = normalizeClaims(asArray(result.claims));
  const publishedClaims = normalizeClaims(asArray(result.published_claims));
  const fallbackClaims = normalizeClaims(asArray(receipts[receipts.length - 1]?.claims));
  const claims = directClaims.length ? directClaims : publishedClaims.length ? publishedClaims : fallbackClaims;
  const answer = text(result.answer) ?? answerFromResult(result, receipts, claims);
  const heads = stringArray(result.consensus_head_set);
  const answerKindRaw = text(result.answerKind) ?? text(result.answer_kind);
  const answerKind = answerKindRaw === 'EMPTY' || !answer ? 'EMPTY' : 'MODEL';

  return {
    mode: input.mode,
    task: input.task,
    answer,
    answerKind,
    bindingId: text(result.binding_id) ?? text(result.bindingId) ?? input.bindingId,
    runId: text(result.run_id) ?? text(result.runId),
    heads: heads.length ? heads : stringArray(result.heads),
    claims,
    alignmentVerdict: result.alignment_verdict ?? result.alignmentVerdict,
    evidenceCount: numberValue(result.evidence_count) ?? numberValue(result.evidenceCount) ?? input.claims.length,
    raw,
  };
}

export function normalizeTheoremAgentInput(input: TheoremAgentRunInput): TheoremAgentNormalizedInput {
  return normalizeInput(input);
}

function normalizeInput(input: TheoremAgentRunInput): TheoremAgentNormalizedInput {
  const task = typeof input.task === 'string' ? input.task.trim() : '';
  if (!task) throw new Error('Theorem agent requires a task.');
  if (input.tenant !== undefined && typeof input.tenant !== 'string') {
    throw new Error('Theorem agent tenant must be a string.');
  }
  if (input.bindingId !== undefined && typeof input.bindingId !== 'string') {
    throw new Error('Theorem agent bindingId must be a string.');
  }
  return {
    task,
    mode: input.mode === 'research' ? 'research' : 'ask',
    claims: normalizeClaims(input.claims ?? []),
    bindingId: input.bindingId?.trim() || uniqueBindingId(),
    tenant: input.tenant?.trim() || DEFAULT_TENANT,
    requestTimeoutMs: clampNumber(input.requestTimeoutMs, DEFAULT_TIMEOUT_MS, 5_000, 120_000),
  };
}

function uniqueBindingId(): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${DEFAULT_BINDING_PREFIX}:run-${Date.now().toString(36)}-${suffix}`;
}

function answerFromResult(result: Record<string, unknown>, receipts: Record<string, unknown>[], claims: TheoremAgentClaim[]): string {
  if (claims.length)
    return claims
      .map((claim) => claim.text)
      .join('\n\n')
      .trim();

  const lastReceipt = receipts[receipts.length - 1];
  const payload = asRecord(lastReceipt?.payload);
  const payloadText = text(payload?.text);
  if (payloadText) return stripClaimsJson(payloadText);

  const summary = text(lastReceipt?.output_summary);
  if (summary) return stripClaimsJson(summary);

  const revisions = asArray(result.scratchpad_revisions).map(asRecord).filter(nonNullable);
  const revisionSummary = text(revisions[revisions.length - 1]?.summary);
  return revisionSummary ? stripClaimsJson(revisionSummary) : '';
}

function stripClaimsJson(value: string): string {
  const lowered = value.toLowerCase();
  const marker = lowered.indexOf('claims json:');
  if (marker < 0) return value.trim();
  return value.slice(0, marker).trim() || value.trim();
}

function structuredPayload(raw: unknown): {
  payload: Record<string, unknown>;
  isError: boolean;
} {
  const root = asRecord(raw) ?? {};
  const rpcResult = asRecord(root.result);
  const directContent = asArray(root.content);
  const resultContent = asArray(rpcResult?.content);
  const content = resultContent.length ? resultContent : directContent;
  const isError = Boolean(root.isError) || Boolean(rpcResult?.isError);

  for (const item of content) {
    const record = asRecord(item);
    const body = text(record?.text);
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      return { payload: asRecord(parsed) ?? { text: body }, isError };
    } catch {
      return { payload: { text: body }, isError };
    }
  }

  if (rpcResult) return { payload: rpcResult, isError };
  return { payload: root, isError };
}

function normalizeClaims(values: unknown[]): TheoremAgentClaim[] {
  return values
    .map((value) => {
      const record = asRecord(value);
      const claimText = text(record?.text);
      if (!record || !claimText) return null;
      return {
        text: claimText,
        provenance: text(record.provenance) ?? 'theorem:agent',
      };
    })
    .filter(nonNullable);
}

async function responseErrorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  const record = asRecord(body);
  return text(record?.message) ?? text(record?.error) ?? `Theorem agent ${res.status}`;
}

function timeoutController(timeoutMs: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && (err as { name?: unknown }).name === 'AbortError';
}

function isProductRouteFallbackEligible(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return [
    'Failed to parse URL',
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    'Theorem agent 404',
  ].some((marker) => err.message.includes(marker));
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(n, max));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  return asArray(value).filter(isString);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function nonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

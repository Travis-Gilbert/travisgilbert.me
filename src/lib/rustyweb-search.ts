export type RustyWebSearchMode = 'web' | 'fractal';

export interface RustyWebSearchHit {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  score?: number;
  sources: string[];
  kind: 'web' | 'graph';
}

export interface RustyWebSearchStats {
  providers?: number;
  providerReceipts?: number;
  candidates?: number;
  seedUrls?: number;
  frontier?: number;
  admittedPages?: number;
  tokensAdmitted?: number;
  tokensDeferred?: number;
  graphExhausted?: boolean;
  webReached?: boolean;
}

export interface RustyWebSearchResponse {
  mode: RustyWebSearchMode;
  query: string;
  hits: RustyWebSearchHit[];
  stats: RustyWebSearchStats;
  raw?: unknown;
}

interface RustyWebSearchOptions {
  mode?: RustyWebSearchMode;
  tenant?: string;
  limit?: number;
  providerLimit?: number;
  providerTimeoutMs?: number;
  requestTimeoutMs?: number;
  endpoint?: string;
}

interface McpToolRequestInput {
  query: string;
  mode: RustyWebSearchMode;
  tenant: string;
  limit: number;
  providerLimit: number;
  providerTimeoutMs: number;
  requestTimeoutMs: number;
}

const DEFAULT_TENANT = 'Travis-Gilbert';
const DEFAULT_LIMIT = 10;
const DEFAULT_WEB_PROVIDER_LIMIT = 4;
const DEFAULT_FRACTAL_PROVIDER_LIMIT = 8;
const DEFAULT_WEB_PROVIDER_TIMEOUT_MS = 4_000;
const DEFAULT_FRACTAL_PROVIDER_TIMEOUT_MS = 8_000;
const LOCAL_NODE_URL = process.env.NEXT_PUBLIC_LOCAL_NODE_URL ?? 'http://127.0.0.1:17888';
const LOCAL_MCP_URL = `${LOCAL_NODE_URL}/mcp`;
const LOCAL_RUSTYWEB_SEARCH_URL = `${LOCAL_NODE_URL}/v1/rustyweb/search`;

export function buildRustyWebMcpRequest(input: McpToolRequestInput): unknown {
  const toolName =
    input.mode === 'fractal' ? 'fractal_expansion' : 'rustyweb_search_acquisition';
  const baseArguments = {
    query: input.query,
    tenant: input.tenant,
    provider_limit: input.providerLimit,
    provider_timeout_ms: input.providerTimeoutMs,
    wait: true,
  };
  const argumentsForMode =
    input.mode === 'fractal'
      ? {
          ...baseArguments,
          search_limit: input.limit,
          web_seed_limit: input.limit,
          top_k: Math.min(5, input.limit),
          frontier_limit: Math.max(8, input.limit),
          budget_tokens: 2_000,
        }
      : {
          ...baseArguments,
          limit: input.limit,
          seed_limit: input.limit,
        };

  return {
    jsonrpc: '2.0',
    id: `${toolName}-${Date.now()}`,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: argumentsForMode,
    },
  };
}

export async function searchRustyWeb(
  query: string,
  options: RustyWebSearchOptions = {},
): Promise<RustyWebSearchResponse> {
  const input = normalizedInput(query, options);

  if (isTauriRuntime()) {
    if (input.mode === 'web') {
      return callRustyWebSearchEndpoint(options.endpoint ?? LOCAL_RUSTYWEB_SEARCH_URL, input);
    }
    return callMcpEndpoint(options.endpoint ?? LOCAL_MCP_URL, input);
  }

  const requestTimeout = timeoutController(input.requestTimeoutMs);
  try {
    const res = await fetch('/api/rustyweb/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
      signal: requestTimeout.signal,
    });
    if (res.status === 404) throw new Error('rustyweb proxy missing');
    if (!res.ok) throw new Error(await responseErrorMessage(res));
    return (await res.json()) as RustyWebSearchResponse;
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error(`RustyWeb search timed out after ${input.requestTimeoutMs}ms`);
    }
    if (!(err instanceof TypeError) && String(err).includes('rustyweb proxy missing') === false) {
      throw err;
    }
    return callMcpEndpoint(options.endpoint ?? LOCAL_MCP_URL, input);
  } finally {
    requestTimeout.clear();
  }
}

export async function callMcpEndpoint(
  endpoint: string,
  input: McpToolRequestInput,
  headers: HeadersInit = {},
): Promise<RustyWebSearchResponse> {
  const requestTimeout = timeoutController(input.requestTimeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(buildRustyWebMcpRequest(input)),
      cache: 'no-store',
      signal: requestTimeout.signal,
    });
    if (!res.ok) throw new Error(`rustyweb MCP ${res.status}`);
    const raw = (await res.json()) as unknown;
    return normalizeRustyWebMcpResponse(input.mode, raw);
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error(`RustyWeb search timed out after ${input.requestTimeoutMs}ms`);
    }
    throw err;
  } finally {
    requestTimeout.clear();
  }
}

export async function callRustyWebSearchEndpoint(
  endpoint: string,
  input: McpToolRequestInput,
  headers: HeadersInit = {},
): Promise<RustyWebSearchResponse> {
  const requestTimeout = timeoutController(input.requestTimeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(buildRustyWebSearchRequest(input)),
      cache: 'no-store',
      signal: requestTimeout.signal,
    });
    if (!res.ok) throw new Error(`RustyWeb search ${res.status}`);
    const raw = (await res.json()) as unknown;
    return normalizeRustyWebProductResponse(input.mode, raw);
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error(`RustyWeb search timed out after ${input.requestTimeoutMs}ms`);
    }
    throw err;
  } finally {
    requestTimeout.clear();
  }
}

export function buildRustyWebSearchRequest(input: McpToolRequestInput): Record<string, unknown> {
  return {
    query: input.query,
    tenant: input.tenant,
    provider_limit: input.providerLimit,
    provider_timeout_ms: input.providerTimeoutMs,
    limit: input.limit,
    seed_limit: input.limit,
  };
}

export function normalizeRustyWebMcpResponse(
  mode: RustyWebSearchMode,
  raw: unknown,
): RustyWebSearchResponse {
  const { payload, isError } = structuredPayload(raw);
  if (isError || typeof payload.error === 'string') {
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : typeof payload.error === 'string'
          ? payload.error
          : 'RustyWeb search failed';
    throw new Error(message);
  }
  return mode === 'fractal'
    ? normalizeFractalResponse(payload, raw)
    : normalizeWebResponse(payload, raw);
}

export function normalizeRustyWebProductResponse(
  mode: RustyWebSearchMode,
  raw: unknown,
): RustyWebSearchResponse {
  const payload = asRecord(raw) ?? {};
  if (typeof payload.error === 'string') {
    const message =
      typeof payload.message === 'string' ? payload.message : payload.error;
    throw new Error(message);
  }
  return mode === 'fractal'
    ? normalizeFractalResponse(payload, raw)
    : normalizeWebResponse(payload, raw);
}

function normalizedInput(
  query: string,
  options: RustyWebSearchOptions,
): McpToolRequestInput {
  const mode = options.mode ?? 'web';
  const defaultProviderLimit =
    mode === 'web' ? DEFAULT_WEB_PROVIDER_LIMIT : DEFAULT_FRACTAL_PROVIDER_LIMIT;
  const defaultProviderTimeoutMs =
    mode === 'web' ? DEFAULT_WEB_PROVIDER_TIMEOUT_MS : DEFAULT_FRACTAL_PROVIDER_TIMEOUT_MS;
  const providerTimeoutMs = clampNumber(
    options.providerTimeoutMs,
    defaultProviderTimeoutMs,
    500,
    30_000,
  );
  return {
    query: query.trim(),
    mode,
    tenant: options.tenant ?? DEFAULT_TENANT,
    limit: Math.max(1, Math.min(options.limit ?? DEFAULT_LIMIT, 20)),
    providerLimit: clampNumber(options.providerLimit, defaultProviderLimit, 1, 50),
    providerTimeoutMs,
    requestTimeoutMs: clampNumber(
      options.requestTimeoutMs,
      Math.max(providerTimeoutMs + 4_000, 8_000),
      2_000,
      60_000,
    ),
  };
}

function timeoutController(timeoutMs: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: unknown }).name === 'AbortError'
  );
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(n, max));
}

function normalizeWebResponse(
  payload: Record<string, unknown>,
  raw: unknown,
): RustyWebSearchResponse {
  const acquisition = asRecord(payload.acquisition);
  const candidates = asArray(acquisition?.candidates);
  return {
    mode: 'web',
    query: text(payload.query) ?? text(acquisition?.query) ?? '',
    hits: candidates.map(webCandidateToHit).filter(nonNullable),
    stats: {
      providers: number(payload.stats, 'providers'),
      providerReceipts: number(payload.stats, 'provider_receipts'),
      candidates: number(payload.stats, 'candidates') ?? candidates.length,
      seedUrls: asArray(payload.seed_urls).length,
    },
    raw,
  };
}

function normalizeFractalResponse(
  payload: Record<string, unknown>,
  raw: unknown,
): RustyWebSearchResponse {
  const receipt = asRecord(payload.receipt) ?? payload;
  const excerptsByUrl = new Map(
    asArray(receipt.admitted_page_excerpts)
      .map((item) => {
        const excerpt = asRecord(item);
        if (!excerpt) return null;
        const url = text(excerpt.url);
        if (!url) return null;
        return [url, asArray(excerpt.passages).filter(isString).join(' ')] as const;
      })
      .filter(nonNullable),
  );

  const graphHits = asArray(receipt.frontier)
    .map((item) => frontierToHit(item))
    .filter(nonNullable);
  const providerHits = asArray(receipt.provider_candidates)
    .map((item) => providerCandidateToHit(item, excerptsByUrl))
    .filter(nonNullable);
  const seedHits =
    providerHits.length > 0
      ? []
      : asArray(receipt.web_seed_urls)
          .filter(isString)
          .map((url, index) => urlToHit(url, index))
          .filter(nonNullable);

  return {
    mode: 'fractal',
    query: text(receipt.query) ?? text(payload.query) ?? '',
    hits: [...graphHits, ...providerHits, ...seedHits],
    stats: {
      providers: asArray(receipt.provider_receipts).length,
      candidates: asArray(receipt.provider_candidates).length,
      seedUrls: asArray(receipt.web_seed_urls).length,
      frontier: graphHits.length,
      admittedPages: number(receipt, 'admitted_pages'),
      tokensAdmitted: number(receipt, 'tokens_admitted'),
      tokensDeferred: number(receipt, 'tokens_deferred'),
      graphExhausted: boolean(receipt, 'graph_exhausted'),
      webReached: boolean(receipt, 'web_reached'),
    },
    raw,
  };
}

function webCandidateToHit(item: unknown): RustyWebSearchHit | null {
  const ranked = asRecord(item);
  if (!ranked) return null;
  const candidate = asRecord(ranked.candidate) ?? ranked;
  const url = text(candidate.url);
  if (!url) return null;
  return {
    id: normalizedUrl(url) ?? url,
    title: text(candidate.title) ?? hostLabel(url) ?? url,
    url,
    snippet: text(candidate.snippet),
    score: number(ranked, 'score'),
    sources: stringArray(ranked.sources).length
      ? stringArray(ranked.sources)
      : stringArray(candidate.source),
    kind: 'web',
  };
}

function providerCandidateToHit(
  item: unknown,
  excerptsByUrl: Map<string, string>,
): RustyWebSearchHit | null {
  const candidate = asRecord(item);
  if (!candidate) return null;
  const url = text(candidate.url);
  if (!url) return null;
  const excerpt = excerptsByUrl.get(url);
  return {
    id: `fractal:web:${normalizedUrl(url) ?? url}`,
    title: text(candidate.title) ?? hostLabel(url) ?? url,
    url,
    snippet: excerpt || text(candidate.snippet),
    score: number(candidate, 'score'),
    sources: stringArray(candidate.sources),
    kind: 'web',
  };
}

function frontierToHit(item: unknown): RustyWebSearchHit | null {
  const hit = asRecord(item);
  if (!hit) return null;
  const url = text(hit.url) ?? '';
  const nodeId = text(hit.node_id) ?? text(hit.id) ?? url;
  if (!nodeId && !url) return null;
  return {
    id: `fractal:graph:${nodeId || url}`,
    title: text(hit.title) ?? hostLabel(url) ?? nodeId,
    url,
    score: number(hit, 'score'),
    sources: ['graph'],
    kind: 'graph',
  };
}

function urlToHit(url: string, index: number): RustyWebSearchHit | null {
  return {
    id: `fractal:seed:${normalizedUrl(url) ?? `${index}:${url}`}`,
    title: hostLabel(url) ?? url,
    url,
    sources: ['web'],
    kind: 'web',
  };
}

function structuredPayload(raw: unknown): {
  payload: Record<string, unknown>;
  isError: boolean;
} {
  const response = asRecord(raw) ?? {};
  const result = asRecord(response.result);
  const structured =
    asRecord(result?.structuredContent) ??
    asRecord(response.structuredContent) ??
    contentTextPayload(result) ??
    response;
  return {
    payload: structured,
    isError: boolean(result, 'isError') ?? boolean(response, 'isError') ?? false,
  };
}

function contentTextPayload(result: Record<string, unknown> | null): Record<string, unknown> | null {
  const first = asRecord(asArray(result?.content)[0]);
  const body = text(first?.text);
  if (!body) return null;
  try {
    return asRecord(JSON.parse(body));
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function number(record: unknown, key: string): number | undefined {
  const value = asRecord(record)?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function boolean(record: unknown, key: string): boolean | undefined {
  const value = asRecord(record)?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function stringArray(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  return asArray(value).filter(isString);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function normalizedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function hostLabel(url: string): string | undefined {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function responseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as unknown;
    const record = asRecord(body);
    return (
      text(record?.message) ??
      text(record?.error) ??
      `rustyweb proxy ${res.status}`
    );
  } catch {
    return `rustyweb proxy ${res.status}`;
  }
}

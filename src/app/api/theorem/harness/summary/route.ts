import type {
  HarnessLiveActivity,
  HarnessLiveCounts,
  HarnessLiveMemoryDoc,
  HarnessLiveSummary,
} from '@/lib/theorem-harness-live';
import { THEOREM_HARNESS_MCP_URL } from '@/lib/theorem-hosted';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_TENANT = 'Travis-Gilbert';
const DEFAULT_ROOM_ID = 'commonplace';
const DEFAULT_MEMORY_QUERY = 'CommonPlace live harness memory logs';
const LOCAL_MCP_URL = 'http://127.0.0.1:17888/mcp';
const MCP_PATH = '/mcp';
const REQUEST_TIMEOUT_MS = 12_000;

const LIVE_SUMMARY_QUERY = `
  query CommonPlaceHarnessLive($roomId: String!, $actor: String!, $memoryQuery: String!) {
    coordinationRoom(roomId: $roomId, actor: $actor, messageLimit: 8, recordLimit: 8, mentionLimit: 8) {
      roomId
      actorId
      counts
      presence
      intents
      messages
      records
      pendingMentions
    }
    memory(query: $memoryQuery, limit: 6, includeLowFitness: false, contentPreviewChars: 180) {
      id
      kind
      title
      gist
      summary
      contentPreview
      servedTier
      tags
      status
      fitness
      updatedAt
    }
  }
`;

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const tenant =
    text(requestUrl.searchParams.get('tenant')) ??
    text(process.env.THEOREM_HARNESS_TENANT) ??
    DEFAULT_TENANT;
  const roomId =
    text(requestUrl.searchParams.get('roomId')) ??
    text(process.env.THEOREM_HARNESS_ROOM_ID) ??
    DEFAULT_ROOM_ID;
  const memoryQuery =
    text(requestUrl.searchParams.get('query')) ??
    text(process.env.THEOREM_HARNESS_MEMORY_QUERY) ??
    DEFAULT_MEMORY_QUERY;
  const actor =
    text(requestUrl.searchParams.get('actor')) ??
    text(process.env.THEOREM_HARNESS_ACTOR) ??
    'commonplace-ui';
  const attempts: string[] = [];

  for (const endpoint of mcpCandidates()) {
    try {
      const summary = await loadLiveSummary(endpoint, {
        actor,
        memoryQuery,
        roomId,
        tenant,
      });
      return json(summary, 200);
    } catch (err) {
      attempts.push(`${sourceLabel(endpoint)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return json(
    unavailableSummary({
      attempts,
      roomId,
      tenant,
    }),
    200,
  );
}

async function loadLiveSummary(
  endpoint: string,
  params: {
    actor: string;
    memoryQuery: string;
    roomId: string;
    tenant: string;
  },
): Promise<HarnessLiveSummary> {
  const payload = await callMcpTool(endpoint, 'graphql_query', {
    query: LIVE_SUMMARY_QUERY,
    variables: {
      actor: params.actor,
      memoryQuery: params.memoryQuery,
      roomId: params.roomId,
    },
  });
  const data = asRecord(asRecord(payload)?.data);
  if (!data) throw new Error('Harness GraphQL returned no data.');

  const room = asRecord(data.coordinationRoom) ?? {};
  const counts = normalizeCounts(asRecord(room.counts), asArray(data.memory).length);
  const memory = asArray(data.memory).map(normalizeMemoryDoc).filter(nonNullable);
  const activity = [
    ...asArray(room.records).map((item, index) => normalizeActivity(item, 'record', index)),
    ...asArray(room.messages).map((item, index) => normalizeActivity(item, 'message', index)),
    ...asArray(room.intents).map((item, index) => normalizeActivity(item, 'intent', index)),
  ]
    .filter(nonNullable)
    .slice(0, 8);

  return {
    source: 'live',
    tenant: params.tenant,
    roomId: text(room.roomId) ?? params.roomId,
    generatedAt: new Date().toISOString(),
    sourceLabel: sourceLabel(endpoint),
    counts,
    memory,
    activity,
  };
}

async function callMcpTool(
  endpoint: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const timeout = timeoutController(REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: mcpHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `${name}-${Date.now()}`,
        method: 'tools/call',
        params: {
          name,
          arguments: args,
        },
      }),
      cache: 'no-store',
      signal: timeout.signal,
    });
    if (!response.ok) {
      throw new Error(`MCP returned ${response.status}.`);
    }

    const rpc = (await response.json()) as unknown;
    const rpcRecord = asRecord(rpc);
    const error = asRecord(rpcRecord?.error);
    if (error) {
      throw new Error(text(error.message) ?? 'MCP tool call failed.');
    }
    return normalizeMcpResult(rpcRecord?.result);
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error(`MCP timed out after ${REQUEST_TIMEOUT_MS}ms.`);
    }
    throw err;
  } finally {
    timeout.clear();
  }
}

function normalizeMcpResult(result: unknown): Record<string, unknown> {
  const resultRecord = asRecord(result);
  if (!resultRecord) throw new Error('MCP returned an invalid result.');
  if (resultRecord.isError === true) {
    throw new Error(contentText(resultRecord) ?? 'MCP tool returned an error.');
  }

  const structured = asRecord(resultRecord.structuredContent);
  if (structured && Object.keys(structured).length > 0) return structured;

  const textPayload = contentText(resultRecord);
  if (textPayload) {
    try {
      const parsed = JSON.parse(textPayload) as unknown;
      const parsedRecord = asRecord(parsed);
      if (parsedRecord) return parsedRecord;
    } catch {
      throw new Error('MCP returned non-JSON content.');
    }
  }

  throw new Error('MCP result had no structured payload.');
}

function contentText(result: Record<string, unknown>): string | undefined {
  for (const item of asArray(result.content)) {
    const record = asRecord(item);
    const value = text(record?.text);
    if (value) return value;
  }
  return undefined;
}

function normalizeMemoryDoc(value: unknown): HarnessLiveMemoryDoc | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const id = text(record.id);
  if (!id) return undefined;
  const title = text(record.title) ?? text(record.gist) ?? id;
  const excerpt =
    text(record.summary) ??
    text(record.contentPreview) ??
    text(record.gist) ??
    text(record.kind) ??
    '';
  return {
    id,
    kind: text(record.kind) ?? 'memory',
    title,
    excerpt,
    servedTier: text(record.servedTier),
    status: text(record.status),
    fitness: numberValue(record.fitness),
    updatedAt: text(record.updatedAt),
  };
}

function normalizeActivity(
  value: unknown,
  kind: HarnessLiveActivity['kind'],
  index: number,
): HarnessLiveActivity | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const fallbackId = `${kind}-${index}`;
  const id =
    text(record.id) ??
    text(record.record_id) ??
    text(record.message_id) ??
    text(record.intent_id) ??
    fallbackId;
  const summary =
    text(record.summary) ??
    text(record.message) ??
    text(record.body) ??
    text(record.status) ??
    text(record.title) ??
    '';
  return {
    id,
    kind,
    title: text(record.title) ?? titleForKind(kind),
    summary,
    actor: text(record.actor) ?? text(record.actor_id) ?? text(record.actorId),
    updatedAt:
      text(record.updatedAt) ??
      text(record.updated_at) ??
      text(record.createdAt) ??
      text(record.created_at) ??
      text(record.refreshed_at),
  };
}

function normalizeCounts(raw: Record<string, unknown> | undefined, memoryCount: number): HarnessLiveCounts {
  return {
    presence: numberValue(raw?.presence) ?? 0,
    intents: numberValue(raw?.intents) ?? 0,
    messages: numberValue(raw?.messages) ?? 0,
    records: numberValue(raw?.records) ?? 0,
    pendingMentions:
      numberValue(raw?.pendingMentions) ??
      numberValue(raw?.pending_mentions) ??
      0,
    memory: memoryCount,
  };
}

function unavailableSummary(params: {
  attempts: string[];
  roomId: string;
  tenant: string;
}): HarnessLiveSummary {
  return {
    source: 'unavailable',
    tenant: params.tenant,
    roomId: params.roomId,
    generatedAt: new Date().toISOString(),
    sourceLabel: 'unavailable',
    counts: {
      presence: 0,
      intents: 0,
      messages: 0,
      records: 0,
      pendingMentions: 0,
      memory: 0,
    },
    memory: [],
    activity: [],
    attempts: params.attempts.slice(0, 4),
  };
}

function mcpCandidates(): string[] {
  const configured = [
    process.env.THEOREM_HARNESS_MCP_URL,
    process.env.THEOREM_MCP_URL,
    process.env.THEOREM_HARNESS_URL,
    process.env.THEOREM_API_URL,
    process.env.NEXT_PUBLIC_HARNESS_URL,
    process.env.NEXT_PUBLIC_THEOREM_API_URL,
  ]
    .map(normalizeMcpEndpoint)
    .filter(nonNullable);
  const defaults =
    process.env.NODE_ENV === 'development'
      ? [LOCAL_MCP_URL, THEOREM_HARNESS_MCP_URL]
      : [THEOREM_HARNESS_MCP_URL];
  return unique([...configured, ...defaults]);
}

function normalizeMcpEndpoint(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const pathname = trimSlash(url.pathname);
    if (!pathname) {
      url.pathname = MCP_PATH;
      url.search = '';
      url.hash = '';
      return url.toString();
    }
    if (pathname.endsWith(MCP_PATH)) return trimSlash(url.toString());
    const basePath = pathname.replace(/\/(?:graphql|api\/theorem\/agent|v1\/theorem\/agent\/run)$/i, '');
    url.pathname = `${basePath}${MCP_PATH}`.replace(/\/{2,}/g, '/');
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return trimSlash(raw);
  }
}

function mcpHeaders(): HeadersInit {
  const token = text(
    process.env.THEOREM_HARNESS_API_TOKEN ??
      process.env.THEOREM_MCP_API_TOKEN ??
      process.env.THEOREM_HARNESS_BEARER ??
      process.env.THEOREM_MCP_BEARER ??
      process.env.THEOREM_API_TOKEN ??
      process.env.THEOREM_AGENT_API_TOKEN ??
      process.env.RUSTYRED_AGENT_BEARER ??
      process.env.HARNESS_API_KEY,
  );
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

function sourceLabel(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return 'local MCP';
    if (url.hostname.includes('railway.app')) return 'hosted MCP';
    return `${url.hostname}${url.pathname}`;
  } catch {
    return 'configured MCP';
  }
}

function titleForKind(kind: HarnessLiveActivity['kind']): string {
  if (kind === 'message') return 'Message';
  if (kind === 'intent') return 'Intent';
  if (kind === 'presence') return 'Presence';
  return 'Record';
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function timeoutController(ms: number): {
  clear: () => void;
  signal: AbortSignal;
} {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    clear: () => clearTimeout(timeout),
    signal: controller.signal,
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function nonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

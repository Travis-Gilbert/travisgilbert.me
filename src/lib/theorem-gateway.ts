/**
 * Theorem gateway GraphQL client (the browser-facing front door over the
 * substrate). v2 wires the agent + search surfaces to this gateway:
 *   - Ask  -> askAgent(question, scope) : Theorem's agent, grounded in the graph
 *             (returns the answer PLUS the context nodes + sources that fed it).
 *   - Search -> search(query, mode)     : RustyRed/Theseus retrieval.
 *   - Map  -> gapWalk(seed)             : a knowledge graph from a seed.
 *   - detail -> provenance(nodeId).
 *
 * Transport mirrors the commonplace-api client: the browser posts to the
 * same-origin /api/theorem-gateway/graphql proxy (no CORS); SSR dials directly.
 */

const PROXY_PATH = '/api/theorem-gateway/graphql';
const SERVER_URL = (
  process.env.THEOREM_GATEWAY_URL ?? 'https://theorem-gateway-production.up.railway.app'
).replace(/\/+$/, '');

/* ─────────────────────────────────────────────────
   Wire shapes (track schema.graphql exactly)
   ───────────────────────────────────────────────── */

export interface GwGraphNode {
  id: string;
  label: string;
  kind: string;
  score: number;
}

export interface GwGraphEdge {
  src: string;
  dst: string;
  kind: string;
  weight: number;
}

export interface GwKnowledgeGraph {
  nodes: GwGraphNode[];
  edges: GwGraphEdge[];
  stats: { nodeCount: number; edgeCount: number; roundsExecuted: number };
}

export interface GwSearchHit {
  id: string;
  title: string;
  snippet: string;
  score: number;
  provenance: string;
}

export interface GwAgentAnswer {
  answer: string;
  /** The graph context that fed the model — visible proof it is graph-aware. */
  contextNodes: GwGraphNode[];
  sources: GwSearchHit[];
  model: string;
}

export type GwSearchMode = 'ASK' | 'DEEP' | 'ENCODE' | 'CIVIC_ATLAS';

/* ─────────────────────────────────────────────────
   Transport
   ───────────────────────────────────────────────── */

class GatewayError extends Error {}

async function gw<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const onServer = typeof window === 'undefined';
  const url = onServer ? `${SERVER_URL}/graphql` : PROXY_PATH;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  if (!res.ok) throw new GatewayError(`theorem-gateway ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new GatewayError(json.errors[0].message);
  return json.data as T;
}

async function gwRead<T>(
  query: string,
  variables: Record<string, unknown>,
  fallback: T,
): Promise<T> {
  try {
    return await gw<T>(query, variables);
  } catch {
    return fallback;
  }
}

/* ─────────────────────────────────────────────────
   Surfaces
   ───────────────────────────────────────────────── */

const HIT_FIELDS = `id title snippet score provenance`;
const NODE_FIELDS = `id label kind score`;

/** Search the substrate (RustyRed/Theseus retrieval). */
export async function gwSearch(
  query: string,
  mode: GwSearchMode = 'ASK',
): Promise<GwSearchHit[]> {
  if (!query.trim()) return [];
  const data = await gwRead<{ search: GwSearchHit[] }>(
    `query($q:String!,$m:SearchMode){ search(query:$q,mode:$m){ ${HIT_FIELDS} } }`,
    { q: query, m: mode },
    { search: [] },
  );
  return data.search;
}

/**
 * Ask Theorem's agent, grounded in the substrate. `scope` requires exactly one
 * of seed (instant-KG PPR walk) or repoId (code-KG); for a general ask we seed
 * the gap-walk with the question itself.
 */
export async function gwAskAgent(
  question: string,
  scope?: { seed?: string; repoId?: string },
): Promise<GwAgentAnswer> {
  const resolvedScope = scope?.repoId
    ? { repoId: scope.repoId }
    : { seed: scope?.seed ?? question };
  const data = await gw<{ askAgent: GwAgentAnswer }>(
    `query($q:String!,$scope:AgentScope!){ askAgent(question:$q,scope:$scope){ answer model contextNodes{ ${NODE_FIELDS} } sources{ ${HIT_FIELDS} } } }`,
    { q: question, scope: resolvedScope },
  );
  return data.askAgent;
}

/** A knowledge graph gap-walked from a seed (nodes are ranked evidence). */
export async function gwGapWalk(seed: string): Promise<GwKnowledgeGraph> {
  if (!seed.trim()) return { nodes: [], edges: [], stats: { nodeCount: 0, edgeCount: 0, roundsExecuted: 0 } };
  const data = await gwRead<{ gapWalk: GwKnowledgeGraph }>(
    `query($s:String!){ gapWalk(seed:$s){ nodes{ ${NODE_FIELDS} } edges{ src dst kind weight } stats{ nodeCount edgeCount roundsExecuted } } }`,
    { s: seed },
    { gapWalk: { nodes: [], edges: [], stats: { nodeCount: 0, edgeCount: 0, roundsExecuted: 0 } } },
  );
  return data.gapWalk;
}

/** Provenance root node for a graph node, or null. */
export async function gwProvenance(nodeId: string): Promise<GwGraphNode | null> {
  const data = await gwRead<{ provenance: GwGraphNode | null }>(
    `query($id:String!){ provenance(nodeId:$id){ ${NODE_FIELDS} } }`,
    { id: nodeId },
    { provenance: null },
  );
  return data.provenance;
}

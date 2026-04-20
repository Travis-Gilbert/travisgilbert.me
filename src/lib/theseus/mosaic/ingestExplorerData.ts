'use client';

// Phase C: DuckDB-WASM ingestion of the Explorer graph.
//
// Loads two tables into the shared DuckDB singleton so Mosaic widgets can
// run SQL against the same nodes/edges the cosmos.gl canvas is drawing:
//
//   objects(id, label, type, degree, pagerank, leiden_community,
//           k_core_number, graph_uncertainty, novelty_score,
//           captured_at, status)
//   edges(source_id, target_id, edge_type, strength, engine)
//
// Column set matches the plan. Fields the Django serializer has not
// shipped yet (pagerank, leiden_community, k_core_number,
// graph_uncertainty, novelty_score, captured_at) are written as NULL so
// charts depending on them render empty rather than crashing the Explorer.
//
// Ingestion is idempotent: DROP TABLE IF EXISTS + CREATE TABLE + load.
// Safe to call every time useGraphData() returns a fresh points/links
// payload, though in practice that's once per Explorer session.
//
// The ingest uses DuckDB's read_json_auto over a registered file buffer
// for schema-permissive loading, then INSERT INTO the typed table. This
// sidesteps the quirks of insertJSONFromPath with nullable columns at
// duckdb-wasm 1.32.0.

import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { getSharedDuckDB } from '@/lib/theseus/cosmograph/duckdb';
import { dispatchTheseusEvent } from '@/lib/theseus/events';
import type {
  CosmoLink,
  CosmoPoint,
} from '@/components/theseus/explorer/useGraphData';

/**
 * Column allowlist for the Explorer's DuckDB tables. Chart builders and
 * selection-bridge SQL MUST reference identifiers from this object instead
 * of hardcoding strings, so we have one place to audit for drift against
 * the Django serializer.
 */
export const EXPLORER_TABLES = {
  objects: {
    name: 'objects',
    columns: [
      'id',
      'label',
      'type',
      'degree',
      'pagerank',
      'leiden_community',
      'k_core_number',
      'graph_uncertainty',
      'novelty_score',
      'captured_at',
      'status',
    ] as const,
  },
  edges: {
    name: 'edges',
    columns: [
      'source_id',
      'target_id',
      'edge_type',
      'strength',
      'engine',
    ] as const,
  },
} as const;

const OBJECTS_JSON_NAME = 'explorer_objects.json';
const EDGES_JSON_NAME = 'explorer_edges.json';

interface ObjectRow {
  id: string;
  label: string;
  type: string;
  degree: number;
  pagerank: number | null;
  leiden_community: number | null;
  k_core_number: number | null;
  graph_uncertainty: number | null;
  novelty_score: number | null;
  captured_at: string | null;
  status: string | null;
}

interface EdgeRow {
  source_id: string;
  target_id: string;
  edge_type: string | null;
  strength: number;
  engine: string | null;
}

function rowFromPoint(p: CosmoPoint): ObjectRow {
  return {
    id: p.id,
    label: p.label,
    type: p.type,
    degree: p.degree ?? 0,
    pagerank: p.pagerank ?? null,
    leiden_community: p.leiden_community ?? null,
    k_core_number: p.k_core_number ?? null,
    graph_uncertainty: p.graph_uncertainty ?? null,
    novelty_score: p.novelty_score ?? null,
    captured_at: p.captured_at ?? null,
    status: p.status ?? null,
  };
}

function rowFromLink(l: CosmoLink): EdgeRow {
  return {
    source_id: l.source,
    target_id: l.target,
    edge_type: l.edge_type ?? null,
    strength: typeof l.weight === 'number' ? l.weight : 0,
    engine: l.engine ?? null,
  };
}

async function registerJsonBuffer(
  duckdb: AsyncDuckDB,
  name: string,
  rows: unknown[],
): Promise<void> {
  // duckdb-wasm's registerFileBuffer is the idiomatic path for in-memory
  // data; read_json_auto can then be called on 'name' as if it were a path.
  const encoded = new TextEncoder().encode(JSON.stringify(rows));
  await duckdb.registerFileBuffer(name, encoded);
}

async function recreateObjectsTable(
  duckdb: AsyncDuckDB,
  conn: AsyncDuckDBConnection,
  points: CosmoPoint[],
): Promise<void> {
  await conn.query(`DROP TABLE IF EXISTS ${EXPLORER_TABLES.objects.name}`);
  await conn.query(`
    CREATE TABLE ${EXPLORER_TABLES.objects.name} (
      id                VARCHAR PRIMARY KEY,
      label             VARCHAR,
      type              VARCHAR,
      degree            INTEGER,
      pagerank          DOUBLE,
      leiden_community  INTEGER,
      k_core_number     INTEGER,
      graph_uncertainty DOUBLE,
      novelty_score     DOUBLE,
      captured_at       TIMESTAMP,
      status            VARCHAR
    )
  `);
  if (points.length === 0) return;

  const rows = points.map(rowFromPoint);
  await duckdb.dropFile(OBJECTS_JSON_NAME).catch(() => undefined);
  await registerJsonBuffer(duckdb, OBJECTS_JSON_NAME, rows);
  // read_json_auto infers columns; the CAST on captured_at is defensive
  // in case DuckDB's auto-detection reads an ISO-8601 string as VARCHAR.
  // sample_size=-1 forces DuckDB to scan every row for type inference.
  // Without it, rows where leiden_community / captured_at / pagerank / etc.
  // are null in the first 100 records cause the parser to infer NULL and
  // drop every real value that follows. explicit `columns=` bypasses the
  // heuristic entirely: we know the types because rowFromPoint writes them.
  await conn.query(`
    INSERT INTO ${EXPLORER_TABLES.objects.name}
    SELECT
      id,
      label,
      type,
      degree,
      pagerank,
      leiden_community,
      k_core_number,
      graph_uncertainty,
      novelty_score,
      CAST(captured_at AS TIMESTAMP) AS captured_at,
      status
    FROM read_json('${OBJECTS_JSON_NAME}', columns={
      id: 'VARCHAR',
      label: 'VARCHAR',
      type: 'VARCHAR',
      degree: 'INTEGER',
      pagerank: 'DOUBLE',
      leiden_community: 'INTEGER',
      k_core_number: 'INTEGER',
      graph_uncertainty: 'DOUBLE',
      novelty_score: 'DOUBLE',
      captured_at: 'VARCHAR',
      status: 'VARCHAR'
    })
  `);
}

async function recreateEdgesTable(
  duckdb: AsyncDuckDB,
  conn: AsyncDuckDBConnection,
  links: CosmoLink[],
): Promise<void> {
  await conn.query(`DROP TABLE IF EXISTS ${EXPLORER_TABLES.edges.name}`);
  await conn.query(`
    CREATE TABLE ${EXPLORER_TABLES.edges.name} (
      source_id  VARCHAR,
      target_id  VARCHAR,
      edge_type  VARCHAR,
      strength   DOUBLE,
      engine     VARCHAR
    )
  `);
  if (links.length === 0) return;

  const rows = links.map(rowFromLink);
  await duckdb.dropFile(EDGES_JSON_NAME).catch(() => undefined);
  await registerJsonBuffer(duckdb, EDGES_JSON_NAME, rows);
  await conn.query(`
    INSERT INTO ${EXPLORER_TABLES.edges.name}
    SELECT
      source_id,
      target_id,
      edge_type,
      strength,
      engine
    FROM read_json('${EDGES_JSON_NAME}', columns={
      source_id: 'VARCHAR',
      target_id: 'VARCHAR',
      edge_type: 'VARCHAR',
      strength: 'DOUBLE',
      engine: 'VARCHAR'
    })
  `);
}

// Serial ingest pipeline. A new call waits for any in-flight ingest to
// finish so DROP/CREATE/INSERT pairs never interleave across StrictMode
// double-mounts. `whenExplorerIngested()` always hands back the promise
// for the LATEST ingest, so charts that subscribe after a re-ingest don't
// read stale "already resolved" state.
let ingestChain: Promise<void> = Promise.resolve();
let lastIngestInfo: { generation: number; nodeCount: number; edgeCount: number } | null = null;

/**
 * Returns a promise that resolves when the current (or most recent) ingest
 * finishes. Charts should await this after initMosaicCoordinator() before
 * probing. Safe to call any number of times; always points at the latest
 * ingest work.
 */
export function whenExplorerIngested(): Promise<void> {
  return ingestChain;
}

/**
 * Populate the DuckDB singleton with the current Explorer graph. Idempotent
 * and serial: concurrent callers are queued behind an in-flight ingest so
 * DROP/CREATE/INSERT statements don't race. On success, broadcasts
 * `explorer:ingest-complete` on the Theseus event bus so subscribers
 * (notably ChartShell) re-probe against the fresh tables.
 */
export async function ingestExplorerData(
  points: CosmoPoint[],
  links: CosmoLink[],
): Promise<void> {
  const prev = ingestChain;
  ingestChain = (async () => {
    // Wait for any in-flight ingest. Swallow its rejection so the new
    // ingest has a clean slate to retry.
    await prev.catch(() => undefined);
    const { duckdb, connection } = await getSharedDuckDB();
    await recreateObjectsTable(duckdb, connection, points);
    await recreateEdgesTable(duckdb, connection, links);
    lastIngestInfo = {
      generation: (lastIngestInfo?.generation ?? 0) + 1,
      nodeCount: points.length,
      edgeCount: links.length,
    };
    dispatchTheseusEvent('explorer:ingest-complete', lastIngestInfo);
  })();
  await ingestChain;
}

/** Read-only snapshot of the last completed ingest. `null` before first run. */
export function getLastIngestInfo(): { generation: number; nodeCount: number; edgeCount: number } | null {
  return lastIngestInfo;
}

'use client';

import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { DataPoint, Label } from 'embedding-atlas/react';
import { initMosaicCoordinator } from '@/lib/theseus/mosaic/coordinator';
import { getSharedDuckDB } from '@/lib/theseus/cosmograph/duckdb';
import type { EmbeddingSpaceRowGql } from '@/lib/commonplace-graphql';

export const COMMONPLACE_EMBEDDING_TABLE = 'embedding_space';

const EMBEDDING_SPACE_JSON_NAME = 'commonplace_embedding_space.json';

interface EmbeddingSpaceDuckRow {
  identifier: string;
  x: number;
  y: number;
  category: number;
  category_label: string;
  text: string;
  created_ms: number;
  community_id: string;
  epistemic_status: string;
}

function toDuckRow(row: EmbeddingSpaceRowGql): EmbeddingSpaceDuckRow {
  return {
    identifier: row.identifier,
    x: row.x,
    y: row.y,
    category: row.category,
    category_label: row.categoryLabel,
    text: row.text,
    created_ms: row.createdMs,
    community_id: row.communityId,
    epistemic_status: row.epistemicStatus,
  };
}

async function registerJsonBuffer(
  duckdb: AsyncDuckDB,
  name: string,
  rows: unknown[],
): Promise<void> {
  const encoded = new TextEncoder().encode(JSON.stringify(rows));
  await duckdb.registerFileBuffer(name, encoded);
}

async function recreateEmbeddingSpaceTable(
  duckdb: AsyncDuckDB,
  conn: AsyncDuckDBConnection,
  rows: EmbeddingSpaceRowGql[],
): Promise<void> {
  await conn.query(`DROP TABLE IF EXISTS ${COMMONPLACE_EMBEDDING_TABLE}`);
  await conn.query(`
    CREATE TABLE ${COMMONPLACE_EMBEDDING_TABLE} (
      identifier        VARCHAR PRIMARY KEY,
      x                 DOUBLE,
      y                 DOUBLE,
      category          INTEGER,
      category_label    VARCHAR,
      text              VARCHAR,
      created_ms        BIGINT,
      community_id      VARCHAR,
      epistemic_status  VARCHAR
    )
  `);
  if (rows.length === 0) return;

  await duckdb.dropFile(EMBEDDING_SPACE_JSON_NAME).catch(() => undefined);
  await registerJsonBuffer(duckdb, EMBEDDING_SPACE_JSON_NAME, rows.map(toDuckRow));
  await conn.query(`
    INSERT INTO ${COMMONPLACE_EMBEDDING_TABLE}
    SELECT
      identifier,
      x,
      y,
      category,
      category_label,
      text,
      created_ms,
      community_id,
      epistemic_status
    FROM read_json('${EMBEDDING_SPACE_JSON_NAME}', columns={
      identifier: 'VARCHAR',
      x: 'DOUBLE',
      y: 'DOUBLE',
      category: 'INTEGER',
      category_label: 'VARCHAR',
      text: 'VARCHAR',
      created_ms: 'BIGINT',
      community_id: 'VARCHAR',
      epistemic_status: 'VARCHAR'
    })
  `);
}

let ingestChain: Promise<void> = Promise.resolve();

export async function ingestCommonPlaceEmbeddingSpace(
  rows: EmbeddingSpaceRowGql[],
): Promise<void> {
  const prev = ingestChain;
  ingestChain = (async () => {
    await prev.catch(() => undefined);
    await initMosaicCoordinator();
    const { duckdb, connection } = await getSharedDuckDB();
    await recreateEmbeddingSpaceTable(duckdb, connection, rows);
  })();
  await ingestChain;
}

export function embeddingRowsToArrays(rows: EmbeddingSpaceRowGql[]) {
  return {
    x: Float32Array.from(rows.map((row) => row.x)),
    y: Float32Array.from(rows.map((row) => row.y)),
    category: Uint8Array.from(rows.map((row) => Math.max(0, Math.min(255, row.category)))),
  };
}

export function dataPointForRow(row: EmbeddingSpaceRowGql): DataPoint {
  return {
    x: row.x,
    y: row.y,
    category: row.category,
    text: row.text,
    identifier: row.identifier,
    fields: {
      category_label: row.categoryLabel,
      community_id: row.communityId,
      epistemic_status: row.epistemicStatus,
      created_ms: row.createdMs,
    },
  };
}

export function categoryLabels(rows: EmbeddingSpaceRowGql[]): string[] {
  const byCategory = new Map<number, string>();
  for (const row of rows) {
    if (!byCategory.has(row.category)) byCategory.set(row.category, row.categoryLabel);
  }
  return [...byCategory.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, label]) => label);
}

export function atlasLabels(rows: EmbeddingSpaceRowGql[]): Label[] {
  const groups = new Map<number, { x: number; y: number; n: number; text: string }>();
  for (const row of rows) {
    const current = groups.get(row.category) ?? {
      x: 0,
      y: 0,
      n: 0,
      text: row.categoryLabel,
    };
    current.x += row.x;
    current.y += row.y;
    current.n += 1;
    groups.set(row.category, current);
  }
  return [...groups.values()].map((group) => ({
    x: group.x / group.n,
    y: group.y / group.n,
    content: group.text,
    level: 0,
    priority: group.n,
  }));
}

export function nearestRow(
  rows: EmbeddingSpaceRowGql[],
  x: number,
  y: number,
  unitDistance: number,
): EmbeddingSpaceRowGql | null {
  let best: EmbeddingSpaceRowGql | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const distance = Math.hypot(row.x - x, row.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = row;
    }
  }
  const threshold = Math.max(unitDistance * 18, 0.025);
  return bestDistance <= threshold ? best : null;
}

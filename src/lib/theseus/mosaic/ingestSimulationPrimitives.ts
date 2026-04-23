'use client';

import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { getSharedDuckDB } from '@/lib/theseus/cosmograph/duckdb';
import type {
  SimulationPrimitive,
  SimulationRelation,
} from '@/lib/theseus-viz/SceneDirective';

function sanitizeIdentifier(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const trimmed = normalized.replace(/^_+|_+$/g, '');
  if (!trimmed) return 'scene';
  return trimmed.slice(0, 48);
}

function metricTableName(sceneId: string, slot: string): string {
  return `sim_metric_${sanitizeIdentifier(sceneId)}_${sanitizeIdentifier(slot)}`;
}

export function SIMULATION_TABLES_FOR(sceneId: string) {
  const safeScene = sanitizeIdentifier(sceneId);
  return {
    primitives: { name: `sim_primitives_${safeScene}` },
    relations: { name: `sim_relations_${safeScene}` },
    metrics: { name: `sim_metrics_${safeScene}` },
    metricBySlot: (slot: string) => ({ name: metricTableName(sceneId, slot) }),
  };
}

interface PrimitiveRow {
  id: string;
  kind: string;
  label: string;
  metadata_json: string;
  provenance_json: string;
}

interface RelationRow {
  from_id: string;
  to_id: string;
  relation_kind: string;
  metadata_json: string;
}

interface MetricRow {
  primitive_id: string;
  slot: string;
  value: number;
}

const sceneSlotTables = new Map<string, string[]>();

function rowsFromPrimitives(primitives: SimulationPrimitive[]): PrimitiveRow[] {
  return primitives.map((primitive) => ({
    id: primitive.id,
    kind: primitive.kind,
    label: String(
      primitive.metadata.title
      ?? primitive.metadata.name
      ?? primitive.id,
    ),
    metadata_json: JSON.stringify(primitive.metadata ?? {}),
    provenance_json: JSON.stringify(primitive.provenance_object_ids ?? []),
  }));
}

function rowsFromRelations(relations: SimulationRelation[]): RelationRow[] {
  return relations.map((relation) => ({
    from_id: relation.from_id,
    to_id: relation.to_id,
    relation_kind: relation.relation_kind,
    metadata_json: JSON.stringify(relation.metadata ?? {}),
  }));
}

function rowsFromMetrics(
  primitives: SimulationPrimitive[],
  metadataSlots: string[],
): MetricRow[] {
  const rows: MetricRow[] = [];
  for (const primitive of primitives) {
    for (const slot of metadataSlots) {
      const value = primitive.metadata[slot];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      rows.push({
        primitive_id: primitive.id,
        slot,
        value,
      });
    }
  }
  return rows;
}

async function registerJsonBuffer(
  duckdb: AsyncDuckDB,
  name: string,
  rows: unknown[],
): Promise<void> {
  const encoded = new TextEncoder().encode(JSON.stringify(rows));
  await duckdb.dropFile(name).catch(() => undefined);
  await duckdb.registerFileBuffer(name, encoded);
}

async function recreatePrimitiveTable(
  duckdb: AsyncDuckDB,
  connection: AsyncDuckDBConnection,
  tableName: string,
  rows: PrimitiveRow[],
): Promise<void> {
  await connection.query(`DROP TABLE IF EXISTS ${tableName}`);
  await connection.query(`
    CREATE TABLE ${tableName} (
      id               VARCHAR PRIMARY KEY,
      kind             VARCHAR,
      label            VARCHAR,
      metadata_json    VARCHAR,
      provenance_json  VARCHAR
    )
  `);
  if (rows.length === 0) return;

  const fileName = `${tableName}.json`;
  await registerJsonBuffer(duckdb, fileName, rows);
  await connection.query(`
    INSERT INTO ${tableName}
    SELECT id, kind, label, metadata_json, provenance_json
    FROM read_json('${fileName}', columns={
      id: 'VARCHAR',
      kind: 'VARCHAR',
      label: 'VARCHAR',
      metadata_json: 'VARCHAR',
      provenance_json: 'VARCHAR'
    })
  `);
}

async function recreateRelationTable(
  duckdb: AsyncDuckDB,
  connection: AsyncDuckDBConnection,
  tableName: string,
  rows: RelationRow[],
): Promise<void> {
  await connection.query(`DROP TABLE IF EXISTS ${tableName}`);
  await connection.query(`
    CREATE TABLE ${tableName} (
      from_id       VARCHAR,
      to_id         VARCHAR,
      relation_kind VARCHAR,
      metadata_json VARCHAR
    )
  `);
  if (rows.length === 0) return;

  const fileName = `${tableName}.json`;
  await registerJsonBuffer(duckdb, fileName, rows);
  await connection.query(`
    INSERT INTO ${tableName}
    SELECT from_id, to_id, relation_kind, metadata_json
    FROM read_json('${fileName}', columns={
      from_id: 'VARCHAR',
      to_id: 'VARCHAR',
      relation_kind: 'VARCHAR',
      metadata_json: 'VARCHAR'
    })
  `);
}

async function recreateMetricTables(
  duckdb: AsyncDuckDB,
  connection: AsyncDuckDBConnection,
  sceneId: string,
  tableName: string,
  rows: MetricRow[],
  metadataSlots: string[],
): Promise<void> {
  await connection.query(`DROP TABLE IF EXISTS ${tableName}`);
  await connection.query(`
    CREATE TABLE ${tableName} (
      primitive_id VARCHAR,
      slot         VARCHAR,
      value        DOUBLE
    )
  `);
  if (rows.length > 0) {
    const fileName = `${tableName}.json`;
    await registerJsonBuffer(duckdb, fileName, rows);
    await connection.query(`
      INSERT INTO ${tableName}
      SELECT primitive_id, slot, value
      FROM read_json('${fileName}', columns={
        primitive_id: 'VARCHAR',
        slot: 'VARCHAR',
        value: 'DOUBLE'
      })
    `);
  }

  const safeScene = sanitizeIdentifier(sceneId);
  const previous = sceneSlotTables.get(safeScene) ?? [];
  for (const oldTable of previous) {
    await connection.query(`DROP TABLE IF EXISTS ${oldTable}`);
  }

  const nextSlotTables: string[] = [];
  for (const slot of metadataSlots) {
    const slotTable = metricTableName(sceneId, slot);
    nextSlotTables.push(slotTable);
    await connection.query(`DROP TABLE IF EXISTS ${slotTable}`);
    await connection.query(`
      CREATE TABLE ${slotTable} AS
      SELECT primitive_id, value
      FROM ${tableName}
      WHERE slot = '${slot.replace(/'/g, "''")}'
    `);
  }
  sceneSlotTables.set(safeScene, nextSlotTables);
}

export async function ingestSimulationPrimitives(
  sceneId: string,
  primitives: SimulationPrimitive[],
  relations: SimulationRelation[],
  metadataSlots: string[],
): Promise<void> {
  const tables = SIMULATION_TABLES_FOR(sceneId);
  const { duckdb, connection } = await getSharedDuckDB();
  await recreatePrimitiveTable(
    duckdb,
    connection,
    tables.primitives.name,
    rowsFromPrimitives(primitives),
  );
  await recreateRelationTable(
    duckdb,
    connection,
    tables.relations.name,
    rowsFromRelations(relations),
  );
  await recreateMetricTables(
    duckdb,
    connection,
    sceneId,
    tables.metrics.name,
    rowsFromMetrics(primitives, metadataSlots),
    metadataSlots,
  );
}

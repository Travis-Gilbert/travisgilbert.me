import type { DataSource, DataLoadProgress, DuckDBError } from './types';
import { getDuckDB } from './DuckDBEngine';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const registeredTables = new Set<string>();

function sanitizeTableName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Load a data source and register it as a DuckDB table.
 * Idempotent: skips loading if a table with the same name already exists.
 */
export async function loadDataSource(
  source: DataSource,
  onProgress?: (progress: DataLoadProgress) => void,
): Promise<string | DuckDBError> {
  const tableName = sanitizeTableName(source.table_name);

  if (registeredTables.has(tableName)) return tableName;

  const db = await getDuckDB();
  if ('code' in db) return db;

  try {
    const conn = await db.connect();

    try {
      if (source.format === 'parquet') {
        const { DuckDBDataProtocol } = await import('@duckdb/duckdb-wasm');
        await db.registerFileURL(
          `${tableName}.parquet`,
          source.url,
          DuckDBDataProtocol.HTTP,
          false,
        );
        await conn.query(
          `CREATE TABLE IF NOT EXISTS "${tableName}" AS SELECT * FROM read_parquet('${tableName}.parquet')`,
        );
      } else {
        const ext = source.format; // 'csv' | 'json'
        const readFn = source.format === 'csv' ? 'read_csv_auto' : 'read_json_auto';
        const data = await fetchWithSizeCheck(source.url, onProgress);
        if ('code' in data) return data;
        await db.registerFileBuffer(`${tableName}.${ext}`, data);
        await conn.query(
          `CREATE TABLE IF NOT EXISTS "${tableName}" AS SELECT * FROM ${readFn}('${tableName}.${ext}')`,
        );
      }

      registeredTables.add(tableName);
      return tableName;
    } finally {
      await conn.close();
    }
  } catch (err) {
    return {
      code: 'LOAD_FAILED',
      message: err instanceof Error ? err.message : `Failed to load ${source.url}`,
    };
  }
}

async function fetchWithSizeCheck(
  url: string,
  onProgress?: (progress: DataLoadProgress) => void,
): Promise<Uint8Array | DuckDBError> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { code: 'LOAD_FAILED', message: `HTTP ${response.status}: ${response.statusText}` };
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_FILE_SIZE) {
      return {
        code: 'OVERSIZED',
        message: `File exceeds 100MB limit (${Math.round(contentLength / 1024 / 1024)}MB)`,
      };
    }

    if (!response.body) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_FILE_SIZE) {
        return {
          code: 'OVERSIZED',
          message: `File exceeds 100MB limit (${Math.round(buffer.byteLength / 1024 / 1024)}MB)`,
        };
      }
      return new Uint8Array(buffer);
    }

    const reader = response.body.getReader();

    // Pre-allocate when content-length is known to avoid double memory
    if (contentLength > 0) {
      const buffer = new Uint8Array(contentLength);
      let offset = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer.set(value, offset);
        offset += value.byteLength;
        onProgress?.({ loaded_bytes: offset, total_bytes: contentLength });
      }
      return buffer;
    }

    // Unknown length: collect chunks then combine
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value.byteLength;

      if (loaded > MAX_FILE_SIZE) {
        reader.cancel();
        return { code: 'OVERSIZED', message: 'File exceeds 100MB limit during download' };
      }

      chunks.push(value);
      onProgress?.({ loaded_bytes: loaded, total_bytes: loaded });
    }

    const result = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  } catch (err) {
    return {
      code: 'LOAD_FAILED',
      message: err instanceof Error ? err.message : `Failed to fetch ${url}`,
    };
  }
}

import type { QueryResult, DuckDBError } from './types';
import { getDuckDB } from './DuckDBEngine';

const QUERY_TIMEOUT_MS = 30_000;
const MAX_CONCURRENT = 5;

let activeQueries = 0;
const queue: Array<{ resolve: () => void }> = [];

const FORBIDDEN_PATTERN = /^\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE)\b/i;

function validateSQL(sql: string): DuckDBError | null {
  if (FORBIDDEN_PATTERN.test(sql)) {
    return { code: 'INVALID_SQL', message: 'Only SELECT statements are allowed' };
  }
  const trimmed = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '').trim();
  if (!/^(SELECT|WITH)\b/i.test(trimmed)) {
    return { code: 'INVALID_SQL', message: 'Only SELECT statements are allowed' };
  }
  // Reject multi-statement queries
  const withoutStrings = trimmed.replace(/'[^']*'/g, '');
  if (withoutStrings.includes(';')) {
    return { code: 'INVALID_SQL', message: 'Multi-statement queries are not allowed' };
  }
  return null;
}

async function acquireSlot(): Promise<void> {
  if (activeQueries < MAX_CONCURRENT) {
    activeQueries++;
    return;
  }
  return new Promise<void>((resolve) => {
    queue.push({ resolve });
  });
}

function releaseSlot(): void {
  activeQueries--;
  const next = queue.shift();
  if (next) {
    activeQueries++;
    next.resolve();
  }
}

export async function runQuery(sql: string): Promise<QueryResult | DuckDBError> {
  const validationError = validateSQL(sql);
  if (validationError) return validationError;

  const db = await getDuckDB();
  if ('code' in db) return db;

  await acquireSlot();

  try {
    const conn = await db.connect();
    const start = performance.now();

    try {
      const result = await new Promise<Awaited<ReturnType<typeof conn.query>>>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Query timed out after 30 seconds')),
          QUERY_TIMEOUT_MS,
        );
        conn.query(sql).then(
          (r) => { clearTimeout(timer); resolve(r); },
          (e) => { clearTimeout(timer); reject(e); },
        );
      });

      const executionTime = performance.now() - start;
      const schema = result.schema;
      const columns = schema.fields.map((f: { name: string }) => f.name);
      const types = schema.fields.map((f: { type: { toString(): string } }) => f.type.toString());

      const cols = columns.map((_: string, j: number) => result.getChildAt(j));
      const rows: unknown[][] = [];
      for (let i = 0; i < result.numRows; i++) {
        const row: unknown[] = [];
        for (let j = 0; j < cols.length; j++) {
          row.push(cols[j] ? convertValue(cols[j]!.get(i), types[j]) : null);
        }
        rows.push(row);
      }

      return {
        columns,
        types,
        rows,
        row_count: result.numRows,
        execution_time_ms: Math.round(executionTime),
      };
    } finally {
      await conn.close();
    }
  } catch (err) {
    return {
      code: 'QUERY_FAILED',
      message: err instanceof Error ? err.message : 'Query execution failed',
    };
  } finally {
    releaseSlot();
  }
}

function convertValue(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return null;

  const upperType = type.toUpperCase();

  if (upperType.includes('INT') || upperType.includes('BIGINT')) {
    if (typeof value === 'bigint') {
      const n = Number(value);
      return Number.isSafeInteger(n) ? n : value.toString();
    }
    return Number(value);
  }
  if (upperType.includes('FLOAT') || upperType.includes('DOUBLE') || upperType.includes('DECIMAL')) {
    return Number(value);
  }
  if (upperType.includes('DATE') || upperType.includes('TIMESTAMP')) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number' || typeof value === 'bigint') {
      return new Date(Number(value)).toISOString();
    }
    return String(value);
  }
  if (upperType.includes('VARCHAR') || upperType.includes('TEXT')) {
    return String(value);
  }
  if (upperType.includes('BOOL')) {
    return Boolean(value);
  }

  return value;
}

export function toObjectArray(result: QueryResult): Record<string, unknown>[] {
  return result.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < result.columns.length; i++) {
      obj[result.columns[i]] = row[i];
    }
    return obj;
  });
}

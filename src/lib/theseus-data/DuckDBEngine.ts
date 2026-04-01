import type { DuckDBError } from './types';

type AsyncDuckDB = import('@duckdb/duckdb-wasm').AsyncDuckDB;

let instance: AsyncDuckDB | null = null;
let initPromise: Promise<AsyncDuckDB | DuckDBError> | null = null;

export async function getDuckDB(): Promise<AsyncDuckDB | DuckDBError> {
  if (instance) return instance;
  if (initPromise) return initPromise;

  initPromise = initDuckDB();
  const result = await initPromise;

  if ('code' in result) {
    initPromise = null;
    return result;
  }

  instance = result;
  return instance;
}

export function isReady(): boolean {
  return instance !== null;
}

async function initDuckDB(): Promise<AsyncDuckDB | DuckDBError> {
  try {
    const duckdb = await import('@duckdb/duckdb-wasm');

    const bundles = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(bundles);

    if (!bundle.mainWorker) {
      return { code: 'INIT_FAILED', message: 'No suitable DuckDB-WASM bundle found' };
    }

    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);

    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    await db.open({});

    return db;
  } catch (err) {
    return {
      code: 'INIT_FAILED',
      message: err instanceof Error ? err.message : 'DuckDB-WASM initialization failed',
    };
  }
}

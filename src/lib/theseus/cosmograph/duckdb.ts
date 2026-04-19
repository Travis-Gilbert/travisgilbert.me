'use client';

// Shared DuckDB-WASM singleton for the Theseus stack. Both Cosmograph
// (<Cosmograph duckDBConnection={...}>) and Mosaic (wasmConnector({ duckdb,
// connection })) talk to the SAME AsyncDuckDB instance so that cross-filter
// selections made in the graph propagate to Mosaic views and vice versa.
//
// The singleton is lazy: the first caller triggers the JsDelivr bundle fetch
// + instantiation, subsequent callers await the cached promise. This must
// only run in the browser; callers that reach here during SSR will throw.

import * as duckdb from '@duckdb/duckdb-wasm';

interface SharedDuckDB {
  duckdb: duckdb.AsyncDuckDB;
  connection: duckdb.AsyncDuckDBConnection;
}

let pending: Promise<SharedDuckDB> | null = null;

async function bootstrap(): Promise<SharedDuckDB> {
  if (typeof window === 'undefined') {
    throw new Error('getSharedDuckDB() called on the server; DuckDB-WASM is browser-only.');
  }

  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  if (!bundle.mainWorker) {
    throw new Error('No DuckDB-WASM worker available in this environment.');
  }

  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: 'text/javascript',
    }),
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? undefined);
  URL.revokeObjectURL(workerUrl);
  const connection = await db.connect();
  return { duckdb: db, connection };
}

/** Resolve the shared DuckDB-WASM instance, initializing it on first call. */
export function getSharedDuckDB(): Promise<SharedDuckDB> {
  if (!pending) pending = bootstrap();
  return pending;
}

/** For testing/hot-reload paths only: drop the cached instance. */
export function _resetSharedDuckDB(): void {
  pending = null;
}

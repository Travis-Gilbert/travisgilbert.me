export type { DataSource, DataAcquisitionSection } from '../theseus-types';

export interface QueryResult {
  columns: string[];
  types: string[];
  rows: unknown[][];
  row_count: number;
  execution_time_ms: number;
}

export interface DataLoadProgress {
  loaded_bytes: number;
  total_bytes: number;
}

export type DataProcessingStatus =
  | { phase: 'initializing' }
  | { phase: 'loading'; source: string; progress: DataLoadProgress }
  | { phase: 'processing'; query_index: number; total: number }
  | { phase: 'complete' }
  | { phase: 'error'; message: string; fallback: string };

export interface DuckDBError {
  code: 'INIT_FAILED' | 'LOAD_FAILED' | 'QUERY_FAILED' | 'OVERSIZED' | 'INVALID_SQL';
  message: string;
}

// TypeScript types for Django-emitted Mosaic specs.
//
// Django serializes Mosaic AST as JSON in a ResponseSection when an answer
// is best rendered as a chart rather than a graph. The frontend passes this
// JSON to `@uwdata/mosaic-spec`'s `parseSpec` + `astToDOM` to produce a
// live, cross-filterable widget.
//
// The `plot` field is typed as `unknown` because the full Mosaic plot
// grammar is large and the Django side is authoritative. If we add
// client-side spec construction later, swap in the imported Spec type from
// @uwdata/mosaic-spec.

export interface MosaicDataSource {
  /** URL to a Parquet/CSV/JSON file Mosaic will load into DuckDB. */
  file?: string;
  /** Inline rows. Use only for tiny datasets (< 1000 rows); Parquet otherwise. */
  inline?: unknown[];
  /** Pre-computed SQL, executed against the shared DuckDB on first use. */
  query?: string;
}

export interface MosaicSpec {
  type: 'mosaic';
  data: Record<string, MosaicDataSource>;
  /** Mosaic plot AST. See @uwdata/mosaic-spec Spec type for full shape. */
  plot: unknown[];
  width?: number;
  height?: number;
  /** Optional per-spec parameters surfaced in the coordinator. */
  params?: Record<string, unknown>;
}

export function isMosaicSpec(x: unknown): x is MosaicSpec {
  return (
    typeof x === 'object' && x !== null &&
    (x as { type?: unknown }).type === 'mosaic' &&
    typeof (x as { data?: unknown }).data === 'object' &&
    Array.isArray((x as { plot?: unknown }).plot)
  );
}

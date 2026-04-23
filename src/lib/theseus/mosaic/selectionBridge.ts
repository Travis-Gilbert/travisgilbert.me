'use client';

// Phase C: Selection -> graph-visibility bridge.
//
// Subscribes to the four module-scoped Selection.intersect() singletons
// declared in coordinator.ts (timeRangeSelection, clusterSelection,
// hypothesisSelection, edgeTypeSelection) and derives a union visible-id
// set by querying the DuckDB `objects` table (plus an optional edges JOIN
// when edgeTypeSelection is active). The resulting set is pushed to the
// cosmos.gl canvas via adapter.setVisibleIds(). When all four selections
// are idle, the bridge calls setVisibleIds(null) so points return to
// their encoded alpha without the filter mask.
//
// Intersection semantics: each Selection is constructed with intersect()
// resolution, which means the SQL predicate returned by Selection.predicate()
// already AND-joins every clause the Selection holds. The bridge then AND-
// joins across the four Selections itself, yielding the full cross-filter.
//
// Edge-type join: edge_type lives on the `edges` table, not `objects`. When
// edgeTypeSelection has an active clause we add a LEFT JOIN against edges
// so a node qualifies if any of its incident edges match the edge predicate.
// The `e.edge_type IS NULL` escape keeps orphan nodes (no edges) visible
// whenever the node-side predicate allows them. The JOIN is omitted
// entirely when edgeTypeSelection is idle, keeping the common case cheap.
//
// Mount topology: ONE bridge per Explorer instance. Call attachSelectionBridge()
// from ExplorerShell's effect after the Coordinator and DuckDB ingestion
// are both ready; retain the returned disposer and call it on unmount.
//
// Hard stops (from claims.jsonl):
//   b57b96ebf9da - Coordinator is the one in coordinator.ts.
//   1bb60008eca1 - Selections are module-scoped; we import, never construct.
//   f14fbe72a84c - Only adapter.setVisibleIds is called; no raw graph setters.

import type { GraphAdapter } from '@/lib/theseus/cosmograph/adapter';
import { getSharedDuckDB } from '@/lib/theseus/cosmograph/duckdb';
import {
  clusterSelection,
  edgeTypeSelection,
  hypothesisSelection,
  simulationBrushSelection,
  timeRangeSelection,
  typeSelection,
} from './coordinator';
import { EXPLORER_TABLES } from './ingestExplorerData';
import { SIMULATION_TABLES_FOR } from './ingestSimulationPrimitives';

type Predicate = unknown;

interface ExplorerSelections {
  timeRange: typeof timeRangeSelection;
  cluster: typeof clusterSelection;
  hypothesis: typeof hypothesisSelection;
  edgeType: typeof edgeTypeSelection;
  type: typeof typeSelection;
  simulationBrush: typeof simulationBrushSelection;
}

const DEFAULT_SELECTIONS: ExplorerSelections = {
  timeRange: timeRangeSelection,
  cluster: clusterSelection,
  hypothesis: hypothesisSelection,
  edgeType: edgeTypeSelection,
  type: typeSelection,
  simulationBrush: simulationBrushSelection,
};

function predicateToSql(p: Predicate): string | null {
  // Selection.predicate(null) returns:
  //   undefined        - no clauses active
  //   true/false       - trivial predicate
  //   ExprNode         - toString() yields SQL
  //   string           - already SQL
  //   Array of any of the above for multi-clause
  if (p == null) return null;
  if (p === true) return null;          // true filter = no filter
  if (p === false) return '0 = 1';      // empty selection
  if (typeof p === 'string') {
    const trimmed = p.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(p)) {
    const parts: string[] = [];
    for (const item of p) {
      const sub = predicateToSql(item);
      if (sub) parts.push(`(${sub})`);
    }
    return parts.length === 0 ? null : parts.join(' AND ');
  }
  if (typeof p === 'object') {
    // ExprNode or similar AST: .toString() serializes to SQL.
    try {
      const s = String(p);
      const trimmed = s.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function combinePredicates(parts: Array<string | null>): string | null {
  const active = parts.filter((s): s is string => s !== null && s.length > 0);
  if (active.length === 0) return null;
  return active.map((s) => `(${s})`).join(' AND ');
}

/**
 * Query DuckDB for the set of object ids satisfying the combined predicate.
 * Returns null when no Selection is active (the canvas should clear its
 * filter mask). Returns [] when the combined predicate matches nothing.
 *
 * Edge-type handling: edge_type lives on the `edges` table, so when its
 * Selection carries a predicate we LEFT JOIN edges onto objects and allow
 * the match via an OR against NULL so orphan nodes (no incident edges)
 * still pass when their node-side predicate allows them. The JOIN is
 * skipped entirely when edgeTypeSelection is idle.
 */
async function resolveVisibleIds(
  selections: ExplorerSelections,
  context: {
    mode: 'explorer' | 'simulation';
    simulationSceneId?: string;
    simulationSlot?: string;
  },
): Promise<string[] | null> {
  if (context.mode === 'simulation') {
    const simulationPredicate = predicateToSql(selections.simulationBrush.predicate(null));
    if (simulationPredicate === null) return null;
    if (!context.simulationSceneId || !context.simulationSlot) return null;

    const { metricBySlot } = SIMULATION_TABLES_FOR(context.simulationSceneId);
    const slotTable = metricBySlot(context.simulationSlot).name;
    const { connection } = await getSharedDuckDB();
    const table = await connection.query(`
      SELECT DISTINCT primitive_id AS id
      FROM ${slotTable}
      WHERE ${simulationPredicate}
    `);
    const column = table.getChild('id');
    if (!column) return [];
    const ids: string[] = [];
    for (let i = 0; i < column.length; i++) {
      const value = column.get(i);
      if (value != null) ids.push(String(value));
    }
    return ids;
  }

  const nodeParts = [
    predicateToSql(selections.timeRange.predicate(null)),
    predicateToSql(selections.cluster.predicate(null)),
    predicateToSql(selections.hypothesis.predicate(null)),
    predicateToSql(selections.type.predicate(null)),
  ];
  const edgePart = predicateToSql(selections.edgeType.predicate(null));
  const nodeCombined = combinePredicates(nodeParts);
  if (nodeCombined === null && edgePart === null) return null;

  const { objects, edges } = EXPLORER_TABLES;
  const { connection } = await getSharedDuckDB();

  let sql: string;
  if (edgePart !== null) {
    // Widen the WHERE clause to keep orphan nodes (no incident edges)
    // eligible so a typical edge-type filter does not blank-out isolated
    // evidence that otherwise satisfies the node-side predicate.
    const wherePieces: string[] = [`((${edgePart}) OR e.edge_type IS NULL)`];
    if (nodeCombined !== null) wherePieces.unshift(`(${nodeCombined})`);
    sql = `
      SELECT DISTINCT o.id
      FROM ${objects.name} o
      LEFT JOIN ${edges.name} e
        ON (e.source_id = o.id OR e.target_id = o.id)
      WHERE ${wherePieces.join(' AND ')}
    `;
  } else {
    sql = `SELECT id FROM ${objects.name} WHERE ${nodeCombined}`;
  }

  const table = await connection.query(sql);
  // arrow.Table rows: getChild('id') returns a column; the generic in
  // connection.query constrains column dtypes so we stay untyped here and
  // String() every row value defensively.
  const column = table.getChild('id');
  if (!column) return [];
  const ids: string[] = [];
  for (let i = 0; i < column.length; i++) {
    const v = column.get(i);
    if (v != null) ids.push(String(v));
  }
  return ids;
}

export interface BridgeOptions {
  /**
   * Override the default module-scoped selections. Kept for tests so we
   * can exercise the bridge without touching the global singletons.
   */
  selections?: Partial<ExplorerSelections>;
  /**
   * Log query failures at info level via the provided function. Defaults
   * to console.warn so failures don't crash the Explorer.
   */
  onError?: (err: unknown) => void;
  /** Bridge mode. Explorer mode applies shared Explorer selections against
   *  objects/edges tables. Simulation mode applies only simulationBrush
   *  against a scene-local metric table. */
  mode?: 'explorer' | 'simulation';
  /** Required for simulation mode. */
  simulationSceneId?: string;
  /** Required for simulation mode. */
  simulationSlot?: string;
}

/**
 * Wire the three Explorer Selections to adapter.setVisibleIds. Returns a
 * disposer that removes all three listeners. Safe to call before any
 * brush has fired: the initial computation also runs so the canvas starts
 * with the correct filter state.
 */
export function attachSelectionBridge(
  adapter: GraphAdapter,
  options: BridgeOptions = {},
): () => void {
  const selections: ExplorerSelections = {
    timeRange: options.selections?.timeRange ?? DEFAULT_SELECTIONS.timeRange,
    cluster: options.selections?.cluster ?? DEFAULT_SELECTIONS.cluster,
    hypothesis: options.selections?.hypothesis ?? DEFAULT_SELECTIONS.hypothesis,
    edgeType: options.selections?.edgeType ?? DEFAULT_SELECTIONS.edgeType,
    type: options.selections?.type ?? DEFAULT_SELECTIONS.type,
    simulationBrush: options.selections?.simulationBrush ?? DEFAULT_SELECTIONS.simulationBrush,
  };
  const mode = options.mode ?? 'explorer';

  const onError = options.onError ?? ((err: unknown) => {
    // Keep the canvas running; just surface at info-level.
    // eslint-disable-next-line no-console
    console.warn('[selectionBridge] query failed', err);
  });

  let disposed = false;
  let inflight = 0;

  const update = () => {
    const token = ++inflight;
    void resolveVisibleIds(selections, {
      mode,
      simulationSceneId: options.simulationSceneId,
      simulationSlot: options.simulationSlot,
    })
      .then((ids) => {
        if (disposed || token !== inflight) return;
        adapter.setVisibleIds(ids);
      })
      .catch((err) => {
        if (disposed || token !== inflight) return;
        onError(err);
        // Fail open: clear the mask so the user isn't left with a black canvas.
        adapter.setVisibleIds(null);
      });
  };

  // Selection extends AsyncDispatch<SelectionClauseArray>; the 'value'
  // event fires after a clause is resolved and emitted.
  const handler = () => update();
  selections.timeRange.addEventListener('value', handler);
  selections.cluster.addEventListener('value', handler);
  selections.hypothesis.addEventListener('value', handler);
  selections.edgeType.addEventListener('value', handler);
  selections.type.addEventListener('value', handler);
  selections.simulationBrush.addEventListener('value', handler);

  // Run once immediately so the canvas reflects any clauses that were
  // already present on Selections when the bridge attached.
  update();

  return () => {
    if (disposed) return;
    disposed = true;
    selections.timeRange.removeEventListener('value', handler);
    selections.cluster.removeEventListener('value', handler);
    selections.hypothesis.removeEventListener('value', handler);
    selections.edgeType.removeEventListener('value', handler);
    selections.type.removeEventListener('value', handler);
    selections.simulationBrush.removeEventListener('value', handler);
  };
}

'use client';

// Mosaic coordinator wiring.
//
// The Mosaic runtime routes every client query through a single Coordinator
// instance. We bind that coordinator to the shared DuckDB-WASM singleton so
// Cosmograph and Mosaic widgets read the same tables without duplicating
// them in memory. The coordinator is a process-level singleton in vgplot's
// design; calling `initMosaicCoordinator()` more than once is idempotent.
//
// Named selections live here too: any widget that wants to cross-filter
// with another should bind its params to one of these shared Selection
// instances. The names (timeRange / cluster / hypothesis) match the
// IntelligencePanel widget specs in §11 of the completion doc.

import { coordinator, wasmConnector, Selection } from '@uwdata/vgplot';
import { getSharedDuckDB } from '@/lib/theseus/cosmograph/duckdb';

let initialized: Promise<void> | null = null;

export function initMosaicCoordinator(): Promise<void> {
  if (initialized) return initialized;
  initialized = (async () => {
    const { duckdb, connection } = await getSharedDuckDB();
    const connector = wasmConnector({ duckdb, connection });
    coordinator().databaseConnector(connector);
  })();
  return initialized;
}

/** Cross-filter selections shared across widgets. Widgets that want to
 *  participate in cross-filter bind their plot `as:` param to one of these.
 *
 *  Constructed at module scope (not per-render) so every chart and the
 *  selectionBridge see the same singleton instance. Phase C Explorer:
 *    - timeRange: areaY brush over objects.captured_at
 *    - cluster:   rectY clicks over objects.leiden_community
 *    - hypothesis: reserved for downstream tension/claim widgets
 *    - edgeType:  rectY clicks over edges.edge_type (joins into visible ids
 *                 via the selectionBridge's edge-aware predicate path)
 *    - type:      GraphLegend swatch clicks over objects.type; dims the
 *                 canvas to a single (or shift-added) object type. Lives
 *                 at the same cross-filter layer as the four above so
 *                 it AND-joins with every other active selection. */
export const timeRangeSelection = Selection.intersect();
export const clusterSelection = Selection.intersect();
export const hypothesisSelection = Selection.intersect();
export const edgeTypeSelection = Selection.intersect();
export const typeSelection = Selection.intersect();
/** Simulation-scoped brush selection. Used by SimulationPart mixed/mosaic
 *  charts to cross-filter primitive visibility on the Cosmograph surface. */
export const simulationBrushSelection = Selection.intersect();

/** Test/hot-reload helper: drop the init promise. */
export function _resetMosaicCoordinator(): void {
  initialized = null;
}

'use client';

import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';

/** Narrow operation surface exposed by the graph canvas to SceneDirective
 *  consumers. Hides the underlying Graph instance and id↔index bookkeeping
 *  so callers don't reach into rendering internals. */
export interface GraphAdapter {
  focusNodes(ids: string[]): void;
  clearFocus(): void;
  zoomToNode(id: string, durationMs: number, distance: number): void;
  fitView(durationMs?: number, padding?: number): void;
}

export function applySceneDirective(
  adapter: GraphAdapter | null | undefined,
  directive: SceneDirective | null | undefined,
): void {
  if (!adapter || !directive) return;

  const salience = Array.isArray(directive.salience) ? directive.salience : [];
  const focal = salience
    .filter((s): s is typeof s & { is_focal: true; node_id: string } =>
      Boolean(s?.is_focal) && typeof s?.node_id === 'string')
    .map((s) => s.node_id);

  if (focal.length > 0) {
    adapter.focusNodes(focal);
  } else {
    adapter.clearFocus();
  }

  const camera = directive.camera;
  if (camera && typeof camera === 'object' && 'focal_node_id' in camera) {
    const focalId = (camera as { focal_node_id?: string }).focal_node_id;
    const distance = (camera as { distance_factor?: number }).distance_factor;
    const duration = (camera as { transition_duration_ms?: number }).transition_duration_ms ?? 800;
    if (focalId) {
      adapter.zoomToNode(focalId, duration, distance ?? 3);
    }
  }
}

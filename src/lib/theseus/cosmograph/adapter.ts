'use client';

// SceneDirective → imperative Cosmograph calls.
//
// The adapter is narrow by design: it reads a few fields from the directive
// and drives Cosmograph via its ref. Anything that requires lower-level DOM
// work (pretext label overlays, banner rendering) lives in dedicated
// components that subscribe to Cosmograph events.
//
// The old v3 SceneDirective shape has `salience`, `camera`, `force_config`,
// `truth_map_topology`, and `hypothesis_style` fields; we treat all of them
// as optional so this adapter works against partial directives emitted by
// older Django versions during the transition.

import type { CosmographRef } from '@cosmograph/react';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';

type CosmoLike = NonNullable<CosmographRef>;

function callIfPresent<T extends keyof CosmoLike>(
  cosmo: CosmoLike,
  method: T,
  ...args: unknown[]
): void {
  const fn = (cosmo as unknown as Record<string, unknown>)[method as string];
  if (typeof fn === 'function') {
    (fn as (...a: unknown[]) => void).apply(cosmo, args);
  }
}

export function applySceneDirective(
  cosmo: CosmographRef,
  directive: SceneDirective | null | undefined,
): void {
  if (!cosmo || !directive) return;

  const salience = Array.isArray(directive.salience) ? directive.salience : [];
  const focal = salience
    .filter((s): s is typeof s & { is_focal: true; node_id: string } =>
      Boolean(s?.is_focal) && typeof s?.node_id === 'string')
    .map((s) => s.node_id);

  // Focus: dim everything except the focal ids.
  if (focal.length > 0) {
    callIfPresent(cosmo, 'selectPoints' as keyof CosmoLike, focal);
  }

  // Camera: zoom to the directive's focal node if one is declared.
  const camera = directive.camera;
  if (camera && typeof camera === 'object' && 'focal_node_id' in camera) {
    const focalId = (camera as { focal_node_id?: string }).focal_node_id;
    const distance = (camera as { distance_factor?: number }).distance_factor;
    const duration = (camera as { transition_duration_ms?: number }).transition_duration_ms ?? 800;
    if (focalId) {
      callIfPresent(
        cosmo,
        'zoomToPoint' as keyof CosmoLike,
        focalId,
        duration,
        distance,
      );
    }
  }
}

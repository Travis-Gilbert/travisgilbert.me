'use client';

// Default Cosmograph configuration for the Theseus Explorer canvas.
//
// Every visual knob is exposed here so the adapter (see ./adapter.ts) can
// override specific fields in response to a SceneDirective without having
// to know the base values. Components using the config should spread it
// into the <Cosmograph {...cfg} /> call and apply their own overrides on
// top.

import type { CosmographConfig } from '@cosmograph/react';
import { resolveTypeColor } from './typeColors';

/** Build the default config at render time so CSS variables resolve against
 *  the current theme. Pass `themeVersion` to invalidate the colour cache when
 *  the document theme flips. */
export function makeDefaultCosmographConfig(
  themeVersion: number = 0,
): Partial<CosmographConfig> {
  return {
    // Rendering
    backgroundColor: 'rgba(0, 0, 0, 0)',    // transparent; panel background wins
    pointSize: 4,
    pointSizeBy: 'pagerank',
    pointColorBy: 'type',
    pointColorByFn: (value: unknown) =>
      resolveTypeColor(String(value ?? ''), themeVersion),

    // Links
    linkWidth: 1,
    linkColor: 'rgba(42, 36, 32, 0.15)',
    linkArrows: false,
    renderLinks: true,
    curvedLinks: true,

    // Labels
    showLabels: true,
    showDynamicLabels: true,
    showLabelsFor: undefined,                // all visible by default
    labelClassName: 'vie-cosmo-label',
    hoveredLabelClassName: 'vie-cosmo-label-hovered',

    // Simulation
    simulationGravity: 0.25,
    simulationRepulsion: 1.0,
    simulationLinkSpring: 1.0,
    simulationLinkDistance: 10,
    simulationFriction: 0.85,
    simulationDecay: 1000,
    spaceSize: 8192,

    // Camera
    fitViewOnInit: true,
    fitViewDelay: 500,

    // Interactions
    enableRightClickRepulsion: true,
    disableZoom: false,
    disableDrag: false,
  } satisfies Partial<CosmographConfig>;
}

/** Eagerly-resolved config for call sites that cannot pass a themeVersion. */
export const DEFAULT_COSMOGRAPH_CONFIG: Partial<CosmographConfig> =
  makeDefaultCosmographConfig(0);

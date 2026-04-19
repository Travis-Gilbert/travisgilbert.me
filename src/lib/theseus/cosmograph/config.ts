'use client';

// Default Cosmograph configuration for the Theseus Explorer canvas.
//
// Every visual knob is exposed here so the adapter (see ./adapter.ts) can
// override specific fields in response to a SceneDirective without having
// to know the base values. Components using the config should spread it
// into the <Cosmograph {...cfg} /> call and apply their own overrides on
// top.

import type { CosmographConfig } from '@cosmograph/react';

/** Build the default config at render time so CSS variables resolve against
 *  the current theme. Pass `themeVersion` to invalidate the colour cache when
 *  the document theme flips. */
export function makeDefaultCosmographConfig(
  _themeVersion: number = 0,
): Partial<CosmographConfig> {
  return {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    fitViewOnInit: true,
  } satisfies Partial<CosmographConfig>;
}

/** Eagerly-resolved config for call sites that cannot pass a themeVersion. */
export const DEFAULT_COSMOGRAPH_CONFIG: Partial<CosmographConfig> =
  makeDefaultCosmographConfig(0);

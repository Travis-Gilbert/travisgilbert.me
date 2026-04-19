'use client';

// Scene directive normalizer.
//
// Django's SceneDirective `render_target.primary` field ships an old
// nine-value vocabulary (`particle-field`, `force-graph-3d`, `sigma-2d`,
// `vega-lite`, `d3`, plus a handful of sub-types). V2 collapses that into
// three values (`graph`, `mosaic`, `text`). Until the backend is updated,
// the frontend accepts either shape and maps the legacy values forward via
// this module.

import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';

export type RenderTargetPrimary = 'graph' | 'mosaic' | 'text';

const LEGACY_MAP: Record<string, RenderTargetPrimary> = {
  'particle-field':  'graph',
  'force-graph-3d':  'graph',
  'sigma-2d':        'graph',
  'graph':           'graph',
  'vega-lite':       'mosaic',
  'd3':              'mosaic',
  'mosaic':          'mosaic',
  'chart':           'mosaic',
  'text':            'text',
  'prose':           'text',
};

/** Resolve a directive's primary render target to the v2 three-way vocabulary. */
export function resolveRenderTarget(directive: SceneDirective | null | undefined): RenderTargetPrimary {
  if (!directive) return 'text';
  const target = (directive as { render_target?: { primary?: string } }).render_target;
  const primary = target?.primary;
  if (!primary) return 'text';
  return LEGACY_MAP[primary] ?? 'text';
}

/** Produce a normalized directive whose render_target.primary matches the
 *  v2 vocabulary. Any legacy value is rewritten in place. All other fields
 *  are passed through unchanged. */
export function normalizeDirective(raw: SceneDirective): SceneDirective {
  const primary = resolveRenderTarget(raw);
  const existing = (raw as { render_target?: unknown }).render_target;
  const base = typeof existing === 'object' && existing !== null ? existing : {};
  return {
    ...raw,
    render_target: { ...(base as Record<string, unknown>), primary },
  } as unknown as SceneDirective;
}

'use client';

/**
 * LensPane: hosts one lens applied to one object inside a SplitPaneContainer
 * pane (FR-002). Resolves the lens definition + renderer, draws a compact lens
 * header, and dispatches to the renderer. Any (object type, lens) pair with no
 * specific renderer — or a lens whose predicate rejects the object — falls back
 * to a quiet generic view instead of crashing (FR-005).
 */

import { Suspense } from 'react';
import { getLens } from '@/lib/commonplace-lenses';
import type { LensContext } from '@/lib/commonplace-lenses';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { LENS_RENDERERS } from './lens-renderers';
import type { LensViewProps } from './lens-types';
import type { RenderableObject } from '../objects/ObjectRenderer';

function objectFromContext(ctx: LensContext): RenderableObject {
  return {
    id: ctx.objectRef,
    slug: ctx.objectSlug,
    title: ctx.objectTitle,
    display_title: ctx.objectTitle,
    object_type_slug: ctx.objectType,
  };
}

function FallbackLensView({ object, lensLabel }: { object: RenderableObject; lensLabel: string }) {
  return (
    <div style={{ padding: '24px 20px', fontFamily: 'var(--cp-font-body)' }}>
      <div style={{ fontSize: 14, color: 'var(--cp-text)', marginBottom: 6 }}>
        {object.display_title ?? object.title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--cp-text-muted)', fontStyle: 'italic' }}>
        The {lensLabel} lens has nothing for this type yet.
      </div>
    </div>
  );
}

function LensHeader({ color, label, object }: { color: string; label: string; object: RenderableObject }) {
  const identity = getObjectTypeIdentity(object.object_type_slug);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--cp-border-faint)',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--cp-text-muted)',
        }}
      >
        {label}
      </span>
      <span style={{ color: 'var(--cp-border)', fontSize: 11 }}>·</span>
      <span
        style={{
          fontFamily: 'var(--cp-font-body)',
          fontSize: 12,
          color: 'var(--cp-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={object.display_title ?? object.title}
      >
        {object.display_title ?? object.title}
      </span>
      <span
        style={{
          marginLeft: 'auto',
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: identity.color,
          flexShrink: 0,
        }}
      >
        {identity.label}
      </span>
    </div>
  );
}

export default function LensPane(ctx: Partial<LensContext>) {
  const lens = ctx.lensId ? getLens(ctx.lensId) : undefined;

  // Malformed context (no lens / no object): graceful, never a crash.
  if (!lens || !ctx.objectRef || !ctx.objectSlug) {
    return (
      <div style={{ padding: '24px 20px', fontFamily: 'var(--cp-font-body)', color: 'var(--cp-text-muted)', fontSize: 12 }}>
        No lens to show.
      </div>
    );
  }

  const fullCtx = ctx as LensContext;
  const object = objectFromContext(fullCtx);
  const Renderer = LENS_RENDERERS[lens.id];
  const renders = !!Renderer && lens.applies(object);

  const viewProps: LensViewProps = { lens, ctx: fullCtx, object };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }} className="commonplace-theme">
      <LensHeader color={lens.color} label={lens.label} object={object} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="cp-scrollbar">
        {renders ? (
          <Suspense fallback={<div style={{ padding: 20, color: 'var(--cp-text-muted)', fontSize: 12 }}>Loading {lens.label}…</div>}>
            <Renderer {...viewProps} />
          </Suspense>
        ) : (
          <FallbackLensView object={object} lensLabel={lens.label} />
        )}
      </div>
    </div>
  );
}

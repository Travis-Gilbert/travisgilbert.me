'use client';

import { lazy, Suspense, type ComponentType } from 'react';
import type { ApiComponent } from '@/lib/commonplace';

export interface InlineComponentProps {
  component: ApiComponent;
  objectId: number;
  objectSlug: string;
  onRemove?: (componentId: number) => void;
}

const MiniTerminal = lazy(() => import('./MiniTerminal'));
const MiniCluster = lazy(() => import('./MiniCluster'));
const MiniPhotos = lazy(() => import('./MiniPhotos'));

const RENDERERS: Record<string, ComponentType<InlineComponentProps>> = {
  terminal: MiniTerminal,
  cluster: MiniCluster,
  file: MiniPhotos,
};

export default function ComponentRenderer(props: InlineComponentProps) {
  const Renderer = RENDERERS[props.component.component_type_name];
  if (!Renderer) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 999,
        border: '1px solid var(--cp-border-faint)',
        fontFamily: 'var(--cp-font-mono)',
        fontSize: 9,
        color: 'var(--cp-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {props.component.component_type_name}
      </div>
    );
  }
  return (
    <Suspense fallback={<div style={{ height: 40, background: 'var(--cp-border-faint)', borderRadius: 4, opacity: 0.3 }} />}>
      <Renderer {...props} />
    </Suspense>
  );
}

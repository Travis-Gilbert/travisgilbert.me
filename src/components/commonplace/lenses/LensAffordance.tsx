'use client';

/**
 * Per-object apply-a-lens affordance — the accessible click path that mirrors
 * the toolbox drag (FR-003), present on every object regardless of type
 * (SC-002). Opens a menu of the lenses that apply to this object; choosing one
 * opens it in a pane.
 */

import { useState } from 'react';
import { lensesForObject } from '@/lib/commonplace-lenses';
import { useApplyLens } from './use-apply-lens';
import type { RenderableObject } from '../objects/ObjectRenderer';

export default function LensAffordance({ object }: { object: RenderableObject }) {
  const [open, setOpen] = useState(false);
  const applyLens = useApplyLens();
  const lenses = lensesForObject(object);
  if (lenses.length === 0) return null;

  const target = {
    objectRef: object.id,
    objectSlug: object.slug,
    objectType: object.object_type_slug,
    objectTitle: object.display_title ?? object.title,
  };

  const engine = lenses.filter((l) => l.kind === 'engine');
  const attach = lenses.filter((l) => l.kind === 'attachment');

  return (
    <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 3 }} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Apply a lens"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Apply a lens"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        style={{
          width: 18, height: 18, display: 'grid', placeItems: 'center', borderRadius: 4,
          border: '1px solid var(--cp-border-faint)', background: 'var(--cp-surface, rgba(255,255,255,0.8))',
          color: 'var(--cp-text-muted)', cursor: 'pointer', fontSize: 11, lineHeight: 1.2, opacity: 0.7,
        }}
      >
        ⊹
      </button>
      {open && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
          <div
            role="menu"
            style={{
              position: 'absolute', top: 22, right: 0, zIndex: 2, minWidth: 150,
              background: 'var(--cp-surface, #fff)', border: '1px solid var(--cp-border)', borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: 4, fontFamily: 'var(--cp-font-body)',
            }}
          >
            <MenuGroup label="See">
              {engine.map((l) => <MenuItem key={l.id} color={l.color} label={l.label} onClick={() => { setOpen(false); applyLens(l.id, target); }} />)}
            </MenuGroup>
            <MenuGroup label="Add">
              {attach.map((l) => <MenuItem key={l.id} color={l.color} label={l.label} onClick={() => { setOpen(false); applyLens(l.id, target); }} />)}
            </MenuGroup>
          </div>
        </>
      )}
    </div>
  );
}

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '2px 0' }}>
      <div style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cp-text-muted)', padding: '2px 8px' }}>{label}</div>
      {children}
    </div>
  );
}

function MenuItem({ color, label, onClick }: { color: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--cp-text)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cp-border-faint)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </button>
  );
}

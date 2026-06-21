'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { LENS_REGISTRY } from '@/lib/commonplace-lenses';
import type { LensDef } from '@/lib/commonplace-lenses';
import { useApplyLens, type LensTarget } from '../lenses/use-apply-lens';
import { useWorkspace } from '@/lib/providers/workspace-provider';
import styles from './ComponentToolbox.module.css';

const OBJECT_MIME = 'application/commonplace-object';

/** Build a lens target from the object card under a point / drop. */
function targetFromElement(el: Element | null): LensTarget | null {
  const card = el?.closest('[data-object-id]');
  if (!card) return null;
  const objectRef = Number(card.getAttribute('data-object-id'));
  if (Number.isNaN(objectRef)) return null;
  return {
    objectRef,
    objectSlug: card.getAttribute('data-object-slug') || String(objectRef),
    objectType: card.getAttribute('data-object-type') || '',
    objectTitle: card.getAttribute('data-object-title') || 'Object',
  };
}

export default function ComponentToolbox() {
  const applyLens = useApplyLens();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('cp-toolbox-open');
    if (saved !== null) setOpen(saved === 'true');
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem('cp-toolbox-open', String(next));
      return next;
    });
  }, []);

  const engine = LENS_REGISTRY.filter((l) => l.kind === 'engine');
  const attach = LENS_REGISTRY.filter((l) => l.kind === 'attachment');

  const renderGroup = (label: string, lenses: LensDef[]) => (
    <div>
      <div style={groupLabelStyle}>{label}</div>
      <div className={styles.toolboxGrid}>
        {lenses.map((lens) => (
          <ToolboxTile
            key={lens.id}
            lens={lens}
            onApply={(target) => applyLens(lens.id, target)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', zIndex: 2 }}>
      <button type="button" className={styles.toolboxToggle} onClick={toggleOpen}>
        <ChevronIcon open={open} />
        TOOLBOX
        <span className={styles.toolboxCount}>{LENS_REGISTRY.length}</span>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {renderGroup('See', engine)}
          {renderGroup('Add', attach)}
        </div>
      )}
    </div>
  );
}

const groupLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--cp-text-muted)',
  padding: '2px 2px 4px',
};

/** Floating ghost that follows the cursor via portal, escaping sidebar overflow. */
function DragOverlay({ lens }: { lens: LensDef }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return createPortal(
    <div
      className={`commonplace-theme ${styles.toolboxDragGhost}`}
      style={{ left: pos.x + 12, top: pos.y - 14, '--comp-color': lens.color } as React.CSSProperties}
    >
      <div className={styles.toolboxTile}>
        <span className="cp-capture-type-dot" style={{ background: lens.color }} />
        <span className={styles.toolboxTileLabel}>{lens.label}</span>
      </div>
    </div>,
    document.body,
  );
}

function ToolboxTile({ lens, onApply }: { lens: LensDef; onApply: (target: LensTarget) => void }) {
  const { setDraggedComponent } = useWorkspace();
  const [dragging, setDragging] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const pointerRef = useRef({ x: 0, y: 0 });

  const initial = lens.label.charAt(0);

  return (
    <>
      <motion.div
        className={`${styles.toolboxTile} ${styles.toolboxTileSource}`}
        style={{ '--comp-color': lens.color, pointerEvents: dragging ? 'none' : undefined, outline: dropHover ? `2px solid ${lens.color}` : undefined } as React.CSSProperties}
        title={lens.description}
        drag
        dragSnapToOrigin
        dragElastic={0.15}
        dragMomentum={false}
        whileDrag={{ scale: 0.9, opacity: 0.4 }}
        onDragStart={() => { setDragging(true); setDraggedComponent(lens.id); }}
        onDrag={(_e, info) => { pointerRef.current = { x: info.point.x, y: info.point.y }; }}
        onDragEnd={() => {
          setDragging(false);
          setDraggedComponent(null);
          const { x, y } = pointerRef.current;
          const target = targetFromElement(document.elementFromPoint(x, y));
          if (target) onApply(target);
        }}
        // Reverse direction: an object dragged onto this lens tile (FR-003).
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(OBJECT_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'link';
          setDropHover(true);
        }}
        onDragLeave={() => setDropHover(false)}
        onDrop={(e) => {
          setDropHover(false);
          const raw = e.dataTransfer.getData(OBJECT_MIME);
          if (!raw) return;
          e.preventDefault();
          try {
            const data = JSON.parse(raw) as { id: number; slug: string; title: string; object_type: string };
            onApply({ objectRef: data.id, objectSlug: data.slug, objectType: data.object_type, objectTitle: data.title });
          } catch { /* malformed payload */ }
        }}
      >
        <div className={styles.toolboxGlowIcon}>{initial}</div>
        <span className={styles.toolboxTileLabel}>{lens.label}</span>
      </motion.div>
      {dragging && <DragOverlay lens={lens} />}
    </>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, transition: 'transform 200ms', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
      <path d="M4 2l4 4-4 4" />
    </svg>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { COMPONENT_TOOLBOX } from '@/lib/commonplace-components';
import type { ComponentToolboxItem } from '@/lib/commonplace-components';
import { useWorkspace } from '@/lib/providers/workspace-provider';
import { createObjectComponent } from '@/lib/commonplace-api';
import { toast } from 'sonner';
import styles from './ComponentToolbox.module.css';

export default function ComponentToolbox() {
  const { setDraggedComponent } = useWorkspace();
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

  const handleComponentDrop = useCallback(
    async (objectId: number, componentTypeId: string) => {
      const comp = COMPONENT_TOOLBOX.find((c) => c.id === componentTypeId);
      if (!comp) return;
      try {
        await createObjectComponent(objectId, {
          component_type_slug: comp.apiTypeName,
          key: comp.id,
          value: '',
        });
        const cardEl = document.querySelector(`[data-object-id="${objectId}"]`);
        if (cardEl) {
          cardEl.dispatchEvent(
            new CustomEvent('cp-component-attached', {
              detail: { color: comp.color },
              bubbles: false,
            }),
          );
        }
        toast.success(`Attached ${comp.label}`);
      } catch {
        toast.error(`Could not attach ${comp.label}`);
      }
    },
    [],
  );

  return (
    <div style={{ position: 'relative', zIndex: 2 }}>
      <button
        type="button"
        className={styles.toolboxToggle}
        onClick={toggleOpen}
      >
        <ChevronIcon open={open} />
        TOOLBOX
        <span className={styles.toolboxCount}>{COMPONENT_TOOLBOX.length}</span>
      </button>

      {open && (
        <div className={styles.toolboxGrid}>
          {COMPONENT_TOOLBOX.map((comp) => (
            <ToolboxTile
              key={comp.id}
              comp={comp}
              onDragStart={() => setDraggedComponent(comp.id)}
              onDrop={(objectId) => {
                setDraggedComponent(null);
                handleComponentDrop(objectId, comp.id);
              }}
              onDragCancel={() => setDraggedComponent(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Floating ghost that follows the cursor via portal, escaping sidebar overflow. */
function DragOverlay({ comp }: { comp: ComponentToolboxItem }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return createPortal(
    <div
      className={`commonplace-theme ${styles.toolboxDragGhost}`}
      style={{
        left: pos.x + 12,
        top: pos.y - 14,
        '--comp-color': comp.color,
      } as React.CSSProperties}
    >
      <div className={styles.toolboxTile}>
        <span
          className="cp-capture-type-dot"
          style={{ background: comp.color }}
        />
        <span className={styles.toolboxTileLabel}>
          {comp.label}
        </span>
      </div>
    </div>,
    document.body,
  );
}

function ToolboxTile({
  comp,
  onDragStart,
  onDrop,
  onDragCancel,
}: {
  comp: ComponentToolboxItem;
  onDragStart: () => void;
  onDrop: (objectId: number) => void;
  onDragCancel: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const pointerRef = useRef({ x: 0, y: 0 });

  const initial = comp.label.charAt(0);

  return (
    <>
      <motion.div
        className={`${styles.toolboxTile} ${styles.toolboxTileSource}`}
        style={{ '--comp-color': comp.color } as React.CSSProperties}
        drag
        dragSnapToOrigin
        dragElastic={0.15}
        dragMomentum={false}
        whileDrag={{ scale: 0.9, opacity: 0.4 }}
        onDragStart={() => {
          setDragging(true);
          onDragStart();
        }}
        onDrag={(_e, info) => {
          pointerRef.current = { x: info.point.x, y: info.point.y };
        }}
        onDragEnd={() => {
          setDragging(false);
          const { x, y } = pointerRef.current;
          const el = document.elementFromPoint(x, y);
          if (!el) {
            onDragCancel();
            return;
          }
          const target = el.closest('[data-object-id]');
          if (target) {
            const objectId = Number(target.getAttribute('data-object-id'));
            if (!Number.isNaN(objectId)) {
              onDrop(objectId);
              return;
            }
          }
          onDragCancel();
        }}
      >
        <div
          className={styles.toolboxGlowIcon}
          style={{
            background: `radial-gradient(circle, ${comp.color}50, ${comp.color}15)`,
            color: comp.color,
            boxShadow: `0 0 8px ${comp.color}30`,
          }}
        >
          {initial}
        </div>
        <span className={styles.toolboxTileLabel} style={{ opacity: 0.85 }}>
          {comp.label}
        </span>
      </motion.div>
      {dragging && <DragOverlay comp={comp} />}
    </>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        opacity: 0.5,
        transition: 'transform 200ms',
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
      }}
    >
      <path d="M4 2l4 4-4 4" />
    </svg>
  );
}

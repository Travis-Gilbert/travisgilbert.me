'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { COMPONENT_TOOLBOX } from '@/lib/commonplace-components';
import type { ComponentToolboxItem } from '@/lib/commonplace-components';
import { useCommonPlace } from '@/lib/commonplace-context';
import { createObjectComponent } from '@/lib/commonplace-api';
import { toast } from 'sonner';

export default function ComponentToolbox() {
  const { setDraggedComponent } = useCommonPlace();
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
        // Trigger absorption glow on the target card
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
        className="cp-toolbox-toggle"
        onClick={toggleOpen}
      >
        <ChevronIcon open={open} />
        TOOLBOX
        <span className="cp-toolbox-count">{COMPONENT_TOOLBOX.length}</span>
      </button>

      {open && (
        <div className="cp-toolbox-grid">
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
  return (
    <motion.div
      className="cp-toolbox-tile"
      drag
      dragSnapToOrigin
      dragElastic={0.15}
      dragMomentum={false}
      whileDrag={{
        scale: 0.9,
        boxShadow: `0 4px 16px ${comp.color}44`,
        zIndex: 9999,
      }}
      onDragStart={onDragStart}
      onDragEnd={(_event, info) => {
        const el = document.elementFromPoint(info.point.x, info.point.y);
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
      style={{ position: 'relative', zIndex: 1 }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: comp.color,
          flexShrink: 0,
        }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {comp.label}
      </span>
    </motion.div>
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

'use client';

import { useEffect, useRef } from 'react';
import { OBJECT_TYPES } from '@/lib/commonplace';
import type { CapturedObject } from '@/lib/commonplace';
import { createCapturedObject } from '@/lib/commonplace-capture';

/**
 * ObjectPalette: 2-column type grid overlay.
 *
 * Triggered by the "+ Object" sidebar button. Floats above
 * sidebar content with a warm dark background. Each cell shows
 * a color dot + label. Click creates an object of that type
 * with an empty body (ready for the user to fill in).
 * Dismiss on outside click or Esc.
 */

interface ObjectPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (object: CapturedObject) => void;
}

export default function ObjectPalette({
  isOpen,
  onClose,
  onCapture,
}: ObjectPaletteProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* Close on outside click */
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    /* Use setTimeout to avoid catching the opening click */
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, onClose]);

  /* Close on Esc */
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleCreate(slug: string) {
    const typeInfo = OBJECT_TYPES.find((t) => t.slug === slug);
    const object = createCapturedObject({
      text: '',
      objectType: slug,
      captureMethod: 'quick-create',
    });
    /* Override title with a meaningful default */
    object.title = `New ${typeInfo?.label ?? slug}`;
    onCapture(object);
    onClose();
  }

  return (
    <div
      ref={panelRef}
      className="cp-object-palette"
      style={{
        position: 'absolute',
        left: 8,
        right: 8,
        zIndex: 20,
        background: 'var(--cp-sidebar-surface)',
        border: '1px solid var(--cp-sidebar-border-strong)',
        borderRadius: 8,
        padding: '8px 6px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
        animation: 'cp-spring-open 250ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--cp-sidebar-text-faint)',
          padding: '2px 8px 6px',
        }}
      >
        CREATE OBJECT
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 2,
        }}
      >
        {OBJECT_TYPES.map((objType) => (
          <button
            key={objType.slug}
            type="button"
            onClick={() => handleCreate(objType.slug)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 5,
              border: 'none',
              background: 'transparent',
              color: 'var(--cp-sidebar-text-muted)',
              fontFamily: 'var(--cp-font-body)',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'background-color 150ms, color 150ms',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                'var(--cp-sidebar-surface-hover)';
              e.currentTarget.style.color = 'var(--cp-sidebar-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--cp-sidebar-text-muted)';
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: objType.color,
                flexShrink: 0,
                boxShadow: `0 0 4px ${objType.color}40`,
              }}
            />
            <span>{objType.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

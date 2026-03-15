'use client';

import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

/**
 * ModuleBrick: generic composable panel for the Model View workspace.
 *
 * Every module (Tensions, Methods, Compare, etc.) wraps its content
 * in a ModuleBrick. The brick provides:
 *   1. Header bar with drag handle (::), title in mono, close button
 *   2. Content area with padding
 *   3. Consistent border, radius, and white background
 *
 * Drag-and-drop reordering uses @hello-pangea/dnd. The brick itself
 * is the draggable; the workspace is the droppable context. When
 * dragHandleProps are passed from a Draggable wrapper, the grip icon
 * becomes the drag handle.
 */

interface ModuleBrickProps {
  title: string;
  accentColor: string;
  count?: number;
  onClose?: () => void;
  /** @hello-pangea/dnd drag handle props, passed from Draggable render */
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  children: ReactNode;
  className?: string;
}

export default function ModuleBrick({
  title,
  accentColor,
  count,
  onClose,
  dragHandleProps,
  children,
  className,
}: ModuleBrickProps) {
  const brickRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={brickRef}
      className={className}
      style={{
        background: '#FFFFFF',
        border: '1px solid var(--cp-border-faint, #ECEAE6)',
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderBottom: `1px solid var(--cp-border-faint, #ECEAE6)`,
          background: 'var(--cp-surface, #F8F7F4)',
          minHeight: 32,
          userSelect: 'none',
        }}
      >
        {/* Drag handle grip */}
        <span
          {...(dragHandleProps || {})}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            cursor: dragHandleProps ? 'grab' : 'default',
            color: 'var(--cp-text-faint, #68666E)',
            fontSize: 12,
            lineHeight: 1,
            letterSpacing: '2px',
          }}
          aria-label="Drag to reorder"
        >
          {'::'}
        </span>

        {/* Accent pip */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: accentColor,
            flexShrink: 0,
          }}
        />

        {/* Title */}
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--cp-text-muted, #48464E)',
            flex: 1,
          }}
        >
          {title}
          {count !== undefined && (
            <span
              style={{
                marginLeft: 6,
                color: 'var(--cp-text-faint, #68666E)',
                fontWeight: 400,
              }}
            >
              {count}
            </span>
          )}
        </span>

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label={`Close ${title} module`}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              color: 'var(--cp-text-faint, #68666E)',
              fontSize: 14,
              lineHeight: 1,
              borderRadius: 2,
            }}
          >
            &times;
          </button>
        )}
      </div>

      {/* Content area */}
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  );
}

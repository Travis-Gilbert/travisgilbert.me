'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { VirtualElement } from '@floating-ui/react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';

interface GroupAction {
  id: string;
  label: string;
  shortcut?: string;
  separator?: boolean;
}

const GROUP_ACTIONS: GroupAction[] = [
  { id: 'move-front', label: 'Move to front' },
  { id: 'move-back', label: 'Move to back', separator: true },
  { id: 'connect-chain', label: 'Connect all (chain)' },
  { id: 'connect-hub', label: 'Connect all (hub)', separator: true },
  { id: 'explode', label: 'Explode all components', separator: true },
  { id: 'remove-all', label: 'Remove all from board', shortcut: 'Del' },
];

interface GroupContextMenuProps {
  position: { x: number; y: number } | null;
  count: number;
  onAction: (actionId: string) => void;
  onClose: () => void;
}

export default function GroupContextMenu({
  position,
  count,
  onAction,
  onClose,
}: GroupContextMenuProps) {
  const isOpen = position !== null;

  const virtualElRef = useRef<VirtualElement>({
    getBoundingClientRect: () =>
      DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 }),
  });

  useEffect(() => {
    if (position) {
      virtualElRef.current.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: position.x, y: position.y, width: 0, height: 0 });
    }
  }, [position]);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
    placement: 'right-start',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setPositionReference(virtualElRef.current);
  }, [refs, position]);

  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true });
  const { getFloatingProps } = useInteractions([dismiss]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        onAction('remove-all');
      }
    },
    [isOpen, onAction],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <FloatingPortal>
      <div className="commonplace-theme">
        <div
          ref={refs.setFloating}
          style={{
            ...floatingStyles,
            backgroundColor: 'var(--cp-chrome-mid)',
            border: '1px solid var(--cp-chrome-line)',
            borderRadius: 6,
            padding: '4px 0',
            minWidth: 220,
            zIndex: 200,
            fontFamily: 'var(--font-metadata)',
            fontSize: 12,
            color: 'var(--cp-chrome-text)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}
          {...getFloatingProps()}
        >
          <div
            style={{
              padding: '4px 12px 6px',
              fontSize: 10,
              color: 'var(--cp-chrome-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {count} items selected
          </div>
          {GROUP_ACTIONS.map((action) => (
            <div key={action.id}>
              <div
                role="menuitem"
                tabIndex={0}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    'var(--cp-chrome-raise)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    'transparent';
                }}
                onClick={() => onAction(action.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onAction(action.id);
                }}
              >
                <span>{action.label}</span>
                {action.shortcut && (
                  <span style={{ color: 'var(--cp-chrome-dim)', fontSize: 10 }}>
                    {action.shortcut}
                  </span>
                )}
              </div>
              {action.separator && (
                <div
                  style={{
                    height: 1,
                    backgroundColor: 'var(--cp-chrome-line)',
                    margin: '4px 0',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </FloatingPortal>
  );
}

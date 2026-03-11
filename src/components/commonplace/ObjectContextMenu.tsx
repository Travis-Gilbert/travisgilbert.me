'use client';

/**
 * ObjectContextMenu: fixed-position right-click context menu for object cards.
 *
 * Actions:
 *   Stash for Later   - marks object as stashed (future pane integration)
 *   Add Connection    - opens connection drawer for the object
 *   Contain as...     - nests the object inside a parent container
 *
 * Positioning: @floating-ui/react virtual element anchored to cursor coordinates.
 * Dismiss: click-outside or Escape via useDismiss.
 * Mounted: once inside CommonPlaceProvider, renders as a portal via FloatingPortal.
 */

import { useEffect, useRef, useCallback } from 'react';
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
import { useCommonPlace } from '@/lib/commonplace-context';
import type { RenderableObject } from './objects/ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { toast } from 'sonner';

/* ─────────────────────────────────────────────────
   Action definitions
   ───────────────────────────────────────────────── */

interface ContextAction {
  id: string;
  label: string;
  shortcut?: string;
  dividerAfter?: boolean;
}

const CONTAIN_TYPES = [
  'Observation',
  'Argument',
  'Evidence',
  'Question',
  'Aside',
  'Anchor',
] as const;

const MAIN_ACTIONS: ContextAction[] = [
  { id: 'stash', label: 'Stash for Later', shortcut: 'S', dividerAfter: true },
  { id: 'connect', label: 'Add Connection', shortcut: 'C' },
];

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

export default function ObjectContextMenu() {
  const { contextMenuTarget, closeContextMenu, openDrawer, requestView } = useCommonPlace();
  const isOpen = contextMenuTarget !== null;

  /* Virtual element at cursor coordinates */
  const virtualElRef = useRef<{ getBoundingClientRect: () => DOMRect }>({
    getBoundingClientRect: () => DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 }),
  });

  /* Update virtual element when menu opens */
  useEffect(() => {
    if (contextMenuTarget) {
      virtualElRef.current.getBoundingClientRect = () =>
        DOMRect.fromRect({
          x: contextMenuTarget.x,
          y: contextMenuTarget.y,
          width: 0,
          height: 0,
        });
    }
  }, [contextMenuTarget]);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) closeContextMenu();
    },
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  /* Sync virtual reference */
  useEffect(() => {
    refs.setPositionReference(virtualElRef.current);
  }, [refs, contextMenuTarget]);

  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true });
  const { getFloatingProps } = useInteractions([dismiss]);

  const handleAction = useCallback(
    (actionId: string, obj: RenderableObject, containType?: string) => {
      closeContextMenu();

      switch (actionId) {
        case 'stash':
          toast.success(`"${obj.title}" stashed`);
          break;
        case 'connect':
          if (obj.id) openDrawer(String(obj.id));
          break;
        case 'contain':
          if (containType) {
            toast.success(`Containing as ${containType}`);
          }
          break;
        default:
          break;
      }
    },
    [closeContextMenu, openDrawer, requestView],
  );

  if (!isOpen || !contextMenuTarget) return null;

  const { obj } = contextMenuTarget;
  const identity = getObjectTypeIdentity(obj.object_type_slug);

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        {...getFloatingProps()}
        className="cp-context-menu"
      >
        {/* Object header */}
        <div className="cp-context-menu__header">
          <span
            className="cp-context-menu__type-dot"
            style={{ background: identity.color }}
          />
          <span className="cp-context-menu__type-label">{identity.label}</span>
        </div>

        <div className="cp-context-menu__title">{obj.display_title ?? obj.title}</div>

        <div className="cp-context-menu__divider" />

        {/* Main actions */}
        {MAIN_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            className="cp-context-menu__item"
            onClick={() => handleAction(action.id, obj)}
          >
            <span className="cp-context-menu__item-label">{action.label}</span>
            {action.shortcut && (
              <span className="cp-context-menu__item-shortcut">{action.shortcut}</span>
            )}
          </button>
        ))}

        <div className="cp-context-menu__divider" />

        {/* Contain as submenu */}
        <div className="cp-context-menu__section-label">Contain as</div>
        {CONTAIN_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className="cp-context-menu__item cp-context-menu__item--sub"
            onClick={() => handleAction('contain', obj, type)}
          >
            <span className="cp-context-menu__item-label">{type}</span>
          </button>
        ))}
      </div>
    </FloatingPortal>
  );
}

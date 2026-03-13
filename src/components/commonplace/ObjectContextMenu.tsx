'use client';

/**
 * ObjectContextMenu: fixed-position right-click context menu for object cards.
 *
 * Actions:
 *   Open Object      - opens the detail drawer
 *   Stash for Later   - marks object as stashed (future pane integration)
 *   Add Connection    - opens connection drawer for the object
 *   Contain In...     - nests the object inside a parent (edge_type='contains')
 *
 * Keyboard: single-key shortcuts (O, S, C, N) fire while menu is open.
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
}

const PRIMARY_ACTIONS: ContextAction[] = [
  { id: 'open', label: 'Open Object', shortcut: 'O' },
];

const GRAPH_ACTIONS: ContextAction[] = [
  { id: 'stash', label: 'Stash for Later', shortcut: 'S' },
  { id: 'connect', label: 'Add Connection', shortcut: 'C' },
  { id: 'contain', label: 'Contain In...', shortcut: 'N' },
];

/** All actions for shortcut lookup */
const ALL_ACTIONS = [...PRIMARY_ACTIONS, ...GRAPH_ACTIONS];

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

export default function ObjectContextMenu() {
  const {
    beginConnection,
    closeContextMenu,
    contextMenuTarget,
    openDrawer,
    stashObject,
  } = useCommonPlace();
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
    (actionId: string, obj: RenderableObject) => {
      closeContextMenu();

      switch (actionId) {
        case 'open':
          openDrawer(obj.slug || String(obj.id));
          break;
        case 'stash':
          stashObject(obj);
          toast.success(`"${obj.title}" stashed`);
          break;
        case 'connect':
          beginConnection(obj);
          toast.message(`Select another object to connect to "${obj.title}"`);
          break;
        case 'contain':
          beginConnection(obj);
          toast.message(`Select a parent object to contain "${obj.title}"`);
          break;
        default:
          break;
      }
    },
    [beginConnection, closeContextMenu, openDrawer, stashObject],
  );

  /* Keyboard shortcuts while menu is open */
  useEffect(() => {
    if (!isOpen || !contextMenuTarget) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toUpperCase();
      const matched = ALL_ACTIONS.find((a) => a.shortcut === key);
      if (matched && contextMenuTarget) {
        e.preventDefault();
        handleAction(matched.id, contextMenuTarget.obj);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, contextMenuTarget, handleAction]);

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

        {/* Primary action: Open */}
        {PRIMARY_ACTIONS.map((action) => (
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

        {/* Divider between primary and graph actions */}
        <div className="cp-context-menu__divider" />

        {/* Graph actions: Stash, Connect, Contain */}
        {GRAPH_ACTIONS.map((action) => (
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
      </div>
    </FloatingPortal>
  );
}

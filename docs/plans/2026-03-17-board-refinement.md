# Board Refinement Implementation Plan

> **For Claude:** REQUIRED: Use /execute-plan to implement this plan task-by-task.

**Goal:** Implement 6 independent refinement areas from the Board v2 addendum spec: multi-select, compose+catalog split, accessibility, loading/error states, visual hierarchy signals, and drag state treatment.

**Architecture:** Each section extends the existing CommonPlace infrastructure. Multi-select and drag state are client-only ephemeral state in `commonplace-context.tsx`. The compose+catalog split extends ComposeView. Visual hierarchy signals are CSS + computed props on object cards. Accessibility and loading states are applied across existing components. No backend changes required.

**Tech Stack:** React 19, Next.js 16 (App Router), Tailwind CSS v4, `@floating-ui/react`, `iconoir-react`, CSS custom properties (`--cp-*` tokens)

**Existing patterns to follow:**
- Context state lives in `src/lib/commonplace-context.tsx`
- Components live in `src/components/commonplace/`
- CSS tokens in `src/styles/commonplace.css`
- Context menu uses `@floating-ui/react` virtual element positioning
- Portals wrap in `<div className="commonplace-theme">` for token resolution
- Canvas components guard dimensions (min 1px, max 8192px)
- All animations must respect `prefers-reduced-motion: reduce`

---

## Section 1: Multi-Select Interaction

### Task 1.1: Add selection state to CommonPlaceContext

**Files:**
- Modify: `src/lib/commonplace-context.tsx`

**Step 1: Add types and state to the context interface**

Add these fields to `CommonPlaceContextValue` (after `connectionDraft`):

```typescript
/** Set of selected PlacedItem/object IDs for multi-select */
selectedItems: Set<string>;
/** Add an item to the selection */
selectItem: (id: string) => void;
/** Toggle an item in/out of the selection */
toggleSelectItem: (id: string) => void;
/** Select all items (pass array of all IDs on the board) */
selectAll: (ids: string[]) => void;
/** Clear all selection */
clearSelection: () => void;
/** Replace selection with a single item */
selectSingle: (id: string) => void;
/** Replace selection with a set from rubber-band */
selectRect: (ids: string[]) => void;
```

**Step 2: Add state and callbacks in the provider**

Inside `CommonPlaceProvider`, add:

```typescript
const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

const selectItem = useCallback((id: string) => {
  setSelectedItems((prev) => new Set(prev).add(id));
}, []);

const toggleSelectItem = useCallback((id: string) => {
  setSelectedItems((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}, []);

const selectAll = useCallback((ids: string[]) => {
  setSelectedItems(new Set(ids));
}, []);

const clearSelection = useCallback(() => {
  setSelectedItems(new Set());
}, []);

const selectSingle = useCallback((id: string) => {
  setSelectedItems(new Set([id]));
}, []);

const selectRect = useCallback((ids: string[]) => {
  setSelectedItems(new Set(ids));
}, []);
```

Add to the context defaults (the `NOOP` block):
```typescript
selectedItems: new Set<string>(),
selectItem: NOOP,
toggleSelectItem: NOOP,
selectAll: NOOP,
clearSelection: NOOP,
selectSingle: NOOP,
selectRect: NOOP,
```

Wire them into the `useMemo` value object.

**Step 3: Commit**

```bash
git add src/lib/commonplace-context.tsx
git commit -m "feat(commonplace): add multi-select state to context"
```

---

### Task 1.2: Create RubberBandSelection component

**Files:**
- Create: `src/components/commonplace/RubberBandSelection.tsx`

**Step 1: Build the rubber-band overlay**

This component renders on a canvas/board area. It listens for mousedown on empty space, draws a selection rectangle, and calls `selectRect` with intersecting item IDs on mouseup.

```tsx
'use client';

import { useState, useCallback, useRef } from 'react';
import type { RefObject, ReactNode } from 'react';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RubberBandSelectionProps {
  /** Ref to the scrollable/pannable container */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Current items with bounding boxes, for intersection testing */
  items: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  /** Called with IDs of items whose bounding boxes intersect the selection rect */
  onSelect: (ids: string[]) => void;
  children: ReactNode;
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export default function RubberBandSelection({
  containerRef,
  items,
  onSelect,
  children,
}: RubberBandSelectionProps) {
  const [dragging, setDragging] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start rubber-band on empty space (not on cards)
      if ((e.target as HTMLElement).closest('[data-board-item]')) return;
      if (e.button !== 0) return;

      const container = containerRef.current;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      const x = e.clientX - bounds.left + container.scrollLeft;
      const y = e.clientY - bounds.top + container.scrollTop;

      startRef.current = { x, y };
      setRect({ x, y, width: 0, height: 0 });
      setDragging(true);
      e.preventDefault();
    },
    [containerRef],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !startRef.current) return;
      const container = containerRef.current;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      const cx = e.clientX - bounds.left + container.scrollLeft;
      const cy = e.clientY - bounds.top + container.scrollTop;

      const x = Math.min(startRef.current.x, cx);
      const y = Math.min(startRef.current.y, cy);
      const width = Math.abs(cx - startRef.current.x);
      const height = Math.abs(cy - startRef.current.y);
      setRect({ x, y, width, height });
    },
    [dragging, containerRef],
  );

  const handleMouseUp = useCallback(() => {
    if (!dragging || !rect) {
      setDragging(false);
      return;
    }

    // Find intersecting items
    const ids = items
      .filter((item) => rectsIntersect(rect, item))
      .map((item) => item.id);

    if (ids.length > 0) onSelect(ids);

    setDragging(false);
    setRect(null);
    startRef.current = null;
  }, [dragging, rect, items, onSelect]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ position: 'relative' }}
    >
      {children}
      {dragging && rect && rect.width > 2 && rect.height > 2 && (
        <div
          style={{
            position: 'absolute',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            border: '1px dashed #B8623D',
            backgroundColor: 'rgba(184, 98, 61, 0.03)',
            pointerEvents: 'none',
            zIndex: 50,
          }}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/commonplace/RubberBandSelection.tsx
git commit -m "feat(commonplace): add rubber-band selection component"
```

---

### Task 1.3: Create GroupContextMenu component

**Files:**
- Create: `src/components/commonplace/GroupContextMenu.tsx`

**Step 1: Build the group context menu**

This extends the existing ObjectContextMenu pattern for multi-selected items. Uses `@floating-ui/react` positioning like ObjectContextMenu.

```tsx
'use client';

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
  /** Screen position to anchor the menu */
  position: { x: number; y: number } | null;
  /** Number of selected items */
  count: number;
  /** Callbacks for each action */
  onAction: (actionId: string) => void;
  /** Close the menu */
  onClose: () => void;
}

export default function GroupContextMenu({
  position,
  count,
  onAction,
  onClose,
}: GroupContextMenuProps) {
  const isOpen = position !== null;

  const virtualElRef = useRef<{ getBoundingClientRect: () => DOMRect }>({
    getBoundingClientRect: () =>
      DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 }),
  });

  if (position) {
    virtualElRef.current.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: position.x, y: position.y, width: 0, height: 0 });
  }

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
    placement: 'right-start',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: virtualElRef.current },
  });

  const dismiss = useDismiss(context);
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

  const menuStyle: React.CSSProperties = {
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
  };

  const itemBase: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    cursor: 'pointer',
    transition: 'background-color 100ms',
  };

  return (
    <FloatingPortal>
      <div className="commonplace-theme">
        <div ref={refs.setFloating} style={menuStyle} {...getFloatingProps()}>
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
                style={itemBase}
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
```

**Step 2: Commit**

```bash
git add src/components/commonplace/GroupContextMenu.tsx
git commit -m "feat(commonplace): add group context menu for multi-select"
```

---

### Task 1.4: Add selection visual treatment CSS

**Files:**
- Modify: `src/styles/commonplace.css`

**Step 1: Add selection styles**

Append to the end of `commonplace.css`:

```css
/* ─────────────────────────────────────────────────
   Multi-select visual treatment
   ───────────────────────────────────────────────── */

[data-board-item][data-selected='true'] {
  outline: 2px solid var(--cp-red);
  outline-offset: 2px;
}

.board-group-bounds {
  border: 1px dashed rgba(var(--cp-red-rgb), 0.15);
  padding: 8px;
  pointer-events: none;
  position: absolute;
  z-index: 10;
}
```

**Step 2: Commit**

```bash
git add src/styles/commonplace.css
git commit -m "feat(commonplace): add multi-select visual treatment CSS"
```

---

## Section 2: Compose + Catalog Split View

### Task 2.1: Create ComposeCatalogSplit component

**Files:**
- Create: `src/components/commonplace/ComposeCatalogSplit.tsx`

**Step 1: Build the split view**

This wraps ComposeView and a compressed catalog with a draggable divider.

```tsx
'use client';

import { useState, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';

interface ComposeCatalogSplitProps {
  /** The compose editor panel */
  composeContent: React.ReactNode;
  /** The compressed catalog panel */
  catalogContent: React.ReactNode;
  /** Discovery dock content (sits below catalog) */
  discoveryContent?: React.ReactNode;
  /** Called when user clicks "Back to full catalog" */
  onExitSplit: () => void;
  /** Called when user clicks "Full compose" (maximize compose) */
  onFullCompose: () => void;
}

const MIN_COMPOSE_HEIGHT = 200;
const MIN_CATALOG_HEIGHT = 120;
const DEFAULT_RATIO = 0.55;

export default function ComposeCatalogSplit({
  composeContent,
  catalogContent,
  discoveryContent,
  onExitSplit,
  onFullCompose,
}: ComposeCatalogSplitProps) {
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const container = containerRef.current;
      if (!container) return;

      const handleMove = (ev: MouseEvent) => {
        if (!isDragging.current || !container) return;
        const bounds = container.getBoundingClientRect();
        const totalHeight = bounds.height;
        const y = ev.clientY - bounds.top;
        let nextRatio = y / totalHeight;

        // Enforce minimums
        const minComposeRatio = MIN_COMPOSE_HEIGHT / totalHeight;
        const maxComposeRatio = 1 - MIN_CATALOG_HEIGHT / totalHeight;
        nextRatio = Math.max(minComposeRatio, Math.min(maxComposeRatio, nextRatio));

        setRatio(nextRatio);
      };

      const handleUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [],
  );

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 10px',
    fontSize: 10,
    fontFamily: 'var(--font-metadata)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--cp-chrome-muted)',
    borderBottom: '1px solid var(--cp-chrome-line)',
  };

  const linkStyle: CSSProperties = {
    cursor: 'pointer',
    color: 'var(--cp-teal)',
    fontSize: 10,
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Compose section */}
      <div style={{ height: `${ratio * 100}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={headerStyle}>
          <span>Field Notes</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={linkStyle} onClick={onExitSplit} role="button" tabIndex={0}>
              Back to full
            </span>
            <span style={linkStyle} onClick={onFullCompose} role="button" tabIndex={0}>
              Expand
            </span>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>{composeContent}</div>
      </div>

      {/* Draggable divider */}
      <div
        onMouseDown={handleDividerMouseDown}
        style={{
          height: 5,
          cursor: 'row-resize',
          backgroundColor: 'var(--cp-chrome-line)',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 24,
            height: 3,
            borderRadius: 2,
            backgroundColor: 'var(--cp-chrome-muted)',
          }}
        />
      </div>

      {/* Catalog section */}
      <div
        style={{
          height: `${(1 - ratio) * 100}%`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={headerStyle}>
          <span>Catalog</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>{catalogContent}</div>
        {discoveryContent && (
          <div style={{ borderTop: '1px solid var(--cp-chrome-line)' }}>
            {discoveryContent}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/commonplace/ComposeCatalogSplit.tsx
git commit -m "feat(commonplace): add compose+catalog split view component"
```

---

## Section 3: Accessibility

### Task 3.1: Add ARIA live region for board announcements

**Files:**
- Create: `src/components/commonplace/BoardAnnouncer.tsx`

**Step 1: Build the announcer component**

```tsx
'use client';

import { useState, useCallback, createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

interface AnnouncerContextValue {
  announce: (message: string) => void;
}

const AnnouncerContext = createContext<AnnouncerContextValue>({
  announce: () => {},
});

export function useAnnouncer() {
  return useContext(AnnouncerContext);
}

export function BoardAnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');

  const announce = useCallback((msg: string) => {
    // Clear then set to ensure screen readers pick up repeated messages
    setMessage('');
    requestAnimationFrame(() => setMessage(msg));
  }, []);

  const value = useMemo(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/commonplace/BoardAnnouncer.tsx
git commit -m "feat(commonplace): add ARIA live region announcer for board"
```

---

### Task 3.2: Add reduced motion and touch target CSS

**Files:**
- Modify: `src/styles/commonplace.css`

**Step 1: Add accessibility styles**

Append to `commonplace.css`:

```css
/* ─────────────────────────────────────────────────
   Reduced motion
   ───────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .board-card-drag {
    transform: none !important;
    transition: none !important;
  }

  .board-alignment-guide {
    animation: none !important;
    opacity: 1 !important;
  }

  .board-card-glow {
    animation: none !important;
    opacity: 0 !important;
  }

  .engine-terminal-expand {
    transition: none !important;
  }

  .rubber-band-rect {
    transition: none !important;
  }

  .board-stacking-pulse {
    animation: none !important;
  }
}

/* ─────────────────────────────────────────────────
   Touch targets: minimum 44px interactive zone
   ───────────────────────────────────────────────── */

.touch-target-44 {
  position: relative;
}

.touch-target-44::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 44px;
  min-height: 44px;
}

/* Sidebar rows: enforce 44px min height */
.cp-sidebar-row {
  min-height: 44px;
  display: flex;
  align-items: center;
}

/* Zoom controls: 44px tap zone */
.cp-zoom-btn {
  min-width: 36px;
  min-height: 36px;
  position: relative;
}

.cp-zoom-btn::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 44px;
  min-height: 44px;
}
```

**Step 2: Commit**

```bash
git add src/styles/commonplace.css
git commit -m "feat(commonplace): add reduced motion and touch target styles"
```

---

### Task 3.3: Add keyboard navigation hook

**Files:**
- Create: `src/hooks/useBoardKeyboardNav.ts`

**Step 1: Build the keyboard navigation hook**

```typescript
'use client';

import { useCallback, useEffect } from 'react';

interface BoardItem {
  id: string;
  x: number;
  y: number;
}

interface UseBoardKeyboardNavOptions {
  /** All items on the board */
  items: BoardItem[];
  /** Currently focused item ID */
  focusedId: string | null;
  /** Set the focused item */
  onFocusItem: (id: string) => void;
  /** Called when Enter is pressed on focused item */
  onOpenContextMenu: (id: string) => void;
  /** Called when Space toggles drag mode */
  onToggleDrag: (id: string) => void;
  /** Called when C starts connect mode */
  onStartConnect: (id: string) => void;
  /** Whether the board canvas has focus */
  isCanvasFocused: boolean;
}

/**
 * Arrow-key navigation between board items.
 * Finds the nearest item in the arrow direction using quadrant filtering.
 */
export function useBoardKeyboardNav({
  items,
  focusedId,
  onFocusItem,
  onOpenContextMenu,
  onToggleDrag,
  onStartConnect,
  isCanvasFocused,
}: UseBoardKeyboardNavOptions) {
  const findNearest = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!focusedId) return null;
      const current = items.find((i) => i.id === focusedId);
      if (!current) return null;

      const candidates = items.filter((item) => {
        if (item.id === focusedId) return false;
        switch (direction) {
          case 'up':
            return item.y < current.y;
          case 'down':
            return item.y > current.y;
          case 'left':
            return item.x < current.x;
          case 'right':
            return item.x > current.x;
        }
      });

      if (candidates.length === 0) return null;

      return candidates.reduce((nearest, item) => {
        const distA =
          Math.abs(nearest.x - current.x) + Math.abs(nearest.y - current.y);
        const distB =
          Math.abs(item.x - current.x) + Math.abs(item.y - current.y);
        return distB < distA ? item : nearest;
      });
    },
    [items, focusedId],
  );

  useEffect(() => {
    if (!isCanvasFocused) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault();
          const dir = e.key.replace('Arrow', '').toLowerCase() as
            | 'up'
            | 'down'
            | 'left'
            | 'right';
          const nearest = findNearest(dir);
          if (nearest) onFocusItem(nearest.id);
          break;
        }
        case 'Enter':
          if (focusedId) {
            e.preventDefault();
            onOpenContextMenu(focusedId);
          }
          break;
        case ' ':
          if (focusedId) {
            e.preventDefault();
            onToggleDrag(focusedId);
          }
          break;
        case 'c':
        case 'C':
          if (focusedId && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            onStartConnect(focusedId);
          }
          break;
        case 'Escape':
          // Handled by clearSelection in parent
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    isCanvasFocused,
    focusedId,
    findNearest,
    onFocusItem,
    onOpenContextMenu,
    onToggleDrag,
    onStartConnect,
  ]);
}
```

**Step 2: Commit**

```bash
git add src/hooks/useBoardKeyboardNav.ts
git commit -m "feat(commonplace): add keyboard navigation hook for board"
```

---

## Section 4: Loading and Error States

### Task 4.1: Add engine status types and loading states

**Files:**
- Modify: `src/lib/commonplace-models.ts`

**Step 1: Add engine status types**

After the existing engine types, add:

```typescript
/* ─────────────────────────────────────────────────
   Engine operational status
   ───────────────────────────────────────────────── */

export type EngineStatus = 'idle' | 'recalculating' | 'error';

export interface EngineStatusInfo {
  status: EngineStatus;
  /** Number of board items the engine is processing */
  itemCount?: number;
  /** ISO timestamp of last successful calculation */
  lastUpdated?: string;
  /** Error message when status is 'error' */
  errorMessage?: string;
}
```

**Step 2: Commit**

```bash
git add src/lib/commonplace-models.ts
git commit -m "feat(commonplace): add engine operational status types"
```

---

### Task 4.2: Create EngineStatusDot component

**Files:**
- Create: `src/components/commonplace/EngineStatusDot.tsx`

**Step 1: Build the status indicator**

```tsx
'use client';

import type { EngineStatus } from '@/lib/commonplace-models';

interface EngineStatusDotProps {
  status: EngineStatus;
}

const STATUS_COLORS: Record<EngineStatus, string> = {
  idle: '#2E8A3E',
  recalculating: '#D4944A',
  error: '#C44A4A',
};

export default function EngineStatusDot({ status }: EngineStatusDotProps) {
  const color = STATUS_COLORS[status];
  const isPulsing = status === 'recalculating';

  return (
    <span
      role="status"
      aria-label={
        status === 'idle'
          ? 'Engine ready'
          : status === 'recalculating'
            ? 'Engine recalculating'
            : 'Engine unavailable'
      }
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        animation: isPulsing ? 'engine-pulse 1.2s ease-in-out infinite' : undefined,
        flexShrink: 0,
      }}
    />
  );
}
```

**Step 2: Add the pulse keyframe to commonplace.css**

Append:

```css
/* Engine status dot pulse */
@keyframes engine-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (prefers-reduced-motion: reduce) {
  @keyframes engine-pulse {
    0%, 100% { opacity: 1; }
  }
}
```

**Step 3: Commit**

```bash
git add src/components/commonplace/EngineStatusDot.tsx src/styles/commonplace.css
git commit -m "feat(commonplace): add engine status dot with pulse animation"
```

---

### Task 4.3: Create SearchLoadingStates component

**Files:**
- Create: `src/components/commonplace/SearchLoadingStates.tsx`

**Step 1: Build loading, empty, error, and rate-limit states**

```tsx
'use client';

import type { CSSProperties } from 'react';

type SearchState = 'loading' | 'empty' | 'error' | 'rate-limited';

interface SearchLoadingStatesProps {
  state: SearchState;
  query?: string;
  onRetry?: () => void;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
  gap: 8,
  color: 'var(--cp-text-muted)',
  fontFamily: 'var(--font-metadata)',
  fontSize: 12,
  textAlign: 'center',
};

function SkeletonCard() {
  return (
    <div
      style={{
        height: 56,
        borderRadius: 6,
        backgroundColor: 'var(--cp-surface)',
        margin: '4px 8px',
      }}
    >
      <div
        style={{
          height: 12,
          width: '60%',
          borderRadius: 3,
          backgroundColor: 'var(--cp-surface-hover)',
          margin: '10px 10px 6px',
        }}
      />
      <div
        style={{
          height: 10,
          width: '40%',
          borderRadius: 3,
          backgroundColor: 'var(--cp-surface-hover)',
          margin: '0 10px',
        }}
      />
    </div>
  );
}

export default function SearchLoadingStates({
  state,
  query,
  onRetry,
}: SearchLoadingStatesProps) {
  switch (state) {
    case 'loading':
      return (
        <div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      );

    case 'empty':
      return (
        <div style={containerStyle}>
          <span>No results for &quot;{query}&quot;</span>
          <span style={{ color: 'var(--cp-text-faint)', fontSize: 11 }}>
            Try different keywords.
          </span>
        </div>
      );

    case 'error':
      return (
        <div style={containerStyle}>
          <span>Search unavailable.</span>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                border: '1px solid var(--cp-chrome-line)',
                backgroundColor: 'transparent',
                color: 'var(--cp-teal)',
                cursor: 'pointer',
                fontFamily: 'var(--font-metadata)',
                fontSize: 11,
                marginTop: 4,
              }}
            >
              Retry
            </button>
          )}
        </div>
      );

    case 'rate-limited':
      return (
        <div style={containerStyle}>
          <span>Search limit reached.</span>
          <span style={{ color: 'var(--cp-text-faint)', fontSize: 11 }}>
            Try again in a few minutes.
          </span>
        </div>
      );
  }
}
```

**Step 2: Commit**

```bash
git add src/components/commonplace/SearchLoadingStates.tsx
git commit -m "feat(commonplace): add search loading/error/empty states"
```

---

## Section 5: Visual Hierarchy Signals

### Task 5.1: Create useCardElevation hook

**Files:**
- Create: `src/hooks/useCardElevation.ts`

**Step 1: Build the elevation computation hook**

```typescript
import { useMemo } from 'react';

/**
 * Three elevation tiers based on connection count.
 * Subtle shadow depth signals importance without changing card size.
 */

interface ElevationResult {
  /** CSS box-shadow string */
  shadow: string;
  /** Tier name for debugging/testing */
  tier: 'flat' | 'raised' | 'elevated';
}

export function useCardElevation(connectionCount: number): ElevationResult {
  return useMemo(() => {
    if (connectionCount >= 8) {
      return {
        shadow:
          '0 4px 12px rgba(42, 36, 32, 0.09), 0 2px 4px rgba(42, 36, 32, 0.05)',
        tier: 'elevated' as const,
      };
    }
    if (connectionCount >= 3) {
      return {
        shadow:
          '0 2px 6px rgba(42, 36, 32, 0.07), 0 1px 2px rgba(42, 36, 32, 0.04)',
        tier: 'raised' as const,
      };
    }
    return {
      shadow: '0 1px 2px rgba(42, 36, 32, 0.04)',
      tier: 'flat' as const,
    };
  }, [connectionCount]);
}
```

**Step 2: Commit**

```bash
git add src/hooks/useCardElevation.ts
git commit -m "feat(commonplace): add shadow elevation hook for card importance"
```

---

### Task 5.2: Create ConnectionBadge component

**Files:**
- Create: `src/components/commonplace/ConnectionBadge.tsx`

**Step 1: Build the badge (only visible at 3+ connections)**

```tsx
interface ConnectionBadgeProps {
  count: number;
  /** Type color at 40% opacity */
  typeColor: string;
}

export default function ConnectionBadge({ count, typeColor }: ConnectionBadgeProps) {
  if (count < 3) return null;

  // Parse hex to rgba at 40%
  const hex = typeColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return (
    <span
      style={{
        position: 'absolute',
        bottom: 6,
        right: 8,
        fontFamily: 'var(--font-code)',
        fontSize: 8,
        color: `rgba(${r}, ${g}, ${b}, 0.4)`,
        lineHeight: 1,
        pointerEvents: 'none',
      }}
    >
      {count} conn.
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/commonplace/ConnectionBadge.tsx
git commit -m "feat(commonplace): add connection count badge for cards"
```

---

### Task 5.3: Create EngineRelevancePip component

**Files:**
- Create: `src/components/commonplace/EngineRelevancePip.tsx`

**Step 1: Build the teal relevance pip**

```tsx
interface EngineRelevancePipProps {
  /** Whether the engine currently references this object */
  isRelevant: boolean;
}

export default function EngineRelevancePip({ isRelevant }: EngineRelevancePipProps) {
  if (!isRelevant) return null;

  return (
    <span
      aria-label="Engine relevant"
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        width: 5,
        height: 5,
        borderRadius: '50%',
        backgroundColor: 'rgba(45, 95, 107, 0.4)',
        pointerEvents: 'none',
      }}
    />
  );
}
```

**Step 2: Commit**

```bash
git add src/components/commonplace/EngineRelevancePip.tsx
git commit -m "feat(commonplace): add engine relevance pip for cards"
```

---

### Task 5.4: Create RecentlyPlacedGlow CSS and hook

**Files:**
- Create: `src/hooks/useRecentlyPlaced.ts`
- Modify: `src/styles/commonplace.css`

**Step 1: Build the timing hook**

```typescript
import { useState, useEffect } from 'react';

/**
 * Returns a CSS class name for the glow phase:
 * - 'board-glow-strong' (0-5s)
 * - 'board-glow-medium' (5-15s)
 * - 'board-glow-fade' (15-30s)
 * - null (after 30s)
 */
export function useRecentlyPlaced(placedAt: number | null): string | null {
  const [phase, setPhase] = useState<string | null>(null);

  useEffect(() => {
    if (!placedAt) {
      setPhase(null);
      return;
    }

    const elapsed = Date.now() - placedAt;
    if (elapsed >= 30_000) {
      setPhase(null);
      return;
    }

    const getPhase = (ms: number) => {
      if (ms < 5_000) return 'board-glow-strong';
      if (ms < 15_000) return 'board-glow-medium';
      if (ms < 30_000) return 'board-glow-fade';
      return null;
    };

    setPhase(getPhase(elapsed));

    const interval = setInterval(() => {
      const now = Date.now() - placedAt;
      const next = getPhase(now);
      setPhase(next);
      if (!next) clearInterval(interval);
    }, 1_000);

    return () => clearInterval(interval);
  }, [placedAt]);

  return phase;
}
```

**Step 2: Add glow styles to commonplace.css**

```css
/* ─────────────────────────────────────────────────
   Recently placed glow
   ───────────────────────────────────────────────── */

.board-glow-strong {
  box-shadow: 0 0 12px rgba(var(--cp-red-rgb), 0.08);
}

.board-glow-medium {
  box-shadow: 0 0 8px rgba(var(--cp-red-rgb), 0.04);
}

.board-glow-fade {
  box-shadow: 0 0 4px rgba(var(--cp-red-rgb), 0.02);
  transition: box-shadow 5s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .board-glow-strong,
  .board-glow-medium,
  .board-glow-fade {
    box-shadow: none;
  }
}
```

**Step 3: Commit**

```bash
git add src/hooks/useRecentlyPlaced.ts src/styles/commonplace.css
git commit -m "feat(commonplace): add recently-placed warm glow effect"
```

---

## Section 6: Drag State Visual Treatment

### Task 6.1: Create useDragState hook

**Files:**
- Create: `src/hooks/useBoardDragState.ts`

**Step 1: Build the drag state manager**

```typescript
import { useState, useCallback, useRef } from 'react';

interface DragItem {
  id: string;
  startX: number;
  startY: number;
}

interface DragState {
  /** Is any item currently being dragged? */
  isDragging: boolean;
  /** IDs of items currently being dragged */
  draggedIds: Set<string>;
  /** Original positions (for ghost rendering) */
  origins: Map<string, { x: number; y: number }>;
  /** Current cursor offset from drag start */
  delta: { dx: number; dy: number };
}

interface UseBoardDragStateReturn {
  state: DragState;
  startDrag: (items: DragItem[], clientX: number, clientY: number) => void;
  updateDrag: (clientX: number, clientY: number) => void;
  endDrag: () => { ids: string[]; dx: number; dy: number } | null;
  cancelDrag: () => void;
}

export function useBoardDragState(): UseBoardDragStateReturn {
  const [state, setState] = useState<DragState>({
    isDragging: false,
    draggedIds: new Set(),
    origins: new Map(),
    delta: { dx: 0, dy: 0 },
  });

  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const startDrag = useCallback(
    (items: DragItem[], clientX: number, clientY: number) => {
      startPosRef.current = { x: clientX, y: clientY };
      const origins = new Map<string, { x: number; y: number }>();
      const ids = new Set<string>();
      for (const item of items) {
        origins.set(item.id, { x: item.startX, y: item.startY });
        ids.add(item.id);
      }
      setState({
        isDragging: true,
        draggedIds: ids,
        origins,
        delta: { dx: 0, dy: 0 },
      });
    },
    [],
  );

  const updateDrag = useCallback((clientX: number, clientY: number) => {
    setState((prev) => {
      if (!prev.isDragging) return prev;
      return {
        ...prev,
        delta: {
          dx: clientX - startPosRef.current.x,
          dy: clientY - startPosRef.current.y,
        },
      };
    });
  }, []);

  const endDrag = useCallback(() => {
    let result: { ids: string[]; dx: number; dy: number } | null = null;
    setState((prev) => {
      if (prev.isDragging) {
        result = {
          ids: Array.from(prev.draggedIds),
          dx: prev.delta.dx,
          dy: prev.delta.dy,
        };
      }
      return {
        isDragging: false,
        draggedIds: new Set(),
        origins: new Map(),
        delta: { dx: 0, dy: 0 },
      };
    });
    return result;
  }, []);

  const cancelDrag = useCallback(() => {
    setState({
      isDragging: false,
      draggedIds: new Set(),
      origins: new Map(),
      delta: { dx: 0, dy: 0 },
    });
  }, []);

  return { state, startDrag, updateDrag, endDrag, cancelDrag };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useBoardDragState.ts
git commit -m "feat(commonplace): add board drag state management hook"
```

---

### Task 6.2: Create DragGhost component

**Files:**
- Create: `src/components/commonplace/DragGhost.tsx`

**Step 1: Build the ghost placeholder**

```tsx
interface DragGhostProps {
  /** Position and size of the original card */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Object type color for the dashed border */
  typeColor: string;
}

export default function DragGhost({
  x,
  y,
  width,
  height,
  typeColor,
}: DragGhostProps) {
  // Parse hex to rgba at 15%
  const hex = typeColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        border: `1px dashed rgba(${r}, ${g}, ${b}, 0.15)`,
        borderRadius: 6,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
```

**Step 2: Commit**

```bash
git add src/components/commonplace/DragGhost.tsx
git commit -m "feat(commonplace): add drag ghost placeholder component"
```

---

### Task 6.3: Add drag visual treatment CSS

**Files:**
- Modify: `src/styles/commonplace.css`

**Step 1: Add drag state styles**

Append to `commonplace.css`:

```css
/* ─────────────────────────────────────────────────
   Drag state visual treatment
   ───────────────────────────────────────────────── */

[data-board-item][data-dragging='true'] {
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(42, 36, 32, 0.12),
    0 2px 6px rgba(42, 36, 32, 0.06);
  z-index: 100;
  cursor: grabbing;
}

/* Straighten hunches while dragging */
[data-board-item][data-dragging='true'][data-hunch='true'] {
  rotate: 0deg;
}

[data-board-item] {
  cursor: grab;
}

@media (prefers-reduced-motion: reduce) {
  [data-board-item][data-dragging='true'] {
    transform: none;
    opacity: 0.85;
  }
}

/* Canvas drop crosshair */
.board-drop-crosshair {
  position: absolute;
  pointer-events: none;
  z-index: 50;
}

.board-drop-crosshair::before,
.board-drop-crosshair::after {
  content: '';
  position: absolute;
  background-color: rgba(45, 95, 107, 0.2);
}

.board-drop-crosshair::before {
  width: 1px;
  height: 20px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.board-drop-crosshair::after {
  width: 20px;
  height: 1px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

/* Stacking drop zone pulse */
@keyframes stack-pulse {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.4; }
}

.board-stack-zone {
  position: absolute;
  width: 3px;
  background-color: var(--cp-teal);
  animation: stack-pulse 800ms ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .board-stack-zone {
    animation: none;
    opacity: 0.3;
  }
}

/* Multi-select drag badge */
.board-drag-badge {
  position: fixed;
  pointer-events: none;
  z-index: 200;
  background-color: var(--cp-red);
  color: var(--cp-cream);
  font-family: var(--font-code);
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}
```

**Step 2: Commit**

```bash
git add src/styles/commonplace.css
git commit -m "feat(commonplace): add drag state visual treatment CSS"
```

---

## Section 7: Integration and Final Wiring

### Task 7.1: Update keyboard shortcuts in commonplace.css

**Files:**
- Modify: `src/styles/commonplace.css`

**Step 1: Add focus-visible styles for board items**

```css
/* ─────────────────────────────────────────────────
   Keyboard focus styles
   ───────────────────────────────────────────────── */

[data-board-item]:focus-visible {
  outline: 2px solid var(--cp-teal);
  outline-offset: 2px;
}

/* Canvas focus ring */
.board-canvas:focus-visible {
  outline: 2px solid var(--cp-teal);
  outline-offset: -2px;
}
```

**Step 2: Commit**

```bash
git add src/styles/commonplace.css
git commit -m "feat(commonplace): add keyboard focus styles for board items"
```

---

### Task 7.2: Run build verification

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors from the new files.

**Step 2: Run ESLint**

Run: `npm run lint`
Expected: No lint errors.

**Step 3: Run build**

Run: `npm run build`
Expected: Successful build.

**Step 4: Final commit (if any fixes needed)**

```bash
git add .
git commit -m "fix(commonplace): resolve build errors from board refinement"
```

---

## Summary: Files Created/Modified

**New files (10):**
- `src/components/commonplace/RubberBandSelection.tsx`
- `src/components/commonplace/GroupContextMenu.tsx`
- `src/components/commonplace/ComposeCatalogSplit.tsx`
- `src/components/commonplace/BoardAnnouncer.tsx`
- `src/components/commonplace/SearchLoadingStates.tsx`
- `src/components/commonplace/EngineStatusDot.tsx`
- `src/components/commonplace/ConnectionBadge.tsx`
- `src/components/commonplace/EngineRelevancePip.tsx`
- `src/components/commonplace/DragGhost.tsx`
- `src/hooks/useBoardKeyboardNav.ts`
- `src/hooks/useCardElevation.ts`
- `src/hooks/useRecentlyPlaced.ts`
- `src/hooks/useBoardDragState.ts`

**Modified files (3):**
- `src/lib/commonplace-context.tsx` (multi-select state)
- `src/lib/commonplace-models.ts` (engine status types)
- `src/styles/commonplace.css` (selection, a11y, drag, glow, focus styles)

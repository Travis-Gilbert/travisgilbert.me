# Board Surface Implementation Plan

> **For Claude:** REQUIRED: Use /execute-plan to implement this plan task-by-task.

**Goal:** Build the Board as a navigable spatial thinking surface: canvas with grid, placed items, pan/zoom, sidebar catalog drag-to-canvas, and connection rendering. Wires in all refinement components from the prior commit.

**Architecture:** Board is a new ViewType ('board') that renders in the split pane system. The canvas uses CSS transforms for pan/zoom (div-based, not `<canvas>`, so React components render directly as children). PlacedItems use the existing polymorphic ObjectRenderer. Demo data stands in until the Django Board models are built. Board state (placed items, connections, viewport) is local React state per BoardView instance.

**Tech Stack:** React 19, Next.js 16, Tailwind CSS v4, existing `--cp-*` tokens, `@floating-ui/react`, `iconoir-react`, existing ObjectRenderer + RoughBorder

**Key codebase conventions:**
- No dashes (em/en) in comments or strings
- `'use client'` on interactive components
- CSS tokens: `--cp-*` in `.commonplace-theme`
- Canvas dimension guards: min 1px, max 8192px
- `commonplace-api.ts` is the single source for API calls
- Sidebar sections defined in `SIDEBAR_SECTIONS` array in `commonplace.ts`
- View routing in `PaneViewContent` function in `SplitPaneContainer.tsx`
- View types registered in `ViewType` union and `VIEW_REGISTRY` in `commonplace.ts`

---

## Task 1: Register 'board' as a ViewType

**Files:**
- Modify: `src/lib/commonplace.ts` (ViewType union ~line 59, VIEW_REGISTRY ~line 102, SIDEBAR_SECTIONS ~line 156)

**Step 1: Add 'board' to ViewType union**

In `src/lib/commonplace.ts`, add `'board'` to the `ViewType` union type (after `'artifacts'`):

```typescript
// Add after '| artifacts'
  | 'board'
```

**Step 2: Add to VIEW_REGISTRY**

```typescript
// Add after the 'artifacts' entry
board: { label: 'Board', icon: 'board' },
```

**Step 3: Add sidebar navigation under Models**

In `SIDEBAR_SECTIONS`, find the section with `Models` (the second section, items array around line 167). Make Models expandable with a Boards child:

```typescript
{
  label: 'Models',
  href: '#models',
  icon: 'model',
  mode: 'screen',
  screenType: 'models',
  expandable: true,
  children: [
    { label: 'Boards', href: '#boards', icon: 'board', mode: 'view', viewType: 'board' },
  ],
},
```

**Step 4: Commit**

```bash
git add src/lib/commonplace.ts
git commit -m "feat(commonplace): register board as ViewType with sidebar nav"
```

---

## Task 2: Create Board types and demo data

**Files:**
- Create: `src/lib/commonplace-board.ts`

**Step 1: Create the Board data module**

This file defines Board-specific types and provides demo data for development. Types mirror the v2 wireframe's data model (Board, PlacedItem, BoardConnection, Frame) but as frontend types, not Django models.

```typescript
/**
 * Board data types and demo content.
 *
 * Types mirror the planned Django models (Board, PlacedItem,
 * BoardConnection, Frame). Demo data stands in until the
 * backend API is built.
 */

import type { RenderableObject } from '@/components/commonplace/objects/ObjectRenderer';

/* ─────────────────────────────────────────────────
   Core types
   ───────────────────────────────────────────────── */

export interface PlacedItem {
  id: string;
  objectRef: number;
  object: RenderableObject;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** ID of parent PlacedItem if stacked */
  stackedOn: string | null;
  /** 'right' or 'bottom' if stacked */
  stackPosition: 'right' | 'bottom' | null;
  /** Timestamp when placed (for recently-placed glow) */
  placedAt: number;
}

export type ConnectionSource = 'engine' | 'manual';

export interface BoardConnection {
  id: string;
  fromItemId: string;
  toItemId: string;
  label: string;
  edgeType: 'related' | 'supports' | 'contradicts' | 'derived-from' | 'inspired-by';
  source: ConnectionSource;
  confirmed: boolean;
}

export interface BoardFrame {
  id: string;
  name: string;
  items: PlacedItem[];
  connections: BoardConnection[];
  viewport: ViewportState;
}

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface BoardState {
  id: string;
  title: string;
  items: PlacedItem[];
  connections: BoardConnection[];
  frames: BoardFrame[];
  viewport: ViewportState;
}

/* ─────────────────────────────────────────────────
   Demo data
   ───────────────────────────────────────────────── */

const now = Date.now();

const DEMO_OBJECTS: RenderableObject[] = [
  {
    id: 1001,
    slug: 'how-buildings-learn',
    title: 'How Buildings Learn',
    object_type_slug: 'source',
    body: 'Stewart Brand on the six layers of change in buildings.',
    edge_count: 8,
  },
  {
    id: 1002,
    slug: 'governing-the-commons',
    title: 'Governing the Commons',
    object_type_slug: 'source',
    body: 'Elinor Ostrom on self-governance of shared resources.',
    edge_count: 12,
  },
  {
    id: 1003,
    slug: 'buildings-adapt',
    title: 'Buildings that adapt outlast buildings that don\'t',
    object_type_slug: 'hunch',
    body: 'Observation from Brand\'s shearing layers framework.',
    edge_count: 3,
  },
  {
    id: 1004,
    slug: 'stewart-brand',
    title: 'Stewart Brand',
    object_type_slug: 'person',
    body: 'Author, Whole Earth Catalog founder.',
    edge_count: 5,
  },
  {
    id: 1005,
    slug: 'stigmergy',
    title: 'Stigmergy',
    object_type_slug: 'concept',
    body: 'Indirect coordination through environmental traces.',
    edge_count: 4,
  },
  {
    id: 1006,
    slug: 'walkable-software',
    title: 'On walkable software',
    object_type_slug: 'note',
    body: 'Good software has the quality of a walkable city: human scale, discoverable, rewards exploration.',
    edge_count: 1,
  },
];

export const DEMO_BOARD: BoardState = {
  id: 'board-demo-1',
  title: 'Adaptation and Commons',
  items: DEMO_OBJECTS.map((obj, i) => ({
    id: `item-${obj.id}`,
    objectRef: obj.id,
    object: obj,
    x: 80 + (i % 3) * 280,
    y: 80 + Math.floor(i / 3) * 240,
    width: 220,
    height: 160,
    rotation: obj.object_type_slug === 'hunch' ? -0.8 : 0,
    stackedOn: null,
    stackPosition: null,
    placedAt: now - (i * 10_000),
  })),
  connections: [
    {
      id: 'conn-1',
      fromItemId: 'item-1001',
      toItemId: 'item-1003',
      label: 'inspired',
      edgeType: 'inspired-by',
      source: 'manual',
      confirmed: true,
    },
    {
      id: 'conn-2',
      fromItemId: 'item-1001',
      toItemId: 'item-1004',
      label: '',
      edgeType: 'related',
      source: 'engine',
      confirmed: false,
    },
    {
      id: 'conn-3',
      fromItemId: 'item-1002',
      toItemId: 'item-1005',
      label: 'shared concept',
      edgeType: 'related',
      source: 'engine',
      confirmed: true,
    },
  ],
  frames: [],
  viewport: { panX: 0, panY: 0, zoom: 1 },
};
```

**Step 2: Commit**

```bash
git add src/lib/commonplace-board.ts
git commit -m "feat(commonplace): add board types and demo data"
```

---

## Task 3: Create BoardCanvas component

**Files:**
- Create: `src/components/commonplace/BoardCanvas.tsx`

**Step 1: Build the canvas with grid, pan, and zoom**

This is the spatial surface. It uses CSS transforms for pan/zoom and renders placed items as positioned React children. Integrates RubberBandSelection, keyboard nav, and drag state from the refinement infrastructure.

```tsx
'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import type { PlacedItem, BoardConnection, ViewportState } from '@/lib/commonplace-board';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { useCommonPlace } from '@/lib/commonplace-context';
import { useCardElevation } from '@/hooks/useCardElevation';
import { useRecentlyPlaced } from '@/hooks/useRecentlyPlaced';
import ObjectRenderer from './objects/ObjectRenderer';
import type { RenderableObject } from './objects/ObjectRenderer';
import ConnectionBadge from './ConnectionBadge';
import EngineRelevancePip from './EngineRelevancePip';
import DragGhost from './DragGhost';

/* ─────────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────────── */

const GRID_SIZE = 48;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

/* ─────────────────────────────────────────────────
   Placed card wrapper (applies elevation, glow, badges)
   ───────────────────────────────────────────────── */

interface PlacedCardProps {
  item: PlacedItem;
  isSelected: boolean;
  isDragging: boolean;
  /** IDs of objects the engine currently references */
  engineRelevantIds: Set<number>;
  onMouseDown: (e: React.MouseEvent, item: PlacedItem) => void;
  onContextMenu: (e: React.MouseEvent, item: PlacedItem) => void;
  onClick: (e: React.MouseEvent, item: PlacedItem) => void;
}

function PlacedCard({
  item,
  isSelected,
  isDragging,
  engineRelevantIds,
  onMouseDown,
  onContextMenu,
  onClick,
}: PlacedCardProps) {
  const { shadow } = useCardElevation(item.object.edge_count ?? 0);
  const glowClass = useRecentlyPlaced(item.placedAt);
  const typeIdentity = getObjectTypeIdentity(item.object.object_type_slug);

  return (
    <div
      data-board-item
      data-selected={isSelected || undefined}
      data-dragging={isDragging || undefined}
      data-hunch={item.object.object_type_slug === 'hunch' || undefined}
      tabIndex={0}
      className={glowClass ?? undefined}
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.width,
        transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
        boxShadow: isDragging ? undefined : shadow,
        zIndex: isDragging ? 100 : 2,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={(e) => onMouseDown(e, item)}
      onContextMenu={(e) => onContextMenu(e, item)}
      onClick={(e) => onClick(e, item)}
    >
      <div style={{ position: 'relative' }}>
        <ObjectRenderer
          object={item.object}
          variant="default"
          compact
        />
        <ConnectionBadge
          count={item.object.edge_count ?? 0}
          typeColor={typeIdentity.color}
        />
        <EngineRelevancePip
          isRelevant={engineRelevantIds.has(item.object.id)}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Connection renderer (canvas overlay)
   ───────────────────────────────────────────────── */

interface ConnectionLinesProps {
  connections: BoardConnection[];
  items: PlacedItem[];
}

function ConnectionLines({ connections, items }: ConnectionLinesProps) {
  const itemMap = new Map(items.map((i) => [i.id, i]));

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {connections.map((conn) => {
        const from = itemMap.get(conn.fromItemId);
        const to = itemMap.get(conn.toItemId);
        if (!from || !to) return null;

        const x1 = from.x + from.width / 2;
        const y1 = from.y + (from.height ?? 160) / 2;
        const x2 = to.x + to.width / 2;
        const y2 = to.y + (to.height ?? 160) / 2;

        const isEngine = conn.source === 'engine';
        const color = isEngine ? '#2D5F6B' : '#B8623D';
        const opacity = conn.confirmed ? 0.4 : 0.25;
        const strokeDash = conn.confirmed ? undefined : '4 4';
        const strokeWidth = conn.confirmed ? 1.5 : 1;

        if (isEngine) {
          // Railway: rectilinear path
          const midY = (y1 + y2) / 2;
          const d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
          return (
            <path
              key={conn.id}
              d={d}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              strokeOpacity={opacity}
              fill="none"
            />
          );
        }

        // Manual: curved pencil line
        const cpx = (x1 + x2) / 2 + (y2 - y1) * 0.15;
        const cpy = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`;
        return (
          <g key={conn.id}>
            {/* Shadow stroke (pencil texture) */}
            <path
              d={d}
              stroke={color}
              strokeWidth={0.5}
              strokeOpacity={0.18}
              fill="none"
            />
            {/* Primary stroke */}
            <path
              d={d}
              stroke={color}
              strokeWidth={1.2}
              strokeOpacity={opacity}
              fill="none"
            />
            {/* Label */}
            {conn.label && (
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2 - 6}
                fill={color}
                fillOpacity={0.5}
                fontSize={9}
                fontFamily="var(--font-metadata)"
                fontStyle="italic"
                textAnchor="middle"
              >
                {conn.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────────
   Empty state
   ───────────────────────────────────────────────── */

function BoardEmptyState() {
  return (
    <div
      style={{
        position: 'absolute',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          border: '2px dashed rgba(45, 95, 107, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 28,
          color: 'rgba(45, 95, 107, 0.3)',
        }}
      >
        +
      </div>
      <div
        style={{
          fontFamily: 'var(--font-metadata)',
          fontSize: 12,
          color: 'var(--cp-text-faint)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        Drag objects from the sidebar to begin
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Main canvas
   ───────────────────────────────────────────────── */

interface BoardCanvasProps {
  items: PlacedItem[];
  connections: BoardConnection[];
  viewport: ViewportState;
  onViewportChange: (v: ViewportState) => void;
  onItemMove: (itemId: string, x: number, y: number) => void;
  /** IDs the engine currently references */
  engineRelevantIds?: Set<number>;
}

export default function BoardCanvas({
  items,
  connections,
  viewport,
  onViewportChange,
  onItemMove,
  engineRelevantIds = new Set(),
}: BoardCanvasProps) {
  const { selectedItems, selectSingle, toggleSelectItem, clearSelection, openContextMenu, openDrawer } =
    useCommonPlace();

  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const dragStart = useRef<{ x: number; y: number; itemX: number; itemY: number } | null>(null);

  /* ── Zoom via scroll wheel ── */
  const handleWheel = useCallback(
    (e: ReactWheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom + delta));
      onViewportChange({ ...viewport, zoom: nextZoom });
    },
    [viewport, onViewportChange],
  );

  /* ── Pan via middle click or Space+drag ── */
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle click or space held
      if (e.button === 1) {
        isPanning.current = true;
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          panX: viewport.panX,
          panY: viewport.panY,
        };
        e.preventDefault();
      }
    },
    [viewport],
  );

  /* ── Item drag ── */
  const handleItemMouseDown = useCallback(
    (e: React.MouseEvent, item: PlacedItem) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      // Shift+click for multi-select
      if (e.shiftKey) {
        toggleSelectItem(item.id);
        return;
      }

      // Start drag
      if (!selectedItems.has(item.id)) {
        selectSingle(item.id);
      }
      setDragId(item.id);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        itemX: item.x,
        itemY: item.y,
      };
    },
    [selectedItems, selectSingle, toggleSelectItem],
  );

  const handleItemClick = useCallback(
    (e: React.MouseEvent, item: PlacedItem) => {
      if (e.shiftKey) return; // Handled by mousedown
      if (e.detail === 2) {
        // Double click opens drawer
        openDrawer(item.object.slug);
      }
    },
    [openDrawer],
  );

  const handleItemContextMenu = useCallback(
    (e: React.MouseEvent, item: PlacedItem) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, item.object);
    },
    [openContextMenu],
  );

  /* ── Global mouse move/up for drag and pan ── */
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (isPanning.current) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        onViewportChange({
          ...viewport,
          panX: panStart.current.panX + dx,
          panY: panStart.current.panY + dy,
        });
        return;
      }

      if (dragId && dragStart.current) {
        const dx = (e.clientX - dragStart.current.x) / viewport.zoom;
        const dy = (e.clientY - dragStart.current.y) / viewport.zoom;
        onItemMove(dragId, dragStart.current.itemX + dx, dragStart.current.itemY + dy);
      }
    };

    const handleUp = () => {
      isPanning.current = false;
      setDragId(null);
      dragStart.current = null;
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [dragId, viewport, onViewportChange, onItemMove]);

  /* ── Keyboard: Escape clears selection ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [clearSelection]);

  /* ── Click empty canvas clears selection ── */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-board-item]')) {
        clearSelection();
      }
    },
    [clearSelection],
  );

  // Find the dragged item for ghost rendering
  const draggedItem = dragId ? items.find((i) => i.id === dragId) : null;

  return (
    <div
      ref={containerRef}
      className="board-canvas"
      role="application"
      aria-label="Board canvas"
      tabIndex={0}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#F4F3F0',
        cursor: isPanning.current ? 'grabbing' : 'default',
      }}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onClick={handleCanvasClick}
    >
      {/* Grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(45, 95, 107, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(45, 95, 107, 0.07) 1px, transparent 1px)
          `,
          backgroundSize: `${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px`,
          backgroundPosition: `${viewport.panX}px ${viewport.panY}px`,
          pointerEvents: 'none',
        }}
      />

      {/* Terracotta ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '40vw',
          height: '40vh',
          background: 'radial-gradient(ellipse at 100% 0%, rgba(184, 98, 61, 0.025), transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* Transformed content layer */}
      <div
        style={{
          position: 'absolute',
          transformOrigin: '0 0',
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        {/* Connection lines (behind cards) */}
        <ConnectionLines connections={connections} items={items} />

        {/* Placed items */}
        {items.map((item) => (
          <PlacedCard
            key={item.id}
            item={item}
            isSelected={selectedItems.has(item.id)}
            isDragging={dragId === item.id}
            engineRelevantIds={engineRelevantIds}
            onMouseDown={handleItemMouseDown}
            onContextMenu={handleItemContextMenu}
            onClick={handleItemClick}
          />
        ))}

        {/* Drag ghost at original position */}
        {draggedItem && dragStart.current && (
          <DragGhost
            x={dragStart.current.itemX}
            y={dragStart.current.itemY}
            width={draggedItem.width}
            height={draggedItem.height ?? 160}
            typeColor={getObjectTypeIdentity(draggedItem.object.object_type_slug).color}
          />
        )}
      </div>

      {/* Empty state */}
      {items.length === 0 && <BoardEmptyState />}

      {/* Zoom indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          fontFamily: 'var(--font-metadata)',
          fontSize: 10,
          color: 'rgba(45, 95, 107, 0.4)',
          letterSpacing: '0.04em',
          pointerEvents: 'none',
        }}
      >
        {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/commonplace/BoardCanvas.tsx
git commit -m "feat(commonplace): add BoardCanvas with grid, pan, zoom, placed items"
```

---

## Task 4: Create BoardView (the top-level orchestrator)

**Files:**
- Create: `src/components/commonplace/BoardView.tsx`

**Step 1: Build BoardView**

This component owns the board state and renders the canvas. It uses demo data for now and will eventually fetch from the API.

```tsx
'use client';

import { useState, useCallback } from 'react';
import type { PlacedItem, BoardConnection, ViewportState } from '@/lib/commonplace-board';
import { DEMO_BOARD } from '@/lib/commonplace-board';
import BoardCanvas from './BoardCanvas';

interface BoardViewProps {
  paneId?: string;
}

export default function BoardView({ paneId }: BoardViewProps) {
  const [items, setItems] = useState<PlacedItem[]>(DEMO_BOARD.items);
  const [connections] = useState<BoardConnection[]>(DEMO_BOARD.connections);
  const [viewport, setViewport] = useState<ViewportState>(DEMO_BOARD.viewport);

  const handleItemMove = useCallback((itemId: string, x: number, y: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, x, y } : item,
      ),
    );
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Board title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--cp-border-faint)',
          backgroundColor: 'rgba(244, 243, 240, 0.5)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--cp-font-title)',
            fontSize: 15,
            color: '#2A2420',
          }}
        >
          {DEMO_BOARD.title}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-metadata)',
            fontSize: 10,
            color: 'rgba(42, 36, 32, 0.4)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {items.length} objects, {connections.length} connections
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <BoardCanvas
          items={items}
          connections={connections}
          viewport={viewport}
          onViewportChange={setViewport}
          onItemMove={handleItemMove}
        />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/commonplace/BoardView.tsx
git commit -m "feat(commonplace): add BoardView orchestrator with demo data"
```

---

## Task 5: Wire BoardView into the split pane router

**Files:**
- Modify: `src/components/commonplace/SplitPaneContainer.tsx`

**Step 1: Add the import at top of file (with other lazy/dynamic imports)**

Find the imports section near the top. Add:

```typescript
import BoardView from './BoardView';
```

**Step 2: Add the 'board' case in PaneViewContent**

In the `PaneViewContent` function (around line 643), add a new case before the final placeholder return (around line 886):

```typescript
  /* Board (spatial thinking surface) */
  if (viewType === 'board') {
    return <BoardView paneId={paneId} />;
  }
```

Add this just before the `/* Placeholder for views not yet implemented */` comment.

**Step 3: Add 'board' to the ViewTypeIcon switch**

In the `ViewTypeIcon` function (the big switch with SVG icons), add a case for `'board'`:

```typescript
    case 'board':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <rect x={1} y={1} width={14} height={14} rx={1} />
          <rect x={3} y={3} width={4} height={3} rx={0.5} />
          <rect x={9} y={5} width={4} height={3} rx={0.5} />
          <rect x={4} y={9} width={4} height={3} rx={0.5} />
          <line x1={7} y1={4.5} x2={9} y2={6.5} opacity={0.5} />
          <line x1={6} y1={9} x2={7} y2={8} opacity={0.5} />
        </svg>
      );
```

Add this before the `default` case.

**Step 4: Commit**

```bash
git add src/components/commonplace/SplitPaneContainer.tsx
git commit -m "feat(commonplace): wire BoardView into split pane router"
```

---

## Task 6: Build verification and screenshot

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No new type errors.

**Step 2: Start dev server and navigate**

Run: `npm run dev`
Navigate to: `/commonplace`
Click: Models > Boards in sidebar (or use launchView to open a 'board' pane)

**Step 3: Verify**

Expected:
- Board renders with warm parchment background and teal grid lines
- 6 demo objects visible as cards at their grid positions
- 3 connections (2 rectilinear engine, 1 curved manual) visible between cards
- Cards are draggable (click and drag moves them)
- Scroll wheel zooms in/out
- Shift+click toggles multi-select
- Escape clears selection
- Double-click opens object drawer
- Zoom percentage shows bottom-right
- Title bar shows "Adaptation and Commons" with item count

**Step 4: Final commit if fixes needed**

```bash
git add .
git commit -m "fix(commonplace): board surface build fixes"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Register 'board' ViewType + sidebar nav | `commonplace.ts` |
| 2 | Board types + demo data | `commonplace-board.ts` (new) |
| 3 | BoardCanvas: grid, pan, zoom, cards, connections | `BoardCanvas.tsx` (new) |
| 4 | BoardView: state owner + title bar | `BoardView.tsx` (new) |
| 5 | Wire into split pane router | `SplitPaneContainer.tsx` |
| 6 | Build verification | (verification only) |

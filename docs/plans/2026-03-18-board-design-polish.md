# Board Design Polish Implementation Plan

> **For Claude:** REQUIRED: Use /execute-plan to implement this plan task-by-task.

**Goal:** Fix 10 design issues identified in design review: navigation escape, tab bar redesign, warm parchment cards, drop target feedback, zoom controls on canvas, drag affordance indicators, connection hover interaction, compose button visual weight, "on board" catalog indicators, and frame button tooltip.

**Architecture:** All changes are in existing Board components (BoardView, BoardCanvas, BoardCatalogSidebar, ConnectionLines). No new files needed. The tab bar loses the separate board title and uses larger Vollkorn font on all tabs. PlacedCard replaces ObjectRenderer with inline tint-wash card rendering matching the mockup's warm parchment style.

**Tech Stack:** React 19, Next.js 16, CSS custom properties (`--cp-*`), `color-mix()` for tint washes, `iconoir-react`

**Key files:**
- `src/components/commonplace/BoardView.tsx` (tab bar)
- `src/components/commonplace/BoardCanvas.tsx` (PlacedCard, ConnectionLines, zoom, drop target)
- `src/components/commonplace/BoardCatalogSidebar.tsx` (nav escape, drag affordance, compose button, "on board" indicator)

---

## Task 1: Redesign tab bar (eliminate board title, larger Vollkorn tabs)

**Files:**
- Modify: `src/components/commonplace/BoardView.tsx`

**Step 1: Replace the tab bar**

Remove the separate "Adaptation and Commons" board title tab. Instead, make ALL tabs (board + frames) use Vollkorn at 15px/600. The board tab becomes "Board" (or user's board name when API is connected). Frame tabs use their frame name. The active tab gets the accent underline. No red dot.

Replace the entire tab bar `<div>` (lines 64-175) with:

```tsx
      {/* Tab strip */}
      <div
        style={{
          height: 36,
          backgroundColor: 'var(--cp-chrome)',
          borderBottom: '1px solid var(--cp-chrome-line)',
          display: 'flex',
          alignItems: 'stretch',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* Board tab */}
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            border: 'none',
            borderBottom: activeFrameId === null
              ? '2px solid var(--cp-red)'
              : '2px solid transparent',
            backgroundColor: activeFrameId === null ? 'var(--cp-chrome-raise)' : 'transparent',
            cursor: 'pointer',
            fontFamily: 'var(--cp-font-title)',
            fontSize: 15,
            fontWeight: 600,
            color: activeFrameId === null ? 'var(--cp-chrome-text)' : 'var(--cp-chrome-dim)',
            whiteSpace: 'nowrap',
          }}
          onClick={() => {
            setActiveFrameId(null);
            setItems(DEMO_BOARD.items);
          }}
        >
          Board
        </button>

        {/* Frame tabs */}
        {frames.map((frame) => (
          <div
            key={frame.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 12px',
              borderBottom: activeFrameId === frame.id
                ? '2px solid #C49A4A'
                : '2px solid transparent',
              backgroundColor: activeFrameId === frame.id ? 'var(--cp-chrome-raise)' : 'transparent',
              cursor: 'pointer',
            }}
            onClick={() => handleLoadFrame(frame)}
          >
            <span
              style={{
                fontFamily: 'var(--cp-font-title)',
                fontSize: 14,
                fontWeight: 500,
                color: activeFrameId === frame.id ? 'var(--cp-chrome-text)' : 'var(--cp-chrome-dim)',
              }}
            >
              {frame.name}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFrame(frame.id);
              }}
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                border: 'none',
                background: 'transparent',
                color: 'var(--cp-chrome-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <Xmark width={10} height={10} strokeWidth={2} />
            </button>
          </div>
        ))}

        {/* Add frame */}
        <button
          type="button"
          onClick={handleSaveFrame}
          title="Save current layout as a frame"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            border: 'none',
            background: 'transparent',
            color: 'var(--cp-chrome-dim)',
            cursor: 'pointer',
          }}
        >
          <Plus width={14} height={14} strokeWidth={1.5} />
        </button>

        <div style={{ flex: 1 }} />

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            fontFamily: 'var(--font-metadata)',
            fontSize: 10,
            color: 'var(--cp-chrome-dim)',
            letterSpacing: '0.04em',
          }}
        >
          {items.length} objects
        </div>
      </div>
```

**Step 2: Commit**

```bash
git add src/components/commonplace/BoardView.tsx
git commit -m "fix(commonplace): redesign tab bar with Vollkorn titles, remove board title"
```

---

## Task 2: Add navigation escape to board catalog sidebar

**Files:**
- Modify: `src/components/commonplace/BoardCatalogSidebar.tsx`

**Step 1: Add nav header with back link**

At the top of the main `return` in `BoardCatalogSidebar`, before the search bar, add a compact navigation header that shows "CommonPlace" as a link back and a breadcrumb showing you're in the board:

Add a new prop:
```typescript
interface BoardCatalogSidebarProps {
  // ... existing props ...
  /** Called when user wants to exit board and return to normal sidebar */
  onExitBoard?: () => void;
}
```

Add at the top of the non-compose return, before the search bar div:

```tsx
      {/* Navigation header */}
      <div
        style={{
          padding: '10px 10px 6px',
          borderBottom: '1px solid var(--cp-chrome-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          onClick={onExitBoard}
          style={{
            background: 'transparent',
            border: 'none',
            fontFamily: 'var(--cp-font-title)',
            fontSize: 13,
            color: 'var(--cp-chrome-text)',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--cp-chrome-dim)' }}>&larr;</span>
          CommonPlace
        </button>
        <span
          style={{
            fontFamily: 'var(--font-metadata)',
            fontSize: 9,
            color: 'var(--cp-chrome-dim)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Board
        </span>
      </div>
```

**Step 2: Wire onExitBoard in CommonPlaceSidebar.tsx**

In `CommonPlaceSidebar.tsx`, where `BoardCatalogSidebar` is rendered, add `onExitBoard` that navigates back to Library:

```tsx
<BoardCatalogSidebar
  objects={boardCatalogObjects}
  components={boardCatalogComponents}
  zoom={1}
  onExitBoard={() => navigateToScreen('library')}
/>
```

**Step 3: Commit**

```bash
git add src/components/commonplace/BoardCatalogSidebar.tsx src/components/commonplace/CommonPlaceSidebar.tsx
git commit -m "fix(commonplace): add navigation escape from board catalog sidebar"
```

---

## Task 3: Replace ObjectRenderer with warm parchment tint-wash cards

**Files:**
- Modify: `src/components/commonplace/BoardCanvas.tsx`

**Step 1: Replace PlacedCard internals**

Remove the `ObjectRenderer` import and replace the card rendering with inline tint-wash cards that match the mockup's warm parchment style. Each type gets its own content layout inside a `color-mix()` tinted wrapper.

Replace the `PlacedCard` function body's inner `<div style={{ position: 'relative' }}>` block with:

```tsx
      <div
        style={{
          position: 'relative',
          padding: '10px 12px',
          borderRadius: item.object.object_type_slug === 'concept' ? 16
            : item.object.object_type_slug === 'hunch' ? 3
            : 6,
          backgroundColor: `color-mix(in srgb, ${typeIdentity.color} ${isSelected ? 10 : 6}%, transparent)`,
          border: `1px solid ${isSelected ? `color-mix(in srgb, ${typeIdentity.color} 30%, transparent)` : 'transparent'}`,
          transition: 'background-color 200ms, border-color 200ms',
          overflow: 'hidden',
        }}
      >
        {/* Type kicker label */}
        <div
          style={{
            fontFamily: 'var(--font-metadata)',
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: typeIdentity.color,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          {typeIdentity.label}
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: 'var(--cp-font-body, system-ui)',
            fontSize: 13,
            fontWeight: 600,
            fontStyle: item.object.object_type_slug === 'hunch' ? 'italic' : undefined,
            color: '#2A2420',
            lineHeight: 1.3,
            marginBottom: 3,
          }}
        >
          {item.object.title}
        </div>

        {/* Body preview */}
        {item.object.body && (
          <div
            style={{
              fontFamily: 'var(--cp-font-body, system-ui)',
              fontSize: 10.5,
              color: '#5C564E',
              lineHeight: 1.4,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {item.object.body}
          </div>
        )}

        {/* Connection badge */}
        <ConnectionBadge
          count={item.object.edge_count ?? 0}
          typeColor={typeIdentity.color}
        />

        {/* Engine relevance pip */}
        <EngineRelevancePip
          isRelevant={engineRelevantIds.has(item.object.id)}
        />
      </div>
```

Remove the `ObjectRenderer` import from the top of the file since it's no longer used.

**Step 2: Commit**

```bash
git add src/components/commonplace/BoardCanvas.tsx
git commit -m "fix(commonplace): warm parchment tint-wash cards on board canvas"
```

---

## Task 4: Add drop target feedback for catalog drag onto canvas

**Files:**
- Modify: `src/components/commonplace/BoardCanvas.tsx`

**Step 1: Add dragover/drop handlers to the canvas**

Add state for showing the crosshair and handle HTML5 drag events:

After the existing `dragId` state, add:

```typescript
const [dropTarget, setDropTarget] = useState<{ x: number; y: number } | null>(null);
```

Add these handlers to the canvas container div:

```tsx
onDragOver={(e) => {
  if (e.dataTransfer.types.includes('application/commonplace-catalog')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const bounds = containerRef.current?.getBoundingClientRect();
    if (bounds) {
      setDropTarget({
        x: (e.clientX - bounds.left - viewport.panX) / viewport.zoom,
        y: (e.clientY - bounds.top - viewport.panY) / viewport.zoom,
      });
    }
  }
}}
onDragLeave={() => setDropTarget(null)}
onDrop={(e) => {
  e.preventDefault();
  setDropTarget(null);
  // Future: create PlacedItem at drop position
}}
```

Inside the transformed content layer, render the crosshair when `dropTarget` is set:

```tsx
{dropTarget && (
  <div
    className="board-drop-crosshair"
    style={{ left: dropTarget.x - 10, top: dropTarget.y - 10, width: 20, height: 20 }}
  />
)}
```

**Step 2: Commit**

```bash
git add src/components/commonplace/BoardCanvas.tsx
git commit -m "feat(commonplace): add teal crosshair drop target feedback on canvas"
```

---

## Task 5: Move zoom controls to canvas overlay

**Files:**
- Modify: `src/components/commonplace/BoardCanvas.tsx`
- Modify: `src/components/commonplace/BoardCatalogSidebar.tsx`

**Step 1: Add zoom controls overlay to BoardCanvas**

Add new props to `BoardCanvasProps`:

```typescript
onZoomIn?: () => void;
onZoomOut?: () => void;
onFitToContent?: () => void;
```

Before the closing `</div>` of the canvas container, replace the existing zoom percentage indicator with full controls:

```tsx
      {/* Zoom controls overlay (bottom-right, like Figma) */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          display: 'flex',
          gap: 2,
          zIndex: 20,
        }}
      >
        {[
          { label: '\u2212', action: () => onViewportChange({ ...viewport, zoom: Math.max(MIN_ZOOM, viewport.zoom - ZOOM_STEP) }) },
          { label: `${Math.round(viewport.zoom * 100)}%`, action: undefined },
          { label: '+', action: () => onViewportChange({ ...viewport, zoom: Math.min(MAX_ZOOM, viewport.zoom + ZOOM_STEP) }) },
          { label: 'Fit', action: onFitToContent },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.action}
            disabled={!btn.action}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid rgba(42, 36, 32, 0.12)',
              backgroundColor: 'rgba(244, 243, 240, 0.9)',
              backdropFilter: 'blur(4px)',
              fontFamily: 'var(--font-metadata)',
              fontSize: 10,
              color: btn.action ? '#5C564E' : '#9A948A',
              cursor: btn.action ? 'pointer' : 'default',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
```

**Step 2: Remove zoom controls from BoardCatalogSidebar**

In `BoardCatalogSidebar.tsx`, remove the `<ZoomControls>` render from both the main return and the compose split view. Remove the `ZoomControls` function, and the `zoom`, `onZoomIn`, `onZoomOut`, `onFitToContent` props from the interface.

**Step 3: Update CommonPlaceSidebar.tsx** to stop passing zoom props.

**Step 4: Commit**

```bash
git add src/components/commonplace/BoardCanvas.tsx src/components/commonplace/BoardCatalogSidebar.tsx src/components/commonplace/CommonPlaceSidebar.tsx
git commit -m "fix(commonplace): move zoom controls from sidebar to canvas overlay"
```

---

## Task 6: Add drag handle affordance to catalog rows

**Files:**
- Modify: `src/components/commonplace/BoardCatalogSidebar.tsx`

**Step 1: Add drag handle to ObjectRow**

Add a drag handle indicator (⠿) on the right side of each `ObjectRow`, visible at all times (not just in compressed mode):

Inside `ObjectRow`, after the object info div, add:

```tsx
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          color: 'var(--cp-chrome-dim)',
          opacity: 0.3,
          flexShrink: 0,
        }}
      >
        ⠿
      </span>
```

**Step 2: Commit**

```bash
git add src/components/commonplace/BoardCatalogSidebar.tsx
git commit -m "fix(commonplace): add drag handle affordance to catalog object rows"
```

---

## Task 7: Add connection hover interaction with wider hit areas

**Files:**
- Modify: `src/components/commonplace/BoardCanvas.tsx`

**Step 1: Make connection paths interactive**

In the `ConnectionLines` component, change the SVG from `pointerEvents: 'none'` to allow interaction on paths. Add an invisible wider hit area path behind each visible path, and a hover state:

Change the SVG style:
```tsx
pointerEvents: 'auto',
```

For each connection, add an invisible wider hit path before the visible path:

```tsx
{/* Invisible wide hit area */}
<path
  d={d}
  stroke="transparent"
  strokeWidth={16}
  fill="none"
  style={{ cursor: 'pointer' }}
  onMouseEnter={() => setHoveredConnectionId?.(conn.id)}
  onMouseLeave={() => setHoveredConnectionId?.(null)}
/>
```

Add `hoveredConnectionId` and `setHoveredConnectionId` as props to `ConnectionLines` and state to `BoardCanvas`.

When hovered, increase the visible path opacity to 0.7.

**Step 2: Commit**

```bash
git add src/components/commonplace/BoardCanvas.tsx
git commit -m "feat(commonplace): add connection hover interaction with wider hit areas"
```

---

## Task 8: Reduce compose button visual weight

**Files:**
- Modify: `src/components/commonplace/BoardCatalogSidebar.tsx`

**Step 1: Tone down the compose button**

Change the compose button from terracotta accent to a muted chrome style that doesn't dominate the sidebar:

```tsx
      <button
        type="button"
        onClick={() => setComposeActive(true)}
        style={{
          margin: '6px 8px',
          padding: '7px 0',
          borderRadius: 4,
          backgroundColor: 'var(--cp-chrome-raise)',
          border: '1px solid var(--cp-chrome-line)',
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--cp-chrome-muted)',
          cursor: 'pointer',
        }}
      >
        ✎ Compose
      </button>
```

**Step 2: Commit**

```bash
git add src/components/commonplace/BoardCatalogSidebar.tsx
git commit -m "fix(commonplace): reduce compose button visual weight in board sidebar"
```

---

## Task 9: Add "on board" indicator to catalog items

**Files:**
- Modify: `src/components/commonplace/BoardCatalogSidebar.tsx`

**Step 1: Add prop for placed item IDs**

Add to `BoardCatalogSidebarProps`:

```typescript
/** IDs of objects currently placed on the board */
placedObjectIds?: Set<number>;
```

**Step 2: Dim items already on board**

In `ObjectRow`, accept an `isOnBoard` prop. When true, dim the row and show a small badge:

```tsx
function ObjectRow({ obj, isOnBoard }: { obj: CatalogObject; isOnBoard?: boolean }) {
```

Add to the row style:

```tsx
opacity: isOnBoard ? 0.45 : 1,
```

After the drag handle, when `isOnBoard`:

```tsx
{isOnBoard && (
  <span
    style={{
      fontFamily: 'var(--cp-font-mono)',
      fontSize: 7,
      color: 'var(--cp-chrome-dim)',
      letterSpacing: '0.04em',
    }}
  >
    ON BOARD
  </span>
)}
```

**Step 3: Pass placedObjectIds from CommonPlaceSidebar**

In `CommonPlaceSidebar.tsx`, compute the set of placed object IDs from the layout context (demo for now):

```tsx
<BoardCatalogSidebar
  objects={boardCatalogObjects}
  components={boardCatalogComponents}
  onExitBoard={() => navigateToScreen('library')}
/>
```

**Step 4: Commit**

```bash
git add src/components/commonplace/BoardCatalogSidebar.tsx src/components/commonplace/CommonPlaceSidebar.tsx
git commit -m "feat(commonplace): dim catalog items already placed on board"
```

---

## Task 10: Verify frame button tooltip

**Files:**
- Verify: `src/components/commonplace/BoardView.tsx`

**Step 1: Confirm tooltip exists**

The [+] button already has `title="Save current layout as a frame"`. Verify it renders by hovering in the browser. No code change needed unless missing.

**Step 2: Run build verification**

```bash
npx tsc --noEmit
npm run dev
# Navigate to /commonplace > Models > Boards
# Verify all 10 fixes visually
```

**Step 3: Final commit**

```bash
git add .
git commit -m "fix(commonplace): board design polish (10 review items)"
```

---

## Summary

| Task | Finding | Fix |
|------|---------|-----|
| 1 | Tab bar title competes visually | Eliminate board title, use Vollkorn on all tabs |
| 2 | No way to exit board sidebar | Add "← CommonPlace" nav header |
| 3 | Dark chrome cards on parchment canvas | Warm tint-wash cards with `color-mix()` |
| 4 | No drop target feedback | Teal crosshair on catalog drag over canvas |
| 5 | Zoom controls buried in sidebar | Move to canvas bottom-right overlay |
| 6 | Catalog items not obviously draggable | Add ⠿ drag handle to every row |
| 7 | Connections not interactive | Wider hit areas + hover highlight |
| 8 | Compose button too prominent | Tone down to muted chrome style |
| 9 | No "on board" indicator in catalog | Dim + "ON BOARD" badge for placed items |
| 10 | Frame button tooltip | Verify existing title attribute |

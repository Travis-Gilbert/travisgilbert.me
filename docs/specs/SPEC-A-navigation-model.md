# Spec A: Navigation Model Migration

> **For Claude Code. Read entire spec before writing code.**
> **Run `npm run build` after every batch. Do not proceed if the build fails.**

## Architecture Summary

CommonPlace is migrating from a universal split-pane-with-tabs system to a
two-tier navigation model: **Screens** and **Views**.

**Screens** are full destinations. Clicking one replaces the entire content
area. They manage their own internal layout.

**Views** live inside a shared **pane workspace**. Views can be split
side-by-side, resized, and closed. The pane workspace uses a Smart launch
strategy (described below).

The tab system is removed entirely. Each pane holds exactly one view, not
an array of tabs.

### Navigation classification

| Item | Mode | Behavior |
|------|------|----------|
| Library | Screen | Full content area. Inline split on object click (list pushes left, detail slides in right). |
| Models | Screen | Full content area. Includes a "+ New Model" creation button in the header. |
| Notebooks | Screen | Full content area. List of notebooks, click opens notebook detail. |
| Projects | Screen | Full content area. List of projects, click opens project detail. |
| Engine | Screen | Full content area. Connection engine status and configuration. |
| Settings | Screen | Full content area. Workspace preferences and data management. |
| Timeline | View | Opens in pane workspace. |
| Map | View | Opens in pane workspace. |
| Calendar | View | Opens in pane workspace. |
| Loose Ends | View | Opens in pane workspace. |
| Compose | View | Opens in pane workspace. Has its own internal layout (editor + discovery dock + pass ribbon). |
| Resurface | View | Opens in pane workspace. |

### Smart launch strategy (pane workspace only)

When a user clicks a View item in the sidebar:

1. If the view is already open in a pane, focus that pane (no duplication).
2. If the pane workspace has one pane, replace its view.
3. If the pane workspace has multiple panes, replace the focused pane's view.
4. Shift-click always creates a new pane via vertical split (overrides rules 1-3).

### Fullscreen toggle

Every pane header includes a fullscreen button. When activated:
- The pane fills the entire pane workspace area.
- Sibling panes are hidden (not destroyed).
- The pane header shows a restore button.
- Pressing Escape or clicking restore returns to the split layout.

### Key design decisions

- No em dashes anywhere in code, comments, or copy.
- No tabs. The `PaneTab` type, `tabs: PaneTab[]`, `activeTabIndex`, and all
  tab management functions are removed.
- The sidebar is the sole view launcher. Pane headers have split, fullscreen,
  and close buttons only.
- The digitize particle animation on tab drops is removed (no tabs to drop).
- Layout presets are simplified: Focus (single pane), Research (two vertical
  panes), Studio (three panes).

---

## Batch 1: Layout type migration

### Read first
- `src/lib/commonplace-layout.ts`
- `src/lib/commonplace.ts` (ViewType, VIEW_REGISTRY, SIDEBAR_SECTIONS)
- `src/lib/commonplace-context.tsx`

### Changes to `src/lib/commonplace-layout.ts`

**Remove** these types and functions entirely:
- `PaneTab` interface
- `generateTabId()`
- `addTab()`
- `closeTab()`
- `closeTabOrPane()`
- `setActiveTab()`
- `moveTab()`
- All keyboard bindings related to tabs (`next-tab`, `prev-tab`, `close-tab`, `move-tab-left`, `move-tab-right`)

**Simplify `LeafPane`:**

```typescript
export interface LeafPane {
  type: 'leaf';
  id: string;
  viewId: ViewType;
  /** Optional context: object ID, notebook slug, filter config */
  context?: Record<string, unknown>;
  /** If true, this pane is in fullscreen mode */
  fullscreen?: boolean;
}
```

No `tabs` array. No `activeTabIndex`. One view per pane.

**Add** new functions:

```typescript
/** Replace a leaf pane's view */
export function replaceView(
  tree: PaneNode,
  paneId: string,
  viewId: ViewType,
  context?: Record<string, unknown>,
): PaneNode {
  if (tree.type === 'leaf' && tree.id === paneId) {
    return { ...tree, viewId, context };
  }
  if (tree.type === 'split') {
    return {
      ...tree,
      first: replaceView(tree.first, paneId, viewId, context),
      second: replaceView(tree.second, paneId, viewId, context),
    };
  }
  return tree;
}

/** Find the first leaf pane with a given viewId */
export function findLeafWithView(
  tree: PaneNode,
  viewId: ViewType,
): LeafPane | null {
  if (tree.type === 'leaf') {
    return tree.viewId === viewId ? tree : null;
  }
  return findLeafWithView(tree.first, viewId)
    ?? findLeafWithView(tree.second, viewId);
}

/** Toggle fullscreen on a pane */
export function toggleFullscreen(
  tree: PaneNode,
  paneId: string,
): PaneNode {
  if (tree.type === 'leaf' && tree.id === paneId) {
    return { ...tree, fullscreen: !tree.fullscreen };
  }
  if (tree.type === 'split') {
    return {
      ...tree,
      first: toggleFullscreen(tree.first, paneId),
      second: toggleFullscreen(tree.second, paneId),
    };
  }
  return tree;
}
```

**Update `createLeaf`:**

```typescript
export function createLeaf(
  viewId: ViewType = 'empty',
  context?: Record<string, unknown>,
): LeafPane {
  return {
    type: 'leaf',
    id: generatePaneId(),
    viewId,
    context,
  };
}
```

**Update presets** to use simplified leaf structure (no `tabs` arrays).

**Update `serializeLayout` / `deserializeLayout`** to handle the new shape.

**Update `shouldDiscardPersistedLayout`** to check `viewId` instead of tabs.

### Changes to `src/lib/commonplace.ts`

**Add navigation mode to SIDEBAR_SECTIONS:**

```typescript
export type NavMode = 'screen' | 'view';

export interface SidebarItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  expandable?: boolean;
  children?: SidebarItem[];
  navMode: NavMode;
  viewType?: ViewType;
  viewContext?: Record<string, unknown>;
}
```

Update `SIDEBAR_SECTIONS` so that Library, Models, Notebooks, Projects, Engine,
Settings have `navMode: 'screen'`. Timeline, Map, Calendar, Loose Ends, Compose,
Resurface have `navMode: 'view'`.

### Changes to `src/lib/commonplace-context.tsx`

**Add to context state:**

```typescript
/** Which navigation mode is active: 'screen' or 'pane-workspace' */
activeNavMode: NavMode;
/** Which screen is active (when navMode is 'screen') */
activeScreen: string | null;
/** The pane workspace layout tree (preserved when switching to a screen) */
paneLayout: PaneNode;
```

**Replace `requestView` with a two-path launcher:**

```typescript
function navigate(item: SidebarItem) {
  if (item.navMode === 'screen') {
    setActiveNavMode('screen');
    setActiveScreen(item.label);
    // Pane layout is preserved in state, not destroyed
  } else {
    setActiveNavMode('pane-workspace');
    // Apply Smart launch strategy to paneLayout
    smartLaunch(item.viewType!, item.viewContext);
  }
}
```

**Implement Smart launch:**

```typescript
function smartLaunch(
  viewId: ViewType,
  context?: Record<string, unknown>,
  forcesSplit?: boolean,
) {
  setPaneLayout(prev => {
    const leaves = collectLeafIds(prev);

    // Shift-click: force split
    if (forcesSplit) {
      const targetId = focusedPaneId ?? leaves[0];
      return splitLeaf(prev, targetId, 'vertical', viewId);
    }

    // Check if view already exists
    const existing = findLeafWithView(prev, viewId);
    if (existing) {
      setFocusedPaneId(existing.id);
      return prev;
    }

    // Single pane: replace
    if (leaves.length === 1) {
      return replaceView(prev, leaves[0], viewId, context);
    }

    // Multiple panes: replace focused
    const targetId = focusedPaneId ?? leaves[0];
    return replaceView(prev, targetId, viewId, context);
  });
}
```

### Verification
- [ ] `PaneTab` type is fully removed
- [ ] `LeafPane` has `viewId` instead of `tabs[]`
- [ ] Smart launch logic works (replace, focus existing, force split)
- [ ] Fullscreen toggle function exists
- [ ] Layout presets use new shape
- [ ] `npm run build` passes

---

## Batch 2: Root layout and screen router

### Read first
- `src/app/(commonplace__)/layout.tsx`
- `src/components/commonplace/SplitPaneContainer.tsx`

### Changes to root layout

The root layout currently renders:
```
Sidebar | SplitPaneContainer
```

Change to:
```
Sidebar | ContentRouter
```

Where `ContentRouter` switches between screen components and the pane workspace
based on `activeNavMode` from context:

```typescript
function ContentRouter() {
  const { activeNavMode, activeScreen } = useCommonPlace();

  if (activeNavMode === 'screen') {
    return <ScreenRouter screen={activeScreen} />;
  }

  return <PaneWorkspace />;
}
```

`ScreenRouter` renders the appropriate screen component:

```typescript
function ScreenRouter({ screen }: { screen: string | null }) {
  switch (screen) {
    case 'Library': return <LibraryScreen />;
    case 'Models': return <ModelsScreen />;
    case 'Notebooks': return <NotebookListView />;
    case 'Projects': return <ProjectListView />;
    case 'Engine': return <EngineScreen />;
    case 'Settings': return <SettingsScreen />;
    default: return <LibraryScreen />;
  }
}
```

`PaneWorkspace` is the simplified `SplitPaneContainer` (Batch 3).

### New file: `src/components/commonplace/LibraryScreen.tsx`

Wraps the existing `LibraryView` with an inline split for object detail.
When a user clicks an object in the library list:
- The list narrows to ~40% width.
- An `ObjectDetailView` slides in from the right at ~60% width.
- A close button on the detail view restores the list to full width.

This is a designed layout, not user-managed panes.

### New file: `src/components/commonplace/ModelsScreen.tsx`

Wraps the existing `ModelListPane` with a "+ New Model" button in the header.
The button opens a creation form (inline or modal).

### Verification
- [ ] Clicking Library, Models, etc. renders full-screen components
- [ ] Clicking Timeline, Map, etc. renders the pane workspace
- [ ] Switching from screen to pane-workspace preserves pane state
- [ ] Library inline split works (click object, detail slides in)
- [ ] Models screen has a "+ New Model" button
- [ ] `npm run build` passes

---

## Batch 3: Simplified SplitPaneContainer (PaneWorkspace)

### Read first
- `src/components/commonplace/SplitPaneContainer.tsx` (the 51KB file)

### Strategy

This is a simplification pass. We are removing:
- All tab bar rendering (`PaneTabBar` component and its children)
- Tab drag-and-drop between panes
- The `TabDigitizeOverlay` component (particle animation)
- The view picker dropdown (`showViewPicker` state)
- All `onMoveTab`, `onAddTab`, `onCloseTab`, `onSetActiveTab` callbacks
- Tab-related keyboard shortcuts

We are keeping:
- The recursive `RenderNode` / `RenderSplit` / `RenderLeaf` structure
- `DragHandle` for pane resizing
- `PaneDotGrid` for the canvas background
- The mobile shell adaptation
- `LayoutPresetSelector`

We are adding:
- Simple pane header (view label + split + fullscreen + close)
- Fullscreen mode rendering (when a pane has `fullscreen: true`, render only
  that pane; hide siblings)

### New pane header

Replace the entire `PaneTabBar` component tree with:

```typescript
function PaneHeader({
  viewId,
  paneId,
  isFocused,
  isFullscreen,
  leafCount,
  onSplitV,
  onSplitH,
  onToggleFullscreen,
  onClosePane,
}: PaneHeaderProps) {
  const view = VIEW_REGISTRY[viewId] || { label: viewId, icon: 'doc' };

  return (
    <div className={`cp-pane-header${isFocused ? ' cp-pane-header--focused' : ''}`}>
      <SidebarIcon name={view.icon} />
      <span className="cp-pane-header-label">{view.label}</span>
      <div className="cp-pane-header-actions">
        <button onClick={onSplitV} title="Split vertical">
          {/* split icon */}
        </button>
        <button onClick={onSplitH} title="Split horizontal">
          {/* splitH icon */}
        </button>
        <button onClick={onToggleFullscreen}
          title={isFullscreen ? 'Restore' : 'Fullscreen'}>
          {/* expand/collapse icon */}
        </button>
        {leafCount > 1 && (
          <button onClick={onClosePane} title="Close pane">
            {/* close icon */}
          </button>
        )}
      </div>
    </div>
  );
}
```

Height: 28px. Background: chrome (focused: chromeMid). Bottom border: focused
panes get 2px red-pencil accent.

### Fullscreen rendering

In `RenderNode`, check if any leaf in the tree has `fullscreen: true`. If so,
render only that leaf at full size. The rest of the tree is preserved in state
but not rendered.

```typescript
function PaneWorkspace() {
  const { paneLayout, focusedPaneId, ... } = useCommonPlace();

  // Check for fullscreen pane
  const fullscreenLeaf = findFullscreenLeaf(paneLayout);
  if (fullscreenLeaf) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <RenderLeaf node={fullscreenLeaf} ... />
      </div>
    );
  }

  // Normal split rendering
  return (
    <div style={{ flex: 1, display: 'flex' }}>
      <RenderNode node={paneLayout} ... />
    </div>
  );
}
```

### CSS changes

Remove all `cp-drawer-tab-*` classes from `commonplace.css`. Add:

```css
.cp-pane-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px 0 10px;
  height: 28px;
  flex-shrink: 0;
  background: var(--cp-chrome);
  border-bottom: 1px solid var(--cp-chrome-line);
  transition: background 120ms, border-color 120ms;
}

.cp-pane-header--focused {
  background: var(--cp-chrome-mid);
  border-bottom: 2px solid var(--cp-red);
}

.cp-pane-header-label {
  font-family: var(--cp-font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--cp-chrome-muted);
  flex: 1;
}

.cp-pane-header--focused .cp-pane-header-label {
  color: var(--cp-chrome-text);
}
```

### Verification
- [ ] Tab bar is fully removed from pane rendering
- [ ] Each pane shows the simplified header (label + split + fullscreen + close)
- [ ] Focused pane has red-pencil accent border
- [ ] Fullscreen toggle works (expands pane, hides siblings, restores)
- [ ] Escape key restores from fullscreen
- [ ] Pane resizing still works via DragHandle
- [ ] PaneDotGrid still renders behind pane content
- [ ] `npm run build` passes

---

## Batch 4: Sidebar updates

### Read first
- `src/components/commonplace/CommonPlaceSidebar.tsx`

### Changes

**Sidebar items call `navigate()` instead of `requestView()`.**

Items with `navMode: 'screen'` trigger screen navigation. Items with
`navMode: 'view'` trigger Smart launch into the pane workspace.

**Active indicators:**

Screens: the active screen's sidebar item gets a solid highlight background.

Views: items whose viewId is currently open in a pane get a red dot indicator.
If the focused pane matches the item, the icon turns red.

**Shift-click detection:**

```typescript
onClick={(e) => {
  if (item.navMode === 'view') {
    smartLaunch(item.viewType!, item.viewContext, e.shiftKey);
  } else {
    navigate(item);
  }
}}
```

**Collapsed rail mode:**

Update the `railItems` array to use the new navigation classification.
Screen items and view items both appear in the rail; clicking them calls
`navigate()` with the appropriate mode.

### Verification
- [ ] Screen items navigate to full-screen components
- [ ] View items launch into the pane workspace
- [ ] Active screen has solid highlight in sidebar
- [ ] Active views have red dot indicator
- [ ] Focused view has red-tinted icon
- [ ] Shift-click on view items force-splits
- [ ] Collapsed rail mode works correctly
- [ ] `npm run build` passes

---

## Batch 5: Keyboard shortcuts and cleanup

### Read first
- `src/lib/commonplace-layout.ts` (KEY_BINDINGS)
- `src/components/commonplace/SplitPaneContainer.tsx` (keyboard handler)

### Updated key bindings

Remove all tab-related bindings. Keep pane-related bindings:

| Key | Action |
|-----|--------|
| Ctrl+\\ | Split focused pane horizontal |
| Ctrl+- | Split focused pane vertical |
| Ctrl+Shift+W | Close focused pane |
| Ctrl+Alt+1 | Focus preset |
| Ctrl+Alt+2 | Research preset |
| Ctrl+Alt+3 | Studio preset |
| Alt+[ | Shrink split ratio |
| Alt+] | Grow split ratio |
| Escape | Exit fullscreen (if active) |

### Cleanup

- Remove `TabDigitizeOverlay` component entirely
- Remove `tabDropAnim` / `onTabDropAnim` / `dragSourceRef` props from RenderNode
- Remove all `onMoveTab` plumbing
- Remove `TAB_DROP_PALETTE`, `TAB_DROP_SPRING`, `MACHINE_CHARS` constants
- Update localStorage version key to force layout reset

### Verification
- [ ] All tab-related code is removed
- [ ] Keyboard shortcuts work for pane operations
- [ ] Escape exits fullscreen
- [ ] localStorage version forces fresh layout on existing users
- [ ] No TypeScript errors from removed tab types
- [ ] `npm run build` passes

---

## Build Order Summary

```
Batch 1: Layout type migration (remove tabs from types, add Smart launch)
Batch 2: Root layout and screen router (ContentRouter, LibraryScreen, ModelsScreen)
Batch 3: Simplified SplitPaneContainer (remove tab bar, add pane header + fullscreen)
Batch 4: Sidebar updates (navigate(), active indicators, shift-click)
Batch 5: Keyboard shortcuts and cleanup (remove all tab remnants)
```

Run `npm run build` after EACH batch. Do not proceed if the build fails.
Fix errors in the current batch before moving on.
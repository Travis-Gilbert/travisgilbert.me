# Spec B: Component Toolbox and Draggable Components

> **For Claude Code. Read entire spec before writing code.**
> **Depends on Spec A being landed. Do not start until Spec A builds clean.**
> **Run `npm run build` after every batch. Do not proceed if the build fails.**

## Architecture Summary

The Component Toolbox is a collapsible section at the bottom of the sidebar.
It displays available component types as draggable tiles in a 2-column grid.
Users drag component tiles onto object cards to attach that component type
to the object.

Components are user-facing building blocks: terminals, photo collections,
cluster graphs, tasks, notes, reminders, timelines. They are distinct from
engine output (evidence links, claims, tensions), which surfaces through
the tag system (Spec C).

### Component types

| ID | Label | Icon | Color | Description |
|----|-------|------|-------|-------------|
| terminal | Terminal | term | #2D5F6B (teal) | Engine analysis scoped to this object |
| photos | Photos | img | #C49A4A (amber) | Image collection strip/grid |
| cluster | Cluster | graph | #7050A0 (purple) | Nearest connections mini-graph |
| tasks | Tasks | check | #B85C28 (orange) | Checklist component |
| notes | Notes | edit | #78767E (ink3) | Rich text notes block |
| reminder | Reminder | bell | #C4503C (red) | Time-triggered resurface |
| timeline | Timeline | clock | #3858B8 (blue) | Scoped event timeline |

Evidence is NOT in this list. Evidence is an engine output that surfaces
through the tag system (Spec C).

### Key design decisions

- No em dashes anywhere in code, comments, or copy.
- The toolbox lives in the sidebar, not in each pane.
- Drag source is the sidebar toolbox tile.
- Drop target is any object card in any visible screen or pane.
- Components attach to objects via the existing Component API.
- Object-scoped terminals use `TerminalCanvas` with near-black base (#1A1C22)
  and subtle teal radial gradient from bottom-left corner.

---

## Batch 1: Toolbox UI in sidebar

### Read first
- `src/components/commonplace/CommonPlaceSidebar.tsx`
- `src/styles/commonplace.css`

### New constant: `COMPONENT_TOOLBOX`

Add to `src/lib/commonplace-components.ts`:

```typescript
export interface ComponentToolboxItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  apiTypeName: string;
}

export const COMPONENT_TOOLBOX: ComponentToolboxItem[] = [
  { id: 'terminal',  label: 'Terminal',  icon: 'term',  color: '#2D5F6B', description: 'Engine analysis scoped to this object', apiTypeName: 'terminal' },
  { id: 'photos',    label: 'Photos',    icon: 'img',   color: '#C49A4A', description: 'Image collection', apiTypeName: 'file' },
  { id: 'cluster',   label: 'Cluster',   icon: 'graph', color: '#7050A0', description: 'Nearest connections mini-graph', apiTypeName: 'cluster' },
  { id: 'tasks',     label: 'Tasks',     icon: 'check', color: '#B85C28', description: 'Checklist', apiTypeName: 'task' },
  { id: 'notes',     label: 'Notes',     icon: 'edit',  color: '#78767E', description: 'Rich text notes block', apiTypeName: 'text' },
  { id: 'reminder',  label: 'Reminder',  icon: 'bell',  color: '#C4503C', description: 'Time-triggered resurface', apiTypeName: 'reminder' },
  { id: 'timeline',  label: 'Timeline',  icon: 'clock', color: '#3858B8', description: 'Scoped event timeline', apiTypeName: 'timeline' },
];
```

### Sidebar addition

Add a collapsible "Toolbox" section above the "travisgilbert.me" back link.
2-column CSS grid, 4px gap. Each tile is `draggable` with `onDragStart`
setting `dataTransfer.setData('component-type', comp.id)`.

Store open/closed state in localStorage key `cp-toolbox-open`.

### CSS

```css
.cp-toolbox-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--cp-font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--cp-chrome-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: left;
}

.cp-toolbox-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 0 8px 8px;
  max-height: 200px;
  overflow-y: auto;
}

.cp-toolbox-tile {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 6px;
  border-radius: 4px;
  cursor: grab;
  border: 1px solid var(--cp-chrome-line);
  background: var(--cp-chrome-mid);
  font-family: var(--cp-font-mono);
  font-size: 10px;
  color: var(--cp-chrome-text);
  transition: background 100ms, border-color 100ms;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-toolbox-tile:hover {
  border-color: var(--cp-chrome-muted);
  background: var(--cp-chrome-raise);
}

.cp-toolbox-tile:active {
  cursor: grabbing;
}

.cp-toolbox-tile[data-dragging="true"] {
  opacity: 0.6;
}
```

### Verification
- [ ] Toolbox section appears at bottom of sidebar
- [ ] Collapsible toggle works
- [ ] 7 component tiles render in 2-column grid
- [ ] Tiles are draggable (browser shows drag ghost)
- [ ] Open/closed state persists across page loads
- [ ] `npm run build` passes

---

## Batch 2: Drop targets on object cards

### Read first
- `src/components/commonplace/objects/ObjectRenderer.tsx`
- `src/components/commonplace/LibraryView.tsx`
- `src/lib/commonplace-api.ts`

### Drop zone hook

```typescript
// src/hooks/useComponentDrop.ts
export function useComponentDrop(objectId: number) {
  const [dragOver, setDragOver] = useState(false);

  const handlers = {
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('component-type')) {
        e.preventDefault();
        setDragOver(true);
      }
    },
    onDragLeave: () => setDragOver(false),
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault();
      const componentType = e.dataTransfer.getData('component-type');
      if (componentType) {
        await attachComponent(objectId, componentType);
      }
      setDragOver(false);
    },
  };

  return { dragOver, handlers };
}
```

### API functions

Add to `src/lib/commonplace-api.ts`:

```typescript
export async function attachComponent(
  objectId: number,
  componentTypeName: string,
  initialValue?: string,
): Promise<ApiComponent> {
  const res = await fetch(`${API_BASE}/objects/${objectId}/components/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      component_type_name: componentTypeName,
      value: initialValue ?? '',
    }),
  });
  if (!res.ok) throw new Error('Failed to attach component');
  return res.json();
}

export async function detachComponent(componentId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/components/${componentId}/`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to detach component');
}
```

### Visual feedback

When `dragOver` is true:
- Teal dashed outline (2px, `outline-offset: -2px`)
- Background tint: `rgba(45, 95, 107, 0.08)`
- "Drop to attach component" label (mono 9px, teal, uppercase)

On successful drop: toast "Attached {component label} to {object title}".

### Verification
- [ ] Dragging a toolbox tile over an object card highlights it
- [ ] Dropping attaches the component via API
- [ ] Toast confirms the attachment
- [ ] Drop zones work in Library, Grid, and Timeline views
- [ ] Non-component drags do not trigger the drop zone
- [ ] `npm run build` passes

---

## Batch 3: Inline component renderers

### Read first
- `src/components/commonplace/TerminalCanvas.tsx`
- `src/components/commonplace/ObjectDrawer.tsx` (ComponentList section)

### New directory: `src/components/commonplace/components/`

### `MiniTerminal.tsx`

Object-scoped terminal. Dark background (#1A1C22) with subtle teal radial
gradient bloom from bottom-left (matching TerminalCanvas: `rgba(45,95,107,0.14)`
to transparent over 60% of the area).

- Header: dark bg, green status dot, "TERMINAL" mono 9px uppercase, "scoped"
  right-aligned, close button.
- Body: 3-4 lines of engine pass output. Each line: pass name in pass color,
  message in terminal text color.
- Data: `GET /api/v1/notebook/objects/{id}/engine-log/` (scoped).
  Falls back to mock data if endpoint unavailable.
- Width: 100% of card. Border: 1px solid terminal border.

### `MiniCluster.tsx`

Nearest-connections mini-graph.

- Header: vellum bg, graph icon in purple, "Cluster" label, count.
- Body: SVG viewBox="0 0 100 80". Center node at (50, 40), r=6, type color.
  Connected nodes radially positioned, r=3-4, type colors. Lines at 0.5px.
- Data: object's top N edges by strength (from detail API).
- Max 8 connections. Clickable nodes (open in drawer).

### `MiniPhotos.tsx`

Photo collection strip.

- Header: vellum bg, image icon in amber, "Photos" label, count.
- Body: horizontal flex row of 36px square thumbnails, 2px gap.
- Data: file-type components attached to the object.
- Click thumbnail for lightbox.

### `ComponentRenderer.tsx`

Registry mapping component type IDs to renderers:

```typescript
const RENDERERS: Record<string, React.ComponentType<InlineComponentProps>> = {
  terminal: MiniTerminal,
  cluster: MiniCluster,
  photos: MiniPhotos,
};
```

Types not in the registry render as a generic badge (icon + label pill).

### Integration

Object cards check their `components` array and render matching inline
renderers below the body text.

### Verification
- [ ] MiniTerminal renders with dark bg and teal bloom
- [ ] MiniCluster renders SVG mini-graph with real edge data
- [ ] MiniPhotos renders horizontal thumbnail strip
- [ ] All have working close/remove buttons
- [ ] Components appear inline after drag-and-drop
- [ ] `npm run build` passes

---

## Build Order Summary

```
Batch 1: Toolbox UI in sidebar (tiles, grid, drag start)
Batch 2: Drop targets on object cards (drop zone, API, feedback)
Batch 3: Inline component renderers (MiniTerminal, MiniCluster, MiniPhotos)
```

Run `npm run build` after EACH batch.
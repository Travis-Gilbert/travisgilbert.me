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
- **Framer Motion drag** instead of native HTML drag-and-drop (see rationale).
- Drop target is any object card in any visible screen or pane.
- Components attach to objects via the existing Component API.
- Object-scoped terminals use `TerminalCanvas` with near-black base (#1A1C22)
  and subtle teal radial gradient from bottom-left corner.

### Why Framer Motion drag instead of native HTML

Native HTML drag-and-drop uses an unstyleable browser ghost image, fires
erratic `dragleave` events on child elements (causing drop zone flickering),
has no return animation on invalid drops, and behaves inconsistently on
touch devices. Framer Motion is already in the bundle (`framer-motion` is
used throughout SplitPaneContainer, AnimatePresence, etc.). Framer drag
gives us:

- The actual tile follows the cursor with spring physics.
- Full visual control: scale, shadow, tint during drag.
- Smooth spring-back animation on invalid drops.
- Identical behavior on touch and pointer devices.
- Drop detection via `document.elementFromPoint()` instead of the browser's
  buggy drop target system.

---

## Batch 1: Toolbox UI in sidebar with Framer Motion drag

### Read first
- `src/components/commonplace/CommonPlaceSidebar.tsx`
- `src/styles/commonplace.css`
- `src/lib/commonplace-context.tsx` (for shared drag state)

### New constant file: `src/lib/commonplace-components.ts`

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

### Shared drag state in context

Add to `CommonPlaceProvider` (or a dedicated `ComponentDragProvider`):

```typescript
/** Currently dragged component type ID, or null */
const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
```

This is shared so that object cards anywhere in the app can react to an
active drag (showing drop zone highlights) without prop drilling.

### Sidebar toolbox section

Add between the sidebar navigation and the "travisgilbert.me" back link.

Collapsible header: "TOOLBOX" in mono 10px uppercase, chevron, count badge.
Open/closed state stored in localStorage key `cp-toolbox-open`.

2-column CSS grid. Each tile is a Framer Motion `<motion.div>`:

```typescript
import { motion } from 'framer-motion';

function ToolboxTile({ comp }: { comp: ComponentToolboxItem }) {
  const { setDraggedComponent } = useCommonPlace();

  return (
    <motion.div
      className="cp-toolbox-tile"
      title={comp.description}
      drag
      dragSnapToOrigin    // springs back if dropped on invalid target
      dragElastic={0.15}  // slight rubber band feel
      dragMomentum={false}
      whileDrag={{
        scale: 0.9,
        boxShadow: `0 4px 16px ${comp.color}44`,
        zIndex: 9999,
        cursor: 'grabbing',
      }}
      onDragStart={() => setDraggedComponent(comp.id)}
      onDragEnd={(event, info) => {
        // Hit-test: find the object card under the pointer
        const target = document.elementFromPoint(
          info.point.x,
          info.point.y,
        );
        const card = target?.closest('[data-object-id]');
        if (card) {
          const objectId = Number(card.getAttribute('data-object-id'));
          if (!isNaN(objectId)) {
            handleComponentDrop(objectId, comp.id);
          }
        }
        setDraggedComponent(null);
      }}
      style={{ position: 'relative', zIndex: 1 }}
    >
      <Icon name={comp.icon} size={11} color={comp.color} />
      <span>{comp.label}</span>
    </motion.div>
  );
}
```

Key behaviors:
- `dragSnapToOrigin` makes the tile spring back to its sidebar position if
  dropped outside a valid target. No manual reset needed.
- `whileDrag` scales the tile down slightly and adds a colored shadow matching
  the component's identity color.
- `onDragEnd` uses `document.elementFromPoint()` with the pointer coordinates
  from Framer's `info.point` to find the nearest `[data-object-id]` element.
- The shared `draggedComponent` context state allows object cards to show
  drop zone indicators while a drag is active.

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
  touch-action: none;  /* required for Framer drag on touch devices */
}

.cp-toolbox-tile:hover {
  border-color: var(--cp-chrome-muted);
  background: var(--cp-chrome-raise);
}
```

### Verification
- [ ] Toolbox section appears at bottom of sidebar
- [ ] Collapsible toggle works, state persists in localStorage
- [ ] 7 component tiles render in 2-column grid
- [ ] Tiles follow the cursor when dragged (Framer Motion)
- [ ] Tiles scale down and show colored shadow while dragging
- [ ] Tiles spring back to sidebar position on invalid drop
- [ ] Drag works on touch devices
- [ ] `npm run build` passes

---

## Batch 2: Drop targets on object cards

### Read first
- `src/components/commonplace/objects/ObjectRenderer.tsx`
- `src/components/commonplace/LibraryView.tsx`
- `src/lib/commonplace-api.ts`
- `src/lib/commonplace-context.tsx` (draggedComponent state from Batch 1)

### Object card drop zone attribute

Every object card must include a `data-object-id` attribute on its outermost
DOM element. This is what the Framer drag `onDragEnd` handler uses to identify
the drop target via `document.elementFromPoint()`.

Update all polymorphic renderers (NoteCard, SourceCard, PersonPill, etc.):

```typescript
<div
  className="cp-object-card"
  data-object-id={object.id}
  // ... existing props
>
```

### Visual drop zone feedback

Object cards read `draggedComponent` from context. When a component drag is
active, cards show a receptive state:

```typescript
function ObjectCard({ object, ... }) {
  const { draggedComponent } = useCommonPlace();
  const [pointerInside, setPointerInside] = useState(false);
  const isDropTarget = draggedComponent !== null;

  return (
    <div
      className={cn(
        'cp-object-card',
        isDropTarget && 'cp-object-card--receptive',
        isDropTarget && pointerInside && 'cp-object-card--hover-drop',
      )}
      data-object-id={object.id}
      onPointerEnter={() => isDropTarget && setPointerInside(true)}
      onPointerLeave={() => setPointerInside(false)}
    >
      {/* card content */}
      {isDropTarget && pointerInside && (
        <div className="cp-drop-label">Drop to attach component</div>
      )}
    </div>
  );
}
```

Note: we use `onPointerEnter`/`onPointerLeave` instead of the native drag
events. These fire reliably during Framer Motion drags because Framer uses
pointer events internally, and the dragged element has `pointer-events: none`
set by Framer during drag. That means the pointer events fire on the elements
*underneath* the dragged tile, which is exactly what we want.

### CSS

```css
/* Subtle receptive state: all cards gently signal they accept drops */
.cp-object-card--receptive {
  transition: outline 150ms, background 150ms;
}

/* Active hover: this specific card is the target */
.cp-object-card--hover-drop {
  outline: 2px dashed #2D5F6B;
  outline-offset: -2px;
  background: rgba(45, 95, 107, 0.08);
}

.cp-drop-label {
  font-family: var(--cp-font-mono);
  font-size: 9px;
  color: #2D5F6B;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-top: 6px;
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

### Drop handler (in context or shared utility)

```typescript
async function handleComponentDrop(objectId: number, componentTypeId: string) {
  const comp = COMPONENT_TOOLBOX.find(c => c.id === componentTypeId);
  if (!comp) return;

  try {
    await attachComponent(objectId, comp.apiTypeName);
    toast.success(`Attached ${comp.label}`);
    // Trigger refetch of the object's components
    notifyComponentChange(objectId);
  } catch {
    toast.error(`Could not attach ${comp.label}`);
  }
}
```

### Verification
- [ ] All object cards have `data-object-id` attribute
- [ ] Cards show dashed outline when pointer enters during drag
- [ ] "Drop to attach component" label appears on hover-drop
- [ ] Dropping attaches the component via API
- [ ] Toast confirms the attachment
- [ ] Failed API calls show error toast
- [ ] Drop detection works across Library, Grid, and Timeline views
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
renderers below the body text. New components fade in using Framer Motion:

```typescript
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
>
  <ComponentRenderer type={compId} ... />
</motion.div>
```

### Verification
- [ ] MiniTerminal renders with dark bg and teal bloom
- [ ] MiniCluster renders SVG mini-graph with real edge data
- [ ] MiniPhotos renders horizontal thumbnail strip
- [ ] All have working close/remove buttons
- [ ] Components fade in smoothly after drag-and-drop attachment
- [ ] Components appear inline on object cards
- [ ] `npm run build` passes

---

## Build Order Summary

```
Batch 1: Toolbox UI with Framer Motion drag (tiles, grid, spring-back)
Batch 2: Drop targets on object cards (pointer hit-test, API, feedback)
Batch 3: Inline component renderers (MiniTerminal, MiniCluster, MiniPhotos)
```

Run `npm run build` after EACH batch.
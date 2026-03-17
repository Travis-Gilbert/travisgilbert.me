# Spec D: Drag-and-Drop Feel Improvements

> **For Claude Code. Read entire spec before writing code.**
> **Depends on Spec A and Spec B being landed.**
> **Run `npm run build` after every batch. Do not proceed if the build fails.**

## Architecture Summary

This spec improves the physical feel of drag-and-drop interactions across
CommonPlace. Modularity is a first-class feature; the drag-and-drop system
should communicate this through animation and visual feedback.

Three areas of improvement:

1. **Component drag**: Dragging toolbox tiles onto objects should feel like
   attaching a module to a workpiece.
2. **Pane split zones**: When hovering split buttons, show where the split
   will occur.
3. **Object reorder**: Smooth layout animations when cards shift position.

### Key design decisions

- No em dashes anywhere in code, comments, or copy.
- All animations respect `prefers-reduced-motion`.
- Animations are short (150-300ms) and functional, not decorative.
- Use CSS transitions and Framer Motion. No heavy physics libraries.

---

## Batch 1: Component absorption animation

### Read first
- `src/components/commonplace/objects/` (card components)
- `src/hooks/useComponentDrop.ts` (from Spec B)
- `src/styles/commonplace.css`

### Behavior

When a toolbox component tile is dropped onto an object card:

1. The object card pulses briefly: a soft glow expands from the drop point
   and fades (150ms). The glow color matches the component's color.
2. The new component renderer fades in at the bottom of the card (200ms
   ease-out, opacity 0 to 1, translateY 8px to 0).
3. A toast appears confirming the attachment.

### Implementation

In `useComponentDrop`, after the successful API call, set a transient
`justAttached` state with the component color. Clear it after 300ms.

```typescript
const [justAttached, setJustAttached] = useState<string | null>(null);

// After successful drop
setJustAttached(componentColor);
setTimeout(() => setJustAttached(null), 300);
```

The object card renders a glow overlay when `justAttached` is set:

```css
.cp-object-card--absorbing::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  animation: cp-absorb 300ms ease-out forwards;
}

@keyframes cp-absorb {
  0% { box-shadow: inset 0 0 0 2px var(--absorb-color); opacity: 0.8; }
  100% { box-shadow: inset 0 0 20px 4px var(--absorb-color); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .cp-object-card--absorbing::after { animation: none; }
}
```

The new component renderer uses Framer Motion:

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
- [ ] Drop triggers a visible glow pulse on the card
- [ ] Glow color matches the dropped component type
- [ ] New component fades in smoothly
- [ ] Animation is skipped when prefers-reduced-motion is set
- [ ] `npm run build` passes

---

## Batch 2: Pane split zone indicators

### Read first
- Post-Spec-A pane workspace components
- `src/components/commonplace/DragHandle.tsx`

### Behavior

When hovering the split-vertical or split-horizontal button in a pane header,
show a preview overlay on the appropriate half of the pane:

- **Vertical split button hover**: Right half of the pane dims with a faint
  teal overlay (`rgba(45,95,107,0.06)`) and a 1px dashed border (#2D5F6B).
  A "New pane" label appears centered in the preview zone (mono 9px).
- **Horizontal split button hover**: Bottom half gets the same treatment.

On click (split action): the preview becomes the actual pane with a brief
expand animation (200ms).

### Implementation

Add `onMouseEnter`/`onMouseLeave` to the split buttons that set a transient
`splitPreview` state on the pane:

```typescript
const [splitPreview, setSplitPreview] = useState<'vertical' | 'horizontal' | null>(null);
```

Render the preview overlay inside the pane:

```css
.cp-split-preview {
  position: absolute;
  z-index: 10;
  pointer-events: none;
  background: rgba(45, 95, 107, 0.06);
  border: 1px dashed #2D5F6B;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 100ms;
}

.cp-split-preview--vertical {
  top: 0;
  right: 0;
  bottom: 0;
  width: 50%;
}

.cp-split-preview--horizontal {
  left: 0;
  right: 0;
  bottom: 0;
  height: 50%;
}

@media (prefers-reduced-motion: reduce) {
  .cp-split-preview { transition: none; }
}
```

### Verification
- [ ] Hovering split-vertical shows right-half preview
- [ ] Hovering split-horizontal shows bottom-half preview
- [ ] Preview disappears on mouse leave
- [ ] Preview transitions smoothly
- [ ] `npm run build` passes

---

## Batch 3: Drag handle refinement

### Read first
- `src/components/commonplace/DragHandle.tsx`

### Behavior

Improve the existing pane resize handle:

1. **Hover state**: Show a grip indicator (three dots, 2px each, 4px apart)
   centered on the handle. Expand visual hit area.
2. **Active state**: Handle turns red-pencil color (#C4503C at 22% opacity).
   A floating readout appears showing the ratio: "52% / 48%" in mono 9px.
3. **Snap points**: When the ratio is within 2% of 33%, 50%, or 67%,
   snap to that value.

### CSS

```css
.cp-drag-handle {
  position: relative;
  flex-shrink: 0;
  background: var(--cp-chrome-line);
  transition: background 100ms;
}

.cp-drag-handle:hover {
  background: var(--cp-chrome-muted);
}

.cp-drag-handle--dragging {
  background: rgba(196, 80, 60, 0.22);
}

.cp-drag-handle-grip {
  position: absolute;
  opacity: 0;
  transition: opacity 100ms;
  pointer-events: none;
}

.cp-drag-handle:hover .cp-drag-handle-grip {
  opacity: 0.4;
}

.cp-drag-readout {
  position: absolute;
  font-family: var(--cp-font-mono);
  font-size: 9px;
  color: var(--cp-chrome-text);
  background: var(--cp-chrome-mid);
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
  white-space: nowrap;
}
```

### Snap logic

```typescript
const SNAP_POINTS = [0.33, 0.5, 0.67];
const SNAP_THRESHOLD = 0.02;

function snapRatio(raw: number): number {
  for (const snap of SNAP_POINTS) {
    if (Math.abs(raw - snap) < SNAP_THRESHOLD) return snap;
  }
  return raw;
}
```

### Verification
- [ ] Drag handle shows grip dots on hover
- [ ] Handle changes color while dragging
- [ ] Size readout appears during drag
- [ ] Snap points work at 33%, 50%, 67%
- [ ] `npm run build` passes

---

## Batch 4: Library card layout animations

### Read first
- `src/components/commonplace/LibraryView.tsx`
- `src/components/commonplace/GridView.tsx`

### Behavior

When cards shift position (due to sorting, filtering, or new captures),
animate the transition smoothly.

### Implementation

Wrap object card lists in `<AnimatePresence>`.
Wrap each card in `<motion.div layout>`:

```typescript
<AnimatePresence mode="popLayout">
  {objects.map(obj => (
    <motion.div
      key={obj.id}
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}
    >
      <ObjectRenderer object={obj} ... />
    </motion.div>
  ))}
</AnimatePresence>
```

### Verification
- [ ] Cards animate smoothly on sort/filter changes
- [ ] New cards fade in from below
- [ ] Removed cards fade out with scale
- [ ] Animations run at 60fps
- [ ] `npm run build` passes

---

## Build Order Summary

```
Batch 1: Component absorption animation (glow + fade-in)
Batch 2: Pane split zone indicators (hover preview)
Batch 3: Drag handle refinement (grip, readout, snap)
Batch 4: Library card layout animations (motion layout)
```

Run `npm run build` after EACH batch.
# ObjectRenderer Consolidation and Token Discipline

## Problem Statement

ObjectRenderer.tsx is 40KB and contains two rendering paths per object type:
1. Individual type components (NoteCard, SourceCard, TaskRow, etc.) in `objects/`
2. A monolithic `ModuleVariantObject` function inside ObjectRenderer.tsx that reimplements every type inline

The `module` variant is the primary rendering path (used by GridView, resurfacing, compose results) but bypasses the individual components entirely. This creates visual inconsistency and maintenance burden.

Additionally, inline `style={}` objects throughout both paths hardcode values (fontSize: 13, gap: 8, padding: '8px 10px') instead of referencing the CSS custom property system defined in commonplace.css. The spacing scale (`--cp-space-*`), typography stack (`--cp-font-*`), and color tokens (`--cp-type-*`) exist but are inconsistently applied.

## Current Architecture

```
ObjectRenderer.tsx (40KB)
  |-- RENDERERS map: { note: NoteCard, source: SourceCard, ... }
  |-- ModuleVariantObject(): 600+ lines of if/else per type
  |-- ChipVariantObject(): compact inline rendering
  |-- DefaultVariantObject(): fallback card
  |-- Main export: dispatches by variant prop
       variant="default" -> RENDERERS[type] || DefaultVariantObject
       variant="module"  -> ModuleVariantObject (bypasses RENDERERS)
       variant="chip"    -> ChipVariantObject
       variant="chain"   -> ChainVariantObject
       variant="dock"    -> (inline)
       variant="timeline"-> (inline)

objects/
  NoteCard.tsx      (2.5KB) - only handles default variant
  SourceCard.tsx    (3.4KB) - only handles default variant
  TaskRow.tsx       (2.6KB) - only handles default variant
  PersonPill.tsx    (2.7KB) - only handles default variant
  ConceptNode.tsx   (1.9KB) - only handles default variant
  HunchSticky.tsx   (2.0KB) - only handles default variant
  QuoteBlock.tsx    (1.7KB) - only handles default variant
  EventBadge.tsx    (3.1KB) - only handles default variant
  ScriptBlock.tsx   (1.4KB) - only handles default variant
  PlacePin.tsx      (2.8KB) - only handles default variant
  PinnedBadge.tsx   (7.4KB) - composition badge (separate concern)
  SignalPips.tsx     (2.1KB) - shared sub-component
  StatusBadge.tsx    (1.6KB) - shared sub-component
```

## Target Architecture

```
ObjectRenderer.tsx (~8KB)
  |-- Thin dispatcher: looks up type, passes variant through
  |-- Shared utilities: formatDate, extractDomain, readString
  |-- RenderableObject interface (stays here)
  |-- ObjectCardProps interface (stays here, adds variant)

objects/
  NoteCard.tsx      - renders all variants: default, module, chip, chain, dock, timeline
  SourceCard.tsx    - renders all variants
  TaskRow.tsx       - renders all variants
  PersonPill.tsx    - renders all variants
  ConceptNode.tsx   - renders all variants
  HunchSticky.tsx   - renders all variants
  QuoteBlock.tsx    - renders all variants
  EventBadge.tsx    - renders all variants
  ScriptBlock.tsx   - renders all variants
  PlacePin.tsx      - renders all variants
  PinnedBadge.tsx   - unchanged (composition, not a type renderer)
  SignalPips.tsx     - unchanged
  StatusBadge.tsx    - unchanged

styles/
  object-cards.css  - NEW: all object card styles using CSS classes + tokens
```

## Batch Plan

### Batch R1: Extract shared utilities and update ObjectCardProps

**Goal**: Prepare the interfaces so type components can accept variants.

**Changes**:

1. Create `objects/shared.ts` with extracted utilities:
   - `formatDate(iso: string): string`
   - `extractDomain(url: string): string`
   - `readString(value: unknown): string | null`
   - `readStringArray(value: unknown): string[]`
   
   These functions currently exist as duplicates across ObjectRenderer.tsx, NoteCard.tsx, and SourceCard.tsx.

2. Update `ObjectCardProps` to include the full variant type:
   ```typescript
   export type ObjectVariant = 'default' | 'module' | 'chip' | 'chain' | 'dock' | 'timeline';
   
   export interface ObjectCardProps {
     object: RenderableObject;
     compact?: boolean;
     variant?: ObjectVariant;
     onClick?: (obj: RenderableObject) => void;
     onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
     onPinCreated?: (parentSlug: string, childSlug: string) => void;
   }
   ```

3. Every type component imports `ObjectCardProps` from ObjectRenderer (already does) and `shared.ts` for utilities.

**Test**: All existing rendering still works. No visual changes.

---

### Batch R2: Create object-cards.css with token-disciplined classes

**Goal**: Define CSS classes for every object type and variant combination using the existing token system.

**Approach**: Replace inline style objects with CSS classes that reference `--cp-space-*`, `--cp-font-*`, `--cp-type-*`, and `--cp-border*` tokens.

**New file**: `src/styles/object-cards.css` (imported in commonplace.css or the layout)

**Class naming convention**:
```
.cp-obj              -- shared base for all object cards
.cp-obj--compact     -- compact modifier
.cp-obj--module      -- module variant base
.cp-obj--chip        -- chip variant base
.cp-obj--chain       -- chain variant base

.cp-obj-note         -- note type specifics
.cp-obj-source       -- source type specifics
.cp-obj-task         -- task type specifics
.cp-obj-person       -- person type specifics
.cp-obj-concept      -- concept type specifics
.cp-obj-hunch        -- hunch type specifics
.cp-obj-quote        -- quote type specifics
.cp-obj-event        -- event type specifics
.cp-obj-script       -- script type specifics
.cp-obj-place        -- place type specifics
```

**Token mapping** (replaces hardcoded values):

| Hardcoded pattern | Token replacement |
|---|---|
| `padding: '8px 10px'` | `padding: var(--cp-space-2) var(--cp-space-3)` |
| `padding: '10px 14px'` | `padding: var(--cp-space-3) var(--cp-space-4)` (closest) |
| `gap: 8` | `gap: var(--cp-space-2)` |
| `gap: 10` | `gap: var(--cp-space-3)` (round to scale) |
| `fontSize: 13` | `font-size: 13px` (keep, but in CSS class) |
| `fontSize: 9` for mono metadata | `.cp-obj-meta { font-size: 9px; }` |
| `fontFamily: 'var(--cp-font-mono)'` | `font-family: var(--cp-font-mono)` (in CSS) |
| `color: identity.color` | `color: var(--cp-type-<slug>)` via data attribute |
| `borderRadius: 6` | `border-radius: 6px` (standardize to one value) |
| `border: '1px solid var(--cp-border-faint)'` | keep, but in CSS class |

**Dynamic color strategy**: Object type color varies per instance. Use a CSS custom property set via a data attribute:
```css
.cp-obj { --obj-color: var(--cp-text-faint); }
.cp-obj[data-type="note"]   { --obj-color: var(--cp-type-note); }
.cp-obj[data-type="source"] { --obj-color: var(--cp-type-source); }
.cp-obj[data-type="person"] { --obj-color: var(--cp-type-person); }
/* ... etc for all types */
```

Then accent elements reference `var(--obj-color)` instead of passing `identity.color` through inline styles.

**Shared sub-patterns** (appear across multiple types):

```css
/* Metadata row: timestamp + link count */
.cp-obj-meta {
  display: flex;
  align-items: center;
  gap: var(--cp-space-2);
  font-family: var(--cp-font-mono);
  font-weight: 500;
  font-size: 9px;
  font-feature-settings: var(--cp-kern-mono);
  color: var(--cp-text-faint);
}

/* Title text */
.cp-obj-title {
  font-family: var(--cp-font-body);
  font-weight: 500;
  line-height: 1.35;
  color: var(--cp-text);
  font-feature-settings: var(--cp-kern-body);
}

/* Body preview */
.cp-obj-body {
  font-family: var(--cp-font-body);
  font-size: 12px;
  line-height: 1.55;
  color: var(--cp-text-muted);
  font-feature-settings: var(--cp-kern-body);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Edge count pill */
.cp-obj-edges {
  font-family: var(--cp-font-mono);
  font-weight: 500;
  font-size: 9px;
  color: var(--obj-color);
  font-feature-settings: var(--cp-kern-mono);
}

/* Accent dot (concept, entity indicators) */
.cp-obj-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--obj-color);
  flex-shrink: 0;
}
```

**Test**: Import object-cards.css. No components use it yet. Visual regression: zero changes.

---

### Batch R3: Migrate type components to multi-variant rendering

**Goal**: Each type component handles all its variants internally. One type at a time.

**Migration order** (simplest to most complex):
1. ConceptNode (simplest: dot + label)
2. PersonPill (avatar + name)
3. PlacePin (pin icon + text)
4. QuoteBlock (blockquote styling)
5. HunchSticky (dashed border + italic)
6. TaskRow (checkbox + title + status)
7. EventBadge (date column + title)
8. ScriptBlock (dark terminal card)
9. NoteCard (title + body + metadata)
10. SourceCard (most complex: OG image, domain, gradient header)

**Pattern for each migration**:

```typescript
// TaskRow.tsx (example)
import { type ObjectCardProps } from './ObjectRenderer';
import { formatDate } from './shared';

export default function TaskRow({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const done = object.status === 'done' || object.status === 'complete' || object.status === 'completed';
  const title = object.display_title ?? object.title;

  // Module variant
  if (variant === 'module') {
    return (
      <button
        type="button"
        className="cp-obj cp-obj--module cp-obj-task"
        data-type="task"
        data-done={done || undefined}
        data-compact={compact || undefined}
        onClick={onClick ? () => onClick(object) : undefined}
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
      >
        <span className="cp-obj-task-checkbox" />
        <span className="cp-obj-title">{title}</span>
        {object.captured_at && (
          <span className="cp-obj-meta">{formatDate(object.captured_at)}</span>
        )}
      </button>
    );
  }

  // Chip variant
  if (variant === 'chip') {
    return (
      <button
        type="button"
        className="cp-obj cp-obj--chip cp-obj-task"
        data-type="task"
        data-done={done || undefined}
        onClick={onClick ? () => onClick(object) : undefined}
      >
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{title}</span>
      </button>
    );
  }

  // Default variant (current NoteCard rendering, cleaned up)
  return (
    <button
      type="button"
      className="cp-obj cp-obj-task"
      data-type="task"
      data-done={done || undefined}
      data-compact={compact || undefined}
      onClick={onClick ? () => onClick(object) : undefined}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
    >
      {/* ... default card layout ... */}
    </button>
  );
}
```

**Per-component migration steps**:
1. Copy the module variant code from ModuleVariantObject's if-branch into the component
2. Replace inline styles with CSS classes from object-cards.css
3. Add variant dispatch (if/switch on variant prop)
4. Verify visual match against current rendering (screenshot compare)
5. Remove the corresponding if-branch from ModuleVariantObject
6. Repeat for chip, chain, dock, timeline variants if the type has them

**Test per component**: After each migration, the GridView (which uses variant="module") should render identically. Use browser devtools screenshot comparison.

---

### Batch R4: Slim down ObjectRenderer.tsx to thin dispatcher

**Goal**: ObjectRenderer becomes a lookup table, not a rendering engine.

**After all type migrations are complete**:

```typescript
// ObjectRenderer.tsx (~100 lines)
'use client';
import { type ComponentType } from 'react';
import NoteCard from './NoteCard';
import SourceCard from './SourceCard';
import TaskRow from './TaskRow';
import PersonPill from './PersonPill';
import ConceptNode from './ConceptNode';
import HunchSticky from './HunchSticky';
import QuoteBlock from './QuoteBlock';
import EventBadge from './EventBadge';
import ScriptBlock from './ScriptBlock';
import PlacePin from './PlacePin';

export type ObjectVariant = 'default' | 'module' | 'chip' | 'chain' | 'dock' | 'timeline';

export interface RenderableObject { /* ... unchanged ... */ }

export interface ObjectCardProps {
  object: RenderableObject;
  compact?: boolean;
  variant?: ObjectVariant;
  onClick?: (obj: RenderableObject) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
  onPinCreated?: (parentSlug: string, childSlug: string) => void;
}

const RENDERERS: Record<string, ComponentType<ObjectCardProps>> = {
  note: NoteCard,
  source: SourceCard,
  person: PersonPill,
  concept: ConceptNode,
  hunch: HunchSticky,
  quote: QuoteBlock,
  task: TaskRow,
  event: EventBadge,
  script: ScriptBlock,
  place: PlacePin,
};

export default function ObjectRenderer(props: ObjectCardProps) {
  const Renderer = RENDERERS[props.object.object_type_slug];
  if (Renderer) return <Renderer {...props} />;
  return <FallbackCard {...props} />;
}

function FallbackCard({ object, compact, variant, onClick, onContextMenu }: ObjectCardProps) {
  return (
    <button
      type="button"
      className="cp-obj cp-obj--fallback"
      data-type={object.object_type_slug}
      data-compact={compact || undefined}
      onClick={onClick ? () => onClick(object) : undefined}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
    >
      <span className="cp-obj-title">{object.display_title ?? object.title}</span>
    </button>
  );
}
```

**What gets deleted**: The entire ModuleVariantObject function (~600 lines), ChipVariantObject, all inline variant logic. ObjectRenderer drops from 40KB to under 5KB.

**Test**: Full visual regression across GridView, TimelineView, ComposeView, ResurfaceView. Every surface that renders objects should look identical.

---

### Batch R5: Add external service type renderers

**Goal**: Prepare the system for TickTick, Notion, Gmail objects.

**New type components**:
```
objects/
  EmailCard.tsx     - sender avatar, subject, snippet, thread indicator
  CalendarCard.tsx  - time block, attendees, duration
  ExternalTask.tsx  - adapts to source system (TickTick, Todoist, Asana)
  DocumentCard.tsx  - Notion page, Google Doc, etc.
```

**New object type identities** (add to OBJECT_TYPES in commonplace.ts):
```typescript
{ slug: 'email', label: 'Email', color: '#4A7A9A', icon: 'envelope' },
{ slug: 'calendar-event', label: 'Calendar', color: '#5A7A4A', icon: 'calendar-clock' },
{ slug: 'external-task', label: 'Task', color: '#C47A3A', icon: 'check-circle-external' },
{ slug: 'document', label: 'Document', color: '#2D5F6B', icon: 'file-text' },
```

**Source system badge**: External objects display a small source indicator:
```css
.cp-obj-source-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--cp-font-mono);
  font-weight: 600;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cp-text-faint);
  opacity: 0.7;
}
```

Each external object card shows a small "TICKTICK" or "NOTION" or "GMAIL" badge so the user always knows where data came from. This maps directly to the `source_system` field on Object.

**Register in RENDERERS**:
```typescript
const RENDERERS: Record<string, ComponentType<ObjectCardProps>> = {
  // ... existing types ...
  email: EmailCard,
  'calendar-event': CalendarCard,
  'external-task': ExternalTask,
  document: DocumentCard,
};
```

New types work immediately across all views because the dispatcher is type-agnostic.

---

## Invariants

1. **No inline styles for layout or typography.** All spacing, font, and color values come from CSS classes referencing `--cp-*` tokens. The only acceptable inline style is `--obj-color` set dynamically when the type color must be computed at runtime.

2. **One rendering path per type.** Each type component handles all its variants. No external function reimplements the type's rendering.

3. **ObjectRenderer is a dispatcher, not a renderer.** It looks up the component and passes props through. Under 200 lines.

4. **CSS classes use the naming convention.** `cp-obj` base, `cp-obj--{variant}` modifier, `cp-obj-{type}` specifics, `cp-obj-{element}` for sub-parts (title, body, meta, dot, edges).

5. **New types require exactly two files**: the component in `objects/` and the identity entry in `commonplace.ts`. Nothing else changes.

---

## Estimated Timeline

| Batch | Scope | Time |
|---|---|---|
| R1 | Shared utilities + interface update | 1 session |
| R2 | object-cards.css token classes | 1-2 sessions |
| R3 | Migrate 10 type components (1-2 per session) | 5-7 sessions |
| R4 | Slim ObjectRenderer to dispatcher | 1 session |
| R5 | External service renderers | 2-3 sessions (per type) |

Total: ~10-12 sessions for R1-R4. R5 is ongoing as connectors ship.

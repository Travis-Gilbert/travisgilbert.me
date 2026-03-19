# Spec E: Readability, Navigation Model, and Page Layouts

> **For Claude Code. Read entire spec before writing code.**
> **Run `npm run build` after every batch. Do not proceed if the build fails.**
> **No em dashes anywhere in code, comments, or copy.**

## Overview

This spec covers three connected improvements in dependency order:

1. **Phase 1 (Batches 1-4):** Fix sitewide readability by making content
   surfaces opaque, bumping text contrast, warming the palette, and tuning
   the dot pattern.
2. **Phase 1.5 (Batches 5-8):** Replace the 200px sidebar with a 44px top
   command strip as the default navigation. The icon rail is available as
   a toggle. Capture and toolbox move to a floating action button.
3. **Phase 2 (Batches 9-10):** Redesign the Artifacts page and Notebook
   Objects tab for the new full-width workspace.

Each phase has an explicit gate. Do not start Phase 1.5 until Phase 1
builds clean. Do not start Phase 2 until Phase 1.5 builds clean.

---

# PHASE 1: READABILITY

## Problem

Content surfaces are functionally transparent. `--cp-surface` is
`rgba(244, 243, 240, 0.10)` and `--cp-card` is `rgba(244, 243, 240, 0.09)`.
The PaneDotGrid canvas paints through every card, row, and input. Text
competes with the dot pattern. Borders draw containers but fills block
nothing.

---

## Batch 1: Surface opacity fix

### Read first
- `src/styles/commonplace.css` (the `.commonplace-theme` token block)

### Token changes in `commonplace.css`

Replace these tokens inside `.commonplace-theme`:

```css
/* BEFORE */
--cp-surface: rgba(244, 243, 240, 0.10);
--cp-surface-hover: rgba(244, 243, 240, 0.14);
--cp-card: rgba(244, 243, 240, 0.09);
--cp-card-hover: rgba(244, 243, 240, 0.13);
--cp-red-soft: rgba(184, 98, 61, 0.07);

/* AFTER */
--cp-surface: #262320;
--cp-surface-hover: #2E2A26;
--cp-card: #242118;
--cp-card-hover: #2C2822;
--cp-red-soft: #2D2219;
```

### Inline transparency audit

Run this grep and fix every match where a transparent rgba is used as a
`backgroundColor` for a container holding readable text:

```bash
grep -rn "rgba(244" src/components/commonplace/
grep -rn "rgba(90, 170" src/components/commonplace/
grep -rn "rgba(184, 98" src/components/commonplace/
```

**Known inline fixes needed:**

`src/components/commonplace/ResumeCards.tsx`: The "While you were away" card
uses `background: 'rgba(90, 170, 186, 0.07)'`. Replace with `#222828`.

For each match: if the rgba is a container background holding readable text,
replace with a solid color. Use `color-mix(in srgb, <accent> 10%, #262320)`
where possible to keep accent relationships dynamic. If the rgba is a
decorative glow, gradient overlay, border, or box-shadow, leave it alone.

**Do NOT change:**
- `.cp-ambient-glow` (decorative radial gradient)
- `.cp-pane-content` (intentionally transparent, dots show through)
- Sidebar section group backgrounds (`rgba(..., 0.025)`)
- Active sidebar item tint highlights
- Modal/overlay backdrops
- Any `border` or `box-shadow` value
- Any gradient `background` that starts with `linear-gradient` or `radial-gradient`

### Verification
- [ ] Cards on the Artifacts page have visible solid backgrounds
- [ ] Text on cards no longer competes with the dot grid
- [ ] Dots remain visible in gutters between cards and in empty workspace
- [ ] The sidebar and its sections render correctly
- [ ] `npm run build` passes

---

## Batch 2: Text contrast bump

### Read first
- `src/styles/commonplace.css` (text tokens)

### Token changes

```css
/* BEFORE */
--cp-text-faint: #8A887F;
--cp-chrome-line: #35353C;

/* AFTER */
--cp-text-faint: #9A9890;
--cp-chrome-line: #3D3936;
```

`--cp-text-faint` is used for subtitles, domain names, metadata, and helper
text. The bump from `#8A887F` to `#9A9890` on the new `#262320` surface
improves contrast from ~2.5:1 to ~3.7:1 (meets WCAG AA for large text).

`--cp-chrome-line` is used for borders on cards, inputs, and dividers. The
shift to `#3D3936` improves border visibility on the new opaque surfaces.

### Verification
- [ ] Subtitle text on Artifact rows is clearly readable
- [ ] Card borders are visible but not heavy
- [ ] `npm run build` passes

---

## Batch 3: Color token warmth pass

### Read first
- `src/styles/commonplace.css` (chrome tokens)

### Token changes

Shift the chrome base from cool blue-black to warm brown-black:

```css
/* BEFORE */
--cp-bg: #1C1C20;
--cp-chrome: #1C1C20;
--cp-chrome-mid: #232328;
--cp-chrome-raise: #2A2A30;

/* AFTER */
--cp-bg: #1E1B18;
--cp-chrome: #1E1B18;
--cp-chrome-mid: #252220;
--cp-chrome-raise: #2E2A26;
```

Note: `--cp-chrome-line` was already updated in Batch 2 to `#3D3936`.

### Verification
- [ ] The sidebar feels warmer, less blue-grey
- [ ] The overall palette is cohesive with the terracotta/gold/teal accents
- [ ] No surfaces look mismatched (one cool, one warm)
- [ ] `npm run build` passes

---

## Batch 4: Dot pattern tuning and glow

### Read first
- `src/components/commonplace/PaneDotGrid.tsx` (default props)
- `src/components/commonplace/DotField.tsx` (default props)
- `src/app/(commonplace)/layout.tsx` (`.cp-ambient-glow`)

### PaneDotGrid.tsx default prop changes

```typescript
// BEFORE
dotColor = [24, 24, 27],
dotOpacity = 0.22,
binaryDensity = 0.10,

// AFTER
dotColor = [36, 30, 24],
dotOpacity = 0.18,
binaryDensity = 0.07,
```

### DotField.tsx default prop changes

```typescript
// BEFORE
dotColor: dotColorProp ?? [26, 26, 29],
dotOpacity = 0.07,
binaryDensity = 0.08,

// AFTER
dotColor: dotColorProp ?? [36, 30, 24],
dotOpacity = 0.05,
binaryDensity = 0.06,
```

### Ambient glow adjustment

In `commonplace.css`, update `.cp-ambient-glow`:

```css
/* BEFORE */
.cp-ambient-glow {
  background: radial-gradient(
    ellipse at 50% 0%,
    rgba(184, 98, 61, 0.06) 0%,
    rgba(184, 98, 61, 0.02) 20%,
    transparent 50%
  );
}

/* AFTER */
.cp-ambient-glow {
  background: radial-gradient(
    ellipse at 65% 0%,
    rgba(184, 98, 61, 0.04) 0%,
    rgba(184, 98, 61, 0.015) 20%,
    transparent 50%
  );
}
```

### Verification
- [ ] Dots in gutters and margins are warm sepia, not cool grey
- [ ] Dots are visible but subtle (not competing with content)
- [ ] Binary characters are sparse enough to read as texture, not noise
- [ ] The ambient glow is subtle and does not bleed into the sidebar zone
- [ ] `npm run build` passes

**PHASE 1 GATE: Verify all 4 batches are clean before proceeding.**

---

# PHASE 1.5: NAVIGATION MODEL

## Architecture

Replace the 200px always-visible sidebar with:
1. A 44px top command strip (always visible)
2. A 48px icon rail (toggle, persists in localStorage)
3. A floating action button for capture and toolbox

The sidebar component is kept in the codebase behind a `cp-nav-mode`
localStorage key for fallback. Default mode: `'topbar'`.

---

## Batch 5: CommonPlaceTopBar component

### Read first
- `src/components/commonplace/CommonPlaceSidebar.tsx` (navigation logic,
  `SIDEBAR_SECTIONS`, `navigateToScreen`, `launchView`)
- `src/lib/commonplace.ts` (`SIDEBAR_SECTIONS`, `ViewType`)
- `src/lib/commonplace-context.tsx` (`useCommonPlace` state shape)

### New file: `src/components/commonplace/CommonPlaceTopBar.tsx`

A 44px fixed-height bar across the top of the content area.

**Left zone:** "CommonPlace" brand link to `/commonplace`. Use
`var(--cp-font-title)`, 15px, weight 700, color `var(--cp-text)`.

**Center zone:** Primary navigation buttons. Use the same
`navigateToScreen()` and `launchView()` functions from context.

Items in the top bar:

| Label | Action | Type |
|-------|--------|------|
| Library | `navigateToScreen('library')` | Screen |
| Models | `navigateToScreen('models')` | Screen |
| Artifacts | `navigateToScreen('artifacts')` | Screen |
| Compose | `launchView('compose')` | View |
| Timeline | `launchView('timeline')` | View |
| Map | `launchView('map')` | View |

Style each button: `var(--cp-font-mono)`, 11px, `letter-spacing: 0.03em`,
color `var(--cp-text-faint)`. Active state:
`background: rgba(184, 98, 61, 0.15); color: var(--cp-text)`.

**Right zone:**
- Active notebook badge: colored pill showing the current notebook name
  from context. Click opens a popover with recent notebooks.
  If no notebook is active, hide the badge.
- Cmd+K button: `border: 1px solid var(--cp-chrome-line)`, shows keyboard
  shortcut text. Click opens the existing `CommandPalette`.
- Rail toggle: grid icon button. Click toggles the icon rail.
  State stored in `localStorage('cp-rail-visible')`. Active state uses
  terracotta tint background.

### CSS additions to `commonplace.css`

```css
.cp-topbar {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 14px;
  gap: 10px;
  background: var(--cp-chrome);
  border-bottom: 1px solid var(--cp-chrome-line);
  flex-shrink: 0;
  z-index: 10;
}

.cp-topbar-nav {
  display: flex;
  gap: 2px;
  margin-left: 12px;
}

.cp-topbar-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-family: var(--cp-font-mono);
  font-weight: 500;
  letter-spacing: 0.03em;
  color: var(--cp-text-faint);
  border-radius: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color 120ms, color 120ms;
}

.cp-topbar-btn:hover {
  background: var(--cp-chrome-raise);
  color: var(--cp-text-muted);
}

.cp-topbar-btn[data-active="true"] {
  background: rgba(184, 98, 61, 0.15);
  color: var(--cp-text);
}

.cp-topbar-right {
  margin-left: auto;
  display: flex;
  gap: 8px;
  align-items: center;
}

.cp-topbar-cmd {
  padding: 3px 10px;
  border: 1px solid var(--cp-chrome-line);
  border-radius: 4px;
  font-size: 10px;
  font-family: var(--cp-font-mono);
  font-weight: 500;
  color: var(--cp-text-faint);
  cursor: pointer;
}

.cp-topbar-toggle {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--cp-chrome-line);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cp-text-faint);
  background: transparent;
  cursor: pointer;
  transition: all 120ms;
}

.cp-topbar-toggle:hover {
  border-color: var(--cp-text-faint);
  color: var(--cp-text);
}

.cp-topbar-toggle[data-active="true"] {
  background: rgba(184, 98, 61, 0.12);
  border-color: rgba(184, 98, 61, 0.3);
  color: var(--cp-text);
}
```

### Verification
- [ ] Top bar renders at 44px with brand, nav items, and right zone
- [ ] Clicking nav items triggers the correct screen/view navigation
- [ ] Active state highlights the correct item
- [ ] Cmd+K button opens the command palette
- [ ] Rail toggle button persists state in localStorage
- [ ] `npm run build` passes

---

## Batch 6: CaptureFAB component

### Read first
- `src/components/commonplace/CaptureButton.tsx`
- `src/components/commonplace/ComponentToolbox.tsx`
- `src/lib/commonplace-capture.ts`
- `src/lib/commonplace-components.ts` (`COMPONENT_TOOLBOX`)

### New file: `src/components/commonplace/CaptureFAB.tsx`

Fixed position, `bottom: 40px` (above the 28px engine terminal),
`right: 16px`. 40px circle, `background: var(--cp-red)`, `z-index: 30`.

**Click** toggles a popover above the FAB:

The popover has two sections separated by a 1px divider:

**Capture section** (top):
- Paste URL: opens an inline URL input inside the popover
- Quick text: opens an inline textarea
- Upload file: triggers a hidden file input

Each capture action uses the same `syncCapture()` function from
`commonplace-capture.ts` that the sidebar uses today.

**Toolbox section** (bottom):
- Renders all items from `COMPONENT_TOOLBOX` as a list
- Each item shows a colored dot + label
- Each item is draggable. On drag start, close the popover and start
  the drag operation. Use the same drag mechanism as `ComponentToolbox.tsx`:
  set `dataTransfer` with `application/commonplace-component` and the
  component type ID.

**Keyboard shortcuts:**
- `C` key (when no input is focused): opens capture mode
- `T` key (when no input is focused): opens toolbox section

Style the popover: `background: var(--cp-surface)`,
`border: 1px solid var(--cp-chrome-line)`, `border-radius: 8px`,
`box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4)`, width 200px.

Close the popover on click outside or Escape.

### Verification
- [ ] FAB renders as a terracotta circle above the engine bar
- [ ] Clicking FAB opens the capture + toolbox popover
- [ ] Capture actions (URL, text, file) work and create objects
- [ ] Toolbox items are draggable from the popover onto object cards
- [ ] `C` and `T` keyboard shortcuts work
- [ ] Popover closes on outside click and Escape
- [ ] `npm run build` passes

---

## Batch 7: CommonPlaceRail extraction

### Read first
- `src/components/commonplace/CommonPlaceSidebar.tsx` (the collapsed rail
  rendering section, `railItems` array, `RailIconButton` component)

### New file: `src/components/commonplace/CommonPlaceRail.tsx`

Extract the collapsed rail mode from `CommonPlaceSidebar.tsx` into a
standalone component. The rail is 48px wide, renders as a vertical column
of icon buttons.

**Structure:**
- Brand abbreviation "C" at top (link to `/commonplace`)
- Capture button (+) with terracotta color
- Divider
- Screen icons: Library, Models, Artifacts, Compose
- Divider
- View icons: Timeline, Map, Calendar, Loose Ends (teal section color)
- Divider
- Work icons: Notebooks (gold section color)
- Flex spacer
- Engine status dot at bottom

Use the same `navigateToScreen()` and `launchView()` from context.
Tooltips use Floating UI (already imported in the sidebar).

**Animation:** The rail slides in from the left using:
```css
.cp-rail {
  width: 48px;
  flex-shrink: 0;
  background: var(--cp-chrome);
  border-right: 1px solid var(--cp-chrome-line);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 2px;
  overflow: hidden;
  transition: width 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 200ms;
}

.cp-rail--hidden {
  width: 0;
  opacity: 0;
  border-right: none;
  padding: 0;
}
```

The visibility is controlled by the `cp-rail-visible` localStorage key
set by the top bar toggle button.

### Verification
- [ ] Rail renders at 48px with all section icons
- [ ] Clicking icons triggers correct navigation
- [ ] Tooltips appear on hover
- [ ] Rail animates in/out with spring easing
- [ ] Engine dot shows at bottom
- [ ] `npm run build` passes

---

## Batch 8: Layout restructuring

### Read first
- `src/app/(commonplace)/layout.tsx`
- `src/components/commonplace/CommonPlaceSidebar.tsx`

### Changes to layout.tsx

The layout currently renders:
```
<div class="cp-shell-root" style="display: flex; height: 100vh;">
  <DotGrid />
  <CommonPlaceSidebar />
  <main class="cp-main-surface">
    <SplitPaneContainer />
  </main>
</div>
```

Change to:
```
<div class="cp-shell-root" style="display: flex; flex-direction: column; height: 100vh;">
  <DotGrid />
  <CommonPlaceTopBar />
  <div class="cp-body-area" style="display: flex; flex: 1; overflow: hidden;">
    <CommonPlaceRail />
    <main class="cp-main-surface" style="flex: 1; min-width: 0;">
      <SplitPaneContainer />
    </main>
  </div>
  <CaptureFAB />
</div>
```

**Gate the layout behind `cp-nav-mode` localStorage:**

```typescript
const [navMode, setNavMode] = useState<'topbar' | 'sidebar'>(() => {
  if (typeof window === 'undefined') return 'topbar';
  return (localStorage.getItem('cp-nav-mode') as 'topbar' | 'sidebar') || 'topbar';
});
```

If `navMode === 'sidebar'`, render the old layout with `CommonPlaceSidebar`.
If `navMode === 'topbar'`, render the new layout with top bar + rail + FAB.

This means the sidebar is not deleted. Users can switch back by setting
`localStorage.setItem('cp-nav-mode', 'sidebar')` in the console, or via
a future settings screen.

### DropZone migration

The `DropZone` component is currently rendered inside `CommonPlaceSidebar`.
In the new layout, move it to render inside the `CommonPlaceProvider` wrapper
in layout.tsx so it works regardless of nav mode. It is a fixed overlay and
does not depend on the sidebar.

### Mobile handling

The mobile layout (`useIsAppShellMobile()`) should continue using the
sidebar via the `MobileDrawer` component. The top bar layout is desktop
only. Check `isMobile` and render the sidebar layout for mobile regardless
of `navMode`.

### CSS additions

```css
.cp-body-area {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
```

### Verification
- [ ] Desktop renders top bar + optional rail + workspace
- [ ] Mobile renders sidebar drawer (unchanged)
- [ ] Setting `cp-nav-mode` to `'sidebar'` restores the old layout
- [ ] DropZone capture overlay works in both layouts
- [ ] Command palette works in both layouts
- [ ] Object drawer works in both layouts
- [ ] Engine terminal renders at the bottom in both layouts
- [ ] The pane system fills the available width correctly
- [ ] `npm run build` passes

**PHASE 1.5 GATE: Verify all 4 batches are clean before proceeding.**

---

# PHASE 2: PAGE LAYOUT IMPROVEMENTS

---

## Batch 9: Artifacts page redesign

### Read first
- `src/components/commonplace/ArtifactBrowserView.tsx`

### Architecture

Replace the flat artifact list with a pipeline-first layout.

**Pipeline summary bar:** A horizontal bar showing each pipeline stage with
a count. Clicking a stage filters the list to that stage. The active stage
acts as the section heading.

```typescript
const PIPELINE_STAGES = [
  'captured', 'parsed', 'extracted', 'reviewed',
  'promoted', 'compiled', 'learned',
] as const;
```

Render as a horizontal flex row. Each stage is a clickable button:
- Label: stage name (uppercase mono, 10px)
- Count: number of artifacts at that stage
- Active: teal underline + brighter text
- Connected by a thin line between dots (same as the existing StageTrack
  pattern but horizontal and larger)

**Failed callout:** If any artifacts have `ingestion_status === 'failed'`,
show a compact warning bar above the pipeline:
`background: color-mix(in srgb, var(--cp-red) 10%, var(--cp-surface))`,
text "N artifacts failed extraction", with a "Show failed" button that
filters to failed items.

**Artifact rows (redesigned):**

Move extraction summary badges (claims, entities, questions) from the
expanded detail panel into the collapsed row itself, so users see at a
glance what each artifact produced. Layout:

```
[CaptureKindIcon]  Title                          3 claims  2 entities  [chevron]
                   domain.com | parsed Mar 17
```

The StageTrack dots move from the row to the pipeline summary bar.
Individual rows show their stage as a small text label instead.

**Domain grouping for URL artifacts:** When the list contains multiple
URLs from the same domain, group them under a collapsible domain header.
The header shows the domain name and count.

**Keep everything else:** The `ArtifactFilterBar` kind filters (URL, File,
Text) stay. The expanded detail panel stays. The `triggerExtraction` action
stays. The search input stays.

### Implementation

Refactor `ArtifactBrowserView.tsx` in place. Extract the pipeline summary
bar into a `PipelineSummaryBar` sub-component within the same file. Reuse
the existing `StageTrack`, `ExtractionSummary`, and `CaptureKindIcon`
components (they are well-built).

Group the artifact list by computing `stageCounts` from the artifacts
array and filtering based on the selected pipeline stage.

### Verification
- [ ] Pipeline summary bar renders with counts per stage
- [ ] Clicking a stage filters the list
- [ ] Failed artifacts show a warning callout
- [ ] Extraction badges appear on collapsed rows
- [ ] URL artifacts from the same domain are grouped
- [ ] Search and kind filters still work
- [ ] Extraction action still works
- [ ] `npm run build` passes

---

## Batch 10: Notebook Objects tab redesign

### Read first
- `src/components/commonplace/NotebookWorkspace.tsx` (the Objects tab
  content, the drop handler)
- `src/components/commonplace/objects/ObjectRenderer.tsx`

### Architecture

Shrink the drop zone and make the object list the hero.

**Inline drop strip:** Replace the full-viewport drop zone with a 40px
dashed-border strip between the filter controls and the object list.

```
[+ Add objects]  [Sort: recent v]  [Filter: all types v]
- - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  Drop objects here to add to {notebook.name}
- - - - - - - - - - - - - - - - - - - - - - - - - - - - -
```

On `dragOver`, animate the strip to 80px height with a spring:
`transition: height 200ms cubic-bezier(0.34, 1.56, 0.64, 1)`.
Background tints to `color-mix(in srgb, var(--cp-teal) 8%, var(--cp-surface))`.
On `dragLeave`, return to 40px.

The existing `handleDrop` function (which calls `batchAddObjects`) stays
unchanged. Just move it to fire on the strip instead of the full workspace.

**Object list rows:** Use `ObjectRenderer` component for each row instead
of plain text. This gives each object its type-specific visual treatment
(person pills, concept nodes, source citations, etc.).

Each row should show:
- Object type dot (from `getObjectTypeIdentity`)
- Title (from `ObjectRenderer` compact mode)
- Connection count (right-aligned, mono font)

**Sort and filter controls:** Add a row above the drop strip with:
- "Add objects" button (opens the ObjectPalette or triggers a search)
- Sort dropdown: "Recent" (default), "Most connected", "Alphabetical"
- Filter dropdown: "All types" (default), then each object type

These are local state controls that filter/sort the notebook's
`objectList` before rendering.

### Implementation

Refactor the Objects tab content inside `NotebookWorkspace.tsx`. The tab
structure (Objects, Graph, Timeline, Tuning, Sharing) does not change.
Only the content rendered when `activeTab === 'objects'` changes.

Import `ObjectRenderer` from `./objects/ObjectRenderer` and use it in
compact mode for each row.

### Verification
- [ ] Drop zone is a 40px inline strip, not a full-viewport overlay
- [ ] Drop zone expands on drag-over with spring animation
- [ ] Dropping objects calls `batchAddObjects` and refreshes the list
- [ ] Object rows use `ObjectRenderer` with type-specific visuals
- [ ] Connection count appears on each row
- [ ] Sort and filter controls work
- [ ] The notebook identity banner still shows at the top
- [ ] `npm run build` passes

---

# BUILD ORDER SUMMARY

```
PHASE 1: READABILITY
  Batch 1:  Surface opacity fix (CSS tokens + inline rgba audit)
  Batch 2:  Text contrast bump (--cp-text-faint, --cp-chrome-line)
  Batch 3:  Color token warmth pass (chrome base cool to warm)
  Batch 4:  Dot pattern tuning + ambient glow
  --- GATE: verify, commit ---

PHASE 1.5: NAVIGATION MODEL
  Batch 5:  CommonPlaceTopBar component
  Batch 6:  CaptureFAB component (capture + toolbox popover)
  Batch 7:  CommonPlaceRail extraction from sidebar
  Batch 8:  Layout restructuring + nav-mode toggle
  --- GATE: verify, commit ---

PHASE 2: PAGE LAYOUTS
  Batch 9:  Artifacts page redesign (pipeline summary bar)
  Batch 10: Notebook Objects tab redesign (inline drop + ObjectRenderer rows)
  --- GATE: verify, commit ---
```

Run `npm run build` after EACH batch.
Do not proceed if the build fails.
Fix errors in the current batch before moving on.

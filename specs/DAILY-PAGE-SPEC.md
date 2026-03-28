# CommonPlace Daily Page: Homepage Redesign

> **For Claude Code. One batch per session.**
> **Depends on: OBJECT-RENDERER-REFACTOR.md (Batch R3+ for polymorphic ObjectRenderer)**
> **Reference prototype: commonplace-v3.html (attached to project knowledge)**

## The Problem

CommonPlace's homepage is an empty page.tsx that renders `<></>` and drops the
user into the split-pane workspace. There is no "here's what happened since you
were last here" surface. The engine finds connections, tensions accumulate,
objects arrive via MCP ingestion, but the user only discovers this by navigating
to individual views.

Every knowledge tool the user admires (Anytype, Roam, Capacities, Notion) has
an opinionated landing state: the daily note, the inbox, the favorites page.
CommonPlace needs one too, but built around what makes Theseus unique: the
engine's intelligence is the main character, not the user's manual organization.

## What the Daily Page Does

The Daily Page is a single-scroll editorial layout organized into three
visual tiers of hierarchy:

**Tier 1 (Dominant): Engine Discoveries.**
Connections the engine found since the user's last visit. These are the
reason you open CommonPlace. They get the most visual weight: dark terminal
background, colored node indicators, strength scores in terracotta circles,
human-readable reasons. The most important discovery renders larger than the
rest.

**Tier 2 (Primary): Today's Objects.**
Captures, MCP-ingested content (emails, calendar events, documents), and
recent objects. Rendered polymorphically: each object type has its own visual
identity. Email objects look like emails. Notes look like notes. Hunches have
dashed borders. Layout is editorial/asymmetric (not a uniform card grid).

**Tier 3 (Ambient): System Status + Workspace Navigation.**
Date, IQ score, object/edge counts. Notebook shelf. Pinned objects. These are
glanceable and never demand attention.

## Key Design Decision: Search Bar, Not Capture Bar

The sidebar already contains a persistent CaptureButton. Duplicating it at the
top of the daily page is redundant. Instead, the prominent bar at the top of
the daily page is a **search and ingest bar**:

- Default mode: searches the knowledge graph (BM25 + SBERT via existing
  `/api/v1/notebook/search/` endpoint)
- URL detected: triggers Firecrawl scrape and ingestion pipeline
- Keyboard shortcut: `/` focuses the bar from anywhere on the daily page

This makes the daily page serve double duty: review what the engine found, and
quickly search or ingest new content.

## Route and File Map

```
src/
  app/(commonplace)/commonplace/
    page.tsx                         MODIFY: render DailyPage instead of empty fragment

  components/commonplace/
    views/
      DailyPage.tsx                  NEW: the daily page (client component)
      DailyPage.module.css           NEW: scoped styles
      EngineDiscoveryFeed.tsx         NEW: Tier 1 discovery cards
      EngineDiscoveryFeed.module.css  NEW: terminal-style discovery styles
      SearchIngestBar.tsx             NEW: search/URL ingest bar
      SearchIngestBar.module.css      NEW: bar styles
      TensionStrip.tsx               NEW: gold tension summary
      NotebookShelf.tsx              NEW: horizontal spine shelf
      NotebookShelf.module.css       NEW: 3D spine styles

    shell/
      CommonPlaceRail.tsx            REPLACE: implement 48px icon rail
      CommonPlaceRail.module.css     NEW: rail styles
      CommonPlaceShell.tsx           MODIFY: support rail vs sidebar toggle
      CommonPlaceSidebar.tsx         MODIFY: add collapsed state awareness

  lib/
    commonplace.ts                   MODIFY: add 'daily' to ViewType, ScreenType
    commonplace-api.ts               MODIFY: add fetchDiscoveries(), fetchTensions()

  styles/
    commonplace-tokens.css           MODIFY: add discovery/terminal tokens
```

## Dependencies

No new npm packages. The daily page uses existing dependencies:
- `sonner` for toasts (already installed)
- `iconoir-react` for icons (already installed)
- `framer-motion` for scroll reveals (already installed, optional)

## Design Tokens

Add to `commonplace-tokens.css` inside `.commonplace-theme`:

```css
/* Terminal (discovery feed) */
--cp-term-bg: #1A1C22;
--cp-term-border: #2A2C32;
--cp-term-text: #C0C8D8;
--cp-term-muted: #6A7080;
--cp-term-green: #5D9B78;
--cp-term-cyan: #5AAABA;

/* Discovery edge */
--cp-discovery-score-bg: var(--cp-red);
--cp-discovery-score-text: #fff;

/* Search bar */
--cp-search-bg: rgba(255,255,255,0.015);
--cp-search-border: var(--cp-border-faint);
--cp-search-focus-border: rgba(184,98,61,0.3);
--cp-search-placeholder: var(--cp-text-dim);
```

Note: `--cp-term-*` tokens already exist in the token file. Only add if not
already present.

## API Endpoints Required

### GET /api/v1/notebook/engine/discoveries/

Returns recent engine-discovered connections, newest first, with both objects
and the edge metadata. Replaces the current approach of fetching all edges
and filtering client-side.

```json
{
  "discoveries": [
    {
      "edge_id": 156,
      "from_object": { "id": 42, "title": "...", "object_type_slug": "concept" },
      "to_object": { "id": 87, "title": "...", "object_type_slug": "note" },
      "engine": "sbert",
      "strength": 0.87,
      "reason": "Both describe systems that encode knowledge through operation.",
      "created_at": "2026-03-27T14:30:00Z"
    }
  ],
  "total": 4
}
```

Query params: `?since=<iso_datetime>&limit=20`

If this endpoint does not exist in the Django backend yet, it needs to be
built. It is a read-only view over Edge objects filtered by `is_auto=True`
and `created_at > since`, ordered by `-created_at`, with related from_object
and to_object serialized inline.

### GET /api/v1/notebook/tensions/summary/

Returns open tension count and the highest-priority tensions.

```json
{
  "total_open": 383,
  "top_tensions": [
    {
      "id": 12,
      "title": "Contradiction: Dan Lahav vs README.md",
      "status": "open",
      "priority": "high"
    }
  ]
}
```

If this does not exist, it is a trivial view over the Tension model filtered
by `status='open'`, ordered by priority.

### GET /api/v1/notebook/iq/latest/

Returns the most recent IQ snapshot. If this already exists in the
`iq_report` management command output, expose it as an API endpoint.

```json
{
  "composite": 71.2,
  "discovery": 27.1,
  "organization": 57.4,
  "object_count": 21569,
  "edge_count": 11946,
  "feedback_count": 203,
  "measured_at": "2026-03-27T23:01:38Z"
}
```

## Build Order

| Batch | What Ships | Depends On |
|-------|-----------|------------|
| D1 | SearchIngestBar + DailyPage shell | Nothing |
| D2 | EngineDiscoveryFeed | D1, backend discoveries endpoint |
| D3 | Polymorphic object rendering in daily feed | D1, OBJECT-RENDERER-REFACTOR R3 |
| D4 | TensionStrip + NotebookShelf + IQ header | D1 |
| D5 | CommonPlaceRail (sidebar collapse) | D1 |
| D6 | Email object type renderer | D3, R5 from OBJECT-RENDERER-REFACTOR |

## Batch D1: DailyPage Shell + SearchIngestBar

**Read first:**
- `src/app/(commonplace)/commonplace/page.tsx`
- `src/app/(commonplace)/layout.tsx`
- `src/lib/commonplace.ts` (ViewType, ScreenType, VIEW_REGISTRY)
- `src/lib/providers/layout-provider.tsx`
- `src/components/commonplace/panes/ScreenRouter.tsx`

**Goal:** The daily page renders as the default screen. It has the date
header, the search/ingest bar, and placeholder sections for content that
will be populated in later batches.

### Changes

#### `src/lib/commonplace.ts`

Add `'daily'` to the `ScreenType` union. Add to `VIEW_REGISTRY`:

```typescript
daily: { label: 'Daily', icon: 'home' },
```

#### `src/components/commonplace/panes/ScreenRouter.tsx`

Add the daily case:

```typescript
import DailyPage from '../views/DailyPage';

// In the switch:
case 'daily':
  return <DailyPage />;
```

#### `src/lib/providers/layout-provider.tsx`

Change the default `activeScreen` from `'library'` to `'daily'`:

```typescript
const [activeScreen, setActiveScreen] = useState<ScreenType | null>('daily');
```

#### `src/components/commonplace/views/SearchIngestBar.tsx` (NEW)

Client component. Single text input that:
1. On empty/text input: shows "Search your graph or paste a URL..." placeholder
2. On typing: debounces 300ms, calls `/api/v1/notebook/search/` (existing endpoint)
3. On URL detected (starts with http/https): shows "Ingest with Firecrawl" action
4. On Enter with URL: calls the existing scrape/ingest pipeline
5. Keyboard: `/` focuses from anywhere on daily page (unless inside another input)

```typescript
'use client';

interface SearchIngestBarProps {
  onSearch?: (query: string) => void;
  onIngest?: (url: string) => void;
}
```

**Styling:** Uses CSS Module. Border is `var(--cp-search-border)`, focus
border is `var(--cp-search-focus-border)`. Height: 44px. Font: `var(--cp-font-body)`
at 14px. The search icon is on the left. When a URL is detected, a small
"Ingest" button appears on the right with the Firecrawl globe icon.

#### `src/components/commonplace/views/DailyPage.tsx` (NEW)

Client component. The page shell with three-tier layout.

```typescript
'use client';

import { useState, useEffect } from 'react';
import SearchIngestBar from './SearchIngestBar';
import styles from './DailyPage.module.css';

export default function DailyPage() {
  // Fetch IQ, discoveries, tensions, recent objects
  // Render: header, search bar, then sections
}
```

**Layout structure:**

```
<div className={styles.dailyPage}>
  <div className={styles.content}>
    <!-- HEADER: date + IQ (Tier 3) -->
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <div className={styles.dayLabel}>FRIDAY</div>
        <h1 className={styles.dateTitle}>March 27</h1>
      </div>
      <div className={styles.headerRight}>
        <div className={styles.iqScore}>71.2</div>
        <div className={styles.iqLabel}>COMPOSITE IQ</div>
        <div className={styles.stats}>21,569 objects ... 11,946 edges</div>
      </div>
    </header>

    <!-- SEARCH BAR -->
    <SearchIngestBar />

    <!-- TIER 1: Engine Discoveries (placeholder in D1) -->
    <section className={styles.section}>
      <div className={styles.sectionLabel}>Engine Discoveries</div>
      <!-- Populated in D2 -->
    </section>

    <!-- TIER 2: Today's Objects (placeholder in D1) -->
    <section className={styles.section}>
      <div className={styles.sectionLabel}>Today</div>
      <!-- Populated in D3 -->
    </section>

    <!-- TIER 3: Tensions, Notebooks (placeholder in D1) -->
    <!-- Populated in D4 -->
  </div>
</div>
```

#### `src/components/commonplace/views/DailyPage.module.css` (NEW)

```css
.dailyPage {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--cp-chrome-line) transparent;
}

.content {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 36px 120px;
}

.header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: var(--cp-space-8);
}

.dayLabel {
  font-family: var(--cp-font-mono);
  font-size: 10px;
  color: var(--cp-text-dim);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: var(--cp-space-1);
}

.dateTitle {
  font-family: var(--cp-font-title);
  font-size: 30px;
  font-weight: 700;
  color: var(--cp-text);
  line-height: 1.1;
  margin: 0;
}

.headerRight {
  text-align: right;
}

.iqScore {
  font-family: var(--cp-font-title);
  font-size: 28px;
  font-weight: 700;
  color: var(--cp-red);
  line-height: 1;
}

.iqLabel {
  font-family: var(--cp-font-mono);
  font-size: 9px;
  color: var(--cp-text-dim);
  letter-spacing: 0.08em;
}

.stats {
  font-family: var(--cp-font-mono);
  font-size: 10px;
  color: var(--cp-text-dim);
  margin-top: var(--cp-space-1);
}

.section {
  margin-bottom: 40px;
}

.sectionLabel {
  font-family: var(--cp-font-mono);
  font-size: 10px;
  color: var(--cp-text-dim);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: var(--cp-space-2);
}

.sectionLabel .count {
  color: var(--cp-terracotta-light);
  font-weight: 600;
}

.sectionLabel .line {
  flex: 1;
  height: 1px;
  background: var(--cp-border-faint);
}
```

**Verification:**
- Navigate to `/commonplace` and see the daily page instead of the empty fragment
- Date header shows today's date
- Search bar renders and focuses on `/` keypress
- Placeholder sections are visible
- `npm run build` passes

---

## Batch D2: EngineDiscoveryFeed

**Read first:**
- `src/components/commonplace/views/DailyPage.tsx` (from D1)
- `src/lib/commonplace-api.ts` (API fetch patterns)
- `apps/notebook/engine.py` (Edge model, engine field values)

**Goal:** The discovery feed renders real engine-discovered connections
with the terminal visual language. Discoveries have size variation based
on strength.

### Changes

#### `src/lib/commonplace-api.ts`

Add:

```typescript
export interface EngineDiscovery {
  edge_id: number;
  from_object: { id: number; title: string; object_type_slug: string };
  to_object: { id: number; title: string; object_type_slug: string };
  engine: string;
  strength: number;
  reason: string;
  created_at: string;
}

export async function fetchDiscoveries(
  since?: string,
  limit: number = 20,
): Promise<EngineDiscovery[]> {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  params.set('limit', String(limit));
  const data = await apiFetch(`/engine/discoveries/?${params}`);
  return data.discoveries ?? [];
}
```

#### `src/components/commonplace/views/EngineDiscoveryFeed.tsx` (NEW)

Client component. Renders a list of discovery cards with the terminal aesthetic.

**Visual rules:**
- Container: `background: var(--cp-term-bg)`, `border: 1px solid var(--cp-term-border)`,
  `border-radius: 8px`
- Each discovery shows: from-object (type-colored square + name), edge line with
  strength circle, to-object (type-colored square + name), reason text below,
  engine badge
- The first discovery (highest strength or most recent) renders at 1.3x scale:
  larger text (15px names vs 12px), more padding (22px vs 14px), full reason text
  vs truncated
- Remaining discoveries render at compact scale
- If 4+ discoveries, the bottom two sit in a 2-column grid

**Type color mapping:** Uses `--cp-type-{slug}` tokens from `commonplace-tokens.css`.
The colored squares next to each object name use these colors. The edge gradient
line runs from the from-type color through terracotta to the to-type color.

**Strength circle:** Centered on the edge line, `background: var(--cp-discovery-score-bg)`,
white text, shows the integer strength percentage.

#### `src/components/commonplace/views/EngineDiscoveryFeed.module.css` (NEW)

Full terminal styling. See the prototype's `.discovery` and `.discovery-edge` classes
for the reference implementation.

#### `src/components/commonplace/views/DailyPage.tsx`

Import and render `EngineDiscoveryFeed` in the Tier 1 section:

```typescript
import EngineDiscoveryFeed from './EngineDiscoveryFeed';
import { fetchDiscoveries } from '@/lib/commonplace-api';

// In component:
const { data: discoveries } = useApiData(
  () => fetchDiscoveries(lastVisit),
  [],
);

// In JSX:
<section className={styles.section}>
  <EngineDiscoveryFeed discoveries={discoveries} />
</section>
```

**Verification:**
- Discoveries render with terminal styling
- First discovery is visually larger than the rest
- Type colors match the object types
- Strength scores render in terracotta circles
- Empty state: "No new discoveries" message in terminal style
- `npm run build` passes

---

## Batch D3: Polymorphic Object Feed

**Read first:**
- OBJECT-RENDERER-REFACTOR.md (Batch R3 must be partially complete)
- `src/components/commonplace/objects/` (existing type renderers)
- `src/lib/commonplace-api.ts` (fetchObjects, fetchRecentObjects)

**Goal:** Today's objects render in an editorial layout with asymmetric
sizing. Each object type uses its polymorphic renderer. Email objects
from MCP ingestion look like literal emails.

**Depends on:** OBJECT-RENDERER-REFACTOR Batch R3 (at minimum NoteCard,
SourceCard, and the new EmailCard from R5 need multi-variant support).
If R3 is not complete, this batch can use inline rendering as a bridge.

### Changes

#### `src/components/commonplace/views/DailyPage.tsx`

Add a "Today" section that fetches recent objects and renders them in an
editorial layout. The layout rules:

1. The most-connected or most-recent object of the day renders as a hero
   (full-width, larger padding, full body text). If it's an email, use the
   literal email renderer.
2. The next 2 objects render in an asymmetric 60/40 two-column grid.
3. Tasks render as a single full-width row.
4. Remaining objects render as compact cards in 2 or 3 column grids,
   grouped loosely by type affinity (emails together, concepts together).

**Layout is driven by data, not hardcoded.** A `layoutObjects()` utility
function takes the list of recent objects and assigns each a layout slot:

```typescript
type LayoutSlot = 'hero' | 'pair-large' | 'pair-small' | 'full-row' | 'grid-item';

interface LayoutAssignment {
  object: ApiObject;
  slot: LayoutSlot;
}

function layoutObjects(objects: ApiObject[]): LayoutAssignment[] {
  // 1. Sort by connections desc, then recency
  // 2. First item: hero
  // 3. Next 2: pair-large + pair-small
  // 4. Tasks: full-row
  // 5. Remaining: grid-item
}
```

**Object variant:** Objects in the daily feed use `variant="module"` from the
ObjectRenderer system. The hero uses a new `variant="hero"` that renders at
larger scale (this is added to the ObjectVariant union in R1).

**Verification:**
- Objects render with correct type-specific visuals
- Hero object is visually dominant (larger, more padding)
- Asymmetric grid layouts render correctly
- Tasks render as full-width checkbox rows
- `npm run build` passes

---

## Batch D4: TensionStrip + NotebookShelf + IQ Header

**Read first:**
- `src/components/commonplace/views/DailyPage.tsx` (from D1-D3)
- `apps/notebook/tensions.py` (Tension model)
- `apps/notebook/iq_measurement.py` (IQ snapshot)
- `src/components/commonplace/views/NotebookListView.tsx` (existing notebook rendering)

**Goal:** Complete the Tier 3 ambient elements.

### TensionStrip

A gold-accented bar showing the open tension count and the highest-priority
tension title. Clicking navigates to the tension/review view.

Visual: Gold left border, warning triangle icon, tension title, priority badge.
Uses `--cp-gold` tokens.

### NotebookShelf

A horizontal scrolling row of notebook spines matching the 3D book aesthetic
from the existing NotebookListView (see screenshot). Each spine is ~88px wide
with the notebook color, name, and object count.

Implementation: Reuse the notebook color and name data from `fetchNotebooks()`.
The 3D effect uses CSS `box-shadow` and `border-radius` (no Three.js needed for
the shelf view, that is the full NotebookListView's territory).

### IQ Header

The header already has placeholder IQ score from D1. In D4, wire it to the
real `/iq/latest/` endpoint. Show the composite score, and on hover, show a
tooltip with all 7 axis scores.

**Verification:**
- Tensions strip shows real tension count and top tension
- Clicking tension navigates to the review view
- Notebook shelf scrolls horizontally with spine visuals
- Clicking a spine opens the notebook workspace
- IQ score updates from real data
- `npm run build` passes

---

## Batch D5: CommonPlaceRail (Sidebar Collapse)

**Read first:**
- `src/components/commonplace/shell/CommonPlaceShell.tsx`
- `src/components/commonplace/shell/CommonPlaceSidebar.tsx`
- `src/components/commonplace/shell/CommonPlaceRail.tsx` (stub: 124 bytes)
- `src/lib/providers/workspace-provider.tsx`

**Goal:** The sidebar can collapse to a 48px icon rail. The rail is the
default state on the daily page. The full sidebar expands on click or hover.

### Changes

#### `src/lib/providers/workspace-provider.tsx`

Add `sidebarMode: 'rail' | 'expanded'` state and `toggleSidebarMode` action.
Default: `'rail'`.

#### `src/components/commonplace/shell/CommonPlaceRail.tsx` (REPLACE)

The 48px icon rail with:
- Logo "C" at top (click toggles to full sidebar)
- 5 nav icons: Home, Library, Map, Notebooks, Engine
- Active state: terracotta background glow
- Bottom: green engine status dot

Icons use Iconoir (already installed). Each button calls `navigateToScreen()`
or `launchView()` from the LayoutProvider.

#### `src/components/commonplace/shell/CommonPlaceShell.tsx`

Conditionally render `CommonPlaceRail` or `CommonPlaceSidebar` based on
`sidebarMode`. When mode is `'rail'`, the main content area gets the full
viewport width minus 52px.

```typescript
const { sidebarMode, toggleSidebarMode } = useWorkspace();

return (
  <>
    {sidebarMode === 'rail'
      ? <CommonPlaceRail onExpand={toggleSidebarMode} />
      : <CommonPlaceSidebar onCollapse={toggleSidebarMode} />
    }
    <main ...>
      <SplitPaneContainer />
    </main>
  </>
);
```

#### Sidebar expand trigger

The rail has a hover zone on its right edge (8px wide, invisible) that shows
a subtle expand indicator on hover. Clicking the "C" logo or the expand
indicator toggles to full sidebar.

The full sidebar gains a collapse button (left-arrow icon at the top right
of the sidebar header) that returns to rail mode.

**Verification:**
- App loads with 48px rail by default
- All 5 nav icons work and show active state
- Clicking "C" expands to full sidebar
- Collapse button in sidebar returns to rail
- Content area width adjusts correctly
- Mobile: rail is hidden, sidebar uses existing mobile drawer
- `npm run build` passes

---

## Batch D6: Email Object Type Renderer

**Read first:**
- OBJECT-RENDERER-REFACTOR.md Batch R5 (EmailCard)
- `src/components/commonplace/objects/` (existing renderers)
- `src/styles/object-cards.css` (from R2)

**Goal:** Email objects ingested via Gmail MCP render as literal emails.

**Depends on:** OBJECT-RENDERER-REFACTOR R3 (multi-variant renderers) and
the Django backend having an `email` ObjectType registered.

### EmailCard Visual Design

The email renderer borrows the visual language of email clients:

**Header bar** (light colored background):
- Envelope icon in a rounded square (type-colored)
- Sender name (bold, 12px)
- Sender address (mono, 10px, muted)
- Source badge: "Gmail" with globe icon, pill-shaped
- Timestamp (mono, 10px, right-aligned)

**Body area:**
- Subject line (bold, 14px, full color)
- Preview text (12.5px, muted, 2-line clamp)

**Footer** (if connections exist):
- Terracotta dot + "{n} connections found by engine"

**Compact variant** (for grid/feed placement):
- Single row: envelope icon, subject (truncated), source badge, timestamp
- No sender address, no body preview

**Hero variant** (for daily page hero slot):
- Full header bar with all fields
- Extended preview (4-line clamp instead of 2)
- Connection footer
- Top accent stripe in type color

### CSS Classes

```css
.cp-obj-email { /* inherits .cp-obj */ }
.cp-obj-email .email-header { ... }
.cp-obj-email .email-icon { ... }
.cp-obj-email .email-from { ... }
.cp-obj-email .email-subject { ... }
.cp-obj-email .email-preview { ... }
.cp-obj-email .email-source-badge { ... }
.cp-obj-email .email-footer { ... }
```

### Data Mapping

Email objects from MCP ingestion store metadata in the Object's `properties`
JSON field (or dedicated model fields if added):

| Email field | Object field |
|-------------|-------------|
| Subject | `title` |
| From name | `properties.from_name` |
| From address | `properties.from_address` |
| Preview/snippet | `body` (first 500 chars) |
| Source system | `properties.source_system` ("gmail") |
| Thread ID | `properties.thread_id` |
| Has attachments | `properties.has_attachments` |
| Received at | `captured_at` |

The renderer reads `properties.from_name` and `properties.source_system` to
render the email-specific chrome.

**Verification:**
- Email objects render with the literal email visual
- Source badge shows "Gmail" (or other MCP source)
- Compact variant works in grid layouts
- Hero variant works when email is the top daily object
- Objects without email properties fall back gracefully to default card
- `npm run build` passes

---

## Invariants

1. **The daily page is a screen, not a pane view.** It replaces the content
   area entirely (like Library or Engine). It is not renderable inside a
   split pane. The split-pane workspace is a separate mode.

2. **All styles use CSS Modules and tokens.** No inline styles except for
   dynamic values that must be computed at runtime (e.g., type colors set
   via CSS custom properties on data attributes).

3. **The search bar is not a capture field.** It searches the graph or
   ingests URLs. Capture stays in the sidebar.

4. **Discovery feed uses terminal visual language.** Dark background, mono
   font, colored node indicators. This matches the existing engine terminal
   aesthetic that already has character in the app.

5. **Editorial layout, not uniform grid.** Objects in the daily feed have
   size variation based on importance. Hero objects are large. Grid items
   are compact. Tasks are full-width rows. The layout function assigns
   slots based on connection count and recency.

6. **The rail is the default sidebar state.** The full sidebar is available
   but not the default. Content is the main character.

7. **Email objects look like emails.** Header bar with sender, subject in
   the body, source badge showing provenance. The type's visual identity
   communicates "this came from your inbox" before any label is read.

## Estimated Timeline

| Batch | Sessions | What Ships |
|-------|----------|-----------|
| D1 | 1 | Daily page shell, search bar, default screen |
| D2 | 1-2 | Engine discovery feed with real data |
| D3 | 2-3 | Polymorphic object feed with editorial layout |
| D4 | 1 | Tensions, notebooks, live IQ |
| D5 | 1-2 | Sidebar rail collapse |
| D6 | 1 | Email object renderer |

Total: 7-10 sessions. D1-D2 can ship independently. D3 depends on progress
in the OBJECT-RENDERER-REFACTOR spec. D5 and D6 are parallelizable.
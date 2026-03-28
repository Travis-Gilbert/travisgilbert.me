# CommonPlace Daily Page: Homepage Redesign

> **For Claude Code. One batch per session.**
> **Depends on: OBJECT-RENDERER-REFACTOR.md (Batch R3+ for polymorphic ObjectRenderer)**
> **Reference prototypes: commonplace-v3.html, discovery-shapes.html (project knowledge)**

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
reason you open CommonPlace. Rendered as a *conversation* between connected
objects: discoveries alternate left and right like a dialog, with the engine
as the intermediary that noticed the relationship. The most important discovery
is physically larger than the rest.

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

## Discovery Feed Layout Patterns (Reusable Library)

Six layout patterns were prototyped in `discovery-shapes.html`. The daily page
uses **Pattern E (Conversation)** for the discovery feed. The other patterns
are documented here for reuse across CommonPlace surfaces:

| Pattern | Shape | Best For |
|---------|-------|----------|
| A. Stacked | Uniform vertical cards | Simple lists, review queues |
| B. Hero + List | One expanded card, rest as inline table rows | Feeds where one item dominates |
| C. Carousel | Horizontal scroll cards | Compact scanning, dashboard widgets |
| D. Ticker | Accordion rows, first expanded | Terminal/log aesthetic, dense feeds |
| E. Conversation | Alternating left/right bubbles | **Discovery feed (selected)** |
| F. Mosaic | Magazine grid, mixed sizes | Editorial feeds, mixed content |

Pattern B is a strong candidate for the Connection Review view (one connection
expanded for rating, others queued as rows). Pattern D fits the Engine Terminal.
Pattern F is what the object feed below discoveries already uses.

## Route and File Map

```
src/
  app/(commonplace)/commonplace/
    page.tsx                         MODIFY: render DailyPage instead of empty fragment

  components/commonplace/
    views/
      DailyPage.tsx                  NEW: the daily page (client component)
      DailyPage.module.css           NEW: scoped styles
      EngineDiscoveryFeed.tsx         NEW: Tier 1 conversation layout
      EngineDiscoveryFeed.module.css  NEW: conversation bubble styles
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
and the edge metadata.

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

Read-only view over Edge objects filtered by `is_auto=True` and
`created_at > since`, ordered by `-created_at`, with related from_object
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

### GET /api/v1/notebook/iq/latest/

Returns the most recent IQ snapshot.

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
| D2 | EngineDiscoveryFeed (conversation layout) | D1, backend discoveries endpoint |
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
1. Shows "Search your graph or paste a URL..." placeholder
2. On typing: debounces 300ms, calls `/api/v1/notebook/search/`
3. On URL detected (http/https): shows "Ingest with Firecrawl" action
4. On Enter with URL: calls existing scrape/ingest pipeline
5. Keyboard: `/` focuses from anywhere on daily page

**Styling:** CSS Module. Height: 44px. Search icon on left. When URL detected,
"Ingest" button appears on right.

#### `src/components/commonplace/views/DailyPage.tsx` (NEW)

Client component. The page shell with three-tier layout:
- Header (date + IQ)
- SearchIngestBar
- Placeholder sections for discoveries, objects, tensions, notebooks

#### `src/components/commonplace/views/DailyPage.module.css` (NEW)

Max-width 800px container, serif date title, mono stats, section labels with
count badges and horizontal rule lines.

**Verification:**
- Navigate to `/commonplace` and see the daily page
- Date header shows today's date
- Search bar renders and focuses on `/` keypress
- Placeholder sections visible
- `npm run build` passes

---

## Batch D2: EngineDiscoveryFeed (Conversation Layout)

**Read first:**
- `src/components/commonplace/views/DailyPage.tsx` (from D1)
- `src/lib/commonplace-api.ts` (API fetch patterns)
- `apps/notebook/engine.py` (Edge model, engine field values)
- Reference: `discovery-shapes.html` Layout E

**Goal:** The discovery feed renders as a conversation between connected
objects. Discoveries alternate left and right, creating visual variety
through position and size rather than uniform stacking.

### The Conversation Layout

Discoveries are a dialog. The engine noticed that Object A and Object B
are related. The layout renders this as two speech bubbles facing each
other, with the engine's reasoning as the bridge between them.

**Hierarchy through three tiers of discovery size:**

#### Tier 1: Hero discovery (the strongest or most recent)

Full-width conversation row. Both objects render as large bubbles
(max-width: 55%) with:
- Type-colored dot (10px, rounded square)
- Object name in type color, 15px, font-weight 600
- Strength circle (28px) centered between the bubbles
- Reason text below the bubbles spanning full width (13px, --cp-text-f)
- Engine badges (mono, 9px, pill-shaped)

The left bubble contains the from-object. The right bubble contains
the to-object. A vertical connector line in terracotta connects them.

```
    +---------------------------+      +---------------------------+
    | [purple dot]              |      |              [cream dot]  |
    | Hamming's generative      |  87  | Shannon's relay memory    |
    | learning                  |      |                           |
    +---------------------------+      +---------------------------+

    Both describe systems that encode knowledge through operation
    rather than explicit instruction.

    [sbert]  [cosine: 0.87]
```

#### Tier 2: Secondary discoveries

Medium conversation rows. Only the "from" side gets a full bubble
(max-width: 50%). The "to" side renders as a compact name-only bubble
(max-width: 40%, less padding). The row alternates direction:
- Discovery 2: from-bubble left, to-name right (same as hero)
- Discovery 3: from-bubble RIGHT, to-name left (flipped)

This alternation creates the conversational rhythm.

```
                  +---------------------------+         +---------+
                  | [blue dot]                |   94    | [teal]  |
                  | Re: TPU Research Cloud    |         | Google  |
                  |                           |         | TRC     |
                  +---------------------------+         +---------+
                  Entity match: TPU, Google, Theseus.
                  [shared_entity]

    +---------+         +---------------------------+
    | [cream] |   72    | [steel dot]               |
    | CAP     |         | Redis concurrency guards  |
    | theorem |         |                           |
    +---------+         +---------------------------+
                        Shared terms: partition tolerance.
                        [bm25]
```

Each secondary discovery is roughly 70% the visual weight of the hero:
smaller text (13px names), smaller score circle (24px), 1-line reason
(truncated with ellipsis if longer), single engine badge.

#### Tier 3: Compact pair

If 4+ discoveries, the last two render as a tight horizontal pair
(side by side, 50/50 grid). Each compact discovery is a single row:
dot + name + score + name + dot + engine badge. No reason text. No
alternation. This is the "and also" tier that doesn't demand attention.

```
    [teal] Buehler 2025 --|81|-- Self-org spec [teal]  sbert
```

### CSS Classes

```css
.convo                    /* flex column container, gap: 12px */
.convo-row                /* flex row, one discovery */
.convo-row.flipped        /* flex-direction: row-reverse */
.convo-bubble             /* the speech bubble: term bg, border, rounded */
.convo-bubble.primary     /* large: max-width 55%, padding 18px */
.convo-bubble.secondary   /* compact name-only: max-width 40%, padding 10px 14px */
.convo-connector          /* vertical terracotta line between bubbles */
.convo-names              /* flex row of dot + name inside bubble */
.convo-reason             /* reason text spanning below the bubbles */
.convo-compact-row        /* 2-column grid for Tier 3 compact pair */
```

### Component Structure

```typescript
interface EngineDiscoveryFeedProps {
  discoveries: EngineDiscovery[];
}

export default function EngineDiscoveryFeed({ discoveries }: EngineDiscoveryFeedProps) {
  if (!discoveries.length) return <EmptyDiscoveries />;

  // Sort by strength descending
  const sorted = [...discoveries].sort((a, b) => b.strength - a.strength);
  const hero = sorted[0];
  const secondary = sorted.slice(1, 3);   // up to 2 medium
  const compact = sorted.slice(3);         // rest as compact pairs

  return (
    <div className={styles.convo}>
      <HeroDiscovery discovery={hero} />
      {secondary.map((d, i) => (
        <SecondaryDiscovery key={d.edge_id} discovery={d} flipped={i % 2 === 1} />
      ))}
      {compact.length > 0 && (
        <div className={styles.compactRow}>
          {compact.map(d => <CompactDiscovery key={d.edge_id} discovery={d} />)}
        </div>
      )}
    </div>
  );
}
```

### Type Color Resolution

Each object's type-colored dot uses the `--cp-type-{slug}` token. The
component maps `object_type_slug` to the CSS variable:

```typescript
const TYPE_COLORS: Record<string, string> = {
  note: 'var(--cp-type-note)',
  source: 'var(--cp-type-source)',
  person: 'var(--cp-type-person)',
  concept: 'var(--cp-type-concept)',
  // ... all 10+ types
};
```

This is set as an inline `style={{ background: TYPE_COLORS[slug] }}` on
the dot element (one of the few acceptable inline styles, per invariant 2).

### Empty State

When no discoveries exist, render a centered terminal-style message:

```
    +-----------------------------------------+
    |  $ engine idle. No new connections       |
    |    since your last visit.                |
    |                                          |
    |    Run the engine or capture new objects  |
    |    to generate discoveries.              |
    +-----------------------------------------+
```

Background: `var(--cp-term-bg)`. Mono font. Muted text. The `$` prompt
in cyan.

### Integration with DailyPage

```typescript
import EngineDiscoveryFeed from './EngineDiscoveryFeed';
import { fetchDiscoveries } from '@/lib/commonplace-api';

// In component:
const { data: discoveries } = useApiData(
  () => fetchDiscoveries(lastVisit),
  [],
);

// In JSX, Tier 1 section:
<section className={styles.section}>
  <div className={styles.sectionLabel}>
    <ConnectionIcon />
    Engine found <span className={styles.count}>{discoveries.length}</span> connections
    <span className={styles.line} />
  </div>
  <EngineDiscoveryFeed discoveries={discoveries} />
</section>
```

**Verification:**
- Hero discovery renders as large left/right conversation
- Secondary discoveries alternate direction
- Compact pair renders as tight inline row
- Type colors match object types
- Strength scores render in terracotta circles
- Empty state renders when no discoveries
- Visual weight decreases from hero to secondary to compact
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
- `src/components/commonplace/views/NotebookListView.tsx`

**Goal:** Complete the Tier 3 ambient elements.

### TensionStrip

A gold-accented bar showing the open tension count and the highest-priority
tension title. Clicking navigates to the tension/review view.

Visual: Gold left border, warning triangle icon, tension title, priority badge.
Uses `--cp-gold` tokens.

### NotebookShelf

A horizontal scrolling row of notebook spines matching the 3D book aesthetic
from the existing NotebookListView. Each spine is ~88px wide with the notebook
color, name, and object count. CSS `box-shadow` for the 3D effect.

### IQ Header

Wire the header IQ score to the real `/iq/latest/` endpoint. On hover, show
a tooltip with all 7 axis scores.

**Verification:**
- Tensions strip shows real data, clicking navigates
- Notebook shelf scrolls with spine visuals, clicking opens workspace
- IQ score updates from real data with hover tooltip
- `npm run build` passes

---

## Batch D5: CommonPlaceRail (Sidebar Collapse)

**Read first:**
- `src/components/commonplace/shell/CommonPlaceShell.tsx`
- `src/components/commonplace/shell/CommonPlaceSidebar.tsx`
- `src/components/commonplace/shell/CommonPlaceRail.tsx` (stub: 124 bytes)
- `src/lib/providers/workspace-provider.tsx`

**Goal:** The sidebar can collapse to a 48px icon rail. The rail is the
default state on the daily page.

### Changes

- Add `sidebarMode: 'rail' | 'expanded'` to WorkspaceProvider (default: `'rail'`)
- Implement CommonPlaceRail: "C" logo, 5 nav icons, green engine dot
- CommonPlaceShell renders Rail or Sidebar based on mode
- Click "C" to expand, collapse button in sidebar to return
- Mobile: rail hidden, existing mobile drawer unchanged

**Verification:**
- App loads with 48px rail by default
- All nav icons work with active state
- Toggle between rail and sidebar works
- Content area width adjusts correctly
- `npm run build` passes

---

## Batch D6: Email Object Type Renderer

**Read first:**
- OBJECT-RENDERER-REFACTOR.md Batch R5 (EmailCard)
- `src/components/commonplace/objects/`
- `src/styles/object-cards.css` (from R2)

**Goal:** Email objects ingested via Gmail MCP render as literal emails.

### EmailCard Visual Design

**Header bar** (colored background):
- Envelope icon in rounded square
- Sender name (bold, 12px) + address (mono, 10px)
- Source badge: "Gmail" pill with globe icon
- Timestamp (mono, 10px)

**Body area:**
- Subject line (bold, 14px)
- Preview text (12.5px, muted, 2-line clamp)

**Footer** (if connections): Terracotta dot + "{n} connections found by engine"

**Variants:**
- Compact: icon + subject + source badge + timestamp (single row)
- Hero: full header, 4-line preview, footer, top accent stripe

### Data Mapping

| Email field | Object field |
|-------------|-------------|
| Subject | `title` |
| From name | `properties.from_name` |
| From address | `properties.from_address` |
| Preview | `body` (first 500 chars) |
| Source system | `properties.source_system` ("gmail") |
| Thread ID | `properties.thread_id` |
| Has attachments | `properties.has_attachments` |
| Received at | `captured_at` |

**Verification:**
- Email objects render with literal email visual
- Source badge shows "Gmail" (or other MCP source)
- All three variants work (default, compact, hero)
- Graceful fallback for objects without email properties
- `npm run build` passes

---

## Invariants

1. **The daily page is a screen, not a pane view.** It replaces the content
   area entirely (like Library or Engine). Not renderable in a split pane.

2. **All styles use CSS Modules and tokens.** No inline styles except for
   dynamic type colors set via CSS custom properties.

3. **The search bar is not a capture field.** It searches the graph or
   ingests URLs. Capture stays in the sidebar.

4. **Discovery feed uses conversation layout.** Alternating left/right
   bubbles with three tiers of hierarchy: hero (large, full reason),
   secondary (medium, alternating direction), compact (tight inline pair).
   This is Pattern E from the shape explorer prototype.

5. **Editorial layout, not uniform grid.** Objects in the daily feed have
   size variation based on importance. The `layoutObjects()` function assigns
   slots based on connection count and recency.

6. **The rail is the default sidebar state.** Content is the main character.

7. **Email objects look like emails.** Header bar with sender, subject,
   source badge. The visual identity communicates provenance before any
   label is read.

8. **Layout patterns are reusable.** The six patterns (A-F) from the shape
   explorer are available for any surface in CommonPlace. Pattern B for
   Connection Review. Pattern D for Engine Terminal. Pattern F for the
   object feed. Each pattern is a CSS Module that can be imported by any
   view component.

## Estimated Timeline

| Batch | Sessions | What Ships |
|-------|----------|-----------|
| D1 | 1 | Daily page shell, search bar, default screen |
| D2 | 1-2 | Engine discovery conversation feed |
| D3 | 2-3 | Polymorphic object feed with editorial layout |
| D4 | 1 | Tensions, notebooks, live IQ |
| D5 | 1-2 | Sidebar rail collapse |
| D6 | 1 | Email object renderer |

Total: 7-10 sessions. D1-D2 can ship independently. D3 depends on progress
in the OBJECT-RENDERER-REFACTOR spec. D5 and D6 are parallelizable.
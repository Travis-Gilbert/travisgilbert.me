# Sourcebox Redesign: Kanban Capture + Enrichment Board

**Date:** 2026-02-27
**Status:** Designed
**Scope:** publishing_api Sourcebox (Draftroom)

## Problem

The current Sourcebox is a flat list with a single URL input and immediate accept/reject/defer triage. It has several gaps:

- No way to capture sources quickly without immediately triaging them
- OG scraping blocks the request for up to 10 seconds with no loading state
- No file/PDF upload support (only URLs)
- Tags JSONField and decision_note TextField exist on the model but have no UI
- SuggestedConnection model exists but has zero UI surface
- No importance/priority rating
- No way to connect sources to essays or field notes during triage
- No batch URL input for research session dumps
- Filter tabs use full-page reloads instead of HTMX

## Design

### Mental Model: Three-Phase Flow

Sources move left to right through a kanban board:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    INBOX     │ →  │   REVIEW    │ →  │   DECIDED   │
│              │    │             │    │             │
│  Raw capture │    │  Enrich &   │    │  Accepted / │
│  URL or file │    │  evaluate   │    │  Rejected / │
│  OG loading  │    │  tags,notes │    │  Deferred   │
│              │    │  connections│    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

**Capture** is fast and thoughtless: paste URLs (single or batch), drag files, click to browse.

**Enrichment** is deliberate: add tags, notes, importance, source type, and connections to existing content.

**Decision** is the final step: Accept (promotes to Paper Trail), Reject (archives), or Defer (keeps for later).

### Unified Capture Bar

A full-width input bar above the kanban columns that accepts three input types:

1. **Paste URLs** (single or batch): Paste one URL or a block of newline-separated URLs. Each URL spawns a card in Inbox immediately.
2. **Drag and drop files**: Dashed-border drop zone activates on drag-enter, accepting PDFs, images, and documents.
3. **Click to browse**: Upload icon at the right edge opens a file picker as fallback.

Placeholder text: `Paste URLs, drop files, or click to upload...`

On paste detection of multiple lines, a small badge shows "4 URLs detected" before submission.

### Async OG Scraping

Replaces the current synchronous 10-second blocking scrape.

1. Card appears instantly in Inbox with URL displayed, everything else in shimmer/skeleton state
2. Background task fetches OG metadata (Django-Q2 or `threading.Thread` for MVP)
3. Card updates via HTMX polling (`hx-trigger="every 2s"`) when metadata resolves
4. Server sends `HX-StopPolling: true` header when scrape completes
5. If scraping fails after timeout, card shows raw URL with "Retry" action

### Kanban Card Anatomy

**Inbox cards** (minimal):
- Small 48px square OG image thumbnail (left-aligned) or file type icon
- Title (or URL if still loading)
- Site name / filename
- Shimmer CSS overlay while OG scrape is in progress
- Subtle "-> Review" button on hover

**Review cards** (richer):
- Same as Inbox, plus:
- Tag pills (if any added)
- Importance dot (color-coded: high = terracotta, medium = amber, low = muted)
- Small connection count badge if linked to essays
- Click anywhere to open detail panel

**Decided cards** (subdued):
- Muted/grayed styling with status pill: Accepted (green), Rejected (red), Deferred (amber)
- Accepted cards show "Promoted to Paper Trail" if promotion succeeded
- Compact height for scannability
- "Undo" link visible for 30 seconds after decision

**Image treatment:** All OG images render as small thumbnails, never as card headers or hero banners. `max-height: 120px` with `object-fit: cover` in the detail panel, 48px squares on kanban cards.

### Slide-Out Detail Panel

Opens from the right edge on card click (~40% viewport width). Kanban stays visible behind a dimmed backdrop. Close via X button, Escape, or backdrop click.

**Layout, top to bottom:**

**Source Preview (read-only):**
- Small thumbnail (max 120px) left-aligned, title/URL/metadata flowing beside it
- Clickable URL opens in new tab
- Site name, domain, date captured
- For files: filename, file size, page count (PDF)

**Enrichment Form:**

- **Source Type**: Dropdown, auto-detected from URL domain (article, video, paper, podcast, book, tool, dataset, repository). Overridable. Files default to "document" or "paper" for PDFs.

- **Importance**: Three-level toggle buttons: Low / Medium / High. Color-coded (muted / amber / terracotta). Defaults to Medium.

- **Tags**: Multi-select input with typeahead autocomplete from existing tag corpus. Create new tags inline by typing + Enter. Pills display below input.

- **Notes**: Textarea for annotation. Placeholder: "Why does this source matter? What caught your attention?" Supports basic markdown.

- **Connections**: "Add Connection" button reveals a row with:
  - Content picker: autocomplete across essays and field notes (slug + title)
  - Relationship type: dropdown with "supports," "contradicts," "inspired by," "cited in"
  - Multiple connections allowed, each as own row with remove button

**Decision Bar (sticky at panel bottom):**
Accept (green) / Reject (red) / Defer (amber) buttons, always visible. Small text field for optional decision note appears on click before confirming. Accept triggers promotion to Paper Trail via the existing httpx promotion pipeline.

### Drag Behavior

- Inbox -> Review: starts enrichment phase
- Review -> Decided: opens quick-action popover (Accept / Reject / Defer)
- No backward drag by default, but "Move back to Review" action exists on Decided cards
- Implemented via Sortable.js (~9kb) with `htmx-sortable` extension

### Filtering

A filter bar above the columns supports filtering by tags, importance, source type, or date range. Filters apply across all three columns simultaneously. HTMX-driven, replacing the current full-page-reload tab system.

### Column Styling

- Inbox: neutral background wash
- Review: faint terracotta tint (active work zone)
- Decided: muted/desaturated
- Column headers use Studio `section_label` Cotton component
- Cards use Studio `card` Cotton component with hover lift
- Detail panel: cream background, subtle left border, same surface treatment as Studio editor sidebar

## Data Model Changes

### RawSource Model

| Field | Change | Type | Purpose |
|-------|--------|------|---------|
| `source_file` | Add | FileField (nullable, blank) | Stores uploaded PDFs/documents |
| `input_type` | Add | CharField (url/file) | Distinguishes source input method |
| `importance` | Add | CharField (low/medium/high) | Three-level importance rating |
| `connections` | Add | JSONField (default []) | `[{slug, content_type, relationship}]` |
| `phase` | Add | CharField (inbox/review/decided) | Tracks kanban column position |
| `scrape_status` | Add | CharField (pending/complete/failed) | Tracks async OG scrape state |
| `url` | Modify | Make nullable (blank=True, null=True) | Files don't have URLs |

`phase` is separate from `decision` because a card can be in Review with a pending decision, or in Decided with an accepted decision. Phase = board position; decision = outcome.

### SuggestedConnection Model

Retire. Its purpose is absorbed by the `connections` JSONField on RawSource. Simpler than a separate table for draft metadata that gets promoted with the source.

### Relationship Types

Stored as string values in the connections JSONField:
- `supports`: Source provides evidence for or agrees with the linked content
- `contradicts`: Source challenges or disagrees with the linked content
- `inspired_by`: Source was the inspiration or starting point for the linked content
- `cited_in`: Source is directly referenced in the linked content

## HTMX Interaction Patterns

### Capture -> Inbox

Capture bar: `hx-post="/sourcebox/add/"`, `hx-swap="afterbegin"` on Inbox column. For batch URLs, response contains multiple card fragments. File uploads use `hx-encoding="multipart/form-data"`. Drop zone uses ~20 lines of JS to intercept drag events and populate a hidden file input.

### OG Scrape Polling

Inbox cards with `scrape_status=pending` include `hx-get="/sourcebox/card/{id}/"` with `hx-trigger="every 2s"`, `hx-swap="outerHTML"`. Server sends `HX-StopPolling: true` on completion. Shimmer state is pure CSS.

### Column Drag

Sortable.js fires `hx-post="/sourcebox/move/"` with card ID and target phase on drop. Server updates `phase`, returns re-rendered card for new column context.

### Detail Panel

Card click: `hx-get="/sourcebox/detail/{id}/"` targeting `#detail-panel` div. Panel slides in via CSS `transform: translateX`. Close: `hx-swap="innerHTML"` with empty content, CSS transitions out.

### Decision

Panel buttons: `hx-post="/sourcebox/triage/{id}/"` with `hx-vals` for decision. Response updates panel (close/confirm) and card via `hx-swap-oob` (moves to Decided column).

## URL Routes

```python
urlpatterns = [
    path('', views.SourceboxBoardView.as_view(), name='sourcebox'),
    path('add/', views.SourceboxCaptureView.as_view(), name='sourcebox-add'),
    path('card/<int:pk>/', views.SourceboxCardView.as_view(), name='sourcebox-card'),
    path('detail/<int:pk>/', views.SourceboxDetailView.as_view(), name='sourcebox-detail'),
    path('move/', views.SourceboxMoveView.as_view(), name='sourcebox-move'),
    path('triage/<int:pk>/', views.SourceboxTriageView.as_view(), name='sourcebox-triage'),
]
```

## Dependencies

- **Sortable.js** (~9kb): Drag-and-drop for kanban columns. No other dependencies.
- **htmx-sortable extension**: Bridges Sortable.js events to HTMX requests.
- **Django-Q2** (optional): Background task queue for async OG scraping. For MVP, `threading.Thread` is sufficient for a single-user app.

## Responsive Behavior

Single-user desktop tool; mobile optimization is low priority. At narrower viewports:
- Columns stack vertically
- Detail panel becomes full-width overlay instead of side panel

## Migration Path

The redesign replaces the existing flat-list Sourcebox at the same URL (`/sourcebox/`). Existing RawSource data is preserved; new fields get sensible defaults (`phase='decided'` for already-triaged sources, `phase='inbox'` for pending, `importance='medium'`, `input_type='url'`).

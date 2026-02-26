# Research Trail Frontend Components

> Implementation guide for building the Research Trail UI in the Next.js site at `travisgilbert.me`.
> The backend is live at `research.travisgilbert.me` (Django REST API on Railway).

## Overview

The Research Trail is a section that appears on essay and field note detail pages, below the article body. It surfaces the research behind each piece of content: what sources informed it, how those sources connect to other content, the chronological timeline of the investigation, external mentions/responses, and community-suggested sources.

The trail fetches data from `https://research.travisgilbert.me/api/v1/trail/<slug>/` and renders it in a tabbed interface with three views: Sources, Research Thread, and Conversation.

## Architecture

### Data Flow

1. **Build time (static)**: The research_api publishes JSON to `src/data/research/trails/<slug>.json` via GitHub commits. The Next.js page reads this at build time for SEO and initial render.
2. **Request time (dynamic)**: A client component fetches fresh data from the API for interactive features and updates.

For the initial implementation, use the API directly from a client component. Static JSON integration can be added later as an optimization.

### File Structure

Create these files:

```
src/
  lib/
    research.ts              # API client + TypeScript types
  components/
    research/
      ResearchTrail.tsx       # Main wrapper (client component, fetches data, renders tabs)
      SourceCard.tsx          # Individual source with badges, annotation, key findings
      BacklinkCard.tsx        # Connected content card
      ThreadTimeline.tsx      # Vertical timeline of research thread entries
      MentionCard.tsx         # External mention with excerpt
      SuggestionCard.tsx      # Community-suggested source
      SuggestSourceForm.tsx   # Form for submitting source suggestions
      TypeBadge.tsx           # Source type badge (Book, Paper, Document, etc.)
      RoleBadge.tsx           # Source role badge (Primary, Data, Background, etc.)
```

### Integration Point

In `src/app/essays/[slug]/page.tsx`, add `<ResearchTrail slug={slug} />` after the `<SourcesCollapsible>` section (or replace it, since ResearchTrail supersedes the static sources list). The component is a client component (`'use client'`) that handles its own data fetching.

```tsx
{/* After the existing SourcesCollapsible section */}
<RoughLine />
<ResearchTrail slug={slug} />
```

## API Shape

### Primary endpoint: `GET /api/v1/trail/<slug>/`

Returns all research context for a single piece of content in one request.

```typescript
interface TrailResponse {
  slug: string;
  contentType: 'essay' | 'field_note';
  sources: TrailSource[];
  backlinks: Backlink[];
  thread: ResearchThread | null;
  mentions: Mention[];
}

interface TrailSource {
  id: number;
  title: string;
  slug: string;
  creator: string;
  sourceType: string;    // book, article, paper, video, podcast, dataset, document, report, map, archive, interview, website
  url: string;
  publication: string;
  publicAnnotation: string;
  role: string;          // primary, background, inspiration, data, counterargument, methodology, reference
  keyQuote: string;
}

interface Backlink {
  contentType: string;
  contentSlug: string;
  contentTitle: string;
  sharedSources: Array<{
    sourceId: number;
    sourceTitle: string;
  }>;
}

interface ResearchThread {
  title: string;
  slug: string;
  description: string;
  status: string;       // active, paused, completed, abandoned
  startedDate: string;  // ISO date
  entries: ThreadEntry[];
}

interface ThreadEntry {
  entryType: string;    // source, note, milestone, connection, question
  date: string;         // ISO date
  title: string;
  description: string;
  sourceTitle: string;
}

interface Mention {
  sourceUrl: string;
  sourceTitle: string;
  sourceExcerpt: string;
  sourceAuthor: string;
  mentionType: string;  // reply, link, repost, like, mention, quote
  featured: boolean;
  mentionSourceName: string;
  mentionSourceAvatar: string;
  createdAt: string;
}
```

### Community submissions: `POST /api/v1/suggest/source/`

```typescript
interface SourceSuggestion {
  title: string;
  url: string;
  source_type: string;
  relevance_note: string;       // max 1000 chars
  target_content_type: string;  // essay or field_note
  target_slug: string;
  contributor_name: string;     // optional
  contributor_url: string;      // optional
  recaptcha_token: string;
}
```

### Approved suggestions: `GET /api/v1/suggestions/<slug>/`

Returns approved community suggestions for display alongside sources.

## Design Specifications

### Typography System

The Research Trail uses the **Editor** typography system (investigation/data context):

| Role | Font | Weight | CSS Class / Variable |
|------|------|--------|---------------------|
| Section headings | Vollkorn | 700 | `font-title font-bold` |
| Body / annotations | IBM Plex Sans | 400 | `font-body-alt` |
| Labels / badges / dates | Space Mono | 400 | `font-mono-alt` |
| Metadata / timestamps | Courier Prime | 400 | `font-mono` |

Use the existing Tailwind font utility classes: `font-title`, `font-body-alt` (IBM Plex), `font-mono` (Courier Prime), `font-mono-alt` (Space Mono).

### Color Application

| Element | Color | Token / Class |
|---------|-------|---------------|
| Source cards border-left | Teal | `border-l-teal` or `border-l-[#2D5F6B]` |
| Source type badges | Teal bg, cream text | `bg-teal text-surface` |
| Role badge: primary | Terracotta bg | `bg-terracotta text-surface` |
| Role badge: data | Gold bg | `bg-gold text-ink` |
| Role badge: background | bg-alt, muted text | `bg-bg-alt text-ink-muted` |
| Mention cards border-left | Terracotta | `border-l-terracotta` |
| Community suggestions border-left | Olive/success | `border-l-[#5A7A4A]` |
| Thread timeline line | Gold gradient | `bg-gold` |
| Thread milestone dots | Gold | `bg-gold` |
| Thread source dots | Teal | `bg-teal` |
| Thread question dots | Terracotta | `bg-terracotta` |
| Key findings diamond | Gold | `text-gold` |
| Tab active state | Terracotta | `text-terracotta border-b-terracotta` |
| Tab inactive | Muted | `text-ink-light` |
| "Suggest a source" CTA button | Terracotta bg | `bg-terracotta hover:bg-terracotta-hover text-surface` |
| Backlink cards hover | Teal tint | `hover:bg-teal/[0.04] hover:border-teal/25` |

### Card Styles

All cards use the **vellum card** pattern from the brand system:

```css
/* Base card */
background: rgba(250, 246, 241, 0.85);  /* --color-surface at 85% opacity */
backdrop-filter: blur(4px);
border: 1px solid rgba(0, 0, 0, 0.06);
border-radius: 10px;                     /* 10-14px per brand spec */
```

In Tailwind:
```
bg-surface/85 backdrop-blur-[4px] border border-black/[0.06] rounded-[10px]
```

Source cards, mention cards, and thread header all get a 3px `border-left` in their accent color.

### Shadows

Use warm brown-tinted shadows, never gray:
- Default: `shadow-warm-sm` or `shadow-[0_2px_8px_rgba(42,36,32,0.07)]`
- Hover: `shadow-warm-lg` utility

### Labels

All metadata labels follow the monospace pattern:
- Font: Space Mono or Courier Prime
- Size: 10-11px
- Transform: uppercase
- Letter spacing: 0.06-0.1em
- Color: `text-ink-light` (#9A8E82) for timestamps, `text-teal` for section headers

```
font-mono-alt text-[10px] uppercase tracking-[0.08em] text-ink-light
```

## Component Specifications

### ResearchTrail.tsx (main wrapper)

- `'use client'` component
- Props: `{ slug: string }`
- Fetches from `https://research.travisgilbert.me/api/v1/trail/${slug}/`
- Shows nothing if the API returns empty data (no sources, no thread, no mentions)
- Three tabs: Sources (default), Research Thread, Conversation
- Tab bar uses Space Mono labels, terracotta active indicator
- Graceful loading state: subtle skeleton or nothing (avoid jarring loaders)
- Graceful error state: silent failure (don't show errors to visitors)

### SourceCard.tsx

- Vellum card with 3px teal left border
- Top row: TypeBadge + RoleBadge side by side, "Found [date]" right-aligned
- Title in Vollkorn 700, 18px, links to source URL if available (hover turns terracotta)
- Creator / publication / year line in Space Mono 11px, muted color
- Public annotation in IBM Plex Sans 14px, muted ink
- Key findings as gold diamond bullet list (◆ character)
- Key quote in IBM Plex Sans italic with terracotta left border

### TypeBadge.tsx

- Space Mono 10px, uppercase, tracked
- Teal background (#2D5F6B), cream text (#FAF6F1)
- Padding: 2px 8px, border-radius: 3px
- Maps source_type to display labels: book -> "Book", paper -> "Paper", etc.

### RoleBadge.tsx

- Same font specs as TypeBadge
- Color varies by role:
  - primary: terracotta bg (#B45A2D), cream text
  - data: gold bg (#C49A4A), dark text (#2A2420)
  - background: bg-alt (#E8E0D6), muted text (#6A5E52)
  - inspiration: light terracotta bg (#D4875A), cream text
  - counterargument: error red bg (#A44A3A), cream text
  - methodology: success green bg (#5A7A4A), cream text
  - reference: border color bg (#D4CCC4), muted text

### BacklinkCard.tsx

- Vellum card, NO colored left border
- Teal-tinted border: `border-teal/[0.12]`
- Hover: border darkens, subtle teal background wash
- Content type label (Space Mono uppercase) + title (Vollkorn 15px 600) + shared source count (Courier Prime 10px)
- Links to `/essays/[slug]` or `/field-notes/[slug]`
- Grid layout: `grid-cols-1 sm:grid-cols-2 gap-3`

### ThreadTimeline.tsx

- Thread header: vellum card with 3px gold left border
- Status badge (gold bg), duration in days (Courier Prime)
- Title in Vollkorn 700, description in IBM Plex 14px
- Vertical timeline below header:
  - Thin vertical line: gold-to-border gradient
  - Entry dots color-coded by type:
    - source: teal circle
    - note: hollow circle with border
    - milestone: gold diamond (rotated square)
    - question: terracotta circle
    - connection: small teal circle
  - Date in Courier Prime 10px uppercase
  - Title in IBM Plex Sans 14px 500
  - Description in IBM Plex Sans 13px muted

### MentionCard.tsx

- Vellum card with 3px terracotta left border
- Mention type label (Space Mono uppercase terracotta) + date
- Title in Vollkorn 15px 600 with external link arrow
- Excerpt in IBM Plex Sans 13px italic, quoted
- Author in Space Mono 11px muted
- Hover: terracotta border darkens, subtle terracotta wash

### SuggestionCard.tsx

- Vellum card with 3px olive/success left border (#5A7A4A)
- TypeBadge + "Community" label (Courier Prime uppercase, olive color)
- Title linking to URL
- Relevance note in IBM Plex Sans 13px
- "Suggested by [name]" in Space Mono 10px muted

### SuggestSourceForm.tsx

- Dashed border container: `border border-dashed border-border rounded-[10px]`
- "Know a source I should see?" heading in Vollkorn 16px 600
- Description in IBM Plex Sans 13px
- Terracotta CTA button: Space Mono 12px uppercase
- Expands to show form fields on click:
  - Title (required), URL, Source Type (dropdown), Relevance Note (textarea, max 1000)
  - Name (optional), Your URL (optional)
  - reCAPTCHA v3 (invisible, uses existing `src/lib/recaptcha.ts`)
  - Submit button: terracotta bg, Space Mono uppercase
- POST to `https://research.travisgilbert.me/api/v1/suggest/source/`
- Success state: "Thanks! Your suggestion will be reviewed."
- Error state: inline error message, muted red

## API Client

Create `src/lib/research.ts`:

```typescript
const RESEARCH_API = 'https://research.travisgilbert.me';

export async function fetchResearchTrail(slug: string): Promise<TrailResponse | null> {
  try {
    const res = await fetch(`${RESEARCH_API}/api/v1/trail/${slug}/`, {
      next: { revalidate: 300 }, // 5-minute cache for ISR
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function submitSourceSuggestion(data: SourceSuggestion): Promise<boolean> {
  try {
    const res = await fetch(`${RESEARCH_API}/api/v1/suggest/source/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

## Existing Patterns to Follow

### Component conventions from the codebase

- Client components use `'use client'` directive
- Phosphor icons via `@phosphor-icons/react` with weight="thin" for decorative, weight="regular" for interactive
- Radix UI primitives for accessible collapsibles, tabs (see SourcesCollapsible.tsx for Radix Collapsible usage)
- Tailwind utility classes using the custom theme tokens defined in `global.css` (e.g., `text-terracotta`, `bg-teal`, `font-title`, `font-mono`)
- Links use Next.js `<Link>` for internal, plain `<a>` for external
- Rough.js line dividers via `<RoughLine />` component for section breaks

### Tailwind custom tokens available

These are defined in `src/styles/global.css` under `@theme inline`:

**Colors**: `paper`, `surface`, `bg-alt`, `ink`, `ink-muted`, `ink-light`, `ink-secondary`, `terracotta`, `terracotta-hover`, `terracotta-light`, `teal`, `teal-light`, `gold`, `gold-light`, `border`, `border-light`, `success`, `error`

**Fonts**: `font-title` (Vollkorn), `font-title-alt` (Ysabeau), `font-body` (Cabin), `font-body-alt` (IBM Plex Sans), `font-mono` (Courier Prime), `font-mono-alt` (Space Mono), `font-annotation` (Caveat)

**Shadows**: `shadow-warm-sm`, `shadow-warm`, `shadow-warm-lg`

**Surfaces**: `.surface-elevated`, `.surface-tint-terracotta`, `.surface-tint-teal`, `.surface-tint-gold`

### Animation patterns

Use `fadeInUp` keyframe for card entrance (defined in global.css):

```css
animation: fadeInUp 0.4s ease forwards;
animation-delay: calc(var(--index) * 0.06s);
```

Set `--index` via inline style for staggered card reveals.

## Critical Rules

1. **Never use white (#FFF) backgrounds.** Always use `--color-surface` (#FAF6F1) or the vellum card pattern.
2. **Never use black (#000) text.** Always use `--color-ink` (#2A2420) or warmer.
3. **Never use gray shadows.** Use `rgba(42, 36, 32, ...)` brown-tinted shadows.
4. **Never use italic headings.** Vollkorn headings are always upright.
5. **All metadata labels are monospace, uppercase, tracked.** Dates, types, categories, counts.
6. **Border-left accent bars** on all content cards (3px solid in the section's accent color).
7. **Use IBM Plex Sans (font-body-alt) for body text** in the Research Trail, NOT Cabin. This follows the Editor typography system for investigation/data contexts.
8. **Cards should feel like layered documents.** Vellum translucency, warm shadows, paper-stack depth.
9. **The trail should render nothing if the API returns empty data.** No empty states, no "no sources found" messages. If there's no research trail, the section simply doesn't appear.
10. **Use Radix UI Tabs** for the tab interface (consistent with existing Radix usage in the codebase).

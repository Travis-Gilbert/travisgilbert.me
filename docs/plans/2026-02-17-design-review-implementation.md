# Design Review Implementation Plan

> **For Claude:** REQUIRED: Use /execute-plan to implement this plan task-by-task.

**Goal:** Implement 14 tasks from the design review covering metadata fixes, CSS cleanup, annotation improvements, hero restructure, content features, and /now page expansion.

**Architecture:** Progressive enhancement of an existing Next.js 15 (App Router) personal site. Most changes are isolated to single files. The hero restructure (Task 6) is the biggest scope change, widening the hero section and integrating a compact /now preview. Schema changes in `content.ts` propagate to detail pages and homepage.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, rough.js, Zod, gray-matter, remark

---

## Batch 1: Quick Fixes

### Task 1: Fix layout metadata description

> Already completed. Description updated from "Investigating..." to "Exploring..." in `src/app/layout.tsx:17`.

---

### Task 2: Clean up CSS comments referencing old framing

**Files:**
- Modify: `src/styles/global.css`

**Context:** The site renamed "investigations" to "essays" in Phase 2. Some CSS comments still reference the old "evidence" / "investigation" language.

**Step 1: Rename "Evidence callout labels" comment block**

In `src/styles/global.css:407-410`, change:

```css
/* Evidence callout labels:
   Activated when a blockquote's first <strong> matches a known keyword.
   Markdown convention: > **Evidence:** text here
   The label floats above the blockquote as a monospace tag. */
```

to:

```css
/* Note callout labels:
   Activated when a blockquote's first <strong> matches a known keyword.
   Markdown convention: > **Note:** text here
   The label floats above the blockquote as a monospace tag. */
```

**Step 2: Rename "Project Timeline: Evidence Organizer Style" comment**

In `src/styles/global.css:542`, change:

```css
/* Project Timeline:Evidence Organizer Style
```

to:

```css
/* Project Timeline: Organizer Style
```

**Step 3: Verify no remaining old-framing references**

Run: `grep -in "evidence\|investigat\|case.file\|case.number" src/styles/global.css`

Expected: No meaningful results. The `.prose-essays` class name is correct (it was already renamed).

**Step 4: Commit**

```bash
git add src/styles/global.css
git commit -m "docs(css): rename old investigation/evidence references to essay/note framing"
```

---

### Task 3: Restore field note callout leader lines on homepage

**Files:**
- Modify: `src/app/page.tsx:402-416`

**Context:** Field note callouts on the homepage currently render as inline styled `<div>` elements inside the card. They should use `RoughCallout`, which draws a hand-drawn leader line in the margin. `RoughCallout` is already imported at `page.tsx:10`. The component must be inside `<RoughBox>` (which has `position: relative`) but outside the `<Link>` wrapper.

**Important:** The field note card structure wraps everything in `<RoughBox>` (line 378), then a `<div className="group">`, then a `<Link>` (line 381). The callout needs to be outside the `<Link>` but still inside the `<div className="group">` (so it's inside `<RoughBox>`).

Also: some field notes use `callouts` (array) instead of singular `callout`. The code currently only checks `note.data.callout`. We need to handle both, similar to how the featured essay does it (lines 42-44).

**Step 1: Replace the inline callout div with RoughCallout**

In `src/app/page.tsx`, replace lines 403-416 (the `{/* Handwritten callout */}` block and the `{note.data.callout && ...}` section):

```tsx
{/* Handwritten callout */}
{note.data.callout && (
  <div
    className="mt-2.5"
    style={{
      fontFamily: 'var(--font-annotation)',
      fontSize: 14,
      color: 'var(--color-teal)',
      opacity: 0.8,
    }}
  >
    {note.data.callout}
  </div>
)}
```

with:

```tsx
{/* Handwritten margin callout (outside Link, inside RoughBox) */}
{(() => {
  const callouts = note.data.callouts ?? (note.data.callout ? [note.data.callout] : []);
  return callouts[0] ? (
    <RoughCallout
      side={i % 2 === 0 ? 'left' : 'right'}
      tint="teal"
      offsetY={12}
      seed={100 + i}
    >
      {callouts[0]}
    </RoughCallout>
  ) : null;
})()}
```

**Important placement:** This block must remain inside `<div className="group">` but after `</Link>`. Looking at the current structure:

```
<RoughBox>
  <div className="group">
    <Link>
      ...card content...
    </Link>
    {/* callout goes HERE (after Link closes, before group div closes) */}
    {note.data.tags...}  ← tags are currently inside the Link; they need to stay accessible
  </div>
</RoughBox>
```

Wait: looking more carefully at lines 379-422, the tags are currently INSIDE the `<div className="group">` but they are after `</Link>` (line 402 closes the Link, lines 417-420 render TagList). So the structure is already correct for placing the callout between the Link close and the tags.

The final structure should be:

```tsx
<RoughBox padding={20} hover tint="teal">
  <div className="group">
    <Link href={...} className="block no-underline text-ink hover:text-ink">
      {/* DateStamp, CompactTracker, title, excerpt */}
    </Link>
    {/* RoughCallout: outside Link, inside RoughBox */}
    {(() => {
      const callouts = note.data.callouts ?? (note.data.callout ? [note.data.callout] : []);
      return callouts[0] ? (
        <RoughCallout side={i % 2 === 0 ? 'left' : 'right'} tint="teal" offsetY={12} seed={100 + i}>
          {callouts[0]}
        </RoughCallout>
      ) : null;
    })()}
    {note.data.tags.length > 0 && (
      <div className="pt-3 relative z-10">
        <TagList tags={note.data.tags} tint="teal" />
      </div>
    )}
  </div>
</RoughBox>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build passes with no errors.

**Step 3: Visual check**

Run: `npm run dev` and navigate to `http://localhost:3000`.
Expected: Field note cards on the homepage display handwritten annotations in the margin (desktop, lg+ viewport) with a hand-drawn leader line, staggered on alternating sides (even index = left, odd = right). On mobile, annotations appear inline below the card content.

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix(homepage): restore RoughCallout leader lines on field note cards"
```

---

### Task 4: Add leader line tick marks to essay margin annotations

**Files:**
- Modify: `src/styles/global.css` (within the `@media (min-width: 1280px)` block, lines 522-538)

**Context:** Essay detail pages have CSS-based margin annotations (text positioned in the margin via `::after` pseudo-elements). Currently there is no visual connector between the annotation text and the prose column. This task adds a short horizontal tick mark using `::before`.

**Important gotcha from CLAUDE.md:** The annotation positioning uses `calc(100% + 1.5rem)` (percentage-based, already fixed in a prior commit). The tick mark should also use percentage-based positioning, not `ch` units. See the `margin-annotation-anchor` rules at lines 488-538.

**Step 1: Add tick mark CSS rules**

In `src/styles/global.css`, inside the `@media (min-width: 1280px)` block (after line 537), add:

```css
  /* Tick mark connecting annotation to prose column */
  .margin-annotation-anchor[data-annotation-side="right"]::before {
    content: '';
    position: absolute;
    left: calc(100% + 0.25rem);
    top: 6px;
    width: 1rem;
    border-top: 1px solid rgba(180, 90, 45, 0.3);
  }

  .margin-annotation-anchor[data-annotation-side="left"]::before {
    content: '';
    position: absolute;
    right: calc(100% + 0.25rem);
    top: 6px;
    width: 1rem;
    border-top: 1px solid rgba(180, 90, 45, 0.3);
  }
```

Note: Uses `calc(100% + 0.25rem)` instead of the spec's `calc(65ch + 0.25rem)` because the prose container uses `max-w-4xl` (percentage-based), not a character-count width. The `100%` refers to the width of `.margin-annotation-anchor`'s containing block (the prose column).

**Step 2: Verify the `::before` won't conflict with existing styles**

The `.margin-annotation-anchor` currently only uses `::after` (lines 495-501). There is no existing `::before` rule on this class. The anchor has `position: relative` (line 490), so the absolutely positioned `::before` will anchor to it correctly.

**Step 3: Verify build and visual**

Run: `npm run dev`, navigate to an essay with annotations (e.g., `/essays/the-sidewalk-tax`).
Expected: At xl+ viewport (1280px+), each margin annotation has a short 1rem horizontal line connecting toward the prose column edge.

**Step 4: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(annotations): add tick mark leader lines connecting margin notes to prose"
```

---

### Task 5: Audit and fix annotation width calculations

**Files:**
- Modify: `src/styles/global.css:522-538` (the margin annotation `@media (min-width: 1280px)` block)

**Context:** The annotation CSS previously used `calc(65ch + 1.5rem)` for positioning. A recent commit (26508af) changed this to percentage-based positioning: `left: calc(100% + 1.5rem)`. This task verifies that the fix is working correctly at multiple viewport widths.

**Step 1: Verify current positioning rules**

Read `src/styles/global.css` lines 522-538. The current rules should be:

```css
.margin-annotation-anchor[data-annotation-side="right"]::after {
  left: calc(100% + 1.5rem);
}
.margin-annotation-anchor[data-annotation-side="left"]::after {
  right: calc(100% + 1.5rem);
  text-align: right;
}
```

If they still use `65ch`, replace with the `100%` variant. The `100%` resolves to the width of the containing block (`.prose-essays` which has `max-w: 65ch` from the `.prose` class). Since `.prose-essays` has `position: relative` (line 484), the anchor's percentage-based positioning will correctly reference the prose column width.

**Step 2: Verify `.prose-essays` has `position: relative`**

Check line 483-486:
```css
.prose-essays {
  position: relative;
  overflow: visible;
}
```

This is required for the percentage-based `::after` positioning to reference the prose container, not some other ancestor.

**Step 3: Verify the annotation width uses responsive `min()`**

Line 525:
```css
width: min(450px, calc((100vw - 100%) / 2 - 3rem));
```

This is correct. At 1280px viewport with `max-w-4xl` (896px) prose, the margin space is approximately `(1280 - 896) / 2 - 48 = 144px`. At 1920px it's `(1920 - 896) / 2 - 48 = 464px`, capped at 450px. The formula adapts correctly.

**Step 4: Visual test at three viewports**

Run `npm run dev` and test the essay annotation page at:
- 1280px wide: annotations should be visible but may be narrow (~144px)
- 1440px wide: annotations should have comfortable width (~224px)
- 1920px wide: annotations should be full 450px width

Expected: No overlap with prose text, no excessive gap, annotations sit cleanly in margin space.

**Step 5: If any issues, adjust**

If annotations are too close to the prose edge, increase the gap: change `1.5rem` to `2rem` in the `left: calc(100% + 1.5rem)` rule. If they're too narrow at 1280px, consider reducing the `3rem` safety margin in the `min()` width to `2rem`.

**Step 6: Commit (if changes were made)**

```bash
git add src/styles/global.css
git commit -m "fix(annotations): verify and tune percentage-based margin positioning"
```

---

## Batch 2: Hero Restructure

### Task 6: Move NowPreview into the hero section

**Files:**
- Modify: `src/app/page.tsx` (hero section + remove standalone NowPreview section)
- Create: `src/components/NowPreviewCompact.tsx` (compact variant for hero)
- No changes to: `src/app/layout.tsx`, `src/components/NowPreview.tsx`, `src/app/now/page.tsx`

**Context:** The hero section currently shows name, CyclingTagline, and content counters in a single column. The design review calls for a two-column hero: left = identity, right = compact /now snapshot. The hero should be wider than the `max-w-4xl` content column.

**Approach:** Use the "breakout" technique (Option 2 from the design review). The hero section uses negative margins + viewport width to extend beyond the parent `<main>` max-width. This avoids changing `layout.tsx` and affecting every other page.

**Step 1: Create NowPreviewCompact component**

Create `src/components/NowPreviewCompact.tsx`:

```tsx
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Link from 'next/link';

interface NowData {
  updated: string;
  researching: string;
  reading: string;
  building: string;
  listening: string;
}

function getNowData(): NowData | null {
  const filePath = path.join(process.cwd(), 'src', 'content', 'now.md');
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data } = matter(raw);
  return data as NowData;
}

const QUADRANTS: {
  label: string;
  field: keyof Omit<NowData, 'updated'>;
  color: string;
}[] = [
  { label: 'Researching', field: 'researching', color: 'var(--color-terracotta)' },
  { label: 'Reading', field: 'reading', color: 'var(--color-teal)' },
  { label: 'Building', field: 'building', color: 'var(--color-gold)' },
  { label: 'Listening to', field: 'listening', color: 'var(--color-success)' },
];

/**
 * NowPreviewCompact: slim single-column /now snapshot for the homepage hero.
 * No RoughBox wrapper. Subtle left border. Server Component.
 */
export default function NowPreviewCompact() {
  const data = getNowData();
  if (!data) return null;

  return (
    <div className="pl-4 border-l-2 border-border-light">
      <Link href="/now" className="no-underline group">
        <span
          className="font-mono block mb-2 text-ink-muted group-hover:text-terracotta transition-colors"
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Right now &rarr;
        </span>
      </Link>
      <div className="flex flex-col gap-2">
        {QUADRANTS.map((q) => (
          <div key={q.field}>
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: q.color,
              }}
            >
              {q.label}
            </span>
            <span className="font-title text-sm font-semibold text-ink block leading-snug">
              {data[q.field]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Restructure the hero section in page.tsx**

In `src/app/page.tsx`, replace the hero section (lines 52-83) with:

```tsx
{/* ═══════════════════════════════════════════════
    Hero: Breakout width, two-column (identity + /now snapshot)
    Uses viewport-width technique to exceed parent max-w-4xl
    ═══════════════════════════════════════════════ */}
<section
  className="relative w-[calc(100vw-2rem)] max-w-6xl left-1/2 -translate-x-1/2 px-4 sm:px-6 pt-8 md:pt-12 pb-4 md:pb-6 border-b border-border-light"
>
  <ScrollReveal>
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 lg:gap-12">
      {/* Left: identity */}
      <div className="flex-1">
        <h1
          className="text-[2rem] sm:text-[2.5rem] md:text-[2.75rem] m-0"
          style={{ fontFamily: 'var(--font-name)', fontWeight: 400, lineHeight: 1.0 }}
        >
          Travis Gilbert
        </h1>

        <div className="mt-1">
          <CyclingTagline />
        </div>

        <p
          className="font-mono text-ink-light mt-3"
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {totalEssays} essay{totalEssays !== 1 ? 's' : ''} &middot;{' '}
          {totalProjects} project{totalProjects !== 1 ? 's' : ''} &middot;{' '}
          {totalFieldNotes} field note{totalFieldNotes !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Right: /now snapshot (compact) */}
      <div className="lg:w-72 flex-shrink-0">
        <NowPreviewCompact />
      </div>
    </div>
  </ScrollReveal>
</section>
```

**Step 3: Add import for NowPreviewCompact**

Add to the imports at the top of `src/app/page.tsx`:

```tsx
import NowPreviewCompact from '@/components/NowPreviewCompact';
```

**Step 4: Remove the standalone NowPreview section**

Delete the NowPreview section (lines 264-271):

```tsx
{/* ═══════════════════════════════════════════════
    /now preview: what Travis is currently focused on
    ═══════════════════════════════════════════════ */}
<section className="py-2 md:py-6">
  <ScrollReveal>
    <NowPreview />
  </ScrollReveal>
</section>
```

Also remove the `NowPreview` import from line 16 (keep the `NowPreviewCompact` import you added):

```tsx
// REMOVE: import NowPreview from '@/components/NowPreview';
```

**Step 5: Verify the breakout technique**

The `w-[calc(100vw-2rem)]` sets the section to viewport width minus scrollbar/padding. `max-w-6xl` caps it at 72rem (1152px). `left-1/2 -translate-x-1/2` centers it. The parent `<main>` is `max-w-4xl` (56rem / 896px), so the hero will extend ~128px wider on each side at large viewports.

**Important:** The breakout section needs `position: relative` (which Tailwind's `relative` class provides) for `left-1/2` to work. Also, the parent `<main>` must not have `overflow: hidden`, or the breakout will be clipped. Check `layout.tsx` line 62: `<main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">`. No `overflow-hidden`, so this is safe.

**Step 6: Verify no scrollbar appears**

The `calc(100vw - 2rem)` accounts for body padding. If a horizontal scrollbar appears, change to `calc(100vw - 3rem)` or add `overflow-x: hidden` to the `<main>` or `<body>`. Test at 1024px, 1280px, and 1440px.

**Step 7: Build and visual check**

Run: `npm run build && npm run start`
Expected:
- Hero is visually wider than the content column
- Name/tagline on the left, /now snapshot on the right (desktop lg+)
- Stacked vertically on mobile
- NowPreview section is gone from the homepage body
- Full `/now` page still works independently
- All other pages (`/essays`, `/field-notes`, `/projects`, etc.) are visually unchanged

**Step 8: Commit**

```bash
git add src/components/NowPreviewCompact.tsx src/app/page.tsx
git commit -m "feat(homepage): move /now preview into two-column hero section"
```

---

## Batch 3: Restore and Refine

### Task 7: Improve essays listing page hierarchy

**Files:**
- Modify: `src/app/essays/page.tsx`
- Modify: `src/components/EssayCard.tsx` (may need no changes if we inline the featured card)

**Context:** The essays listing page currently shows all essays in a flat 2-column grid. The design calls for promoting the newest essay to a full-width featured treatment above the grid, reusing the homepage featured card visual pattern.

**Step 1: Update the intro text**

In `src/app/essays/page.tsx:27-29`, change the `<p>` content:

```tsx
<p className="text-ink-secondary mb-8">
  Long form examinations of how design decisions reshape cities, systems, and daily life.
</p>
```

**Step 2: Add featured essay treatment**

Replace the flat grid (lines 32-46) with a featured + grid structure. Add necessary imports:

```tsx
import Link from 'next/link';
import ProgressTracker, { ESSAY_STAGES } from '@/components/ProgressTracker';
import PatternImage from '@/components/PatternImage';
import RoughBox from '@/components/rough/RoughBox';
import DateStamp from '@/components/DateStamp';
import TagList from '@/components/TagList';
```

Then replace the grid section:

```tsx
{/* Featured essay: full width */}
{essays[0] && (() => {
  const featured = essays[0];
  const hasThumbnail = Boolean(featured.data.youtubeId);
  return (
    <RoughBox padding={0} hover tint="terracotta" elevated>
      <div className="group">
        {hasThumbnail ? (
          <div className="w-full h-40 sm:h-48 md:h-64 overflow-hidden">
            <img
              src={`https://img.youtube.com/vi/${featured.data.youtubeId}/maxresdefault.jpg`}
              alt={`Thumbnail for ${featured.data.title}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <PatternImage seed={featured.slug} height={160} color="var(--color-terracotta)" />
        )}
        <div className="p-6 md:p-8">
          <ProgressTracker
            stages={ESSAY_STAGES}
            currentStage={featured.data.stage || 'published'}
            color="var(--color-terracotta)"
          />
          <div className="mt-3">
            <DateStamp date={featured.data.date} />
          </div>
          <h2 className="font-title text-2xl md:text-3xl font-bold mt-2 mb-3 group-hover:text-terracotta transition-colors">
            <Link
              href={`/essays/${featured.slug}`}
              className="no-underline text-ink hover:text-ink after:absolute after:inset-0 after:z-0"
            >
              {featured.data.title}
            </Link>
          </h2>
          <p className="text-ink-secondary text-base md:text-lg mb-4 max-w-prose leading-relaxed">
            {featured.data.summary}
          </p>
          <div className="relative z-10">
            <TagList tags={featured.data.tags} tint="terracotta" />
          </div>
        </div>
      </div>
    </RoughBox>
  );
})()}

{/* Remaining essays: 2-column grid */}
{essays.length > 1 && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
    {essays.slice(1).map((essay) => (
      <EssayCard
        key={essay.slug}
        title={essay.data.title}
        summary={essay.data.summary}
        date={essay.data.date}
        youtubeId={essay.data.youtubeId}
        tags={essay.data.tags}
        href={`/essays/${essay.slug}`}
        stage={essay.data.stage}
        slug={essay.slug}
      />
    ))}
  </div>
)}
```

**Step 3: Adjust the empty state**

The empty state check (lines 48-52) should stay as-is but now it only triggers when there are zero essays.

**Step 4: Build and verify**

Run: `npm run build`
Expected: `/essays` page shows the newest essay at full width with ProgressTracker and image, with older essays in a grid below.

**Step 5: Commit**

```bash
git add src/app/essays/page.tsx
git commit -m "feat(essays): add featured essay treatment to listing page"
```

---

### Task 8: Add essay prev/next navigation

**Files:**
- Modify: `src/app/essays/[slug]/page.tsx:133-140`

**Context:** Field note detail pages have prev/next navigation (see `src/app/field-notes/[slug]/page.tsx:38-46, 81-102`). Essay detail pages only have a "back to all essays" link. This task adds the same prev/next pattern.

**Step 1: Add prev/next computation**

In `src/app/essays/[slug]/page.tsx`, after the `relatedNotes` computation (around line 61), add:

```tsx
// Prev/next navigation
const allEssays = getCollection<Essay>('essays')
  .filter((e) => !e.data.draft)
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

const currentIndex = allEssays.findIndex((e) => e.slug === slug);
const prevEssay = currentIndex < allEssays.length - 1 ? allEssays[currentIndex + 1] : null;
const nextEssay = currentIndex > 0 ? allEssays[currentIndex - 1] : null;
```

Note: "prev" = chronologically older (higher index in newest-first array), "next" = chronologically newer. This matches the field note pattern.

**Step 2: Replace the bottom navigation**

Replace lines 133-140:

```tsx
<nav className="py-4 border-t border-border mt-6">
  <Link
    href="/essays"
    className="font-mono text-sm hover:text-terracotta-hover"
  >
    &larr; All essays
  </Link>
</nav>
```

with:

```tsx
<nav className="flex justify-between items-start gap-4 py-4 border-t border-border mt-6">
  <div>
    {prevEssay && (
      <Link
        href={`/essays/${prevEssay.slug}`}
        className="font-mono text-sm hover:text-terracotta-hover"
      >
        &larr; {prevEssay.data.title}
      </Link>
    )}
  </div>
  <div className="text-right">
    {nextEssay && (
      <Link
        href={`/essays/${nextEssay.slug}`}
        className="font-mono text-sm hover:text-terracotta-hover"
      >
        {nextEssay.data.title} &rarr;
      </Link>
    )}
  </div>
</nav>
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: Essay detail pages show prev/next links at the bottom.

**Step 4: Commit**

```bash
git add src/app/essays/[slug]/page.tsx
git commit -m "feat(essays): add prev/next navigation to essay detail pages"
```

---

### Task 9: Tune PatternImage visibility

**Files:**
- Modify: `src/components/PatternImage.tsx`

**Context:** PatternImage renders three layers of generative art on canvas. At small heights (100px cards), the patterns are barely visible. This task increases opacity/width values and adds a faint blueprint grid layer.

**Step 1: Increase organic curve opacity and width (Layer 2)**

In `src/components/PatternImage.tsx:94-95`, change:

```tsx
ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.08 + rand() * 0.07})`;
ctx.lineWidth = 0.8 + rand() * 0.6;
```

to:

```tsx
ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.10 + rand() * 0.08})`;
ctx.lineWidth = 1.0 + rand() * 0.6;
```

**Step 2: Increase contour line opacity and width (Layer 3)**

In `src/components/PatternImage.tsx:114-115`, change:

```tsx
ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.05 + rand() * 0.04})`;
ctx.lineWidth = 0.6;
```

to:

```tsx
ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.08 + rand() * 0.06})`;
ctx.lineWidth = 0.8;
```

**Step 3: Add blueprint grid layer between dots and curves**

After Layer 1 (the grid dots loop ends at line 88) and before Layer 2 (organic curves at line 91), insert:

```tsx
// Layer 1.5: faint blueprint grid
ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.04)`;
ctx.lineWidth = 0.5;
for (let x = 0; x < w; x += 40) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();
}
for (let y = 0; y < h; y += 40) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
}
```

**Step 4: Visual check**

Run: `npm run dev` and check:
- Homepage featured card (180px height): patterns should be noticeably more detailed
- Homepage secondary cards (100px height): patterns should be more visible than before
- EssayCard thumbnails: same improvement
- Overall feel: still subtle and generative, not busy or noisy

**Step 5: Commit**

```bash
git add src/components/PatternImage.tsx
git commit -m "feat(pattern): increase generative pattern visibility and add blueprint grid layer"
```

---

## Batch 4: New Features

### Task 10: Add connected field note breadcrumbs

**Files:**
- Modify: `src/lib/content.ts:40-53` (fieldNoteSchema)
- Modify: `src/app/field-notes/[slug]/page.tsx`
- Modify: `src/app/essays/[slug]/page.tsx:104-131`
- Modify: `src/app/page.tsx` (homepage field notes section)
- Modify: `src/content/field-notes/against-legibility-in-public-space.md` (example content)

**Part A: Schema update**

In `src/lib/content.ts`, add to `fieldNoteSchema` (after the `featured` field at line 52):

```tsx
/** Slug of the parent essay this note connects to */
connectedTo: z.string().optional(),
```

**Part B: Field note detail page breadcrumb**

In `src/app/field-notes/[slug]/page.tsx`, add import:

```tsx
import { getCollection, getEntry, renderMarkdown, estimateReadingTime } from '@/lib/content';
import type { FieldNote, Essay } from '@/lib/content';
```

(Add `Essay` to the existing type import, and `getEntry` to the function import.)

Then, in the header (before the `<h1>` at line 68), add:

```tsx
{entry.data.connectedTo && (() => {
  const parentEssay = getEntry<Essay>('essays', entry.data.connectedTo);
  if (!parentEssay) return null;
  return (
    <div className="mb-2">
      <span
        className="font-mono"
        style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-teal)' }}
      >
        Connected to:{' '}
      </span>
      <Link
        href={`/essays/${parentEssay.slug}`}
        className="font-mono no-underline"
        style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-terracotta)' }}
      >
        {parentEssay.data.title}
      </Link>
    </div>
  );
})()}
```

**Part C: Homepage field note cards**

In `src/app/page.tsx`, within the field notes map (after the TagList block at lines 417-420), add:

```tsx
{note.data.connectedTo && (() => {
  const parentEssay = getCollection<Essay>('essays').find(
    (e) => e.slug === note.data.connectedTo && !e.data.draft
  );
  if (!parentEssay) return null;
  return (
    <span
      className="block mt-1 font-mono text-teal opacity-70"
      style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}
    >
      Connected to: {parentEssay.data.title}
    </span>
  );
})()}
```

Note: This uses `getCollection` which is already imported. The collection is already being fetched in the component, but since `getCollection` is cached by Next.js during static generation, calling it again here is effectively free.

**Part D: Essay detail page distinction**

In `src/app/essays/[slug]/page.tsx`, replace the related notes section (lines 104-131). Instead of a single "Related Field Notes" heading, split into two groups:

```tsx
{(() => {
  // Split related notes into two groups
  const connectedNotes = allFieldNotes.filter(
    (n) => n.data.connectedTo === slug
  );
  const connectedSlugs = new Set(connectedNotes.map((n) => n.slug));
  const topicNotes = relatedNotes.filter((n) => !connectedSlugs.has(n.slug));

  if (connectedNotes.length === 0 && topicNotes.length === 0) return null;

  return (
    <>
      <RoughLine />
      <section className="py-4">
        {connectedNotes.length > 0 && (
          <>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-teal mb-3">
              Field notes that led to this essay
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {connectedNotes.map((note) => (
                <Link
                  key={note.slug}
                  href={`/field-notes/${note.slug}`}
                  className="block no-underline text-ink hover:text-teal p-3 rounded border border-teal/10 bg-teal/[0.03] transition-colors hover:border-teal/25 hover:bg-teal/[0.06]"
                >
                  <span className="block font-title text-sm font-semibold">
                    {note.data.title}
                  </span>
                  {note.data.excerpt && (
                    <span className="block text-xs text-ink-secondary mt-1 line-clamp-2">
                      {note.data.excerpt}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}

        {topicNotes.length > 0 && (
          <>
            <h2 className={`font-mono text-[11px] uppercase tracking-[0.1em] text-teal mb-3 ${connectedNotes.length > 0 ? 'mt-6' : ''}`}>
              {connectedNotes.length > 0 ? 'Related by topic' : 'Related Field Notes'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topicNotes.map((note) => (
                <Link
                  key={note.slug}
                  href={`/field-notes/${note.slug}`}
                  className="block no-underline text-ink hover:text-teal p-3 rounded border border-teal/10 bg-teal/[0.03] transition-colors hover:border-teal/25 hover:bg-teal/[0.06]"
                >
                  <span className="block font-title text-sm font-semibold">
                    {note.data.title}
                  </span>
                  {note.data.excerpt && (
                    <span className="block text-xs text-ink-secondary mt-1 line-clamp-2">
                      {note.data.excerpt}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
})()}
```

**Part E: Update example content**

In `src/content/field-notes/against-legibility-in-public-space.md`, add `connectedTo` to frontmatter. First, check which essay it connects to. The note is about legibility in public space; the essay "the-sidewalk-tax" is about sidewalk/infrastructure policy. Add:

```yaml
connectedTo: the-sidewalk-tax
```

**Step: Build and verify**

Run: `npm run build`
Expected:
- `against-legibility-in-public-space` detail page shows "Connected to: The Sidewalk Tax" breadcrumb
- `/essays/the-sidewalk-tax` shows "Field notes that led to this essay" section with that note
- Other related notes appear under "Related by topic"

**Step: Commit**

```bash
git add src/lib/content.ts src/app/field-notes/[slug]/page.tsx src/app/essays/[slug]/page.tsx src/app/page.tsx src/content/field-notes/against-legibility-in-public-space.md
git commit -m "feat(content): add connectedTo field linking field notes to parent essays"
```

---

### Task 11: Add reading progress bar to essay detail pages

**Files:**
- Create: `src/components/ReadingProgress.tsx`
- Modify: `src/app/essays/[slug]/page.tsx`

**Step 1: Create ReadingProgress component**

Create `src/components/ReadingProgress.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';

/**
 * ReadingProgress: thin terracotta line at the top of the viewport
 * that fills left-to-right as the reader scrolls through the article.
 * Pairs with ProgressTracker (production stage vs reading progress).
 */
export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 h-[2px] z-[60] transition-[width] duration-75 ease-linear"
      style={{
        width: `${progress}%`,
        background: 'var(--color-terracotta)',
      }}
      aria-hidden="true"
    />
  );
}
```

Note: `z-[60]` places it above the sticky nav (`z-50`). The `h-[2px]` keeps it subtle. `transition-[width]` with 75ms duration smooths the movement without lag.

**Step 2: Add ReadingProgress to essay detail page**

In `src/app/essays/[slug]/page.tsx`, add import:

```tsx
import ReadingProgress from '@/components/ReadingProgress';
```

Then add `<ReadingProgress />` at the very start of the returned JSX, before `<article>`:

```tsx
return (
  <>
    <ReadingProgress />
    <article className="py-8">
      {/* ... existing content ... */}
    </article>
  </>
);
```

Note: wrapping in `<>...</>` fragment since we now have two top-level elements.

**Step 3: Build and verify**

Run: `npm run dev`, navigate to any essay.
Expected: A thin terracotta line appears at the very top of the viewport, filling from left to right as you scroll. It should be above the sticky nav.

**Step 4: Commit**

```bash
git add src/components/ReadingProgress.tsx src/app/essays/[slug]/page.tsx
git commit -m "feat(essays): add reading progress bar to essay detail pages"
```

---

### Task 12: Enhance shelf as commonplace book

**Files:**
- Modify: `src/lib/content.ts:55-63` (shelfSchema)
- Modify: `src/app/shelf/page.tsx`
- Modify: `src/components/ShelfFilter.tsx` (to display `connectedEssay` link)

**Step 1: Add connectedEssay to shelfSchema**

In `src/lib/content.ts`, add to `shelfSchema` (after the `tags` field at line 62):

```tsx
/** Essay slug this source relates to */
connectedEssay: z.string().optional(),
```

**Step 2: Read ShelfFilter component**

Before modifying, read `src/components/ShelfFilter.tsx` to understand the data flow. The shelf page passes plain objects to `ShelfFilter`. We need to include the `connectedEssay` field in that mapping.

**Step 3: Update shelf page data mapping**

In `src/app/shelf/page.tsx:17-24`, add `connectedEssay` to the mapped object:

```tsx
.map((item) => ({
  title: item.data.title,
  creator: item.data.creator,
  type: item.data.type,
  annotation: item.data.annotation,
  url: item.data.url,
  tags: item.data.tags,
  connectedEssay: item.data.connectedEssay,
}));
```

Also resolve the essay title at the server level (since ShelfFilter is a Client Component and can't call `getEntry`):

```tsx
import { getCollection, getEntry } from '@/lib/content';
import type { ShelfEntry, Essay } from '@/lib/content';

// In the component, after mapping:
const itemsWithEssayTitles = shelfItems.map((item) => {
  if (!item.connectedEssay) return { ...item, connectedEssayTitle: undefined, connectedEssaySlug: undefined };
  const essay = getEntry<Essay>('essays', item.connectedEssay);
  return {
    ...item,
    connectedEssayTitle: essay?.data.title,
    connectedEssaySlug: essay?.slug,
  };
});
```

Then pass `itemsWithEssayTitles` to `<ShelfFilter>`.

**Step 4: Update ShelfFilter to display "Referenced in" link**

This requires reading `ShelfFilter.tsx` first and adding the display logic for `connectedEssayTitle` and `connectedEssaySlug` props. Add a small "Referenced in: [Title]" line below the annotation text in each shelf card.

**Step 5: Build and verify**

Run: `npm run build`
Expected: Shelf entries with `connectedEssay` show which essay they connect to. The connection is visible on the shelf page.

**Step 6: Commit**

```bash
git add src/lib/content.ts src/app/shelf/page.tsx src/components/ShelfFilter.tsx
git commit -m "feat(shelf): add connectedEssay field linking sources to essays"
```

---

### Task 13: Display annotation density alongside essay stage

**Files:**
- Modify: `src/components/ProgressTracker.tsx:31-35` (add `annotationCount` prop)
- Modify: `src/app/essays/[slug]/page.tsx:84-88` (pass annotationCount)
- Modify: `src/app/page.tsx:118-122` (pass annotationCount on homepage featured)

**Step 1: Add annotationCount prop to ProgressTracker**

In `src/components/ProgressTracker.tsx:31-35`, update the interface:

```tsx
interface ProgressTrackerProps {
  stages: Stage[];
  currentStage: string;
  color?: string;
  annotationCount?: number;
}
```

Update the function signature to destructure it:

```tsx
export default function ProgressTracker({
  stages,
  currentStage,
  color = 'var(--color-terracotta)',
  annotationCount,
}: ProgressTrackerProps) {
```

After the closing `</div>` of the stages map (line 95, just before the final `</div>` at line 96), add:

```tsx
{annotationCount != null && annotationCount > 0 && (
  <span
    className="font-mono ml-3"
    style={{
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--color-ink-light)',
    }}
  >
    {annotationCount} margin note{annotationCount !== 1 ? 's' : ''}
  </span>
)}
```

**Step 2: Pass annotationCount in essay detail page**

In `src/app/essays/[slug]/page.tsx:84-88`, update:

```tsx
<ProgressTracker
  stages={ESSAY_STAGES}
  currentStage={entry.data.stage || 'published'}
  color="var(--color-terracotta)"
  annotationCount={entry.data.annotations?.length}
/>
```

**Step 3: Pass annotationCount in homepage featured essay**

In `src/app/page.tsx:118-122`, update:

```tsx
<ProgressTracker
  stages={ESSAY_STAGES}
  currentStage={featured.data.stage || 'published'}
  color="var(--color-terracotta)"
  annotationCount={featured.data.annotations?.length}
/>
```

**Step 4: Build and verify**

Run: `npm run build`
Expected: Essay ProgressTracker shows "3 margin notes" (or appropriate count) after the stage dots when annotations exist. No text shown when annotations array is empty.

**Step 5: Commit**

```bash
git add src/components/ProgressTracker.tsx src/app/essays/[slug]/page.tsx src/app/page.tsx
git commit -m "feat(tracker): display annotation count alongside essay production stage"
```

---

## Batch 5: /now Expansion

### Task 14: Expand /now page schema and display

**Files:**
- Modify: `src/content/now.md` (add context fields and thinking)
- Modify: `src/app/now/page.tsx` (display context and thinking)
- Modify: `src/components/NowPreview.tsx` (update NowData interface for type safety)
- No changes to: `src/components/NowPreviewCompact.tsx` (compact variant ignores context fields)

**Step 1: Update now.md frontmatter**

Replace `src/content/now.md` with:

```yaml
---
updated: 2026-02-16
researching: "How parking minimums shape American cities"
researching_context: "Reading Shoup's original data. The numbers are staggering."
reading: "The Color of Law by Richard Rothstein"
reading_context: "Chapter 4. The FHA was worse than I expected."
building: "This website (always)"
building_context: "Hero restructure, annotation system, progress trackers."
listening: "99% Invisible, The War on Cars"
listening_context: ""
thinking: "Whether maintenance burden should be a required field in urban design proposals"
---
```

**Step 2: Update NowData interface in now/page.tsx**

In `src/app/now/page.tsx:9-15`, expand the interface:

```tsx
interface NowData {
  updated: string;
  researching: string;
  researching_context?: string;
  reading: string;
  reading_context?: string;
  building: string;
  building_context?: string;
  listening: string;
  listening_context?: string;
  thinking?: string;
}
```

**Step 3: Add context display to quadrants**

In the QUADRANTS rendering loop (around line 102-107), after the value `<span>`, add:

```tsx
{data[`${q.field}_context` as keyof NowData] && (
  <span className="block text-xs text-ink-secondary mt-0.5 leading-relaxed">
    {data[`${q.field}_context` as keyof NowData]}
  </span>
)}
```

**Step 4: Add "Thinking about" section**

After the quadrants grid (after line 110's closing `</div>`), add:

```tsx
{data.thinking && (
  <div className="mt-8 max-w-2xl">
    <RoughBox padding={20} tint="terracotta">
      <span
        className="font-mono block mb-1"
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-terracotta)',
        }}
      >
        Thinking about
      </span>
      <span className="font-title text-base font-semibold text-ink">
        {data.thinking}
      </span>
    </RoughBox>
  </div>
)}
```

**Step 5: Update NowPreview.tsx interface (for type consistency)**

In `src/components/NowPreview.tsx:7-13`, update the NowData interface to include the new optional fields. This prevents TypeScript errors if the frontmatter contains them:

```tsx
interface NowData {
  updated: string;
  researching: string;
  researching_context?: string;
  reading: string;
  reading_context?: string;
  building: string;
  building_context?: string;
  listening: string;
  listening_context?: string;
  thinking?: string;
}
```

The NowPreview component itself doesn't display these fields; it only reads the four main values. But the interface should match the frontmatter shape.

**Step 6: Do the same for NowPreviewCompact.tsx**

Update the `NowData` interface in `src/components/NowPreviewCompact.tsx` to match. The component still only renders the four main values.

**Step 7: Build and verify**

Run: `npm run dev`, navigate to `/now`.
Expected:
- Each quadrant shows a context line below the value (when populated)
- Empty context strings (`listening_context: ""`) don't render
- "Thinking about" section appears at the bottom in a terracotta-tinted RoughBox
- The homepage compact /now preview is unchanged (only shows four main values)

**Step 8: Commit**

```bash
git add src/content/now.md src/app/now/page.tsx src/components/NowPreview.tsx src/components/NowPreviewCompact.tsx
git commit -m "feat(now): add context lines and thinking section to /now page"
```

---

## Implementation Order Summary

| Batch | Tasks | Estimated Steps |
|-------|-------|----------------|
| 1: Quick Fixes | Task 1 (done), 2, 3, 4, 5 | ~15 steps |
| 2: Hero Restructure | Task 6 | ~8 steps |
| 3: Restore and Refine | Tasks 7, 8, 9 | ~12 steps |
| 4: New Features | Tasks 10, 11, 12, 13 | ~18 steps |
| 5: /now Expansion | Task 14 | ~8 steps |

## Standing Rules (from design review)

- **No dashes.** Em dashes, en dashes: never. Use colons, periods, semicolons, commas, or parentheses.
- **No "investigation" language.** Use "essays," "researcher," "studio journal."
- **Warm shadows only.** `rgba(42, 36, 32, ...)` never `rgba(0, 0, 0, ...)`.
- **Terracotta is brand constant.** `#B45A2D` across all contexts.
- **Callouts go in the margin, not inside cards.** Use `RoughCallout` or `RoughPivotCallout`.
- **Server Components by default.** Only use `'use client'` when browser APIs are needed.
- **Phosphor SSR imports.** `@phosphor-icons/react/dist/ssr` for Server Components.
- **Date serialization.** Pass `.toISOString()` across RSC boundaries.

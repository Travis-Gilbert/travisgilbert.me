# Design System Sweep

## Branch: `fix/design-system-sweep`

Single branch, single PR. 13 items from the design audit across 5 batches.

**Standing rule:** Every change must preserve or enhance the dot grid. No change should remove, diminish, or gate the visibility of dots.

---

## Batch 1: Nav Gradient Fix + Contrast Tokens

### 1a. New nav-specific color tokens (global.css)

Add dedicated tokens tuned for 4.5:1+ contrast on `#1E1620`:

```
--color-nav-terracotta: #D4935F   (~5.2:1)
--color-nav-teal: #5AB0C0         (~5.5:1)
--color-nav-gold: #D4B46A         (~5.8:1)
```

In `@theme inline` block. Dark mode: same values (nav bg is #1E1620 in both modes).

### 1b. Fix nav background (TopNav.tsx:111)

- Replace `rgba(30, 22, 32, 0.85)` with `var(--color-nav-bg)` at full opacity
- Remove `backdropFilter` and `WebkitBackdropFilter`
- Keep `boxShadow: '0 1px 12px rgba(30, 22, 32, 0.5)'`

### 1c. Update NAV_COLORS map (TopNav.tsx:35-43)

- `/essays`, `/toolkit` -> `var(--color-nav-terracotta)`
- `/research`, `/field-notes`, `/connect` -> `var(--color-nav-teal)`
- `/projects`, `/shelf` -> `var(--color-nav-gold)`

---

## Batch 2: Accessibility Fixes

### 2a. DotGrid reduced-motion (DotGrid.tsx)

Check `prefers-reduced-motion: reduce` at init. When true:
- Draw single static frame (full dot grid + purple band gradient + zone-aware coloring)
- Skip: rAF loop, ink trail, spring physics, scatter animation
- Mouse/touch listeners attach for cursor, but trail/scatter are no-ops
- ResizeObserver still fires single static repaints

Dots always render. Only motion stops.

### 2b. Footer separator (Footer.tsx:58)

Add `aria-hidden="true"` to the `|` separator span.

### 2c. EssayCard thumbnail dimensions (EssayCard.tsx:42-46)

Add `width={320} height={180}` to YouTube img. Prevents CLS.

---

## Batch 3: Component Refinements

### 3a. ProgressTracker label size (ProgressTracker.tsx)

- Full tracker: `fontSize: 9` -> `fontSize: 11`, `letterSpacing: 0.08em` -> `0.06em`
- CompactTracker: `fontSize: 9` -> `fontSize: 10`, `letterSpacing: 0.06em` -> `0.05em`

### 3b. DateStamp tint prop (DateStamp.tsx)

Add optional `tint` prop (`'terracotta' | 'teal' | 'gold'`, default `'terracotta'`).
Map tint to `text-{tint}-light bg-{tint}/[0.06]` classes.

Update callers:
- EssayCard: no change (terracotta default is correct)
- FieldNoteEntry: pass `tint="teal"`
- ShelfItem (if it uses DateStamp): pass `tint="gold"`

---

## Batch 4: Token Hygiene

### 4a. Font role comments (global.css)

Add a clarifying comment above `--font-mono` and `--font-code`:
```
/* Monospace: Two faces, two roles
   --font-mono (Courier Prime): labels, metadata, nav text, tags
   --font-code (JetBrains Mono): CodeComment annotations, inline code */
```

### 4b. Alias deprecation comments (global.css)

Mark `--color-ink-secondary` and `--color-ink-faint` as aliases:
```
--color-ink-secondary: #6A5E52;  /* alias: prefer --color-ink-muted */
--color-ink-faint: #9A8E82;      /* alias: prefer --color-ink-light */
```

### 4c. Nav breakpoint bump (TopNav.tsx)

Change desktop nav from `md` to `lg` breakpoint:
- `hidden md:flex` -> `hidden lg:flex`
- `md:hidden` -> `lg:hidden`

This gives 7 nav items more room. Tablets (768-1023px) get the mobile menu.

---

## Batch 5: Performance

### 5a. DotGrid rAF pause when off-screen (DotGrid.tsx)

Add IntersectionObserver on the canvas element. Set `isVisible` ref.
When `!isVisible.current`, skip animation work inside the rAF callback.
Canvas still exists and shows last painted frame (no visual gap).
Observer uses `threshold: 0` (any pixel visible = active).

### 5b. Caveat/Ysabeau note (no code change)

Document in global.css that these fonts are candidates for deferred loading in a future optimization pass. No code change in this sweep.

---

## Files Touched

| File | Batches |
|------|---------|
| `src/styles/global.css` | 1a, 4a, 4b |
| `src/components/TopNav.tsx` | 1b, 1c, 4c |
| `src/components/DotGrid.tsx` | 2a, 5a |
| `src/components/Footer.tsx` | 2b |
| `src/components/EssayCard.tsx` | 2c |
| `src/components/ProgressTracker.tsx` | 3a |
| `src/components/DateStamp.tsx` | 3b |
| `src/components/FieldNoteEntry.tsx` | 3b (caller) |

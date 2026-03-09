# Iconoir Icon Migration Spec

**Repo:** Travis-Gilbert/travisgilbert.me
**Target branch:** main
**Spec file:** `docs/plans/iconoir-migration.md`

Replace all hand-drawn `SketchIcon` paths and `DrawOnIcon` usage with professionally extracted Iconoir
SVG paths. The animation system and component architecture stay intact; only the path data, viewBox,
and strokeWidth change.

---

## Ground Truth Audit

### Current system

| File | Role |
|---|---|
| `src/components/rough/SketchIcon.tsx` | Server component. Single `string` path per icon. `viewBox="0 0 32 32"`, `strokeWidth=1.8` |
| `src/components/rough/DrawOnIcon.tsx` | Client component. Imports `ICON_PATHS` from SketchIcon. Single path per icon with `pathLength=1` stroke-dashoffset animation. |
| `src/components/TopNav.tsx` | Uses `SketchIcon` at `size=16` for 7 nav links |

### DrawOnIcon consumers (section-header icons, `size=32`)

```
src/app/(main)/essays/page.tsx
src/app/(main)/field-notes/page.tsx
src/app/(main)/shelf/page.tsx
src/app/(main)/research/page.tsx
src/app/(main)/toolkit/page.tsx
src/app/(main)/connect/page.tsx
src/app/(main)/stats/page.tsx
src/app/(main)/tags/page.tsx
src/app/(main)/tags/[tag]/page.tsx
src/app/(main)/changelog/page.tsx
src/app/(main)/now/page.tsx
src/app/(main)/colophon/page.tsx
```

---

## Icon Name Mapping

All existing `IconName` values are preserved for zero-churn at call sites. Only the path data underneath changes.

| Existing name | Iconoir source file | Semantic change | Path count |
|---|---|---|---|
| `magnifying-glass` | `search.svg` | Same concept, refined geometry | 2 |
| `file-text` | `page-edit.svg` | Document + pencil = Works in Progress | 4 |
| `gears` | `settings.svg` | Gear/cog with outer ring | 2 |
| `note-pencil` | `notes.svg` | Clipboard-style notepad | 4 |
| `briefcase` | `kanban-board.svg` | Projects board (better semantics) | 5 |
| `wrench` | `tools.svg` | Wrench + screwdriver cross | 4 |
| `book-open` | `open-book.svg` | Two-page spread, same concept | 6 |
| `chat-circle` | `message-text.svg` | Bubble with text lines | 3 |
| `tag` | `label.svg` | Ticket/tag shape, cleaner | 1 |
| `info` | `info-circle.svg` | Circle + dot + line | 3 |

---

## Batch 0 -- Update `SketchIcon.tsx`

**File:** `src/components/rough/SketchIcon.tsx`
**Gate:** `npm run build` passes with no TS errors

### Changes

1. `ICON_PATHS` type changes from `Record<IconName, string>` to `Record<IconName, string[]>`
   (always an array, even single-path icons)
2. `viewBox` changes from `"0 0 32 32"` to `"0 0 24 24"`
3. Default `strokeWidth` changes from `1.8` to `1.5`
4. The `<path>` render becomes a `.map()` over the paths array
5. Each sub-path shares the same `stroke`, `strokeWidth`, `strokeLinecap`, `strokeLinejoin`

### Full replacement for `src/components/rough/SketchIcon.tsx`

```tsx
/**
 * SketchIcon: Iconoir SVG icons rendered as pure SVG.
 * Paths sourced from iconoir-icons/iconoir @ icons/regular/*.svg
 * viewBox: 0 0 24 24 | strokeWidth: 1.5 | multi-path support
 *
 * Server Component (no browser APIs needed).
 */

interface SketchIconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
}

type IconName =
  | 'magnifying-glass'
  | 'file-text'
  | 'gears'
  | 'note-pencil'
  | 'briefcase'
  | 'wrench'
  | 'book-open'
  | 'chat-circle'
  | 'tag'
  | 'info';

// Each entry is an array of SVG path `d` strings.
// All paths share the same stroke attributes; fill is always "none".
// Source: iconoir-icons/iconoir/icons/regular/*.svg (24x24 viewBox, stroke-width 1.5)
export const ICON_PATHS: Record<IconName, string[]> = {
  // search.svg
  'magnifying-glass': [
    'M17 17L21 21',
    'M3 11C3 15.4183 6.58172 19 11 19C13.213 19 15.2161 18.1015 16.6644 16.6493C18.1077 15.2022 19 13.2053 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11Z',
  ],

  // page-edit.svg
  'file-text': [
    'M20 12V5.74853C20 5.5894 19.9368 5.43679 19.8243 5.32426L16.6757 2.17574C16.5632 2.06321 16.4106 2 16.2515 2H4.6C4.26863 2 4 2.26863 4 2.6V21.4C4 21.7314 4.26863 22 4.6 22H11',
    'M8 10H16M8 6H12M8 14H11',
    'M17.9541 16.9394L18.9541 15.9394C19.392 15.5015 20.102 15.5015 20.5399 15.9394C20.9778 16.3773 20.9778 17.0873 20.5399 17.5252L19.5399 18.5252M17.9541 16.9394L14.963 19.9305C14.8131 20.0804 14.7147 20.2741 14.6821 20.4835L14.4394 22.0399L15.9957 21.7973C16.2052 21.7646 16.3988 21.6662 16.5487 21.5163L19.5399 18.5252M17.9541 16.9394L19.5399 18.5252',
    'M16 2V5.4C16 5.73137 16.2686 6 16.6 6H20',
  ],

  // settings.svg
  'gears': [
    'M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z',
    'M19.6224 10.3954L18.5247 7.7448L20 6L18 4L16.2647 5.48295L13.5578 4.36974L12.9353 2H10.981L10.3491 4.40113L7.70441 5.51596L6 4L4 6L5.45337 7.78885L4.3725 10.4463L2 11V13L4.40111 13.6555L5.51575 16.2997L4 18L6 20L7.79116 18.5403L10.397 19.6123L11 22H13L13.6045 19.6132L16.2551 18.5155C16.6969 18.8313 18 20 18 20L20 18L18.5159 16.2494L19.6139 13.598L21.9999 12.9772L22 11L19.6224 10.3954Z',
  ],

  // notes.svg
  'note-pencil': [
    'M8 14L16 14',
    'M8 10L10 10',
    'M8 18L12 18',
    'M10 3H6C4.89543 3 4 3.89543 4 5V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V5C20 3.89543 19.1046 3 18 3H14.5M10 3V1M10 3V5',
  ],

  // kanban-board.svg
  'briefcase': [
    'M3 3.6V20.4C3 20.7314 3.26863 21 3.6 21H20.4C20.7314 21 21 20.7314 21 20.4V3.6C21 3.26863 20.7314 3 20.4 3H3.6C3.26863 3 3 3.26863 3 3.6Z',
    'M6 6L6 16',
    'M10 6V9',
    'M14 6V13',
    'M18 6V11',
  ],

  // tools.svg
  'wrench': [
    'M10.0503 10.6066L2.97923 17.6777C2.19818 18.4587 2.19818 19.7251 2.97923 20.5061C3.76027 21.2872 5.0266 21.2872 5.80765 20.5061L12.8787 13.4351',
    'M17.1927 13.7994L21.071 17.6777C21.8521 18.4587 21.8521 19.7251 21.071 20.5061C20.29 21.2872 19.0236 21.2872 18.2426 20.5061L12.0341 14.2977',
    'M6.73267 5.90381L4.61135 6.61092L2.49003 3.07539L3.90424 1.66117L7.43978 3.78249L6.73267 5.90381ZM6.73267 5.90381L9.5629 8.73404',
    'M10.0503 10.6066C9.2065 8.45359 9.37147 5.62861 11.111 3.8891C12.8505 2.14958 16.0607 1.76778 17.8285 2.82844L14.7878 5.86911L14.5052 8.98015L17.6162 8.69754L20.6569 5.65686C21.7176 7.42463 21.3358 10.6349 19.5963 12.3744C17.8567 14.1139 15.0318 14.2789 12.8788 13.435',
  ],

  // open-book.svg
  'book-open': [
    'M12 21V7C12 5.89543 12.8954 5 14 5H21.4C21.7314 5 22 5.26863 22 5.6V18.7143',
    'M12 21V7C12 5.89543 11.1046 5 10 5H2.6C2.26863 5 2 5.26863 2 5.6V18.7143',
    'M14 19L22 19',
    'M10 19L2 19',
    'M12 21C12 19.8954 12.8954 19 14 19',
    'M12 21C12 19.8954 11.1046 19 10 19',
  ],

  // message-text.svg
  'chat-circle': [
    'M7 12L17 12',
    'M7 8L13 8',
    'M3 20.2895V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V15C21 16.1046 20.1046 17 19 17H7.96125C7.35368 17 6.77906 17.2762 6.39951 17.7506L4.06852 20.6643C3.71421 21.1072 3 20.8567 3 20.2895Z',
  ],

  // label.svg
  'tag': [
    'M3 17.4V6.6C3 6.26863 3.26863 6 3.6 6H16.6789C16.8795 6 17.0668 6.10026 17.1781 6.26718L20.7781 11.6672C20.9125 11.8687 20.9125 12.1313 20.7781 12.3328L17.1781 17.7328C17.0668 17.8997 16.8795 18 16.6789 18H3.6C3.26863 18 3 17.7314 3 17.4Z',
  ],

  // info-circle.svg
  'info': [
    'M12 11.5V16.5',
    'M12 7.51L12.01 7.49889',
    'M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z',
  ],
};

export default function SketchIcon({
  name,
  size = 32,
  color = 'currentColor',
  className = '',
  strokeWidth = 1.5,
}: SketchIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      {ICON_PATHS[name].map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </svg>
  );
}

export type { IconName, SketchIconProps };
```

### Verification checklist

- [ ] `npm run build` passes
- [ ] Nav renders at all 7 links with no blank icons
- [ ] `size=16` nav icons look crisp (24px viewBox scales correctly to any pixel size)
- [ ] `size=32` section icons render correctly
- [ ] No TypeScript errors on `ICON_PATHS` type

---

## Batch 1 -- Update `DrawOnIcon.tsx`

**File:** `src/components/rough/DrawOnIcon.tsx`
**Depends on:** Batch 0
**Gate:** `npm run build` passes; animated draw-on works in browser at `/essays`

### Core change

The component now renders `N` paths per icon. Each path gets its own
`pathLength=1 / strokeDasharray=1 / strokeDashoffset` pair and animates with a stagger offset.

Animation budget:
- Each path draws over `duration` ms
- Each path starts `pathStaggerMs` after the previous (default: 60)
- Path 0 starts at `delay`ms, path 1 at `delay + 60`ms, etc.
- Total time for a 6-path icon at defaults: `800 + 5*60 = 1100ms`

### Full replacement for `src/components/rough/DrawOnIcon.tsx`

```tsx
'use client';

/**
 * DrawOnIcon: Animated variant of SketchIcon.
 *
 * Uses the pathLength="1" technique per path to normalize stroke lengths,
 * then transitions strokeDashoffset from 1 (hidden) to 0 (fully drawn)
 * when the icon enters the viewport via IntersectionObserver.
 *
 * Multi-path icons (Iconoir standard) animate each path with a configurable
 * stagger so the icon draws stroke-by-stroke.
 *
 * Respects prefers-reduced-motion: shows all paths immediately without animation.
 *
 * Designed for section header icons (size=32).
 * Nav icons use SketchIcon (always visible, no animation).
 */

import { useRef, useEffect, useState } from 'react';
import { ICON_PATHS } from './SketchIcon';
import type { IconName } from './SketchIcon';

interface DrawOnIconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
  /** Duration of each individual path draw animation in ms */
  duration?: number;
  /** Delay before the FIRST path starts animating, in ms */
  delay?: number;
  /** Additional delay between each successive path, in ms */
  pathStaggerMs?: number;
}

export default function DrawOnIcon({
  name,
  size = 32,
  color = 'currentColor',
  className = '',
  strokeWidth = 1.5,
  duration = 800,
  delay = 0,
  pathStaggerMs = 60,
}: DrawOnIconProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReduced) {
      setSkipAnimation(true);
      setDrawn(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const paths = ICON_PATHS[name];

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      {paths.map((d, i) => {
        const pathDelay = delay + i * pathStaggerMs;
        return (
          <path
            key={i}
            d={d}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={drawn ? 0 : 1}
            style={
              skipAnimation
                ? undefined
                : {
                    transition: `stroke-dashoffset ${duration}ms ease-out ${pathDelay}ms`,
                  }
            }
          />
        );
      })}
    </svg>
  );
}
```

### Verification checklist

- [ ] `npm run build` passes
- [ ] Navigate to `/essays` -- the `file-text` section icon draws in 4 strokes sequentially
- [ ] All 4 paths of `page-edit` appear in order (document body, text lines, pencil, fold)
- [ ] `size=16` nav icons (SketchIcon, not DrawOnIcon) are unaffected
- [ ] Reduced-motion: all paths show immediately, no animation

---

## Batch 2 -- Verify all DrawOnIcon call sites

**Depends on:** Batch 1
**Gate:** `npm run build`, visual spot check at 6 pages

No icon names changed, so all existing call sites should compile without edits.
This batch is a verification pass.

### Pages to spot-check

| Page | Icon name used | Expected icon |
|---|---|---|
| `/essays` | `file-text` | Document with pencil (page-edit) |
| `/field-notes` | `note-pencil` | Clipboard notepad (notes) |
| `/shelf` | `book-open` | Open book spread |
| `/research` | `magnifying-glass` | Clean search lens + handle |
| `/toolkit` | `wrench` | Crossed wrench + screwdriver |
| `/connect` | `chat-circle` | Message bubble with text lines |

### If any page uses an icon name NOT in the `IconName` union

TypeScript will error at build time. Fix: either add the missing name to `ICON_PATHS` in Batch 0
with appropriate Iconoir path data, or update the call site to use an existing name.

### Verification checklist

- [ ] `npm run build` passes with zero TS errors
- [ ] 6 spot-check pages render section header icons correctly at `size=32`
- [ ] Scroll animation triggers correctly on all pages
- [ ] TopNav (SketchIcon at `size=16`) crisp on retina and 1x screens
- [ ] Dark mode: icons render in correct color via `currentColor`

---

## Batch 3 (optional, future) -- Studio toolbar icon replacement

The EditorToolbar.tsx currently uses text-label buttons ("B", "I", "H1", etc.).
Iconoir React components can replace these.

```bash
npm install iconoir-react
```

Import directly in `EditorToolbar.tsx`:

```tsx
import { Bold, Italic, Underline, Link, MediaImage, Table, Code, Highlighter } from 'iconoir-react';
```

Recommended mappings:

| Current label | Iconoir component | Notes |
|---|---|---|
| B | `Bold` | |
| I | `Italic` | |
| U | `Underline` | |
| S | `Strikethrough` | |
| H1/H2/H3 | Keep as mono text | Faster to scan than icons |
| Bq | `Quote` | |
| Ln | `Link` | |
| Im | `MediaImage` | |
| Tb | `Table` | |
| [] | `Code` | |
| Hi | `Highlighter` | |

Low-priority polish pass. Studio toolbar text labels are functional.

---

## Notes and caveats

### viewBox change (32x32 to 24x24)

SVG scales proportionally to any pixel size. No CSS or layout changes needed.

### strokeWidth at small sizes

Iconoir's native strokeWidth is 1.5. At `size=16` on low-DPI screens this can look thin.
If needed, pass `strokeWidth={1.75}` to `SketchIcon` in `TopNav.tsx`:

```tsx
<SketchIcon name={link.icon} size={16} strokeWidth={1.75} />
```

### No npm install required for Batches 0-2

Path data is extracted directly from Iconoir source SVGs and hardcoded into `ICON_PATHS`.
`iconoir-react` is only needed for Batch 3.

### Tuning the stagger animation

For icons with many paths (e.g. `book-open` with 6 paths), total animation time at defaults
is approximately 1100ms. To speed up:

```tsx
<DrawOnIcon name="book-open" duration={600} pathStaggerMs={40} />
```

### Commit sequence

```
Batch 0: feat(icons): migrate SketchIcon to Iconoir path data (24x24, multi-path)
Batch 1: feat(icons): update DrawOnIcon for multi-path stagger animation
Batch 2: chore(icons): verify DrawOnIcon call sites post-Iconoir migration
```

# FIG. INDEX Easter Egg: Terminal Schematic Board (v2)

> **For Claude Code.** Read this entire document before touching any files.
> No em dashes anywhere. Use colons, semicolons, commas, or periods instead.
> Run `npm run build` after each batch to verify zero errors before proceeding.

## Repo & Paths

```
Repo:             Travis-Gilbert/travisgilbert.me
New component:    src/components/FigIndexEasterEgg.tsx
Replaced:         src/components/DotGridEasterEgg.tsx (DELETE after Batch 2)
Layout:           src/app/(main)/layout.tsx
Hooks:            src/hooks/useThemeColor.ts (read-only, already exists)
                  src/hooks/usePrefersReducedMotion.ts (read-only, already exists)
Theme provider:   src/components/ThemeProvider.tsx (read-only)
Reference:        src/components/DotGrid.tsx (gradient system to replicate)
Dependencies:     framer-motion (already installed v12.35.0)
```

## IMPORTANT: What NOT to Import

```
DO NOT import or use:
  - roughjs               (removed; use clean SVG lines instead)
  - @phosphor-icons/react (migrated to Iconoir; use inline SVG paths)
```

The close icon uses the Iconoir Xmark path rendered as inline SVG:

```tsx
// Iconoir Xmark (24x24 viewBox)
const XMARK_PATH = 'M6.758 17.243L12.001 12m5.243-5.243L12 12m0 0L6.758 6.757M12.001 12l5.243 5.243';

function CloseIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d={XMARK_PATH} stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

## Summary

Replace the DotGrid Easter egg with a terminal-styled schematic board. The board is a 3x2 grid
of miniature schematics representing all six Easter eggs on the site. It lives in the same fixed
position as the old DotGrid egg (left: 16, lower-left). In its seed state it shows a small
breathing canvas glyph. On click, it expands into a dark terminal window. Clicking any tile
triggers a framer-motion particle burst that digitizes the schematic, then opens a slide-out panel
from the right edge with the expanded diagram.

**No rough.js.** All SVG lines use clean strokes (strokeLinecap: round, strokeLinejoin: round).
The wobblePath generator still adds hand-drawn jitter, but no rough.js canvas rendering. This
creates visual contrast with the other Easter eggs that do use rough.js borders.

**Gradient-aware seed glyph.** The component sits in the DotGrid gradient transition zone. The
seed glyph's dot colors must adapt to the gradient beneath it, reading the same CSS variables
DotGrid uses and replicating its inversion factor calculation.

## Gradient Awareness System

The DotGrid canvas paints a gradient across the top portion of the viewport:
- Purple band (#1E1620) at the very top (~7% of viewport)
- Charcoal (--color-hero-ground, ~#2A2824) easing to paper (--color-paper, ~#F0EBE4)
- Hermite smoothstep easing over INVERSION_DEPTH (35% in light, 25% in dark)
- A subtle tail zone (8% of viewport) below the main gradient

The Easter egg's seed glyph is fixed-position at `bottom: calc(25vh - 72px)`. Its vertical
position in the viewport determines what color the gradient is beneath it. The seed dots must
blend with this gradient, not fight it.

### Implementation: Replicate getInversionFactor from DotGrid.tsx

Copy the inversion factor logic from DotGrid.tsx into FigIndexEasterEgg.tsx:

```tsx
const INVERSION_DEPTH = 0.35;
const DARK_INVERSION_DEPTH = 0.25;
const GRADIENT_TAIL = 0.08;

function getInversionFactor(y: number, viewportH: number, isDark: boolean): number {
  const depth = isDark ? DARK_INVERSION_DEPTH : INVERSION_DEPTH;
  const gradEnd = viewportH * depth;
  const tailEnd = gradEnd + viewportH * GRADIENT_TAIL;

  if (y <= 0) return 1;
  if (y < gradEnd) {
    const t = y / gradEnd;
    return 1 - (t * t * (3 - 2 * t));
  }
  if (y < tailEnd) {
    const t = (y - gradEnd) / (tailEnd - gradEnd);
    return (1 - (t * t * (3 - 2 * t))) * 0.15;
  }
  return 0;
}
```

### Seed glyph color calculation

In the rAF loop that draws the seed canvas:

```tsx
// Resolve once per theme change:
const heroGroundRgb = hexToRgb(readCssVar('--color-hero-ground') || '#2A2824');
const heroTextRgb = hexToRgb(readCssVar('--color-hero-text') || '#F0EBE4');
const roughLightRgb = hexToRgb(readCssVar('--color-rough-light') || '#9A8E82');

// Per dot in the seed glyph, calculate its screen Y from the wrapper's position:
const wrapperRect = wrapperRef.current.getBoundingClientRect();
const dotScreenY = wrapperRect.top + dotLocalY;
const inv = getInversionFactor(dotScreenY, window.innerHeight, isDarkMode);

// Lerp between normal dot color and inverted dot color:
const invertedRgb = isDarkMode ? heroGroundRgb : heroTextRgb;
const baseRgb = roughLightRgb;
const r = Math.round(baseRgb[0] + (invertedRgb[0] - baseRgb[0]) * inv);
const g = Math.round(baseRgb[1] + (invertedRgb[1] - baseRgb[1]) * inv);
const b = Math.round(baseRgb[2] + (invertedRgb[2] - baseRgb[2]) * inv);
const alpha = (0.5 + inv * 0.15) * breathePulse;
```

This makes the seed dots cream-on-dark when overlapping the charcoal zone, and warm-muted
when below on the parchment. The transition is seamless with the DotGrid dots behind it.

### Terminal window border adaptation

When the terminal expands, its border and shadow should also respect the gradient:

```tsx
// When expanded, check top edge of terminal against gradient
const terminalTopY = wrapperRect.top;
const topInv = getInversionFactor(terminalTopY, window.innerHeight, isDarkMode);

// If terminal overlaps the dark gradient zone, lighten the border for contrast
const borderColor = topInv > 0.3
  ? 'rgba(255, 255, 255, 0.12)'  // subtle light border on dark ground
  : isDarkMode
    ? '#3A3632'                    // dark mode, below gradient
    : readCssVar('--color-border') || '#D4CCC4'; // light mode, below gradient
```

## Design Tokens

Terminal interior: fixed dark palette (always dark regardless of theme).

```
Terminal constants (always dark):
  FIG_BLACK:         #1A1816
  FIG_SURFACE:       #2A2622
  FIG_SURFACE_LIGHT: #3A3632
  FIG_BORDER:        #4A4642
  FIG_BORDER_DIM:    #3A3632
  FIG_TEXT_DIM:      #6A5E52
  FIG_TEXT_MUTED:    #9A8E82

Brand accent lines (resolved from CSS vars for theme awareness):
  terracotta:  var(--color-terracotta)   fallback #B45A2D
  teal:        var(--color-teal)         fallback #2D5F6B
  gold:        var(--color-gold)         fallback #C49A4A
  purple:      #6B4F7A                   (constant; no CSS var exists yet)
```

### Light vs Dark Mode Behavior

| Element                | Light mode                                  | Dark mode                                   |
|------------------------|---------------------------------------------|---------------------------------------------|
| Terminal interior      | Always #1A1816 (dark)                       | Always #1A1816 (dark)                       |
| Terminal border        | Gradient-aware (see above)                  | Gradient-aware (see above)                  |
| Terminal box-shadow    | 0 12px 40px rgba(0,0,0,0.15)               | 0 12px 40px rgba(0,0,0,0.4)                |
| Seed glyph dots        | Gradient-aware color lerp                   | Gradient-aware color lerp                   |
| Slide-out backdrop     | rgba(240, 235, 228, 0.5) + blur(6px)       | rgba(26, 24, 22, 0.6) + blur(6px)          |
| Slide-out panel bg     | Always #1A1816                              | Always #1A1816                              |
| Slide-out left border  | 1px solid var(--color-border)               | 1px solid #3A3632                           |
| Hover label below seed | Gradient-aware (cream in dark zone)         | Gradient-aware                              |

## Easter Egg Tile Definitions

Six tiles in a 3x2 grid.

| Index | Fig label | ID              | Primary color | Schematic type      |
|-------|-----------|-----------------|---------------|---------------------|
| 0     | FIG. 1    | architecture    | terracotta    | File tree           |
| 1     | FIG. 2    | design-tokens   | gold          | Color swatches      |
| 2     | FIG. 2B   | research-api    | teal          | Endpoint flow       |
| 3     | FIG. 3    | source-graph    | purple        | Force cluster       |
| 4     | FIG. 4    | dot-grid        | teal          | Vignetted dots      |
| 5     | FIG. 5    | commonplace     | gold          | Pipeline boxes      |

Each tile's miniature schematic is an inline SVG (viewBox 0 0 50 65) drawn with wobblePath
using a deterministic mulberry32 seed per tile. Clean strokes, no rough.js.

## Animation System

### Phase State Machine

Same 5-phase model as existing Easter eggs:

```
seed -> connecting -> expanding -> open -> collapsing -> seed
```

Touch devices and `prefers-reduced-motion`: skip animation, jump directly to open/seed.

### Framer Motion Particle Digitize Effect

When a tile is clicked, BEFORE the slide-out panel opens, a particle burst plays using
framer-motion's `motion.span` with `animate` for each particle.

```tsx
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  char: '0' | '1';
  angle: number;
  distance: number;
  size: number;
  delay: number;
}

function ParticleBurst({
  active,
  color,
  onComplete,
}: {
  active: boolean;
  color: string;
  onComplete: () => void;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) { setParticles([]); return; }

    const rng = mulberry32(Date.now() & 0xffff);
    const batch: Particle[] = [];
    for (let i = 0; i < 28; i++) {
      const angle = rng() * Math.PI * 2;
      batch.push({
        id: i,
        x: 60,
        y: 50,
        char: rng() < 0.5 ? '0' : '1',
        angle,
        distance: 30 + rng() * 50,
        size: 8 + rng() * 5,
        delay: rng() * 0.1,
      });
    }
    setParticles(batch);

    const timer = setTimeout(onComplete, 700);
    return () => clearTimeout(timer);
  }, [active, color, onComplete]);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none', zIndex: 5, overflow: 'visible',
    }}>
      <AnimatePresence>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: p.x, y: p.y, opacity: 0.9, scale: 1 }}
            animate={{
              x: p.x + Math.cos(p.angle) * p.distance,
              y: p.y + Math.sin(p.angle) * p.distance,
              opacity: 0, scale: 0.3,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.6,
              delay: p.delay,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              position: 'absolute',
              fontFamily: 'var(--font-code, monospace)',
              fontSize: p.size,
              color: color,
              pointerEvents: 'none',
              textShadow: `0 0 6px ${color}60`,
            }}
          >
            {p.char}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

### Slide-Out Panel (framer-motion)

```tsx
<motion.div
  initial={{ x: '100%' }}
  animate={{ x: 0 }}
  exit={{ x: '100%' }}
  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
  style={{
    position: 'fixed', top: 0, right: 0, bottom: 0,
    width: 'min(420px, 90vw)', zIndex: 91,
    background: FIG_BLACK,
    borderLeft: `1px solid ${borderColor}`,
  }}
>
```

Contents: Header (FIG label + CloseIcon), schematic SVG, metadata grid, description, footer.

### Terminal Window Chrome

Title bar: dark surface (#2A2622), three brand-colored dots (terracotta, gold, teal),
centered "FIG. INDEX", "v1.0" right.

Prompt line: `$ ls schematics/` with teal `$` prompt, terracotta blinking cursor.

Status bar: "6 SCHEMATICS" left, teal dot + "ALL ACTIVE" center, "travisgilbert.me" right.

### No rough.js Borders

The expanded terminal and slide-out panel use clean CSS borders:

```tsx
// Terminal window (when expanded):
border: `1px solid ${borderColor}`,
borderRadius: 6,

// Slide-out panel:
borderLeft: `1px solid ${isDark ? '#3A3632' : 'var(--color-border)'}`,
```

No rough.canvas, no borderCanvasRef, no rough.js import. This creates a deliberately clean,
terminal-native aesthetic that contrasts with the hand-drawn rough.js borders on the other
Easter eggs (Architecture, Design Language, etc.).

### Tile Hover Effects

1. Border: #3A3632 to brand color
2. Inset glow: `box-shadow: 0 0 12px ${glow}, inset 0 0 20px ${glow}`
3. SVG opacity: 0.65 to 1.0 with drop-shadow
4. Label: #6A5E52 to brand color with text-shadow
5. Background: #1A1816 to #2A2622

All transitions: 250ms ease.

### Scanline Texture

```css
background-image: repeating-linear-gradient(
  0deg,
  transparent,
  transparent 2px,
  rgba(255, 255, 255, 0.015) 2px,
  rgba(255, 255, 255, 0.015) 4px
);
```

Pointer-events-none div on terminal and slide-out panel.

---

## Batch 0: Create FigIndexEasterEgg.tsx

**New file:** `src/components/FigIndexEasterEgg.tsx`
**Gate:** `npm run build` passes with no TS errors

### File structure

```
'use client';

imports:
  - { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react'
  - { motion, AnimatePresence } from 'framer-motion'
  - { readCssVar, hexToRgb, useThemeVersion } from '@/hooks/useThemeColor'
  - { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

  DO NOT IMPORT: roughjs, @phosphor-icons/react

sections (in order):
  1. XMARK_PATH constant + CloseIcon component (Iconoir inline SVG)
  2. mulberry32 PRNG (copy from existing eggs)
  3. Terminal palette constants (FIG_BLACK, FIG_SURFACE, etc.)
  4. Gradient awareness: INVERSION_DEPTH, DARK_INVERSION_DEPTH, GRADIENT_TAIL,
     getInversionFactor() (replicated from DotGrid.tsx)
  5. EGGS array (6 entries)
  6. wobblePath generator (jitter-based hand-drawn SVG lines, no roughjs)
  7. Six miniature schematic renderer functions
  8. ParticleBurst component (framer-motion)
  9. SlideOutPanel component (framer-motion motion.div)
  10. EggTile component (hover state, particle trigger)
  11. TerminalWindow component (chrome, prompt, status bar)
  12. Seed glyph generation (6 dots in 3x2 formation + scatter)
  13. Main FigIndexEasterEgg default export (phase state machine, canvas loop,
      gradient-aware color resolution, wrapper positioning)
```

### Positioning

```tsx
style={{
  position: 'fixed',
  left: 16,
  ...(isTouchDevice
    ? { bottom: 16, top: 'auto' }
    : { bottom: 'calc(25vh - 72px)' }),
  zIndex: 40,
  width: isExpanded ? 420 : 56,
  height: isExpanded ? 'auto' : 72,
}}
```

### Gradient-aware theme resolution

```tsx
const themeVersion = useThemeVersion();
const canvasColorsRef = useRef({
  // Base dot color (below gradient)
  roughLightRgb: [154, 142, 130] as [number, number, number],
  // Inverted dot color (in gradient zone)
  invertedDotRgb: [240, 235, 228] as [number, number, number],
  // Brand accents
  terracottaRgb: [180, 90, 45] as [number, number, number],
  tealRgb: [45, 95, 107] as [number, number, number],
  goldRgb: [196, 154, 74] as [number, number, number],
  // Theme state
  isDark: false,
  borderColor: '#D4CCC4',
  backdropColor: 'rgba(240, 235, 228, 0.5)',
});

useEffect(() => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const c = canvasColorsRef.current;
  c.isDark = isDark;

  // Dot colors
  const rl = readCssVar('--color-rough-light');
  if (rl) c.roughLightRgb = hexToRgb(rl);

  const heroText = readCssVar('--color-hero-text');
  const heroGround = readCssVar('--color-hero-ground');
  c.invertedDotRgb = isDark
    ? (heroGround ? hexToRgb(heroGround) : [42, 40, 36])
    : (heroText ? hexToRgb(heroText) : [240, 235, 228]);

  // Brand accents
  const tc = readCssVar('--color-terracotta');
  if (tc) c.terracottaRgb = hexToRgb(tc);
  const tl = readCssVar('--color-teal');
  if (tl) c.tealRgb = hexToRgb(tl);
  const gl = readCssVar('--color-gold');
  if (gl) c.goldRgb = hexToRgb(gl);

  // Border + backdrop
  c.borderColor = isDark
    ? (readCssVar('--color-dark-border') || '#3A3632')
    : (readCssVar('--color-border') || '#D4CCC4');
  c.backdropColor = isDark
    ? 'rgba(26, 24, 22, 0.6)'
    : 'rgba(240, 235, 228, 0.5)';
}, [themeVersion]);
```

### Seed glyph canvas drawing (gradient-aware)

In the rAF loop:

```tsx
const wrapperRect = wrapperRef.current?.getBoundingClientRect();
if (!wrapperRect) return;

const { roughLightRgb, invertedDotRgb, isDark } = canvasColorsRef.current;
const vh = window.innerHeight;

for (const dot of seedDots) {
  const screenY = wrapperRect.top + dot.y;
  const inv = getInversionFactor(screenY, vh, isDark);

  const r = Math.round(roughLightRgb[0] + (invertedDotRgb[0] - roughLightRgb[0]) * inv);
  const g = Math.round(roughLightRgb[1] + (invertedDotRgb[1] - roughLightRgb[1]) * inv);
  const b = Math.round(roughLightRgb[2] + (invertedDotRgb[2] - roughLightRgb[2]) * inv);
  const alpha = (0.35 + 0.15 * Math.sin(breathe + dot.phaseOffset) + inv * 0.15);

  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
  // draw dot or binary char...
}
```

### Verification checklist

- [ ] `npm run build` passes
- [ ] No roughjs import anywhere in the file
- [ ] No @phosphor-icons/react import anywhere in the file
- [ ] CloseIcon renders Iconoir Xmark SVG inline
- [ ] Seed glyph dots change color across the gradient transition
- [ ] All six miniature schematic renderers produce visible SVG paths
- [ ] ParticleBurst renders framer-motion animated spans
- [ ] SlideOutPanel slides from right edge
- [ ] No TypeScript errors

---

## Batch 1: Wire into Layout

**File:** `src/app/(main)/layout.tsx`
**Depends on:** Batch 0
**Gate:** `npm run build` passes; seed glyph visible in browser at lower-left

### Changes

1. Replace `DotGridEasterEgg` import with `FigIndexEasterEgg`
2. Replace `<DotGridEasterEgg />` with `<FigIndexEasterEgg />` in JSX

No other changes. All other Easter eggs stay.

### Verification checklist

- [ ] `npm run build` passes
- [ ] Lower-left seed glyph visible on homepage
- [ ] Seed dots are cream/light when overlapping the dark gradient zone at top
- [ ] Seed dots are warm-muted when below on the parchment
- [ ] All other Easter eggs still visible and functional
- [ ] Click seed: expands to terminal window
- [ ] Click tile: particle burst in brand color, then slide-out panel
- [ ] Toggle theme: seed dots adapt, terminal interior stays dark
- [ ] No rough.js borders visible on this component (clean CSS borders only)

---

## Batch 2: Delete Old File + Print Stylesheet

**Depends on:** Batch 1
**Gate:** `npm run build` passes

1. Delete `src/components/DotGridEasterEgg.tsx`
2. Add `className="fig-index-easter-egg"` to wrapper div
3. Add `.fig-index-easter-egg` to print hide list in `src/styles/print.css`

---

## Batch 3: CommonPlace Expanded Schematic Detail

**Depends on:** Batch 0
**Gate:** CommonPlace slide-out panel shows full data flow

Render the complete CommonPlace pipeline in the slide-out panel when egg.id === 'commonplace'.
Use clean SVG strokes with wobblePath jitter (no rough.js). Each box outlined in its brand color:

```
[User types in Compose]                    gold
[POST /api/v1/notebook/compose/related/]   teal
[compose_engine.py]                        terracotta
  1. TF-IDF  2. SBERT  3. KGE  4. NER  5. NLI
[LiveResearchGraph.tsx]                    purple
[Entity chips bar]                         teal
[User saves Object]                        gold
[POST /api/v1/notebook/capture/]           teal
[post_save signal: 7-pass engine]          terracotta
[New Edges + Nodes + RetroNote]            gold
```

Labels in var(--font-code) or monospace at 7-9px. Flow arrows use wobblePath.

---

## Batch 4: Polish and Accessibility

**Depends on:** Batches 0-3
**Gate:** `npm run build` passes; Lighthouse a11y unaffected

1. `aria-label="FIG. INDEX schematic board"` on wrapper
2. `role="complementary"` on wrapper
3. `aria-label="Open ${egg.label} schematic"` on each tile
4. Escape closes panel and terminal
5. Click outside closes both
6. `prefers-reduced-motion`: skip canvas animation, skip particle burst, no spring transition
7. Touch: skip rAF, draw static seed, tap to open/close instantly
8. Focus management: move to close button on panel open, return on close

---

## Commit Sequence

```
Batch 0: feat(easter-egg): create FigIndexEasterEgg terminal schematic board
Batch 1: refactor(layout): replace DotGridEasterEgg with FigIndexEasterEgg
Batch 2: chore: delete DotGridEasterEgg, update print stylesheet
Batch 3: feat(easter-egg): detailed CommonPlace data flow schematic
Batch 4: fix(a11y): keyboard nav, focus management, reduced motion for FIG. INDEX
```

---

## Key Patterns to Follow

### From existing components (copy these exactly):
- mulberry32 PRNG: deterministic, no Math.random()
- wobblePath: hand-drawn SVG via quadratic bezier with jitter (NOT roughjs)
- useThemeVersion + readCssVar + canvasColorsRef: theme-aware canvas
- getInversionFactor: replicate from DotGrid.tsx for gradient awareness
- phaseRef + setPhase: ref for rAF, state for React renders
- isTouchDevice + usePrefersReducedMotion: detected on mount
- Iconoir SVG paths inline (not package import)

### New patterns in this component:
- framer-motion AnimatePresence + motion.span: particle burst
- framer-motion motion.div: slide-out panel entrance/exit
- Blinking cursor: setInterval at 530ms
- Scanline overlay: repeating-linear-gradient
- Terminal chrome: window dots, prompt, status bar
- Gradient-aware seed dot coloring (lerp based on screen Y position)

### Do NOT:
- Import roughjs
- Import @phosphor-icons/react
- Use em dashes anywhere
- Use white or near-white backgrounds for the terminal
- Modify any other Easter egg component
- Change layout.tsx beyond the import swap
- Add new CSS custom properties to global.css
- Use localStorage or sessionStorage

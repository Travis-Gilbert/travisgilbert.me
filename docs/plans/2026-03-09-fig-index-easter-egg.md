# FIG. INDEX Easter Egg: Terminal Schematic Board

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
Theme provider:   src/components/ThemeProvider.tsx (read-only)
Dependencies:     framer-motion (already installed v12.35.0)
                  roughjs (already installed v4.6.6)
                  @phosphor-icons/react (already installed)
```

## Summary

Replace the DotGrid Easter egg with a terminal-styled schematic board. The board is a 3x2 grid
of miniature hand-drawn schematics representing all six Easter eggs on the site. It lives in the
same fixed position as the old DotGrid egg (left: 16, lower-left). In its seed state it shows a
small breathing canvas glyph. On click, it expands into a dark terminal window. Clicking any tile
triggers a framer-motion particle burst that digitizes the schematic, then opens a slide-out panel
from the right edge with the expanded diagram.

The component supports both light and dark mode via CSS custom properties and the existing
`useThemeVersion` hook. The terminal surface itself is always dark (it is a terminal), but border
colors, glow intensities, and backdrop colors adapt to the current theme.

## Design Tokens

The terminal interior uses a fixed dark palette. These are NOT CSS variables; they are constants
within the component (the terminal is always dark regardless of site theme). Border, backdrop,
and glow effects DO read from CSS vars so they integrate with the surrounding page.

```
Terminal constants (always dark):
  --fig-black:         #1A1816
  --fig-surface:       #2A2622
  --fig-surface-light: #3A3632
  --fig-border:        #4A4642
  --fig-border-dim:    #3A3632
  --fig-text-dim:      #6A5E52
  --fig-text-muted:    #9A8E82

Brand accent lines (resolved from CSS vars for theme awareness):
  terracotta:  var(--color-terracotta)   fallback #B45A2D
  teal:        var(--color-teal)         fallback #2D5F6B
  gold:        var(--color-gold)         fallback #C49A4A
  purple:      #6B4F7A                   (constant; no CSS var exists yet)

Glow effects (rgba of brand colors at 15% for tile hover bloom):
  terracottaGlow:  rgba(180, 90, 45, 0.15)
  tealGlow:        rgba(45, 95, 107, 0.15)
  goldGlow:        rgba(196, 154, 74, 0.15)
  purpleGlow:      rgba(107, 79, 122, 0.15)
```

### Light vs Dark Mode Behavior

| Element                | Light mode                                  | Dark mode                                   |
|------------------------|---------------------------------------------|---------------------------------------------|
| Terminal interior      | Always #1A1816 (dark)                       | Always #1A1816 (dark)                       |
| Terminal border        | 1px solid var(--color-border)               | 1px solid var(--color-dark-border)          |
| Terminal box-shadow    | 0 12px 40px rgba(0,0,0,0.15)               | 0 12px 40px rgba(0,0,0,0.4)                |
| Seed glyph dots        | Read --color-text-light via readCssVar      | Read --color-text-light via readCssVar      |
| Slide-out backdrop     | rgba(240, 235, 228, 0.5) + blur(6px)       | rgba(26, 24, 22, 0.6) + blur(6px)          |
| Slide-out panel bg     | Always #1A1816                              | Always #1A1816                              |
| Slide-out left border  | 1px solid var(--color-border)               | 1px solid #3A3632                           |
| Hover label below seed | color: var(--color-text-light)              | color: var(--color-text-light)              |

Use `readCssVar` + `useThemeVersion` to re-resolve on theme change, matching the exact pattern
in `ArchitectureEasterEgg.tsx` and `DesignLanguageEasterEgg.tsx`.

## Easter Egg Tile Definitions

Six tiles in a 3x2 grid. Each tile maps to an existing Easter egg component.

| Index | Fig label | ID              | Primary color | Schematic type      |
|-------|-----------|-----------------|---------------|---------------------|
| 0     | FIG. 1    | architecture    | terracotta    | File tree           |
| 1     | FIG. 2    | design-tokens   | gold          | Color swatches      |
| 2     | FIG. 2B   | research-api    | teal          | Endpoint flow       |
| 3     | FIG. 3    | source-graph    | purple        | Force cluster       |
| 4     | FIG. 4    | dot-grid        | teal          | Vignetted dots      |
| 5     | FIG. 5    | commonplace     | gold          | Pipeline boxes      |

Each tile's miniature schematic is an inline SVG (viewBox 0 0 50 65) drawn with the wobblePath
generator using a deterministic mulberry32 seed per tile.

## Animation System

### Phase State Machine

Same 5-phase model as the existing Easter eggs:

```
seed -> connecting -> expanding -> open -> collapsing -> seed
```

The seed state shows a 56x72 canvas glyph (a 3x2 miniature dot cluster representing the grid).
Clicking triggers connecting (dots form bezier lines), then expanding (wrapper grows to terminal
size), then open (terminal content fades in with stagger).

Touch devices and `prefers-reduced-motion`: skip animation, jump directly to open/seed.

### Framer Motion Particle Digitize Effect

When a tile is clicked, BEFORE the slide-out panel opens, a particle burst plays. This uses
`framer-motion`'s `motion.span` with `animate` for each particle.

**Implementation pattern:**

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
            initial={{
              x: p.x,
              y: p.y,
              opacity: 0.9,
              scale: 1,
            }}
            animate={{
              x: p.x + Math.cos(p.angle) * p.distance,
              y: p.y + Math.sin(p.angle) * p.distance,
              opacity: 0,
              scale: 0.3,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.6,
              delay: p.delay,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              position: 'absolute',
              fontFamily: "'JetBrains Mono', monospace",
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

The particle characters are binary 0s and 1s. They burst outward from the tile center with
varying angles and distances, using the tile's brand color. Each particle has a text-shadow glow
in the brand color at 40% opacity. The burst lasts ~600ms, after which `onComplete` fires and the
slide-out panel opens.

### Slide-Out Panel

The panel slides in from the right edge of the viewport. Uses framer-motion for entrance:

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

The panel contains:
1. Header bar: FIG. label, egg name, ESC close button
2. Schematic SVG: larger version using all four brand colors for subsystem outlines
3. Metadata grid: 2x2 cards showing TYPE, STATUS, SEED (hex), LINES
4. Description: left-bordered paragraph with egg.color accent
5. Footer: "CLICK TILE ON LIVE SITE" + "travisgilbert.me"

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

Applied as a pointer-events-none div on both terminal and slide-out panel.

### Terminal Window Chrome

Title bar: dark surface (#2A2622), three brand-colored dots (terracotta, gold, teal),
centered "FIG. INDEX" in Courier Prime, "v1.0" right.

Prompt line: `$ ls schematics/` with teal `$` prompt, terracotta blinking cursor.

Status bar: "6 SCHEMATICS" left, teal dot + "ALL ACTIVE" center, "travisgilbert.me" right.

### Tile Hover Effects

1. Border: #3A3632 to brand color
2. Inset glow: `box-shadow: 0 0 12px ${glow}, inset 0 0 20px ${glow}`
3. SVG opacity: 0.65 to 1.0 with drop-shadow
4. Label: #6A5E52 to brand color with text-shadow
5. Background: #1A1816 to #2A2622

All transitions: 250ms ease.

---

## Batch 0: Create FigIndexEasterEgg.tsx

**New file:** `src/components/FigIndexEasterEgg.tsx`
**Gate:** `npm run build` passes with no TS errors

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

Matches the exact position of the old DotGridEasterEgg.

### Theme-aware color resolution

```tsx
const themeVersion = useThemeVersion();
const canvasColorsRef = useRef({ /* ... */ });

useEffect(() => {
  const tc = readCssVar('--color-terracotta');
  if (tc) canvasColorsRef.current.terracottaRgb = hexToRgb(tc);
  // ... resolve teal, gold, rough, border
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  canvasColorsRef.current.borderColor = isDark
    ? (readCssVar('--color-dark-border') || '#3A3632')
    : (readCssVar('--color-border') || '#D4CCC4');
  canvasColorsRef.current.backdropColor = isDark
    ? 'rgba(26, 24, 22, 0.6)'
    : 'rgba(240, 235, 228, 0.5)';
}, [themeVersion]);
```

### Verification checklist

- [ ] `npm run build` passes
- [ ] Component exports default function FigIndexEasterEgg
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
- [ ] All other Easter eggs still visible and functional
- [ ] Click seed: expands to terminal window
- [ ] Click tile: particle burst, then slide-out panel
- [ ] Toggle theme: border adapts, terminal interior stays dark

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

Render the complete CommonPlace pipeline in the slide-out panel when egg.id === 'commonplace':

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

All boxes use wobblePath. Flow arrows use wobblePath. Labels in Courier Prime 7-9px.

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

### From existing Easter eggs (copy these exactly):
- mulberry32 PRNG: deterministic, no Math.random()
- wobblePath: hand-drawn SVG via quadratic bezier with jitter
- useThemeVersion + readCssVar + canvasColorsRef: theme-aware canvas
- phaseRef + setPhase: ref for rAF, state for React renders
- isTouchDevice + reducedMotion: detected on mount
- borderCanvasRef + rough.canvas: rough.js rectangle border

### New patterns:
- framer-motion AnimatePresence + motion.span: particle burst
- framer-motion motion.div: slide-out panel entrance/exit
- Blinking cursor: setInterval at 530ms
- Scanline overlay: repeating-linear-gradient
- Terminal chrome: window dots, prompt, status bar

### Do NOT:
- Use em dashes anywhere
- Use white or near-white backgrounds for the terminal
- Modify any other Easter egg component
- Change layout.tsx beyond the import swap
- Add new CSS custom properties to global.css
- Use localStorage or sessionStorage

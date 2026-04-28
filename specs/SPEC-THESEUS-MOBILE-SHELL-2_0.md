# SPEC-THESEUS-MOBILE-SHELL-2_0

Supersedes SPEC-THESEUS-MOBILE-SHELL-1_0 in two places (color tokens, nav structure) and extends it in four (assistant-ui chat patterns, cosmos.gl mobile touch, scrollbar policy, intelligence-as-landing repurpose). Read v1 first. This assumes v1 Batch 0 has shipped.

Reference visual: 6-screen mockup (cool slate dark + cool paper, assistant-ui chat patterns, Plugins / Code nav, dark-canvas Explorer, repurposed landing).

---

## Why this exists

Three structural calls came in while v1 was being prepped:

1. Warm-brown palette was wrong. Switch to cool slate plus brand-derived (forest green + brass) accents pulled directly from `theseus/icon.svg`.
2. Adopt assistant-ui patterns for the chat surface. The library (`@assistant-ui/react ^0.12.25`) is already in `package.json`.
3. Restructure nav: Sources becomes Plugins (with three sub-tabs), Intel slot becomes Code, Intelligence content becomes a public `/theseus` landing.

Plus: cosmos.gl on mobile gets promoted from "out of scope" to its own batch. And: hide every scrollbar inside `.theseus-root` globally.

---

## BATCH 5 · Color token swap (~1.5 hr)

**Read first**
- `src/styles/theseus.css` lines 9-77 (`.theseus-root` token block)
- `src/styles/theseus.css` lines 100-200 (`--vie-*` aliases)
- `src/components/theseus/atlas/AtlasEmblem.tsx`

**Goal:** replace warm-ink + cream-paper with cool-slate + cool-paper. Variable names stay; values change. Brass and forest green are the only accents.

**The swap.** Replace lines 11 to 77 of `theseus.css` with this block:

```css
.theseus-root {
  /* Cool slate ink. */
  --app-base:    #16181C;
  --top-chrome:  #1B1E22;
  --sidebar:     #14171B;
  --panel:       #1E2128;
  --panel-2:     #232730;
  --panel-3:     #2C3036;

  /* Iridescent washes — cool, very subtle. */
  --tone-brass:  rgba(201, 162, 58, 0.05);
  --tone-rose:   rgba(196, 122, 134, 0.04);
  --tone-plum:   rgba(138, 122, 168, 0.04);
  --tone-blue:   rgba(140, 154, 219, 0.05);
  --tone-ink:    rgba(228, 230, 234, 0.04);
  --tone-bone:   rgba(228, 230, 234, 0.06);

  /* Brand-derived solids from theseus-emblem.svg. */
  --brass:       #c9a23a;   /* trace gold */
  --pcb:         #2a8b6c;   /* forest green at brand contrast */
  --pcb-deep:    #0a2a20;   /* the icon background itself */
  --silkscreen:  #d4c88a;
  --rose:        #c47a86;
  --plum:        #8a7aa8;
  --blue:        #8c9adb;
  --bone:        #E6E8EC;

  /* Cool ink. */
  --ink:         #E4E6EA;
  --ink-2:       #B0B5BD;
  --ink-3:       #7A828D;
  --ink-4:       #4D5460;
  --rule:        rgba(228, 230, 234, 0.06);
  --rule-strong: rgba(228, 230, 234, 0.16);

  /* Accent: brass primary, forest green secondary. */
  --pencil:       var(--brass);
  --accent:       var(--brass);
  --accent-color: var(--brass);
  --accent-2:     var(--pcb);

  /* Cool paper. */
  --paper:        #f5f5f7;
  --paper-2:      #eaeaef;
  --paper-3:      #dde0e6;
  --paper-ink:    #15171B;
  --paper-ink-2:  #2A2E36;
  --paper-ink-3:  #525866;
  --paper-rule:   #c4c8d0;
  --paper-pencil: var(--pcb);   /* was terracotta; now forest green */

  /* Kind colours, cooled. */
  --sage:   #6fa580;
  --indigo: #8c9adb;
  --ochre:  var(--brass);
  --teal:   #5fb3b3;
  --mauve:  var(--rose);
  --lilac:  var(--plum);

  /* Tweakables and typography unchanged. */
  --sidebar-w:    220px;
  --grid-size:    28px;
  --grid-opacity: 0.10;
  --font-body:    var(--font-ibm-plex, 'IBM Plex Sans', system-ui, sans-serif);
  --font-display: var(--font-vollkorn, Georgia, serif);
  --font-ui:      var(--font-ibm-plex, 'IBM Plex Sans', system-ui, sans-serif);
  --font-mono:    var(--font-ibm-plex-mono, var(--font-jetbrains-mono), ui-monospace, monospace);
}
```

**Per-component checks after the swap**

1. `.atlas-canvas` paper grid lines (~line 6219) currently use `rgba(120, 104, 82, 0.12)` — a warm sepia. Change to `rgba(120, 124, 130, 0.14)`.
2. `.atlas-canvas` accent override (~6229-6232) sets `--paper-pencil` per-canvas. Update to `var(--pcb)` so the canvas accent is forest green.
3. Sidebar background-image gradients (~5837-5840) use `--tone-ink` and `--tone-blue`. With the new low-saturation tone values the wash will be barely visible. That is intentional. If it disappears entirely, remove the rules; do not restore opacity.
4. `.atlas-nav-item.active` linear-gradient (~5943) goes very subtle under new tones. The 2px inset box-shadow at `var(--accent-color)` (now `--brass`) carries the active state.
5. Engine-state `vie-amber-light` / `vie-teal-light`: verify `--brass` reads as warm enough for engine-warm. If conflicts with brand voice, swap `--vie-engine-active` to `var(--pcb)` so forest green = running.

**Verify**
- `/theseus` shows cool slate (`#16181C`), not warm brown.
- Active nav row shows a brass left rule, no patina-rose gradient.
- Atlas canvas: cool paper with forest-green pencil (was terracotta).
- Brand mark visually rhymes with the chrome.
- `npm run build` passes.

---

## BATCH 6 · Adopt assistant-ui chat patterns (~3 hr)

**Read first**
- `src/components/theseus/panels/AskPanel.tsx`
- `src/components/theseus/chat/` in full
- https://github.com/assistant-ui/assistant-ui/blob/main/packages/ui/src/components/assistant-ui/thread.tsx (canonical reference; this spec derives from it)
- `src/styles/assistant-ui-theme.css` (already exists, partial)

**Goal:** adopt assistant-ui primitives for message rendering, composer, and welcome state. Don't replace panel-level architecture; replace the per-message and composer rendering. Tokens map via `assistant-ui-theme.css`.

**Patterns, verbatim from the assistant-ui Thread reference**

1. **Welcome state.** Display heading + muted lede + 2-col suggestion grid.
   - `h1` in Vollkorn 26px mobile / 28px desktop, `font-weight: 500`
   - `p` lede in Vollkorn 19px / 21px, color `var(--paper-ink-3)`
   - Suggestions: `grid grid-cols-1 @md:grid-cols-2 gap-2` of `<Button variant="ghost" className="rounded-3xl border bg-background px-4 py-3 text-start">` with title in `font-medium` and description in `text-muted-foreground`
   - Stagger: `fade-in slide-in-from-bottom-1 animate-in fill-mode-both duration-200` with 0 / 80 / 160 / 240 ms delays per suggestion

2. **User message.** Right-aligned bubble.
   - `align-self: flex-end; max-width: 85%; background: var(--paper-2); border-radius: 16px; padding: 10px 14px;`
   - Hover-revealed Edit action floats left of the bubble.
   - 14px IBM Plex Sans body.

3. **Assistant message.** No bubble. Plain prose.
   - `align-self: stretch; color: var(--paper-ink); padding: 0 4px;`
   - Vollkorn 15px / 1.6 line-height (matches editorial voice).
   - Markdown via assistant-ui's `MarkdownText` component.
   - Citations as inline links with `border-bottom: 1px solid rgba(42, 139, 108, 0.4)` (forest underline).
   - Footer meta row: `confidence | sources | dissent count`, mono 10px, numerals in brass.
   - Action bar (Copy / Reload / More) below the message at `text-muted-foreground`, autohide on `not-last` via `<ActionBarPrimitive.Root autohide="not-last" />`.

4. **Reasoning panel.** Collapsible above the answer.
   - Border-card at `bg-paper-2` with brass heartbeat-pulse dot.
   - Mono 10px label "Reasoning · 1.4s".
   - Body 12.5px IBM Plex Sans, color `var(--paper-ink-2)`.
   - Collapsed by default after reasoning completes; expanded while reasoning is in flight.
   - Use assistant-ui's `<Reasoning>` primitive.

5. **Composer.** Sticky bottom, `rounded-3xl`.
   - `--composer-radius: 24px; --composer-padding: 10px;` on thread root.
   - `border: 1px solid var(--paper-rule); transition: border-color 160ms, box-shadow 160ms;`
   - On `:focus-within`: `border-color: rgba(201, 162, 58, 0.6); box-shadow: 0 0 0 4px rgba(201, 162, 58, 0.18);`. Brass focus ring at 18% alpha.
   - Tools row left: `@`, `Attach`, `Voice` icons at 32x32 with hover wash.
   - Send: 32x32 circle, `ArrowUpIcon` from `lucide-react`, `background: var(--paper-ink); color: var(--paper);`
   - Cancel state during streaming: same circle with `<SquareIcon>` filled.
   - Auto-grow textarea, `font-size: 16px` (prevents iOS zoom).

6. **Follow-ups.** Inline below an assistant message.
   - Stacked column of bordered pills. Each prefixed with `↗` in brass mono.
   - `<SuggestionPrimitive.Trigger send asChild>`.
   - Hover: `border-color: var(--paper-ink-3); background: rgba(20, 22, 26, 0.04);`

**File map**

- `src/components/theseus/chat/Composer.tsx` — wraps `ComposerPrimitive.Root`
- `src/components/theseus/chat/Message.tsx` — branches on role
- `src/components/theseus/chat/Welcome.tsx` — suggestion grid
- `src/components/theseus/chat/Thread.tsx` — top-level `ThreadPrimitive.Root`
- `src/styles/assistant-ui-theme.css` — token map (below)

**`assistant-ui-theme.css` token map**

```css
.theseus-root {
  --background:           var(--paper);
  --foreground:           var(--paper-ink);
  --card:                 var(--paper);
  --card-foreground:      var(--paper-ink);
  --popover:              var(--paper);
  --popover-foreground:   var(--paper-ink);
  --primary:              var(--paper-ink);
  --primary-foreground:   var(--paper);
  --secondary:            var(--paper-2);
  --secondary-foreground: var(--paper-ink);
  --muted:                var(--paper-2);
  --muted-foreground:     var(--paper-ink-3);
  --accent:               var(--brass);
  --accent-foreground:    var(--paper-ink);
  --destructive:          #c4413f;
  --border:               var(--paper-rule);
  --input:                var(--paper-rule);
  --ring:                 var(--brass);
  --radius:               0.75rem;
}

/* Reverse-map for any panel that sits on the dark sidebar surface.
   Wrap that subtree in className="theseus-dark". */
.theseus-root .theseus-dark {
  --background:           var(--app-base);
  --foreground:           var(--ink);
  --card:                 var(--panel);
  --card-foreground:      var(--ink);
  --popover:              var(--panel);
  --popover-foreground:   var(--ink);
  --primary:              var(--ink);
  --primary-foreground:   var(--app-base);
  --secondary:            var(--panel-2);
  --secondary-foreground: var(--ink);
  --muted:                var(--panel-2);
  --muted-foreground:     var(--ink-3);
  --accent:               var(--brass);
  --accent-foreground:    var(--ink);
  --border:               var(--rule-strong);
  --input:                var(--rule-strong);
  --ring:                 var(--brass);
}
```

**Verify**
- Empty state: 4-card 2x2 suggestion grid with stagger animation.
- User msgs: right-aligned muted bubbles.
- Assistant msgs: plain prose, no bubble.
- Composer focus shows brass-glow ring at 18% alpha.
- Action bar appears under the most-recent assistant message; auto-hides on older messages.
- Reasoning panel collapses on completion; pulse respects `prefers-reduced-motion`.
- Markdown citations render with forest-green underline.
- `npm run build` passes.

---

## BATCH 7 · Nav restructure: Plugins / Code / landing (~2 hr)

**Read first**
- `src/components/theseus/TheseusMobileNav.tsx` (`MOBILE_NAV_ITEMS`)
- `src/components/theseus/TheseusSidebar.tsx` (`TRAILING_PLACES`)
- `src/components/theseus/PanelManager.tsx` (`PANEL_COMPONENTS`)
- `src/components/theseus/panels/ConnectionsPanel.tsx`
- `src/components/theseus/panels/PluginsPanel.tsx` (will absorb Connections)
- `src/components/theseus/panels/IntelligencePanel.tsx`
- `src/components/theseus/panels/CodePanel.tsx`

**Goal:** three structural moves.

1. Merge `connections` + `plugins` into one Plugins panel with three sub-tabs: Connectors, MCP, Skills.
2. Replace the Intel tab with Code in the bottom nav.
3. Repurpose Intelligence content as a public `/theseus` landing. Authenticated users redirect to `/theseus/threads`.

**New mobile bottom nav:** `Threads | Explorer | Plugins | Code`

**New sidebar Places (5, was 6):**

```
01 Threads
02 Explorer
03 Plugins   (was Connections + Plugins, merged)
04 Code      (was Intelligence's slot)
05 Notebook
```

`Cmd` shortcuts shift accordingly: `⌘1` Threads, `⌘2` Explorer, `⌘3` Plugins, `⌘4` Code, `⌘5` Notebook.

**File changes**

1. **`TheseusMobileNav.tsx`** — update `MOBILE_NAV_ITEMS`:

```ts
const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { id: 'ask',      label: 'Threads',  panelId: 'ask',      icon: ChatIcon },
  { id: 'explorer', label: 'Explorer', panelId: 'explorer', icon: GraphIcon },
  { id: 'plugins',  label: 'Plugins',  panelId: 'plugins',  icon: PluginsIcon },
  { id: 'code',     label: 'Code',     panelId: 'code',     icon: CodeIcon },
];
```

`PluginsIcon`: 4-rect grid + center traces. 22x22, stroke-width 1.5.
`CodeIcon`: chevron-pair + slash. Path: `M16 18l6-6-6-6 M8 6l-6 6 6 6 M14 4l-4 16`.
Drop `ConnectionsIcon` and `IntelligenceIcon` imports. Keep components in version control if other surfaces still reference them.

2. **`TheseusSidebar.tsx`** — update `TRAILING_PLACES`:

```ts
const TRAILING_PLACES: TrailingPlace[] = [
  { panel: 'plugins', n: '03', label: 'Plugins',  meta: '⌘3' },
  { panel: 'code',    n: '04', label: 'Code',     meta: '⌘4' },
  { panel: 'notebook',n: '05', label: 'Notebook', meta: '⌘5' },
];
```

Drop `connections` and `intelligence` rows.

3. **`PanelManager.tsx`** — keep all 8 `PanelId` values for backward compat on URL deep-links.
   - `'connections'` renders `<PluginsPanel defaultTab="connectors" />`
   - `'intelligence'` renders a deprecation card with two CTAs: "See Plugins" and "See Code"
   - For new sessions, redirect `?view=connections` to `?view=plugins`.

4. **`PluginsPanel.tsx`** — refactor for three tabs:
   - **Connectors** (default): GitHub, arXiv + Semantic, Fastmail, Obsidian, browser highlights. Source registry already lives at `src/components/theseus/atlas/sources.ts`; reuse it.
   - **MCP**: enumerate from the MCP registry (`theseus-mcp`, `r3f-mcp`, `tpu-commander`, etc.). Render: connection state, tool count, toggle.
   - **Skills**: enumerate user skills loaded via the Plugins MCP server. If MCP not connected yet, show empty state + "Connect Theseus MCP".

   Card pattern: 36px monogram (kind-tinted background) + name + detail line + status dot + toggle button.

5. **`/theseus` route handler.** Expand `src/app/theseus/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import TheseusLanding from '@/components/theseus/landing/TheseusLanding';

export default async function TheseusEntry() {
  const session = await auth();
  if (session?.user) redirect('/theseus/threads');
  return <TheseusLanding />;
}
```

`TheseusLanding` is a new component:
- forest-green halo gradient at top
- brass eyebrow ("Visual Intelligence Engine")
- italicized brass headline accent
- real engine stats from `/api/v2/theseus/graph-weather/`
- six-layer architecture as a 2x3 grid

6. **Sidebar drawer (mobile)** — already implemented in v1 Batch 1. Verify the Places list updates when `TRAILING_PLACES` changes; no extra work.

**Migrations**
- `?view=connections` → `?view=plugins` (with `tab=connectors`).
- `?view=intelligence` → `/theseus/about` (or deprecation card).
- `useKeyboardShortcuts.ts`: `⌘3` connections → plugins; `⌘5` intelligence → notebook.
- `AtlasCommandPalette.tsx` searchable items list: same rename.

**Verify**
- Bottom nav: Threads | Explorer | Plugins | Code. No Sources, no Intel.
- Plugins tap opens merged panel with three sub-tabs (Connectors default).
- Code tap opens existing CodePanel.
- `/theseus` while logged-out shows landing.
- `/theseus` while logged-in redirects to `/theseus/threads`.
- Old deep links to `?view=connections` / `?view=intelligence` redirect cleanly.
- `npm run build` passes.

---

## BATCH 8 · cosmos.gl on mobile, properly (~2 hr)

**Read first**
- `src/components/theseus/explorer/` (find the cosmos.gl wrapper)
- `node_modules/@cosmos.gl/graph` README and types
- `src/styles/theseus.css` lines 2045-2070 (existing mobile responsive)

**Goal:** make the existing cosmos.gl Explorer canvas first-class on mobile. WebGL2 already works on iOS Safari 15+ so the graph renders. Missing pieces: touch wiring, perf budget, dark-canvas shell so the graph is the page.

**Touch wiring**

1. **Pinch-zoom**: cosmos.gl exposes `setZoomLevel(level)`. Bind iOS `gesturestart` / `gesturechange` / `gestureend`, plus the modern `pointerdown` / `pointermove` / `pointerup` with two pointers (Android, desktop touch). On `gesturechange` set zoom to `currentZoom * e.scale`. Throttle with rAF.
2. **Pan**: cosmos.gl auto-pans on click-drag. Verify it picks up touch-drag without extra wiring; if not, wire `pointerdown → pointermove → pointerup` to `setCameraPosition`.
3. **Tap-to-Lens**: `pointerdown` then `pointerup` within 300ms and < 8px movement = tap. Use cosmos.gl `getNodeAt(x, y)` hit-test. If hit, dispatch the existing `theseus:open-lens` event with the node ID.
4. **Two-finger pan vs scroll**: `touch-action: none` on the canvas so the page does not scroll.

**Perf budget**
- Default node count today: 2,148. cosmos.gl handles this trivially even on a 4-year-old Android.
- At 10K+ nodes on mobile: drop simulation `decay` to 1000, pause the simulation entirely after 3 seconds idle via `requestIdleCallback`.
- Flow lens (which keeps the simulation breathing): gate behind `prefers-reduced-motion` on mobile. If reduced motion is on, default to Atlas (static positions).

**Mobile style passes** — append to `theseus.css`:

```css
@media (max-width: 767px) {
  /* Explorer goes full-bleed dark; graph is the page. */
  .atlas-canvas {
    background: var(--app-base);
    background-image: none;
  }
  /* Faint forest-green spotlight under the graph. */
  .atlas-canvas::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at 50% 45%,
      rgba(42, 139, 108, 0.08) 0%,
      transparent 60%
    );
    pointer-events: none;
    z-index: 0;
  }
  .atlas-canvas canvas { touch-action: none; }
  .atlas-graph-controls {
    flex-direction: column;
    align-items: flex-end;
    bottom: calc(14px + env(safe-area-inset-bottom));
    right: 12px;
  }
  .atlas-cos-sim-readout {
    position: absolute;
    bottom: calc(16px + env(safe-area-inset-bottom));
    left: 14px;
    z-index: 5;
  }
}
```

**Verify on a real iPhone**
- Pinch-zoom feels instant.
- Two-finger pan + one-finger pan move the camera.
- Tap a node → Lens sheet opens with that node focused.
- Page does not scroll while panning the canvas.
- Battery: leave Explorer open with engine warm for 5 min. Simulation pauses when idle, device does not get warm.
- `prefers-reduced-motion` on → Atlas lens default.
- `npm run build` passes.

---

## BATCH 9 · Global scrollbar hide (~10 min)

**Read first:** anywhere in `theseus.css` with `overflow: auto` or `overflow-y: scroll`.

**Goal:** hide every scrollbar inside `.theseus-root`. Native scroll continues to work; only the visual indicator is gone. Wrapped in `.theseus-root` so the rest of `travisgilbert.me` (CommonPlace, blog) keeps its scrollbars.

**Append to `theseus.css`:**

```css
.theseus-root *,
.theseus-root *::before,
.theseus-root *::after {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.theseus-root *::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}
```

**Verify**
- No scrollbar visible anywhere inside `/theseus`.
- Touch-scroll, mouse-wheel, keyboard arrow scrolling still work.
- `/commonplace`, `/blog` still show scrollbars where expected.
- `npm run build` passes.

---

## Deliberate exclusions

- **Light/dark toggle.** Theseus is dark-first by intent. Paper is the only light surface. System-driven dark/light split is a separate exercise.
- **assistant-ui voice/dictation primitive.** Existing `voice-controls-btn` CSS is partial. Wire it in its own batch.
- **Branch picker UI.** assistant-ui's `BranchPickerPrimitive` is in the reference `thread.tsx` but Theseus has no message branching today.
- **Dark composer surface.** Today composer only sits on paper. If a panel ever needs a dark composer, wrap it in `.theseus-dark` and the token map handles the rest.

---

## Definition of done (incremental over v1)

| #  | Check                                                                  | Batch |
|----|------------------------------------------------------------------------|-------|
| 1  | App background is cool slate, not warm brown                           | 5     |
| 2  | Brand colors (PCB green + brass) are the only accents                  | 5     |
| 3  | Welcome state = display heading + lede + 2x2 staggered grid            | 6     |
| 4  | User msg = right-aligned muted bubble; assistant = plain prose         | 6     |
| 5  | Composer is `rounded-3xl` with brass focus-within ring                 | 6     |
| 6  | Reasoning collapsible with heartbeat pulse                             | 6     |
| 7  | Bottom nav = Threads / Explorer / Plugins / Code                       | 7     |
| 8  | Plugins panel has three sub-tabs, absorbs Connections                  | 7     |
| 9  | `/theseus` shows landing when logged-out                               | 7     |
| 10 | Pinch-zoom and tap-to-Lens work on iOS Safari                          | 8     |
| 11 | No scrollbars visible anywhere in `/theseus`                           | 9     |
| 12 | Desktop ≥768px: same color shift, no other regressions                 | 5+    |

---

## Suggested ship order

1. **Batch 5 + Batch 9** in one PR. Cosmetic, quick, low risk.
2. **Batch 6** in its own PR. Big diff, contained scope.
3. **Batch 7** — depends on landing component existing. Plan to ship the route + a placeholder landing first, iterate the landing after.
4. **Batch 8** last. Real-device QA needed; touches perf-sensitive Explorer.

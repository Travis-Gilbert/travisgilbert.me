# Implementation Plan: Theseus Mobile Shell 2.0

**Source spec:** SPEC-THESEUS-MOBILE-SHELL-2_0 (inline; no file on disk)
**Supersedes:** v1 Batch 0 (assumed shipped)
**Author:** plan-pro:write-plan, 2026-04-28
**Estimated total:** ~8.5 hours across 5 batches

---

## Context

Theseus VIE shipped v1 of its mobile shell with a warm-brown Atlas palette, ad-hoc chat rendering, and a six-place sidebar (Threads / Explorer / Sources / Plugins / Intel / Notebook). Three structural calls landed after v1 was prepped:

1. The warm palette read as wrong against the brand mark (`src/app/theseus/icon.svg` is forest-green + brass on dark). Switch to cool slate + brand-derived accents.
2. `@assistant-ui/react` is already in `package.json` but not driving message rendering. Adopt its primitives for chat, composer, welcome, and reasoning so Theseus rhymes with industry chat patterns without losing editorial voice.
3. Sidebar is overcrowded. Merge Sources + Plugins into one Plugins panel with Connectors / MCP / Skills sub-tabs. Replace the Intel tab with Code. Repurpose Intelligence content as a public `/theseus` landing page.

Plus: cosmos.gl Explorer needs first-class touch wiring on mobile (was deferred in v1). And: hide every scrollbar inside `.theseus-root` so the chrome reads as native-app.

**Outcome:** A shipped, mobile-first Theseus that visually rhymes with the brand mark, uses canonical assistant-ui patterns for chat, has a 4-tab bottom nav, and feels native on iOS Safari.

---

## File map (referenced throughout)

| Path | Role |
|---|---|
| `src/styles/theseus.css` | Token block (12-77), sidebar gradients (~5837), nav active states (~5945-5974), atlas-canvas (~6219-6232), responsive (2045-2070) |
| `src/styles/assistant-ui-theme.css` | Token map for assistant-ui primitives (already exists, partial) |
| `src/components/theseus/TheseusMobileNav.tsx` | `MOBILE_NAV_ITEMS` array |
| `src/components/theseus/TheseusSidebar.tsx` | `TRAILING_PLACES` array |
| `src/components/theseus/PanelManager.tsx` | `PANEL_COMPONENTS` dispatch + URL sync |
| `src/components/theseus/useKeyboardShortcuts.ts` | ⌘1-5 bindings |
| `src/components/theseus/atlas/AtlasCommandPalette.tsx` | Searchable items |
| `src/components/theseus/atlas/AtlasEmblem.tsx` | Brand mark colors |
| `src/components/theseus/atlas/sources.ts` | Source registry (reused by Connectors tab) |
| `src/components/theseus/panels/AskPanel.tsx` | Wraps chat |
| `src/components/theseus/panels/ConnectionsPanel.tsx` | Will be absorbed into PluginsPanel |
| `src/components/theseus/panels/PluginsPanel.tsx` | Refactor to 3-tab layout |
| `src/components/theseus/panels/IntelligencePanel.tsx` | Becomes deprecation card; content moves to landing |
| `src/components/theseus/panels/CodePanel.tsx` | Existing, no changes |
| `src/components/theseus/chat/Composer.tsx` | NEW — wraps `ComposerPrimitive.Root` |
| `src/components/theseus/chat/Message.tsx` | NEW — branches on role |
| `src/components/theseus/chat/Welcome.tsx` | NEW — suggestion grid |
| `src/components/theseus/chat/Thread.tsx` | NEW — top-level `ThreadPrimitive.Root` |
| `src/components/theseus/chat/ChatComposer.tsx`, `AssistantMessage.tsx`, `UserMessage.tsx`, `TheseusThread.tsx`, `AskIdleHero.tsx` | Existing — replace bodies with assistant-ui primitives, keep filenames so PanelManager wiring is unchanged |
| `src/components/theseus/landing/TheseusLanding.tsx` | NEW — public landing |
| `src/app/theseus/page.tsx` | Auth-gated redirect to `/theseus/threads` or render landing |
| `src/components/theseus/explorer/CosmosGraphCanvas.tsx` (or wrapper) | Touch wiring + perf budget |

**Reuse, do not reinvent:**
- `src/components/theseus/atlas/sources.ts` for Connectors tab
- Existing `IntelligencePanel.tsx` content as the source for `TheseusLanding.tsx` body
- Existing `voice-controls-btn` CSS (out of scope here, future batch)

---

## Batch 5 · Color token swap (~1.5 hr)

### Task 5.1 · Replace token block in theseus.css (~30 min)

**File:** `src/styles/theseus.css` lines 12-77

**Action:** Replace the entire `.theseus-root { ... }` block (everything from the opening brace through `--font-mono: ...` ending around line 77) with the cool-slate block from the spec. Keep variable names; change values only. New `--accent-2: var(--pcb)` and `--pcb-deep: #0a2a20` are added; nothing is removed.

**Concrete diff hint:**
- `--app-base: #1A1817` → `#16181C`
- `--sidebar: #171110` → `#14171B`
- `--brass: #B09468` → `#c9a23a` (matches `theseus/icon.svg` trace gold)
- Add `--pcb: #2a8b6c`, `--pcb-deep: #0a2a20`, `--silkscreen: #d4c88a`
- `--paper: #f3efe6` → `#f5f5f7`
- `--paper-pencil: #a8301e` → `var(--pcb)` (was terracotta; now forest green)

**Verify:** Reload `/theseus` in browser. Background reads cool slate, not warm brown. `npm run lint` passes (no syntax errors).

### Task 5.2 · Atlas canvas grid lines (~10 min)

**File:** `src/styles/theseus.css` line ~6219

**Find:** `rgba(120, 104, 82, 0.12)` (warm sepia inside `.atlas-canvas` background-image rule)
**Replace with:** `rgba(120, 124, 130, 0.14)`

**Verify:** Atlas canvas grid reads cool, not sepia.

### Task 5.3 · Atlas canvas accent override (~5 min)

**File:** `src/styles/theseus.css` lines ~6229-6232

**Find:** `--accent-color: var(--paper-pencil);` inside `.atlas-canvas` block
**Action:** No code change needed — `--paper-pencil` already aliases to `--pcb` via Task 5.1. Confirm canvas pencil reads forest-green.

### Task 5.4 · Audit sidebar gradients (~15 min)

**File:** `src/styles/theseus.css` lines ~5837-5840

**Action:** Inspect at `/theseus`. With new `--tone-ink` (`rgba(228, 230, 234, 0.04)`) and `--tone-blue` (`rgba(140, 154, 219, 0.05)`) the wash will be barely visible. **Do not** restore opacity. If completely invisible, delete the `background-image` rule entirely.

### Task 5.5 · Audit active-row inset shadow (~10 min)

**File:** `src/styles/theseus.css` lines ~5943, 5965

**Action:** Verify `.atlas-nav-item.active` and `.atlas-place-row.active` show a brass left rule via `box-shadow: inset 2px 0 0 var(--accent-color)`. The 2px brass inset now carries the active state alone (the `linear-gradient` patina-rose wash will be near-invisible with new tones).

### Task 5.6 · Engine-state color sanity (~15 min)

**File:** `src/styles/theseus.css` (search for `--vie-engine-active`, `vie-amber-light`, `vie-teal-light`)

**Action:** Confirm `--brass` reads as warm enough to mean "engine running / amber". If it conflicts with brand voice, change `--vie-engine-active: var(--pcb)` so forest green = running. Default: leave as brass.

### Task 5.7 · Build + visual check (~5 min)

```bash
npm run build
npm run dev
```

Open `/theseus` at desktop and mobile widths. Verify:
- Background = cool slate `#16181C`
- Brand mark visually rhymes with chrome
- Active nav row = brass left rule, no patina-rose wash
- Atlas canvas = cool paper, forest-green pencil
- `npm run build` passes

---

## Batch 6 · Adopt assistant-ui chat patterns (~3 hr)

### Task 6.1 · Update assistant-ui-theme.css token map (~20 min)

**File:** `src/styles/assistant-ui-theme.css`

**Action:** Replace contents with the two-block token map from the spec:
- `.theseus-root { ... }` → paper-surface defaults (`--background: var(--paper)`, etc.)
- `.theseus-root .theseus-dark { ... }` → reverse map for dark-surface chat (composer on sidebar, etc.)

**Verify:** `npm run lint`. Visit `/theseus/threads` — paper surface still reads correctly.

### Task 6.2 · Welcome suggestion grid (~30 min)

**File:** `src/components/theseus/chat/AskIdleHero.tsx` (rename body, keep filename for PanelManager compat)

**Pattern (verbatim from spec):**
- `<h1>` Vollkorn 26px mobile / 28px desktop, `font-weight: 500`
- `<p>` lede Vollkorn 19px / 21px, `color: var(--paper-ink-3)`
- Suggestions: `grid grid-cols-1 @md:grid-cols-2 gap-2` of `<Button variant="ghost" className="rounded-3xl border bg-background px-4 py-3 text-start">` with title in `font-medium` and description in `text-muted-foreground`
- Stagger: `fade-in slide-in-from-bottom-1 animate-in fill-mode-both duration-200` with `0 / 80 / 160 / 240ms` delays per suggestion (Tailwind `delay-[Nms]`)

**Suggestion data:** Pull from existing suggestion source if one exists; otherwise hardcode 4 brand-voice prompts (e.g., "Start a research thread", "Open the Atlas", "Connect a source", "What did the engine learn last night?").

**Verify:** Empty Ask panel shows display heading + lede + 2x2 staggered grid, animates in once on mount.

### Task 6.3 · UserMessage.tsx — right-aligned bubble (~20 min)

**File:** `src/components/theseus/chat/UserMessage.tsx`

**Pattern:**
```css
align-self: flex-end;
max-width: 85%;
background: var(--paper-2);
border-radius: 16px;
padding: 10px 14px;
font: 14px var(--font-body);
```

Edit action floats left of bubble on hover, autohides via `opacity` + `transition`.

**Verify:** User message renders right-aligned with muted bubble.

### Task 6.4 · AssistantMessage.tsx — plain prose, no bubble (~25 min)

**File:** `src/components/theseus/chat/AssistantMessage.tsx`

**Pattern:**
```css
align-self: stretch;
color: var(--paper-ink);
padding: 0 4px;
font: 15px/1.6 var(--font-display);  /* Vollkorn editorial voice */
```

Markdown via `<MarkdownText />` from `@assistant-ui/react`. Citation links: `border-bottom: 1px solid rgba(42, 139, 108, 0.4)` (forest underline). Footer meta row: confidence | sources | dissent count, IBM Plex Mono 10px, numerals in brass (`color: var(--brass)`). Action bar (Copy / Reload / More) below at `text-muted-foreground`, autohide via `<ActionBarPrimitive.Root autohide="not-last" />`.

**Verify:** Assistant prose reads as editorial; cite-links underline forest; action bar appears only under newest assistant message.

### Task 6.5 · Reasoning collapsible (~25 min)

**File:** `src/components/theseus/chat/parts/` (new file `Reasoning.tsx` if not present, else update existing)

**Pattern:**
- Border-card at `bg-paper-2` with brass heartbeat-pulse dot (CSS animation respecting `prefers-reduced-motion`)
- Mono 10px label `Reasoning · 1.4s`
- Body 12.5px IBM Plex Sans, `color: var(--paper-ink-2)`
- Collapsed by default after reasoning completes; expanded while in flight
- Use assistant-ui's `<Reasoning>` primitive

**Verify:** During streaming, reasoning is open; on completion it collapses; pulse dot stops when `prefers-reduced-motion: reduce` is set.

### Task 6.6 · ChatComposer.tsx — rounded-3xl with brass focus ring (~30 min)

**File:** `src/components/theseus/chat/ChatComposer.tsx`

**Pattern:**
- Thread root sets `--composer-radius: 24px; --composer-padding: 10px;`
- `border: 1px solid var(--paper-rule); transition: border-color 160ms, box-shadow 160ms;`
- `:focus-within` → `border-color: rgba(201, 162, 58, 0.6); box-shadow: 0 0 0 4px rgba(201, 162, 58, 0.18);`
- Tools row left: `@`, Attach, Voice icons at 32x32 with hover wash
- Send button: 32x32 circle, `<ArrowUpIcon />` from `lucide-react`, `background: var(--paper-ink); color: var(--paper);`
- Cancel state during streaming: same circle with `<SquareIcon />` filled
- Auto-grow textarea, `font-size: 16px` (prevents iOS zoom)

Wrap with `ComposerPrimitive.Root` from `@assistant-ui/react`.

**Verify:** Focus the composer → brass focus ring at 18% alpha appears. iOS Safari does not zoom on focus.

### Task 6.7 · Follow-up suggestion pills (~20 min)

**File:** `src/components/theseus/SuggestionPills.tsx` (already exists, refactor)

**Pattern:**
- Stacked column of bordered pills below the most recent assistant message
- Each prefixed with `↗` in brass mono
- `<SuggestionPrimitive.Trigger send asChild>` from assistant-ui
- Hover: `border-color: var(--paper-ink-3); background: rgba(20, 22, 26, 0.04);`

**Verify:** Follow-ups render as a column of pills, click sends.

### Task 6.8 · Thread.tsx top-level wrapper (~15 min)

**File:** `src/components/theseus/chat/TheseusThread.tsx`

**Action:** Wrap children in `<ThreadPrimitive.Root>` from `@assistant-ui/react`. Confirm `AskPanel.tsx` still mounts `TheseusThread`.

**Verify:** Stream a real chat end-to-end. All states (welcome, user msg, reasoning, assistant msg, action bar, follow-ups, composer) render.

### Task 6.9 · Build + a11y check (~15 min)

```bash
npm run build
```

- Empty state: 4-card 2x2 suggestion grid with stagger
- User msg: right-aligned muted bubble
- Assistant msg: plain prose, no bubble
- Composer focus shows brass-glow ring
- Action bar autohides on older messages
- Reasoning collapses on completion
- Markdown citations underline forest-green
- `prefers-reduced-motion` disables heartbeat pulse

---

## Batch 7 · Nav restructure: Plugins / Code / landing (~2 hr)

### Task 7.1 · Update MOBILE_NAV_ITEMS (~15 min)

**File:** `src/components/theseus/TheseusMobileNav.tsx`

**Replace** `MOBILE_NAV_ITEMS` with:
```ts
const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { id: 'ask',      label: 'Threads',  panelId: 'ask',      icon: ChatIcon },
  { id: 'explorer', label: 'Explorer', panelId: 'explorer', icon: GraphIcon },
  { id: 'plugins',  label: 'Plugins',  panelId: 'plugins',  icon: PluginsIcon },
  { id: 'code',     label: 'Code',     panelId: 'code',     icon: CodeIcon },
];
```

**Add icons** in the same file (or a sibling `icons.tsx`):
- `PluginsIcon`: 4-rect grid + center traces, 22x22, `stroke-width: 1.5`
- `CodeIcon`: chevron-pair + slash, path `M16 18l6-6-6-6 M8 6l-6 6 6 6 M14 4l-4 16`

**Drop:** `ConnectionsIcon` and `IntelligenceIcon` imports from this file. Keep the icon components in version control if other surfaces still reference them (grep before removing).

**Verify:** Bottom nav on mobile shows 4 items: Threads, Explorer, Plugins, Code.

### Task 7.2 · Update TRAILING_PLACES (~10 min)

**File:** `src/components/theseus/TheseusSidebar.tsx`

**Replace** `TRAILING_PLACES` with:
```ts
const TRAILING_PLACES: TrailingPlace[] = [
  { panel: 'plugins', n: '03', label: 'Plugins',  meta: '⌘3' },
  { panel: 'code',    n: '04', label: 'Code',     meta: '⌘4' },
  { panel: 'notebook',n: '05', label: 'Notebook', meta: '⌘5' },
];
```

**Drop:** `connections` and `intelligence` rows.

**Verify:** Desktop sidebar shows 5 places (01 Threads, 02 Explorer, 03 Plugins, 04 Code, 05 Notebook).

### Task 7.3 · Update keyboard shortcuts (~10 min)

**File:** `src/components/theseus/useKeyboardShortcuts.ts`

**Action:** ⌘1 Threads, ⌘2 Explorer, ⌘3 Plugins (was Connections), ⌘4 Code (was Intelligence), ⌘5 Notebook.

**Verify:** Press ⌘3 → Plugins panel opens. Press ⌘4 → Code panel.

### Task 7.4 · PanelManager backward-compat (~20 min)

**File:** `src/components/theseus/PanelManager.tsx`

**Action:**
- Keep all 8 `PanelId` values as a discriminated union for URL deep-link compat
- `'connections'` renders `<PluginsPanel defaultTab="connectors" />`
- `'intelligence'` renders a deprecation card with two CTAs: "See Plugins" and "See Code"
- New sessions: redirect `?view=connections` → `?view=plugins&tab=connectors`, `?view=intelligence` → `/theseus/about` (or render deprecation card if route not yet built)

**Verify:** Navigating to `/theseus?view=connections` lands on Plugins panel with Connectors tab selected. `/theseus?view=intelligence` shows deprecation card.

### Task 7.5 · PluginsPanel refactor with 3 sub-tabs (~40 min)

**File:** `src/components/theseus/panels/PluginsPanel.tsx`

**Action:**
- Add `defaultTab?: 'connectors' | 'mcp' | 'skills'` prop
- Tab strip at top with 3 buttons; active tab gets brass underline
- **Connectors** (default): GitHub, arXiv + Semantic, Fastmail, Obsidian, browser highlights. Reuse `src/components/theseus/atlas/sources.ts` registry; render each source card.
- **MCP**: enumerate from MCP registry. Render: connection state, tool count, toggle. (If a registry list isn't available, hardcode a list of known servers from `~/.claude.json` MCP names: `theseus-mcp`, `r3f-mcp`, `tpu-commander`, etc., with a TODO to wire dynamic enumeration. Per project rule: no mock data — show empty state with "Configure in `~/.claude.json`" if not enumerable.)
- **Skills**: enumerate user skills loaded via the Plugins MCP server. If MCP not connected, show empty state + "Connect Theseus MCP" link.
- Card pattern: 36px monogram (kind-tinted background) + name + detail line + status dot + toggle button

**Important (CLAUDE.md rule):** No `MOCK_*`/`SAMPLE_*` arrays. If MCP enumeration endpoint doesn't exist yet, render an honest empty state — do not ship a fake list.

**Verify:** All three tabs render. Switching tabs is instant. Connectors tab uses real `sources.ts` data.

### Task 7.6 · TheseusLanding.tsx new component (~25 min)

**File:** `src/components/theseus/landing/TheseusLanding.tsx` (NEW)

**Pattern (from spec):**
- Forest-green halo gradient at top: `radial-gradient(ellipse at 50% 0%, rgba(42, 139, 108, 0.18) 0%, transparent 60%)`
- Brass eyebrow: `<p className="text-[var(--brass)] font-mono text-xs tracking-wide uppercase">Visual Intelligence Engine</p>`
- Italicized brass headline accent (Vollkorn italic, brass color, 1 phrase)
- Real engine stats from `/api/v2/theseus/graph-weather/` via `fetch` in a server component (App Router page is async)
- Six-layer architecture as a 2x3 grid (move existing copy from `IntelligencePanel.tsx`)

**Verify:** Visit `/theseus` while logged out — landing renders with real graph stats.

### Task 7.7 · `/theseus/page.tsx` auth-gated redirect (~15 min)

**File:** `src/app/theseus/page.tsx`

**Replace contents with:**
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

**Action:** Verify `@/lib/auth` exists (or use whatever auth helper the project ships). If no auth helper exists yet, render the landing unconditionally and add a TODO comment — do NOT fake a session check.

**Verify:** Logged-out: lands on `/theseus`. Logged-in: redirects to `/theseus/threads`.

### Task 7.8 · Command palette rename (~10 min)

**File:** `src/components/theseus/atlas/AtlasCommandPalette.tsx`

**Action:** Rename "Connections" → "Plugins"; remove "Intelligence" or rename to "About / Code" (whichever maps clearly to the new `/theseus` landing).

**Verify:** Open Cmd+K palette; search "plug" finds Plugins panel.

### Task 7.9 · Build + manual nav check (~15 min)

```bash
npm run build
```

- Bottom nav: Threads / Explorer / Plugins / Code (no Sources, no Intel)
- Plugins tap opens merged panel, Connectors tab default
- Code tap opens `CodePanel`
- `/theseus` logged-out → landing
- `/theseus` logged-in → `/theseus/threads`
- `?view=connections` → Plugins tab=connectors (no console errors)

---

## Batch 8 · cosmos.gl on mobile, properly (~2 hr)

### Task 8.1 · Locate the cosmos.gl wrapper (~10 min)

**Action:** `grep -rn "@cosmos.gl/graph" src/components/theseus/explorer/` to find the wrapper component.

Likely candidate: `src/components/theseus/explorer/CosmosGraphCanvas.tsx` (per CLAUDE.md). Confirm before editing.

### Task 8.2 · Pinch-zoom touch wiring (~30 min)

**File:** `src/components/theseus/explorer/CosmosGraphCanvas.tsx`

**Action:** Add gesture handlers inside the existing canvas mount effect:
- iOS: `gesturestart` / `gesturechange` / `gestureend` events on canvas
- Modern: `pointerdown` / `pointermove` / `pointerup` with two pointers (Android, desktop touch)
- On `gesturechange`: `cosmos.setZoomLevel(currentZoom * e.scale)`, throttled with `requestAnimationFrame`
- Track `currentZoom` in a ref to avoid stale closure

**Pattern:**
```tsx
const zoomRef = useRef(1);
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  let rafId: number;
  const onGestureChange = (e: any) => {
    e.preventDefault();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      cosmos.setZoomLevel(zoomRef.current * e.scale);
    });
  };
  const onGestureEnd = (e: any) => {
    zoomRef.current = zoomRef.current * e.scale;
  };
  canvas.addEventListener('gesturechange', onGestureChange, { passive: false });
  canvas.addEventListener('gestureend', onGestureEnd);
  return () => {
    canvas.removeEventListener('gesturechange', onGestureChange);
    canvas.removeEventListener('gestureend', onGestureEnd);
    cancelAnimationFrame(rafId);
  };
}, [cosmos]);
```

**Verify:** Pinch-zoom on iPhone feels instant.

### Task 8.3 · Tap-to-Lens hit-test (~25 min)

**File:** same wrapper

**Action:**
- Track `pointerdown` time + (x, y); on `pointerup`, if `Δtime < 300ms` and `Δdist < 8px`, treat as tap
- Use cosmos.gl `getNodeAt(x, y)` (verify exact API surface; in the wrapper README it's likely `graph.spaceToScreenPosition` + manual hit-test, OR a built-in `findNearestPoint`). Confirm before writing.
- On hit: `window.dispatchEvent(new CustomEvent('theseus:open-lens', { detail: { nodeId: hit.id } }))`

**Verify:** Tapping a node opens Lens sheet with that node focused.

### Task 8.4 · `touch-action: none` (~5 min)

**File:** `src/styles/theseus.css` mobile media query (Task 8.6)

**Action:** Add `.atlas-canvas canvas { touch-action: none; }` so two-finger pan does not scroll the page.

### Task 8.5 · Perf budget (~20 min)

**File:** wrapper

**Action:**
- Drop simulation `decay` from default to `1000` if `nodeCount > 10_000`
- After 3 seconds idle (no pointer events), pause simulation via `requestIdleCallback` → `cosmos.pause()`
- Resume on next interaction
- Flow lens (continuous breathing simulation): gate behind `!matchMedia('(prefers-reduced-motion: reduce)').matches` AND `!isMobile`. If reduced-motion is on, default to Atlas (static positions).

**Verify:** Open Explorer with engine warm for 5 min on iPhone — device does not heat, simulation pauses when idle.

### Task 8.6 · Mobile style passes (~15 min)

**File:** `src/styles/theseus.css` (append at end of mobile media query, around line 2070+)

**Append:**
```css
@media (max-width: 767px) {
  .atlas-canvas {
    background: var(--app-base);
    background-image: none;
  }
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

**Verify:** On iPhone, Explorer goes full-bleed dark with forest spotlight. Controls stack vertically bottom-right; cos-sim readout pinned bottom-left above safe-area inset.

### Task 8.7 · Real-device QA (~15 min)

Open `/theseus/explorer` on a real iPhone (Safari) and verify:
- Pinch-zoom feels instant
- Two-finger pan and one-finger pan both move camera
- Tap a node → Lens sheet opens, node focused
- Page does not scroll while panning canvas
- Battery: 5 min idle → device not warm
- `prefers-reduced-motion: reduce` (Settings → Accessibility) → Atlas lens is default
- `npm run build` passes

---

## Batch 9 · Global scrollbar hide (~10 min)

### Task 9.1 · Append scrollbar hide block to theseus.css (~5 min)

**File:** `src/styles/theseus.css`

**Append at end:**
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

### Task 9.2 · Verify isolation (~5 min)

- `/theseus`: no scrollbar visible anywhere; touch / wheel / arrow scroll still works
- `/commonplace`: scrollbars still visible (CommonPlace not in `.theseus-root`)
- `/blog` (or main site): scrollbars still visible
- `npm run build` passes

---

## Verification (definition of done)

| # | Check | Batch |
|---|---|---|
| 1 | App background is cool slate, not warm brown | 5 |
| 2 | Brand colors (PCB green + brass) are the only accents | 5 |
| 3 | Welcome state = display heading + lede + 2x2 staggered grid | 6 |
| 4 | User msg = right-aligned muted bubble; assistant = plain prose | 6 |
| 5 | Composer is rounded-3xl with brass focus-within ring | 6 |
| 6 | Reasoning collapsible with heartbeat pulse | 6 |
| 7 | Bottom nav = Threads / Explorer / Plugins / Code | 7 |
| 8 | Plugins panel has 3 sub-tabs, absorbs Connections | 7 |
| 9 | `/theseus` shows landing when logged-out, redirects when logged-in | 7 |
| 10 | Pinch-zoom and tap-to-Lens work on iOS Safari | 8 |
| 11 | No scrollbars visible anywhere in `/theseus` | 9 |
| 12 | Desktop ≥768px: same color shift, no other regressions | 5+ |

**End-to-end smoke (run after each batch):**
```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website"
npm run lint
npm run build
npm run dev
```

Then manually: open `/theseus`, click each nav item, send a chat message, open Explorer, resize to 375px width, run through the matrix above.

**Real-device QA (Batch 8 only):** Connect iPhone → Safari Web Inspector via USB → load `/theseus/explorer` → run pinch-zoom, tap, pan, leave 5 min idle, toggle reduced-motion.

---

## Suggested ship order

1. **PR 1 (Batches 5 + 9)** — cosmetic, quick, low risk. Token swap + scrollbar hide.
2. **PR 2 (Batch 6)** — assistant-ui adoption. Big diff, contained scope.
3. **PR 3 (Batch 7)** — nav restructure. Ship route + placeholder landing first; iterate landing content in a follow-up.
4. **PR 4 (Batch 8)** — cosmos.gl mobile. Last because of real-device QA need; touches perf-sensitive code.

---

## Deliberate exclusions (per spec)

- **Light/dark toggle** — Theseus is dark-first by intent. Paper is the only light surface.
- **assistant-ui voice/dictation primitive** — `voice-controls-btn` CSS exists but wiring is its own batch.
- **Branch picker UI** — `BranchPickerPrimitive` is in the assistant-ui reference but Theseus has no message branching today.
- **Dark composer surface** — composer only on paper today. If a panel ever needs a dark composer, wrap subtree in `.theseus-dark` and the token map handles it.

---

## Project conventions enforced (from CLAUDE.md)

- **No em/en dashes** anywhere in code, comments, UI strings, or markdown content
- **No mock data** in shipped surfaces — Plugins MCP/Skills tabs render honest empty states if enumeration is unavailable
- **No fake UI** — every button wires to real state or real navigation; no `onClick={() => {}}` placeholders
- **No `?mock=1` flags** — landing renders real `/api/v2/theseus/graph-weather/` data, not seeded mock
- **Match exact visual specs** — token values, animation timings, and CSS rules from the spec are reproduced verbatim
- **Atomic commits per batch** — `feat(theseus): cool slate token swap (Batch 5)` etc.
- **No Co-Authored-By lines** in commits

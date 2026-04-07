# Theseus /ask motion cleanup implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the /theseus/ask thinking-to-answer transition feel like one continuous, intentional gesture by removing dead air, morphing the search box into the spinner, and blooming the answer card from the spinner location.

**Architecture:** Phase A is purely local frontend changes — no backend dependency, ships immediately. Phase B layers predictive dot formation onto the SSE stream once the backend stage-events commit (Index-API `968a226`) is deployed. Phase A is the focus of this session.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, the existing TheseusDotGrid canvas system, React state in `src/app/theseus/ask/page.tsx`, no new dependencies.

---

## Constraints from the user (locked, do not deviate)

1. **Search box morph (Option B)** is the chosen approach. Spinner can grow to ~36-48px; search box can shrink to ~480px. The morph is allowed to read as compression-into-a-point.
2. **Bloom answer card from spinner location.** The spinner is the anchor point — the answer card emerges from where the spinner was, not from a separate top-left position.
3. **No emojis. No em-dashes or en-dashes** (CLAUDE.md project rule).
4. **Preserve existing visuals** the user did not ask to change (DotGrid, heat gradient on Galaxy side, particle field, etc.).

---

## Phase A: ships against the existing backend

### Task A1: Remove the three hard-coded dead-air `setTimeout`s

**Files:**
- Modify: `src/app/theseus/ask/page.tsx:541` (the 500ms `await setTimeout` between MODEL and CONSTRUCTING)
- Modify: `src/app/theseus/ask/page.tsx:609-611` (the 3000ms narration delay)
- Modify: `src/components/theseus/GalaxyController.tsx:1031` (the 1000ms construction-phase delay)
- Modify: `src/components/theseus/GalaxyController.tsx:1141` (the 2000ms crystallize delay)

**Step 1:** Replace `page.tsx:541` `await new Promise(r => setTimeout(r, 500))` with `await new Promise(r => requestAnimationFrame(() => r(undefined)))`. One frame, not 500ms.

**Step 2:** Replace `page.tsx:609-611` narration timer with an immediate set when the directive is graph-native. The 2D path's `runAnswerConstruction` already has its own animation timeline; narration should appear when CONSTRUCTING ends, which is when we transition to EXPLORING. Set `narrationReady` to true at the same point we set `state = EXPLORING` for graph-native targets, no `setTimeout`.

**Step 3:** In `GalaxyController.tsx:1031`, change the 1000ms `setTimeout` to a `requestAnimationFrame`-driven start. The filter ramp at line 1015-1027 finishes after exactly 500ms (10 steps × 50ms). Track its completion via a callback ref and start construction the moment the filter interval clears.

**Step 4:** In `GalaxyController.tsx:1141`, change the 2000ms `setTimeout` for crystallize to ~600ms. The recruited dots reach their targets on the canvas's own animation loop in well under 2 seconds; 600ms is enough for them to settle perceptually. (Stronger fix is event-driven but that requires a callback API on `setDotTarget` that doesn't exist; 600ms is the tight pragmatic value.)

**Step 5:** Verify in dev server: query "what is design thinking" and observe that there are no perceptible flat moments between THINKING → MODEL → CONSTRUCTING → EXPLORING. The total time should drop by ~5500ms in the worst case.

**Step 6:** Commit. `fix(theseus-ask): remove hard-coded dead air between thinking phases`

### Task A2: Layout-thrash CSS fixes

**Files:**
- Modify: `src/components/theseus/ThinkingScreen.tsx:200-220` (pipeline bars use `width`)
- Modify: `src/components/theseus/ThinkingScreen.tsx:128-139` (heat gradient uses `height`)

**Step 1:** Pipeline bars: replace `width: barIndex <= step ? '100%' : '0%'` with `transform: barIndex <= step ? 'scaleX(1)' : 'scaleX(0)'` and add `transformOrigin: 'left'`. Change the transition to `transform 400ms ease-out`. The `transform-origin` makes it grow from the left edge, which matches the existing `width` behavior visually.

**Step 2:** Heat gradient: this gradient duplicates the one in `GalaxyController.tsx:1965-1988`. Delete the entire ThinkingScreen heat gradient (`ThinkingScreen.tsx:128-139`) and let the Galaxy heat gradient be the single source of truth. The Galaxy version is more comprehensive (4 phase intensities vs 3) and uses `background` transitions which don't trigger layout.

**Step 3:** Verify in dev server. Check that there is no visible double-gradient stacking at the bottom of the viewport during THINKING. Take a screenshot.

**Step 4:** Commit. `fix(theseus-ask): use transform for pipeline bars, drop duplicate heat gradient`

### Task A3: A11y reduced-motion gates

**Files:**
- Modify: `src/components/ask/SpatialPanel.tsx:64-70`
- Modify: `src/components/theseus/renderers/RenderRouter.tsx:158-170`

**Step 1:** SpatialPanel: import `usePrefersReducedMotion` from `@/hooks/usePrefersReducedMotion`. In the bloom transition style block, gate `transition` to `prefersReducedMotion ? 'none' : 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease'`. Also drop the bloom on reduced motion: set `transform: prefersReducedMotion ? 'scale(1)' : (bloomed ? 'scale(1)' : 'scale(0.92)')` and `opacity: prefersReducedMotion ? 1 : (bloomed ? 1 : 0)`.

**Step 2:** RenderRouter: same hook, gate the cross-fade. `transition: prefersReducedMotion ? 'none' : 'opacity 600ms ease'`.

**Step 3:** Verify by toggling System Preferences > Accessibility > Reduce motion (or via DevTools emulation in the preview tool's `colorScheme` analog if available). At minimum, eyeball the code.

**Step 4:** Commit. `a11y(theseus-ask): honor prefers-reduced-motion in SpatialPanel and RenderRouter`

### Task A4: Persistent search box, query string travels

**The big one.** This is where the perceptual win lives.

**Files:**
- Modify: `src/app/theseus/ask/page.tsx` (heavy edits to `AskContent`)
- Modify: `src/components/theseus/ThinkingScreen.tsx` (delete the centered query `<p>` at line 141-155)

**Step 1:** Lift the bottom dock out of the per-state branches. Currently `renderBottomDock` is only called when `showComposer` is true (EXPLORING or error). The dock should be rendered for **all states** (IDLE, THINKING, MODEL, CONSTRUCTING, EXPLORING). The IDLE branch at lines 714-769 has its own duplicate dock; merge it into the persistent one.

**Step 2:** Restructure `AskContent` so it always returns a single root container with three layers, rendered conditionally:
   - The persistent search box dock (always)
   - The thinking overlay (when state is THINKING/MODEL/CONSTRUCTING)
   - The answer surface (when state is EXPLORING)

   **Do not** early-return ThinkingScreen at line 887. The thinking overlay should be a sibling of the answer surface, both inside the same root, with `opacity` and `pointer-events` driving visibility.

**Step 3:** Move the query string out of `ThinkingScreen.tsx`. The centered `<p>` at lines 141-155 is the visual element that needs to morph. Delete it from ThinkingScreen entirely.

**Step 4:** Pin the query string to a single DOM node in `AskContent`. Render it once, with `position: absolute` and `transform: translate(...)` driven by state. Three target positions:
   - IDLE: hidden (the input is empty, nothing to show)
   - THINKING / MODEL / CONSTRUCTING: centered above the dock at `bottom: 100px`, font size matching ThinkingScreen's previous size
   - EXPLORING: top-left, at the position of the existing answer header card, font size matching the existing `<h1>` (1.55rem desktop, 1.25rem mobile)

   Use `transition: transform 700ms cubic-bezier(0.32, 0.72, 0.24, 1.04), font-size 700ms ease` so the morph reads as one continuous gesture. Add `prefersReducedMotion` gate: snap to position with no transition.

**Step 5:** Remove the `<h1>` query from inside the answer header card (`page.tsx:961-971`). The answer header card now reads "renderer label · nodes · confidence" only — the query lives in the persistent overlay element above it. Position the answer header card under where the persistent query lands so the user reads (query, then meta) in vertical order.

**Step 6:** The search box itself: shrink its desktop width from `min(640px, ...)` to `min(480px, ...)`. This is the user's explicit ask.

**Step 7:** Verify in dev server:
   - Submit a query from IDLE
   - Watch the query text travel from input → centered above dock → top-left header position
   - There should be no point at which the query text is unmounted/remounted
   - The search box stays put the whole time

**Step 8:** Commit. `feat(theseus-ask): persistent search dock and traveling query string`

### Task A5: Search box morphs into spinner (Option B)

**Files:**
- Modify: `src/components/theseus/ThinkingScreen.tsx` (the spinner block at line 157-191)
- Modify: `src/app/theseus/ask/page.tsx` (search box dock, to support the morph)

**Approach:** This is a coordinated cross-dissolve at a shared center point, not a literal continuous shape interpolation. The search box scales down toward its center, the spinner scales up at the same point, with the two crossing at ~50% opacity. The user has approved that the spinner can grow to ~36-48px so the visual gap is small.

**Step 1:** Create a new `SubmittingMorph` component (inline in `page.tsx` or a sibling file). Props: `state: AskState`, `position: { x, y }`. Renders nothing in IDLE/EXPLORING. In THINKING/MODEL/CONSTRUCTING, renders a centered spinner element (the existing braille glyph, but at 40px instead of 14px) with a soft circular halo behind it.

**Step 2:** In the persistent search box dock, add a `submitting` boolean derived from `state !== 'IDLE' && state !== 'EXPLORING'`. When `submitting` is true:
   - The input element gets `transform: scale(0.88)` and `opacity: 0.4`, transition 400ms ease
   - The voice button and submit button get `opacity: 0` and `pointer-events: none`, transition 300ms ease
   - The whole search box wrapper does NOT translate — it stays put
   The input visually "compresses inward" but does not move.

**Step 3:** Render the spinner element OVER the input, positioned at the input's geometric center. When `submitting` is true: `opacity: 1`, `transform: scale(1)`. When false: `opacity: 0`, `transform: scale(0.6)`. Transition `400ms cubic-bezier(0.32, 0.72, 0.24, 1.04)`. Stagger the spinner appearance by ~150ms after `submitting` flips so the input compression starts first.

**Step 4:** Delete the existing spinner block in `ThinkingScreen.tsx:157-191`. Same with the pipeline bars at 193-221. ThinkingScreen now contains only the status label (which will move to a small line under the centered query) and the slow-warning text.

**Step 5:** Bloom the answer card from the spinner location (Priority 3 from the audit). When `state === 'EXPLORING'`, the spinner element fades out (`opacity: 0`, `transform: scale(0.6)`) and the answer header card blooms in from the same point: `transform-origin` set to the spinner's screen position, starting `transform: scale(0.85) translate(...)` from the spinner location and animating to its final top-left rest position. Transition `600ms cubic-bezier(0.32, 0.72, 0.24, 1.04)`. This is the SpatialPanel pattern applied to the whole header card.

**Step 6:** Verify in dev server:
   - Submit a query
   - Watch the search box compress while the spinner appears at its center
   - During THINKING/MODEL/CONSTRUCTING, only the spinner is visible inside the dock
   - On EXPLORING, the spinner fades out and the answer header card emerges from where the spinner was
   - The query string (Task A4) lifts up to the top-left at the same time
   Expected: feels like one continuous gesture, no hard cuts.

**Step 7:** Commit. `feat(theseus-ask): morph search box into spinner, bloom answer from spinner location`

### Task A6: Status label sits under the centered query

**Files:**
- Modify: `src/components/theseus/ThinkingScreen.tsx` (what's left of it)
- Modify: `src/app/theseus/ask/page.tsx`

**Step 1:** ThinkingScreen now renders only the status label (e.g. "searching graph…") and the slow warning. Strip everything else. The label is small and unobtrusive, sits directly under the centered query string.

**Step 2:** In `AskContent`, render ThinkingScreen as an absolutely-positioned overlay below the persistent query string, only when `state` is THINKING/MODEL/CONSTRUCTING. Use opacity transition for enter/exit (300ms), do not unmount. This guarantees no hard cut on the status text either.

**Step 3:** Remove the wall-clock-driven label flip from `ThinkingScreen.tsx:23-27` for now. Just show "thinking…" or use the actual `dataStatus.phase` when in CONSTRUCTING. The lying-clock labels are deferred until the SSE stage events are wired in Phase B.

**Step 4:** Verify and commit. `refactor(theseus-ask): simplify ThinkingScreen to status overlay`

---

## Phase B: predictive dot formation (deferred until backend `968a226` deploys)

This phase wires the new SSE stream from the backend into the frontend dot field so the dots begin migrating toward the answer shape during the wait. **Do not start this phase in this session unless Phase A is complete and verified.** Notes only:

- Frontend `askTheseus` becomes an SSE consumer against `POST /api/v2/theseus/ask/async/` + `GET /api/v2/theseus/ask/stream/<job_id>/`. Stage events drive a new `predictiveDirective` state on `GalaxyController`.
- New `vizPlanner.predictLayout(answer_type)` returns centroids per shape (portrait, map, timeline, comparison, graph).
- New `runPredictiveLayout(grid, centroids)` migrates dots toward speculative positions during THINKING using existing `setDotTarget` mechanism.
- When `objects_loaded` stage arrives, dots correct toward `focal_object_ids` positions.
- When `expression_start` stage arrives, dots are settled and the spinner blooms into the answer card (Phase A's existing path).

A Phase B plan doc will be written separately once Phase A ships.

---

## Verification before completion (Phase A)

1. `npm run lint` passes
2. `npm run build` passes (production SSG)
3. Manual: open dev server, submit a query from IDLE, watch the full sequence:
   - Search box compresses, spinner appears at its center
   - Query text lifts to the centered overlay position
   - At EXPLORING, spinner fades, answer card blooms from the spinner location, query text travels to the top-left
   - No hard cuts, no flat pauses
4. Manual: re-submit a follow-up query while in EXPLORING, observe the same morph in reverse and forward.
5. Manual: enable reduced-motion, verify the answer arrives without animation.

---

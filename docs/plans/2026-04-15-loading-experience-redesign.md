# Loading Experience Redesign

Date: 2026-04-15
Status: Approved, building iteratively
Scope: Explorer (primary), Ask (secondary), Face expressions (discrete fix)

## Problem

Current loading states fail on four axes: low intensity, pre-SSE dead zone, weak identity, and unintentional feel. The spinner was meant to look like a terminal spinner, ended up glowy. "Real-time construction of the answer" was the intent, never landed. On the Explorer, loading is plain text ("LOADING CONNECTIONS"). The face changes expression by tearing down all stipples and re-running Lloyd's relaxation instead of smoothly displacing dots.

## Architecture: three layers

Each layer does exactly one job. No layer carries more than one meaning.

1. **Terminal stream (Layer 1)**: persistent honest voice. Monospace, braille spinner, single cycling line. Says what is happening.
2. **Scaffold / skeleton (Layer 2)**: center stage. What is being built. Shows structure before content arrives, fills in as pipeline stages complete.
3. **Causal map (Layer 3, Ask only)**: dot grid. 1 dot = 1 evidence item. A dot brightens exactly when its source card appears in the scaffold.

Shared motion primitive across Explorer and Ask: **rough.js ink-in**. Any appearing element goes from invisible to dashed outline to filled stroke to filled content.

## Terminal stream spec

- Font: `var(--font-code)` (JetBrains Mono), 11px, line-height 1.55
- Single line (no stacking). New events replace the active line via 150ms crossfade.
- Braille spinner `BRAILLE_FRAMES` at 90ms per frame on the active line only.
- Heartbeat: if no event for 3s, append ` · still working` as a dimmer suffix.
- Colors: amber (active), terra (milestone), teal (data), dim (heartbeat).
- After completion: collapses to `answered in 3.42s` pill with expand chevron. Expanded view shows full timestamped event log. Re-expandable any time.
- Ask placement: fixed bottom-left, above dock, 16px margin. Not centered.
- Explorer placement: replaces "loading" text inside `explorer-status-strip`.

## Explorer changes

### 3A: initial cluster fetch (IdleGraph)

Canvas mounts with faint dot grid at 0.04 opacity (paper tooth). Cluster nodes ink in at final positions: rough.js stroke circle grows from 0 to final radius over 250ms, fills to type color. Staggered 40ms per node. Edges then stroke-dashoffset draw in. Object titles fade on their nodes as `getObject()` resolves.

### 3B: context panel loading

Replace uppercase text labels with rough.js dashed-outline skeleton rows. Three rows per tab, varying widths, stroke opacity pulses 0.15 to 0.30 over 1.4s. On data arrival, 160ms cross-dissolve into real content. Skip skeleton entirely on responses under 300ms.

### 3C: active exploration (neighborhood expansion)

Each new node arrives as a real-time ink-in rather than batched reveal. Edges draw 350ms after their node appears.

## Ask changes

- Replace `ThinkingScreen` text status with `TerminalStream` in bottom-left.
- `AmbientGraphActivity` stays but opacity lifted from 0.08-0.14 to 0.18-0.28 so whispers and edges are actually visible.
- Scaffold: during THINKING, the AnswerReadingPanel shows empty entity chips (rough.js boxes) that fill as `e4b_classify_complete` fires. Source cards slide up as `retrieval_complete` fires. Synthesis narrative types in word-by-word as the LM streams.
- Dot grid becomes causal map: instead of 5 simultaneous animations on `retrieval_complete`, each evidence item brightens its corresponding dot at the moment its scaffold card appears. Pagerank flood stays, SBERT heatmap and BM25 strobe retire (their job is now the scaffold, not the grid).

## Face expression fix

Current `runStippleConstruction` tears down all stipples and re-runs Lloyd's relaxation per expression change. Fix: extend `FaceAnimator.ts` (already has the correct pattern for breathing and blinks) with an expression vocabulary that displaces tagged dots in place. No restippling after initial construction.

Expressions as parameter sets over tagged regions (mouth-upper, mouth-lower, eye-left, eye-right, face):

- `idle`: breathing only
- `thinking`: eye dots shift 3px left, mouth corners dip 2px
- `working`: mouth closes, eyes narrow (eye-region Y compression)
- `found`: brief mouth open, eyes widen
- `done`: mouth corners rise

Transitions tween parameter values over 300-500ms. Dot identity preserved across all expressions.

## Open decisions (resolve during build)

- Context panel skeleton: rough.js dashed vs braille column. Decision deferred to implementation.
- Face expression timing curves and exact displacement magnitudes. Tune visually during build.
- Scaffold word-by-word streaming cadence on synthesis. Depends on LM token rate.

## Implementation order

1. `TerminalStream` component (shared, foundational)
2. Wire into Explorer StatusStrip (replaces plain loading text)
3. Ink-in for IdleGraph cluster load
4. ContextPanel skeleton
5. Wire into AskExperience (replaces ThinkingScreen text)
6. Face expression displacement
7. Answer scaffold + dot-grid causal map wiring

Stop at step 2 for first review. Iterate from real running code, not more spec.

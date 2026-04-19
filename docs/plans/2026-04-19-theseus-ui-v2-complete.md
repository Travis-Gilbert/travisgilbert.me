# SPEC-THESEUS-UI-V2: Completion Addendum

**Purpose:** make SPEC-THESEUS-UI-V2.md implementable without hand-rolling anything the spec says to fork. Read SPEC-THESEUS-UI-V2.md first. This document adds the parts the V2 spec left implicit: fork procedures, codebase reality, reconciliation matrix, source-material pointers, dependency manifest, and per-batch fork-verification.

**Base spec:** `SPEC-THESEUS-UI-V2.md` (Travis's Downloads). Its batch structure, file map, token fork, Cosmograph/Mosaic contracts, and scene-director rewrite are canonical. Nothing here contradicts V2; this document only refines how each fork actually happens.

---

## 0. Non-Negotiable Preamble (read once, obey throughout)

Travis has observed Claude Code sessions silently replacing "fork this library" with "hand-roll an imitation." That has already happened once in this codebase (see `src/components/theseus/chat/TheseusThread.tsx`: 440 lines mixing assistant-ui primitives with a bespoke composition instead of a clean shadcn fork). Do not repeat the pattern.

**Hard rules** (any violation is a Batch failure, even if the build passes):

1. When the spec says "fork <library>," the implementation MUST import named exports from the real package or the shadcn-registry output. No rewriting the primitive, no copying bytes and renaming, no "inspired by."
2. The canonical fork surface is named in §2 of this document. If the named surface isn't present in the diff, the fork didn't happen.
3. Before writing any new component file, run the pre-flight grep for that batch (see §6). If the sentinel imports aren't present when you finish the file, delete the file and start over from the source material.
4. A component whose behavior comes from a forked library MUST import from that library. Example: `TheseusThread.tsx` MUST contain `from '@assistant-ui/react'`. `CosmographCanvas.tsx` MUST contain `from '@cosmograph/react'`. `MosaicPart.tsx` MUST contain `from '@uwdata/vgplot'`. Grep-enforced.
5. CSS, layout, copy, and theming are yours to customize. The underlying primitive, physics engine, parser, layout engine, and search index are not.

These are not style preferences. They are the acceptance criteria for each batch.

---

## 1. Codebase Reality Snapshot (audited 2026-04-19)

What actually exists right now. Batch 1 starts from here, not from a greenfield.

### 1.1 Installed packages (stay)

| Package | Version | Role in V2 |
|---|---|---|
| `@assistant-ui/react` | 0.12.24 | Chat primitives (ThreadPrimitive, ComposerPrimitive, MessagePrimitive) |
| `@assistant-ui/react-markdown` | 0.12.8 | `MarkdownTextPrimitive` for streamed markdown |
| `@chenglou/pretext` | 0.0.4 | DOM-free text measurement and layout |
| `@duckdb/duckdb-wasm` | 1.33.1-dev20.0 (replace during Batch 2; see §5.1) | Shared in-browser DB for Cosmograph + Mosaic |
| `cmdk` | 1.1.1 | Command palette (Batch 10) |
| `framer-motion` / `motion` | 12.35.0 | Transitions |
| `vaul` | 1.1.2 | Mobile bottom sheets (Batch 10) |

### 1.2 Packages to install (Batch 2)

| Package | Target | Notes |
|---|---|---|
| `@cosmograph/react` | latest | Brings its own peer on `@cosmograph/cosmograph`. Check version compat with duckdb-wasm 1.33. |
| `@cosmograph/cosmograph` | latest | Peer of the React wrapper; WebGL engine. |
| `@uwdata/vgplot` | latest | Mosaic plot grammar; the primary API we consume. |
| `@uwdata/mosaic-core` | latest | Coordinator runtime. |
| `@uwdata/mosaic-sql` | latest | SQL builder used by coordinator clients. |

**DuckDB-WASM decision (binding):** the currently installed `@duckdb/duckdb-wasm@1.33.1-dev20.0` is a development prerelease and is not a safe foundation for a shared-state system with Cosmograph and Mosaic on top. Replace it during Batch 2. Procedure in §5.1.

### 1.3 Existing files matching V2's deletion list (all confirmed present)

`src/components/theseus/`: `GalaxyController.tsx`, `GalaxyDrawer.tsx`, `AskExperience.tsx`, `AmbientGraphActivity.tsx`, `SceneRenderer.tsx`, `ThinkingScreen.tsx`, `ProactiveIntel.tsx`, `TerminalStream.tsx`, `galaxyLayout.ts`, `askExperienceState.ts`, `useNavScreenState.ts`, `TheseusDotGrid.tsx`.

`src/components/theseus/chat/`: `ChatCanvas.tsx` (noise-texture background, NOT an assistant-ui wrapper), `ChatInput.tsx`, `ChatMessage.tsx`, `ChatThread.tsx`, `GraphActivity.tsx`, `TheseusComposer.tsx`, `TheseusMessage.tsx`, `VisualPreviewCard.tsx`, `AskIdleHero.tsx`.

`src/components/theseus/explorer/`: `ExplorerCanvas.tsx`, `ExplorerLayout.tsx`, `IdleGraph.tsx`, `useDeepField.ts`, `useCanvasInteraction.ts`, `PathOverlay.tsx`.

`src/lib/galaxy/`: 18 files present (`StipplingEngine.ts`, `TheseusAvatar.ts`, `FaceAnimator.ts`, `navPredictor.ts`, `navAttractors.ts`, `pretextLabels.ts`, `stippleConstruction.ts`, `algorithms/`, `renderers/`, etc.).

`src/lib/theseus-viz/`: includes `vizPlanner.ts` (delete) and also `SceneDirector.ts`, `SceneSpec.ts`, `VizConstructor.ts`, `vegaToPlot.ts` (V2 doesn't mention; see §3).

### 1.4 Existing files V2 marks as restyle-only

`TheseusSidebar.tsx`, `TheseusMobileNav.tsx`, `PanelManager.tsx`, `TransmissionLine.tsx`, `SourceTrail.tsx`, `SuggestionPills.tsx`, `panels/NotebookPanel.tsx`, `panels/SettingsPanel.tsx`, `library/ModelGrid.tsx`, `capture/` (entire directory), `intelligence/DetailCard.tsx` (conditional).

### 1.5 Routes under `src/app/theseus/`

Currently present: `ask/`, `artifacts/`, `code/`, `explorer/`, `library/`, `models/`, `truth-maps/` (+ `[slug]`), `particle-test/`, `layout.tsx`, `page.tsx`.

V2 says: `ask/` keep (redirect), `explorer/` delete, `particle-test/` delete, and "audit" `artifacts/`, `code/`, `models/`, `truth-maps/`. Concrete audit procedure in §3.

### 1.6 Files V2 doesn't explicitly address but that must be resolved

Listed in §3 as "not in V2 deletion list" rows. Each needs a disposition decision before Batch 10.

---

## 2. Fork Procedures (one per forked surface)

The V2 spec names six things to fork. Each fork has a unique procedure; getting any of them wrong is the failure mode Travis flagged.

### Fork A: assistant-ui Thread (Claude clone composition)

**Design target:** the Claude clone example at https://www.assistant-ui.com/examples/claude, which provides warm tones, serif typography, attachment support, model selection, and feedback affordances. The Theseus parchment aesthetic is already aligned with this register, so the Claude clone is the closest-fit starting point the registry offers.

**Source of truth:** the assistant-ui CLI, which wraps shadcn and emits the tuned composition used by the Claude clone.

**Procedure (Batch 4):**

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website
npx assistant-ui@latest add thread
```

This writes the thread composition (and the composer + message child components it uses) into `src/components/assistant-ui/`. That directory is the "upstream mirror": commit it, do not edit it.

If `npx assistant-ui add thread` is unavailable in a given version of the CLI, fall back to the shadcn registry equivalent:

```bash
npx shadcn@latest add https://r.assistant-ui.com/thread.json
```

Then fork the mirror into Theseus:

```bash
cp src/components/assistant-ui/thread.tsx src/components/theseus/chat/TheseusThread.tsx
# plus every child the thread composition pulls in (composer, user/assistant
# message, action bar, attachment, etc.). Copy the whole set so the Theseus
# surface is self-contained.
```

Inside each copied file:
- Change every import whose path is relative to `src/components/assistant-ui/` to the corresponding location inside `src/components/theseus/chat/` (or a shared `src/components/theseus/chat/primitives/` folder if you extract children). Imports from `@assistant-ui/react` stay exactly as they are.
- Restyle for parchment. Only touch `className` strings, Tailwind utility values, CSS variable references, and tokens. Do NOT rename `ThreadPrimitive.Root`, `ThreadPrimitive.Viewport`, `ThreadPrimitive.Messages`, `ThreadPrimitive.Empty`, `ComposerPrimitive.Root`, `ComposerPrimitive.Input`, `ComposerPrimitive.Send`, `ComposerPrimitive.AddAttachment`, `MessagePrimitive.Root`, `.Content`, `.If`, `.Parts`, or any of their props.
- Rename top-level components to their Theseus names (`TheseusThread`, `ChatComposer`, `UserMessage`, `AssistantMessage`, `ChatMessageList`) per V2's file map. This is renaming, not rewriting.

**Existing code disposition:** today's `src/components/theseus/chat/TheseusThread.tsx` (440 LOC) imports assistant-ui primitives correctly but bakes the whole composition into one file without the Claude clone's structure. That file is replaced wholesale by the fork output. Do not port fragments of the old file across unless they're genuine customizations (stage-label spinner, raw-messages context) that are extracted into small helper components the new thread pulls in. Even then, the new TheseusThread.tsx must still read as "this is the assistant-ui Claude-clone thread with Theseus styling", not "this is a custom thread that happens to import primitives."

**Anti-hand-roll sentinels** (must all be present in the final `TheseusThread.tsx` + children):
- `import { ... ThreadPrimitive ... } from '@assistant-ui/react'`
- `<ThreadPrimitive.Root>` as the outermost element (or directly inside `AssistantRuntimeProvider`).
- `<ThreadPrimitive.Viewport>` wrapping the message list (auto-scroll comes from it; do not reimplement).
- `<ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage, ... }}>`: message iteration is owned by the primitive.
- `ComposerPrimitive.Root` / `.Input` / `.Send` / `.AddAttachment` in `ChatComposer.tsx`.
- `MessagePrimitive.*` usage inside both `UserMessage.tsx` and `AssistantMessage.tsx`.
- `MarkdownTextPrimitive` from `@assistant-ui/react-markdown` inside `parts/TextPart.tsx`.

**Forbidden patterns** (any occurrence is a rewrite, not a fork; Batch 4 fails):
- A bare `<div>` or `<ul>` acting as the thread root with `messages.map(...)` inside.
- A hand-wired `<form onSubmit>` that calls `runtime.append(...)` directly in place of `ComposerPrimitive.Root` + `ComposerPrimitive.Send`.
- Any reimplementation of `ThreadPrimitive.Viewport` auto-scroll, keyboard navigation, or focus restoration.
- A custom markdown renderer in place of `MarkdownTextPrimitive`.
- Porting the entire old 440-LOC `TheseusThread.tsx` forward "with minor edits." The existing file is retired; the new file starts from the registry output.

### Fork B: assistant-ui Composer (part of Fork A)

The Claude-clone thread fork from Fork A already emits the composer composition (that's why `npx assistant-ui add thread` pulls in the full surface). There is no separate install step for the composer: if Fork A ran correctly, `src/components/assistant-ui/composer.tsx` (or `composer/*.tsx`) already exists.

**Procedure (Batch 4, immediately after Fork A):**

```bash
# Confirm the composer mirror is present
ls src/components/assistant-ui/ | grep -i composer
# Copy to Theseus chat dir
cp src/components/assistant-ui/composer.tsx src/components/theseus/chat/ChatComposer.tsx
```

(If `npx assistant-ui add thread` did NOT pull in composer files for any reason, run `npx shadcn@latest add https://r.assistant-ui.com/composer.json` to fetch them directly: but verify first, don't run redundantly.)

Restyle per V2: parchment input background, terracotta submit button labeled `ASK →` in Courier Prime, autofocus on empty state. Keep the attachment affordance from the Claude clone (it's free with the fork) even if Batch 4 doesn't yet wire attachments end-to-end: render the `AddAttachment` button disabled with a tooltip rather than deleting it.

**Anti-hand-roll sentinels** in `ChatComposer.tsx`:
- `import { ... ComposerPrimitive ... } from '@assistant-ui/react'`
- `<ComposerPrimitive.Root>`, `<ComposerPrimitive.Input>`, `<ComposerPrimitive.Send>`, and `<ComposerPrimitive.AddAttachment>` (keep the attachment button from the Claude clone).
- No bespoke `<textarea onKeyDown={...}>` handling Enter vs. Shift+Enter: the primitive owns keybindings.

**Forbidden:** a hand-wired `<form onSubmit={...}>` that calls `runtime.append(...)` directly. That skips ComposerPrimitive's provider wiring and breaks attachment, abort, voice input, and keybindings in one stroke.

### Fork C: Cosmograph React wrapper

**Source of truth:** `node_modules/@cosmograph/react` (after install).

**Procedure (Batch 2 install, Batch 6 consume):**

```bash
npm install @cosmograph/react @cosmograph/cosmograph
```

Verify after install: `node_modules/@cosmograph/react/package.json` exists and exports `Cosmograph`, `CosmographRef`, `CosmographSearch`, `CosmographTimeline`, `CosmographHistogram`, `CosmographTypeColorLegend`, and `prepareCosmographData` (see §4.3 for the full list).

In `CosmographCanvas.tsx` (Batch 6):

```tsx
'use client';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Cosmograph, type CosmographRef } from '@cosmograph/react';
import { DEFAULT_COSMOGRAPH_CONFIG } from '@/lib/theseus/cosmograph/config';
// ... your wrapper exposes the imperative ref upward
```

The React component `<Cosmograph />` IS the fork. You never reimplement force physics, collision resolution, label placement, or the WebGL renderer. If the physics needs to be tuned, tune the `simulation*` props on `DEFAULT_COSMOGRAPH_CONFIG`.

**Anti-hand-roll sentinels** in `CosmographCanvas.tsx`, `GraphSearch.tsx`, `GraphLegend.tsx`, `GraphTimeline.tsx`, `GraphHistogram.tsx`:
- `import { Cosmograph | CosmographSearch | CosmographTimeline | CosmographHistogram | CosmographTypeColorLegend } from '@cosmograph/react'`

**Forbidden:**
- Any `d3-force` / `graphology-layout-forceatlas2` / `react-force-graph-3d` import in a new file (those are being removed in Batch 10).
- A hand-coded histogram or timeline using D3 axes (the spec explicitly provides Cosmograph components for both).
- Rewriting `prepareCosmographData` (use the exported function; ingestion shape is documented in §4.3).

### Fork D: Mosaic via vgplot

**Source of truth:** `node_modules/@uwdata/vgplot` (after install).

**Procedure (Batch 2 install, Batch 5 first consume, Batch 8 deeper use):**

```bash
npm install @uwdata/vgplot @uwdata/mosaic-core @uwdata/mosaic-sql
```

In `MosaicPart.tsx`:

```tsx
'use client';
import * as vg from '@uwdata/vgplot';
import { initMosaicCoordinator } from '@/lib/theseus/mosaic/coordinator';
// Accept a MosaicSpec prop, call vg.parseSpec(spec) or vg.astToDOM(spec),
// mount the returned DOM node into a ref.
```

The Django `MosaicSpec` shape (from V2) is what `vg.parseSpec` expects. Consult `@uwdata/mosaic-spec` documentation if ambiguity arises: do not invent a parser.

**Anti-hand-roll sentinels** in `MosaicPart.tsx`:
- `import * as vg from '@uwdata/vgplot'` (or named `import { parseSpec, ... }`).
- At least one call to `vg.parseSpec(...)` or `vg.astToDOM(...)`.

**Anti-hand-roll sentinels** in `src/lib/theseus/mosaic/coordinator.ts`:
- `import { coordinator, wasmConnector } from '@uwdata/vgplot'`.
- `coordinator().databaseConnector(wasmConnector({ duckdb }))` is the exact wiring (V2 §Mosaic integration).

**Forbidden:**
- Writing a Vega-Lite compiler, D3 chart renderer, or Observable Plot shim to "translate" the Mosaic spec into something else. The whole point of the replacement is to let vgplot own rendering.
- Leaving `vega`, `vega-embed`, or `vega-lite` imports in any file touched by this rebuild (they are removed in Batch 10).

### Fork E: pretext (already installed)

**Source of truth:** `node_modules/@chenglou/pretext/src/` (layout, line-break, measurement, bidi, analysis).

**Procedure (Batch 5 for chat inline, Batch 6 for Cosmograph overlay):**

In `src/lib/theseus/pretext/inline.ts`:

```ts
import { prepare, layout } from '@chenglou/pretext';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
```

Use `prepare()` once per distinct text+font combination (cache results keyed by text+font). Use `layout()` on every width change.

**Anti-hand-roll sentinels:**
- `from '@chenglou/pretext'` at the top of each pretext consumer.
- Calls to `prepare` or `prepareWithSegments` (for segment-aware layouts).

**Forbidden:**
- `getBoundingClientRect` or `element.offsetHeight` for measurement in any file touched by this rebuild. The entire reason pretext is in the stack is to avoid those.
- Re-implementing segmentation (`Intl.Segmenter` chains, regex splits on Unicode classes, etc.).

### Fork F: DotGrid (in-repo re-export, NOT a copy)

**Source of truth:** `src/components/DotGrid.tsx` (main-site component, already handles light/dark, paper grain, binary scatter, reduced motion).

**Procedure (Batch 1):**

Replace `src/components/theseus/TheseusDotGrid.tsx` with exactly:

```ts
// src/components/theseus/TheseusDotGrid.tsx
// Deprecated alias. Use `@/components/DotGrid` directly in new code.
export { default } from '@/components/DotGrid';
export type { DotGridHandle } from '@/components/DotGrid';
```

(Verify the actual exported type name in `DotGrid.tsx` before copy-pasting the `export type` line. If the main DotGrid doesn't export a named `DotGridHandle` type, drop that export.)

In `TheseusShell.tsx`, mount `<DotGrid />` directly from `@/components/DotGrid`. Do NOT import from the shim (the shim exists only for legacy imports during the transition).

**Anti-hand-roll sentinel** in `TheseusDotGrid.tsx`:
- The file is ≤4 lines of code plus the comment.

**Forbidden:** any canvas drawing, `useEffect` with `ctx.fillRect`, PRNG, or dot-animation logic inside `TheseusDotGrid.tsx`. The original (51 KB) must be gone.

---

## 3. Reality Reconciliation Matrix

One row per file/directory that V2 touches, or that V2 leaves ambiguous. Disposition column is binding.

| Path | Current state | V2 says | Disposition (this doc) |
|---|---|---|---|
| `src/components/theseus/TheseusShell.tsx` | Exists, owns `GalaxyContext` with galaxy refs | Rewrite, rename context to `TheseusContext`, strip galaxy refs, mount `<DotGrid />` | Per V2 |
| `src/components/theseus/TheseusDotGrid.tsx` | 51 KB custom canvas | Replace with re-export of main-site DotGrid | Per V2 (§2 Fork F) |
| `src/components/theseus/chat/TheseusThread.tsx` | 440 LOC, uses primitives but not shadcn structure | Rewrite as shadcn fork + child components | Per V2 (§2 Fork A) |
| `src/components/theseus/chat/ChatCanvas.tsx` | 109 LOC background noise texture | Delete (Batch 4) | Per V2. Note: this file is NOT an assistant-ui wrapper despite the name; the spec's old "ChatCanvas" confusion is resolved by deletion. |
| `src/components/theseus/chat/ChatThread.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`, `TheseusComposer.tsx`, `TheseusMessage.tsx`, `VisualPreviewCard.tsx`, `GraphActivity.tsx`, `AskIdleHero.tsx` | Exist | Delete | Per V2 Batch 4 |
| `src/components/theseus/chat/useChatHistory.ts` | Exists | Keep unchanged | Per V2 |
| `src/components/theseus/GalaxyController.tsx` (93 KB), `TheseusDotGrid.tsx` (51 KB), `AskExperience.tsx` (68 KB), `AmbientGraphActivity.tsx`, `SceneRenderer.tsx`, `ThinkingScreen.tsx`, `ProactiveIntel.tsx`, `TerminalStream.tsx`, `galaxyLayout.ts`, `askExperienceState.ts`, `useNavScreenState.ts`, `GalaxyDrawer.tsx` | Exist | Delete (Batch 7 + 10) | Per V2 |
| `src/components/theseus/TransmissionLine.tsx`, `SourceTrail.tsx`, `SuggestionPills.tsx` | Exist | Restyle only | Per V2. Grep each for hex literals and inline RGB: replace with `--vie-*` tokens in Batch 9. |
| `src/components/theseus/Emblem.tsx` | Does not exist | Create | Per V2 Batch 1/2. SVG emblem, parchment-tint, no logic. |
| `src/components/theseus/useSwitchPanel.ts` | Inline in `PanelManager.tsx` today | Extract | Per V2 Batch 1. Pure re-export of the hook already inside PanelManager. |
| `src/components/theseus/explorer/ExplorerCanvas.tsx`, `ExplorerLayout.tsx`, `IdleGraph.tsx`, `useCanvasInteraction.ts`, `useDeepField.ts`, `PathOverlay.tsx` | Exist | Delete (Batch 6) | Per V2 |
| `src/components/theseus/explorer/EvidenceSubgraph.tsx`, `StatusStrip.tsx`, `ControlDock.tsx` | Exist | Delete if unused after rewrite | Per V2. Procedure: after Batch 6 rewrite lands, `grep -r "EvidenceSubgraph\|StatusStrip\|ControlDock" src/`: if zero imports, delete. |
| `src/components/theseus/explorer/AnswerReadingPanel.tsx`, `ArtifactExporter.tsx`, `ClaimRow.tsx`, `ConfidenceBar.tsx`, `ConnectionList.tsx`, `ContextPanel.tsx`, `Markdown.tsx`, `NeighborhoodSummary.tsx`, `ObjectInspectorTabs.tsx`, `SkeletonRows.tsx`, `StructurePanel.tsx`, `TensionCard.tsx`, `WhyThisNode.tsx` | Exist | Not in V2 deletion list | Keep by default. These feed `NodeDetailPanel.tsx` (Batch 6) content. After Batch 6 completes, grep each: delete any with zero inbound imports. |
| `src/components/theseus/explorer/ExplorerSearch.tsx` | Exists | Replaced by `GraphSearch.tsx` wrapping `<CosmographSearch>` | Delete when `GraphSearch.tsx` lands in Batch 6. |
| `src/components/theseus/explorer/useGraphData.ts`, `useExplorerSelection.ts`, `useInvestigationView.ts` | Exist | Rewrite / keep trimmed / keep | Per V2 |
| `src/components/theseus/intelligence/GalaxyExplainer.tsx`, `galaxyGenerator.ts` | Exist | Delete (Batch 8) | Per V2 |
| `src/components/theseus/intelligence/DetailCard.tsx`, `algorithmRegions.ts` | Exist | Delete "unless reused" | Audit in Batch 8. If any Mosaic widget reuses them, keep; otherwise delete. |
| `src/components/theseus/intelligence/widgets/` | Does not exist | Create 5 Mosaic widgets | Per V2 Batch 8 |
| `src/components/theseus/renderers/` (19 files including SigmaRenderer, VegaRenderer, D3Renderer, R3FRenderer, PlotRenderer, ConstructionAnimator, ParticleField, etc.) | Exists | Delete entire directory (Batch 7) | Per V2 |
| `src/components/theseus/panels/AskPanel.tsx`, `ExplorerPanel.tsx`, `IntelligencePanel.tsx`, `LibraryPanel.tsx`, `CodePanel.tsx` | Exist | Rewrite | Per V2 |
| `src/components/theseus/panels/NotebookPanel.tsx`, `SettingsPanel.tsx` | Exist | Restyle only | Per V2 |
| `src/components/theseus/library/LibraryView.tsx`, `ModelGrid.tsx`, `MosaicAnalytics.tsx` | First two exist, last is new | Restyle existing, create new | Per V2 Batch 9 |
| `src/components/theseus/capture/` (all files) | Exists | Keep unchanged | Per V2 |
| `src/components/theseus/notebook/` (extensions subdirectory) | Exists | Not in V2 map | Keep. These extensions feed TiptapEditor in `NotebookPanel`, which stays. |
| `src/components/theseus/code/` | Exists | Not in V2 map; `CodePanel.tsx` rewritten | Audit during Batch 9 rewrite. Code-graph view should use Cosmograph. Subdirectory files may feed the rewrite or may be deletable; decide per file at rewrite time. |
| `src/app/theseus/layout.tsx` | Exists | Unchanged | Per V2. The context rename (`GalaxyContext` → `TheseusContext`) only touches `TheseusShell.tsx`; layout.tsx imports shell by default export. |
| `src/app/theseus/page.tsx` | Exists, mounts PanelManager | Unchanged | Per V2 |
| `src/app/theseus/ask/page.tsx` | Exists, likely a redirect to `/theseus?view=ask` | Unchanged | Verify it's a redirect; if it's a standalone route with its own content, reconcile with PanelManager flow before declaring Batch 4 done. |
| `src/app/theseus/explorer/page.tsx` | Exists | Delete (Batch 7) | Per V2. After delete, `/theseus/explorer` should return 404; `/theseus?view=explorer` is the only path. |
| `src/app/theseus/particle-test/page.tsx` | Exists | Delete (Batch 10) | Per V2 |
| `src/app/theseus/artifacts/page.tsx`, `code/page.tsx`, `models/page.tsx`, `truth-maps/page.tsx` (+`[slug]`) | Exist | "Audit; keep if live, delete if dead" | Concrete audit: during Batch 10, grep the main site for links pointing at these routes. Zero inbound links AND not mentioned in any active panel action = delete. Otherwise keep as legacy deep links, restyle to new palette. |
| `src/styles/theseus.css` | Exists, dark-only `--vie-*` palette | Rewrite as parchment fork | Per V2 Batch 1 |
| `src/styles/assistant-ui-theme.css` | Exists | Rewrite to reference new tokens | Per V2 Batch 4 |
| `src/styles/global.css` | Exists, canonical palette | Unchanged | Per V2. Do NOT add Theseus tokens here; theseus.css owns the fork. |
| `src/lib/galaxy/` (18 files: StipplingEngine, TheseusAvatar, FaceAnimator, ThinkingChoreographer, VisionTracer, TargetGenerator, SpatialConversation, StipplingDirector, ImageTracer, e4bVision, faceMeshTriangulation, modelLoader, navAttractors, navPredictor, pretextLabels, stippleConstruction, plus `algorithms/` and `renderers/` subfolders) | Exists | Delete entire directory (Batch 7) | Per V2. Before delete, grep imports for `navPredictor` (V2 says keep the nav predictor). If found, extract the single file to `src/lib/theseus/navPredictor.ts` first, update imports, then delete `src/lib/galaxy/`. |
| `src/lib/galaxy/pretextLabels.ts` | Exists | Delete (explicit) | Per V2 |
| `src/lib/theseus-viz/SceneDirective.ts` | Exists | Keep (contract is stable) | Per V2 |
| `src/lib/theseus-viz/vizPlanner.ts` | Exists | Delete (Batch 10) | Per V2 |
| `src/lib/theseus-viz/SceneDirector.ts`, `SceneSpec.ts`, `VizConstructor.ts`, `vegaToPlot.ts`, `data-viz/`, `features/`, `intelligence/`, `layouts/`, `model/`, `rules/`, `training/`, `vizTrainingData.json` | Exist | Not in V2 deletion list (except `vizPlanner.ts`) | Audit in Batch 10 via grep. `vizTrainingData.json` is referenced by spec (copied into `src/lib/theseus/sceneDirector/trainingData.json`): keep the original until the new copy is in use, then delete. The rest: delete any file with zero inbound imports after new scene director lands. Legacy v2 scene code (`SceneSpec.ts`, `VizConstructor.ts`) is likely dead already. |
| `src/lib/theseus-api.ts`, `src/lib/theseus-assistant-runtime.ts`, `src/lib/theseus-types.ts` | Exist | Unchanged | Per V2 |
| `src/lib/theseus/` | Does not exist | Create subtree (tokens, cosmograph/, mosaic/, pretext/, sceneDirector/) | Per V2 |

---

## 4. Source Material Index (what the installed packages actually expose)

This section exists so Claude Code doesn't guess at APIs. If an API you want isn't listed here, open `node_modules/<pkg>` and confirm before writing code.

### 4.1 `@assistant-ui/react` @ 0.12.24

Top-level primitives available at `src/primitives/`:
- `actionBar/`, `actionBarMore/`
- `assistantModal/`
- `attachment/`
- `branchPicker/`
- `chainOfThought/`
- `composer/` → `ComposerPrimitive.Root`, `.Input`, `.Send`, `.Cancel`, `.Attachment*`
- `error/`
- `message/` → `MessagePrimitive.Root`, `.Content`, `.If`, `.Parts`
- `messagePart/`
- `queueItem/`
- `reasoning/`
- `selectionToolbar/`
- `suggestion/`
- `thread/` → `ThreadPrimitive.Root`, `.Viewport`, `.Messages`, `.Empty`, `.If`, `.Suggestion`, `.Suggestions`, `.ScrollToBottom`, `.ViewportFooter`
- `threadList/`

Other important exports: `AssistantRuntimeProvider`, `useThreadRuntime`, `useMessage`, `useComposerRuntime`, `useExternalStoreRuntime` (for custom transports).

### 4.2 `@assistant-ui/react-markdown` @ 0.12.8

Exports: `MarkdownTextPrimitive`: drop-in primitive that renders streamed markdown with remark/rehype pipeline preconfigured. Accepts `components` prop for custom element overrides (e.g. injecting `<CitationPart>` when a custom markdown extension emits citation tokens; alternatively, parse citations in `TextPart.tsx` before passing text to MarkdownTextPrimitive).

### 4.3 `@cosmograph/react` @ latest (Batch 2 install)

Components (exported named):
- `Cosmograph`: main WebGL canvas. Accepts ~150 config props plus `points`, `links` data.
- `CosmographSearch`: search UI bound to the graph instance.
- `CosmographTypeColorLegend`: legend mapping types to colors.
- `CosmographHistogram`: brushable histogram of a numeric point attribute.
- `CosmographTimeline`: brushable timeline of a date/time attribute.

Refs & imperative methods (via `CosmographRef`):
- `setConfig(partial)`, `setData(points, links)`, `fitView()`, `fitViewToPointsByIds(ids)`
- `zoomToPoint(id, durationMs, distance?)`, `selectPoint(id)`, `selectPoints(ids)`, `unselectPoints()`
- `getPointPositions()`, `getSelectedPointIds()`, `getSimulationProgress()`
- `pause()`, `restart()`, `step()`
- Event subscribers: `onPointClick`, `onLabelClick`, `onZoomStart`, `onZoomEnd`, `onSimulationStart`, `onSimulationTick`, `onSimulationEnd`

Data preparation helper: `prepareCosmographData(config, rawPoints, rawLinks)`: normalizes input into the format Cosmograph expects. Config fields include `points.pointIdBy`, `pointColorBy`, `pointLabelBy`, `pointClusterBy`; `links.linkSourceBy`, `linkTargetsBy`.

If any of the above names are absent in the installed version, prefer the installed version's surface; do NOT write a shim named after the missing export.

### 4.4 `@uwdata/vgplot` @ latest (Batch 2 install)

Primary exports:
- `coordinator()`: singleton Mosaic coordinator.
- `wasmConnector({ duckdb? })`: connector bound to a DuckDB-WASM instance.
- `parseSpec(specJSON)`: Mosaic JSON spec → renderable DOM/AST.
- `astToDOM(ast)`: render a pre-parsed AST.
- Plot grammar builders: `plot()`, `barX()`, `lineY()`, `rectY()`, `dotX()`, `heatmap()`, `cell()`, etc. (many). These are the imperative builders if you ever want to construct a spec in TS instead of parsing JSON.
- Selection/param: `Selection.intersect()`, `Selection.union()`, `Param.value()`.

### 4.5 `@uwdata/mosaic-core`, `@uwdata/mosaic-sql`

`mosaic-core`: `Coordinator`, `MosaicClient`, `Selection` base classes. Needed only if you write a custom client beyond vgplot.

`mosaic-sql`: `Query`, `from()`, `sql`, `column`, `agg.count()`, `agg.sum()`: SQL AST builders used by Mosaic clients.

### 4.6 `@chenglou/pretext` @ 0.0.4

Exports:
- `prepare(text, font, options?)` → handle (opaque). One-time work: segmentation + width measurement.
- `layout(handle, width, lineHeight)` → `{ height, lineCount }`. Pure arithmetic.
- `prepareWithSegments(...)` → handle with segment data for custom layout.
- `layoutWithLines(handle, width, lineHeight)` → per-line data for manual rendering.
- `materializeLineRange(...)` → for progressive/streamed layout.

Font string format is standard CSS shorthand: `'15px Vollkorn, Georgia, serif'`. The font MUST be loaded and rendered at the time `prepare()` runs, or measurements will be wrong.

### 4.7 `@duckdb/duckdb-wasm` @ 1.33.1-dev20.0

Already used elsewhere in the app. For our singleton:
```ts
import * as duckdb from '@duckdb/duckdb-wasm';
const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
const worker = new Worker(bundle.mainWorker!);
const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
```
(Check `src/lib/` for existing duckdb usage before writing new code; if a singleton already exists, reuse it.)

---

## 5. Dependency Manifest

### 5.1 Install order (Batch 2)

**Step 1: Replace the duckdb-wasm prerelease with a stable version.**

The currently installed `@duckdb/duckdb-wasm@1.33.1-dev20.0` is a dev prerelease. A shared-DB system with Cosmograph and Mosaic coordinating on top cannot rest on a dev build. Pin to the most recent stable release:

```bash
# Check what stable is available
npm view @duckdb/duckdb-wasm versions --json | tail -40
# Install the latest stable (as of 2026-04, target the 1.33.x line, NOT a -dev tag)
npm install @duckdb/duckdb-wasm@^1.33
# Re-run the app's existing DuckDB call sites (CommonPlace, data pipelines) to
# confirm nothing regressed.
npm run build
```

If an existing CommonPlace or data-pipeline call site breaks on the stable release (e.g. the dev prerelease exposed an API the stable doesn't), the fix is to update the call site, not to revert to the prerelease. Document any such fix-up in the Batch 2 commit.

**Step 2: Install Cosmograph.** Cosmograph brings its own WebGL renderer and force engine. If its `peerDependencies` pin duckdb-wasm to a specific minor, align to that pin now (before Step 3); Cosmograph is the more opinionated of the two consumers, so it wins version ties.

```bash
npm install @cosmograph/react @cosmograph/cosmograph
npm ls @duckdb/duckdb-wasm    # confirm only one resolved version
```

**Step 3: Install Mosaic + vgplot.** `wasmConnector({ duckdb })` accepts whatever instance you hand it, so Mosaic follows whichever duckdb version Steps 1-2 settled on.

```bash
npm install @uwdata/vgplot @uwdata/mosaic-core @uwdata/mosaic-sql
```

**Step 4: Verify the five new (or updated) packages and duckdb-wasm all resolve.**

```bash
npm ls @duckdb/duckdb-wasm @cosmograph/react @cosmograph/cosmograph \
       @uwdata/vgplot @uwdata/mosaic-core @uwdata/mosaic-sql
```

Exactly one resolved version for each. If duckdb-wasm shows two (Cosmograph's and the app's), consolidate via an `overrides` entry in `package.json` on Cosmograph's pinned version, then `npm install` again.

Record the final pinned versions in the Batch 2 commit message. Beyond those, no version pins specified in V2: take latest at install time and let `package-lock.json` do the rest.

### 5.2 shadcn-registry installs (Batch 4, not npm)

```bash
npx shadcn@latest add https://r.assistant-ui.com/thread.json
npx shadcn@latest add https://r.assistant-ui.com/composer.json
```

These write to `src/components/assistant-ui/`. That directory is the upstream mirror and stays checked-in (useful as a reference for future upstream syncs).

### 5.3 Package removals (Batch 10)

Before each removal, run:
```bash
grep -r "from '<pkg>'" src/
```
If zero matches across the whole `src/`, remove. If matches exist outside the Theseus tree (`src/components/theseus/**` or `src/lib/theseus*/**`), either migrate them or keep the package.

Packages V2 marks for removal:
`@react-sigma/core`, `@sigma/edge-curve`, `sigma`, `@react-three/drei`, `@react-three/fiber`, `react-force-graph-3d`, `@mediapipe/face_mesh`, `@mediapipe/selfie_segmentation`, `@tensorflow-models/body-segmentation`, `@tensorflow-models/coco-ssd`, `@tensorflow-models/depth-estimation`, `@tensorflow-models/face-landmarks-detection`, `@tensorflow-models/mobilenet`, `@tensorflow-models/pose-detection`, `vega`, `vega-embed`, `vega-lite`, `@observablehq/plot` (conditional), `graphology-layout-forceatlas2`, `d3-delaunay`.

Packages V2 marks to KEEP:
`@tensorflow/tfjs`, `@tensorflow-models/universal-sentence-encoder`, `@tensorflow-models/knn-classifier` (used by the three-class scene director).

Audit before uninstalling `@react-three/drei` and `@react-three/fiber`: check if anything under `src/app/(main)/**` or `src/components/**` (non-Theseus) uses them (existing `three` dep may be consumed by hero components: verify).

---

## 6. Per-batch Fork Verification Checklist

After each batch, run the grep commands listed for that batch. Every sentinel must match; every anti-pattern must return zero. If any check fails, the batch is not done.

### Batch 1: Palette fork + tokens

```bash
# Theseus DotGrid is a re-export, not a reimplementation
wc -l src/components/theseus/TheseusDotGrid.tsx          # MUST be ≤ 5 lines
grep "from '@/components/DotGrid'" src/components/theseus/TheseusDotGrid.tsx  # MUST match

# TheseusShell has DotGrid mounted and context renamed
grep "from '@/components/DotGrid'" src/components/theseus/TheseusShell.tsx    # MUST match
grep "TheseusContext" src/components/theseus/TheseusShell.tsx                  # MUST match
grep "GalaxyContext" src/components/theseus/TheseusShell.tsx                   # MUST be 0

# theseus.css tokens are the parchment fork
grep -c "var(--color-" src/styles/theseus.css                                  # SHOULD be ≥ 15
grep "rgba(74, 138, 150" src/styles/theseus.css                                # MUST be 0 (old dark palette hardcodes)
```

Manual: toggle theme on `/theseus`: parchment renders light; dark is warm dark per main-site tokens.

### Batch 2: Cosmograph + Mosaic install

```bash
# Packages installed
test -d node_modules/@cosmograph/react                    # MUST exist
test -d node_modules/@cosmograph/cosmograph               # MUST exist
test -d node_modules/@uwdata/vgplot                       # MUST exist
test -d node_modules/@uwdata/mosaic-core                  # MUST exist
test -d node_modules/@uwdata/mosaic-sql                   # MUST exist

# New lib infrastructure imports from the real packages
grep "from '@cosmograph/react'" src/lib/theseus/cosmograph/config.ts      # MUST match (type import is fine)
grep "from '@uwdata/vgplot'"    src/lib/theseus/mosaic/coordinator.ts     # MUST match
```

Manual: from a Node REPL or a throwaway page, `await getSharedDuckDB()` resolves; `await initMosaicCoordinator()` resolves.

### Batch 3: Scene director

```bash
# New predictor lives under src/lib/theseus/
test -f src/lib/theseus/sceneDirector/predictor.ts        # MUST exist
grep "VizPrediction" src/lib/theseus/sceneDirector/predictor.ts    # MUST match
# Old planner still exists (deleted in Batch 10)
test -f src/lib/theseus-viz/vizPlanner.ts                 # MUST exist
```

Manual: a unit-style test in the browser console: `predictVizType("show me a graph of X")` returns `{mode: 'graph', ...}`.

### Batch 4: AskPanel chat surface (Claude-clone fork)

```bash
# Claude-clone mirror was written by `npx assistant-ui add thread`
test -d src/components/assistant-ui                       # MUST exist
ls src/components/assistant-ui/                           # Thread + composer + children present
grep -rn "ThreadPrimitive\." src/components/assistant-ui/   | head -1  # sanity: mirror uses primitives

# Old TheseusThread.tsx has been replaced, not patched.
# Today's file is 440 LOC; the forked version is typically structured
# across multiple smaller files. A single-file 400+ LOC thread is the
# pattern we are explicitly retiring.
wc -l src/components/theseus/chat/TheseusThread.tsx       # Expected: much smaller than 440

# Fork targets are composition-based and import from the package
grep "from '@assistant-ui/react'" src/components/theseus/chat/TheseusThread.tsx   # MUST match
grep "ThreadPrimitive\."          src/components/theseus/chat/TheseusThread.tsx   # MUST match (multiple)
grep "ThreadPrimitive.Viewport"   src/components/theseus/chat/TheseusThread.tsx   # MUST match (auto-scroll owned by primitive)
grep "ThreadPrimitive.Messages"   src/components/theseus/chat/TheseusThread.tsx   # MUST match

grep "from '@assistant-ui/react'" src/components/theseus/chat/ChatComposer.tsx    # MUST match
grep "ComposerPrimitive\."        src/components/theseus/chat/ChatComposer.tsx    # MUST match (multiple)
grep "ComposerPrimitive.Root"     src/components/theseus/chat/ChatComposer.tsx    # MUST match
grep "ComposerPrimitive.Input"    src/components/theseus/chat/ChatComposer.tsx    # MUST match
grep "ComposerPrimitive.Send"     src/components/theseus/chat/ChatComposer.tsx    # MUST match
grep "ComposerPrimitive.AddAttachment" src/components/theseus/chat/ChatComposer.tsx  # MUST match (kept from Claude clone)

grep "MessagePrimitive\."         src/components/theseus/chat/UserMessage.tsx      # MUST match
grep "MessagePrimitive\."         src/components/theseus/chat/AssistantMessage.tsx # MUST match
grep "MarkdownTextPrimitive"      src/components/theseus/chat/parts/TextPart.tsx   # MUST match

# Old chat files gone
test ! -e src/components/theseus/chat/ChatCanvas.tsx      # MUST not exist
test ! -e src/components/theseus/chat/ChatInput.tsx       # MUST not exist
test ! -e src/components/theseus/chat/ChatMessage.tsx     # MUST not exist
test ! -e src/components/theseus/chat/ChatThread.tsx      # MUST not exist
test ! -e src/components/theseus/chat/TheseusComposer.tsx # MUST not exist
test ! -e src/components/theseus/chat/TheseusMessage.tsx  # MUST not exist
test ! -e src/components/theseus/chat/VisualPreviewCard.tsx # MUST not exist
test ! -e src/components/theseus/chat/GraphActivity.tsx   # MUST not exist

# No hand-rolled message loop or form submit anywhere in the chat tree
grep -rn "messages\.map"            src/components/theseus/chat/   # MUST be 0 (primitives own iteration)
grep -rn "<form .*onSubmit"         src/components/theseus/chat/   # MUST be 0 (ComposerPrimitive.Send owns submit)
grep -rn "runtime\.append("         src/components/theseus/chat/   # MUST be 0 in new files (goes through primitives)
```

Manual: `/theseus?view=ask` streams a response that visually matches the Claude clone's register (warm tones, serif body), citations hover, stage labels render, composer submits with Enter, cancels mid-stream, attachment button renders (disabled with tooltip is fine for now).

### Batch 5: Pretext + Mosaic inline

```bash
grep "from '@chenglou/pretext'" src/lib/theseus/pretext/inline.ts           # MUST match
grep "prepare(" src/lib/theseus/pretext/inline.ts                            # MUST match
grep "parseSpec\|astToDOM" src/components/theseus/chat/parts/MosaicPart.tsx # MUST match (one or the other)
grep "from '@uwdata/vgplot'" src/components/theseus/chat/parts/MosaicPart.tsx # MUST match

# No DOM measurement in Theseus code
grep -rn "getBoundingClientRect\|offsetHeight" src/components/theseus/chat/  # SHOULD be 0 in Theseus chat
```

Manual: streamed answer with `[CITE:...]...[/CITE]` anchors renders hover cards; a mock Mosaic spec renders and cross-filters to a second Mosaic view.

### Batch 6: ExplorerPanel Cosmograph

```bash
# Cosmograph components come from the package
grep "from '@cosmograph/react'" src/components/theseus/explorer/CosmographCanvas.tsx   # MUST match
grep "<Cosmograph "             src/components/theseus/explorer/CosmographCanvas.tsx   # MUST match
grep "<CosmographSearch "       src/components/theseus/explorer/GraphSearch.tsx        # MUST match
grep "<CosmographTypeColorLegend " src/components/theseus/explorer/GraphLegend.tsx     # MUST match
grep "<CosmographTimeline "     src/components/theseus/explorer/GraphTimeline.tsx      # MUST match
grep "<CosmographHistogram "    src/components/theseus/explorer/GraphHistogram.tsx     # MUST match
grep "prepareCosmographData"    src/components/theseus/explorer/useGraphData.ts        # MUST match
grep "applySceneDirective"      src/components/theseus/panels/ExplorerPanel.tsx        # MUST match

# Pretext overlay uses pretext
grep "from '@chenglou/pretext'" src/components/theseus/explorer/PretextLabels.tsx      # MUST match

# No legacy renderers in Explorer
grep -rn "react-force-graph-3d\|sigma\|react-sigma\|three/drei" src/components/theseus/explorer/   # MUST be 0

# Old Explorer files gone
test ! -e src/components/theseus/explorer/ExplorerCanvas.tsx   # MUST not exist
test ! -e src/components/theseus/explorer/ExplorerLayout.tsx   # MUST not exist
test ! -e src/components/theseus/explorer/IdleGraph.tsx        # MUST not exist
test ! -e src/components/theseus/explorer/useCanvasInteraction.ts # MUST not exist
test ! -e src/components/theseus/explorer/useDeepField.ts       # MUST not exist
test ! -e src/components/theseus/explorer/PathOverlay.tsx       # MUST not exist
```

Manual: `/theseus?view=explorer` full acceptance list from V2 Batch 6.

### Batch 7: Galaxy retirement

```bash
test ! -e src/components/theseus/GalaxyController.tsx      # MUST not exist
test ! -e src/components/theseus/GalaxyDrawer.tsx           # MUST not exist
test ! -e src/components/theseus/AskExperience.tsx          # MUST not exist
test ! -e src/components/theseus/AmbientGraphActivity.tsx   # MUST not exist
test ! -e src/components/theseus/SceneRenderer.tsx          # MUST not exist
test ! -e src/components/theseus/ThinkingScreen.tsx         # MUST not exist
test ! -e src/components/theseus/galaxyLayout.ts            # MUST not exist
test ! -e src/components/theseus/askExperienceState.ts      # MUST not exist
test ! -d src/lib/galaxy                                    # MUST not exist
test ! -d src/components/theseus/renderers                  # MUST not exist
test ! -e src/app/theseus/explorer/page.tsx                 # MUST not exist (explorer is now panel-only)

# No residual imports
grep -rn "GalaxyController\|galaxyLayout\|StipplingEngine\|AskExperience\|AmbientGraphActivity\|from '@/lib/galaxy" src/   # MUST be 0
```

If `navPredictor` was used anywhere, it must have been migrated to `src/lib/theseus/navPredictor.ts` before this step. Grep confirms:
```bash
grep -rn "navPredictor" src/                          # Any matches must import from src/lib/theseus/navPredictor.ts, not src/lib/galaxy/
```

### Batch 8: Intelligence dashboard

```bash
# Five widgets exist and each imports vgplot
for w in IQTrend EpistemicWeather ClusterHealth HypothesisQueue ScorerAccuracy; do
  test -f "src/components/theseus/intelligence/widgets/${w}.tsx" || echo "MISSING: ${w}"
  grep -q "from '@uwdata/vgplot'" "src/components/theseus/intelligence/widgets/${w}.tsx" || echo "HAND-ROLLED: ${w}"
done

test ! -e src/components/theseus/intelligence/GalaxyExplainer.tsx   # MUST not exist
test ! -e src/components/theseus/intelligence/galaxyGenerator.ts    # MUST not exist
```

Manual: `/theseus?view=intelligence` shows five cross-filtering Mosaic widgets.

### Batch 9: Library, Notebook, Code, Settings

```bash
# No inline hex colors in rewritten panels
grep -En "#[0-9a-fA-F]{3,6}" src/components/theseus/panels/LibraryPanel.tsx     # MUST be 0
grep -En "#[0-9a-fA-F]{3,6}" src/components/theseus/panels/CodePanel.tsx        # MUST be 0
grep -En "#[0-9a-fA-F]{3,6}" src/components/theseus/panels/SettingsPanel.tsx    # MUST be 0
grep -En "#[0-9a-fA-F]{3,6}" src/components/theseus/library/ModelGrid.tsx       # MUST be 0
# NotebookPanel allowed TiptapEditor hex (inside editor config), but panel chrome itself uses tokens
```

Manual: all five panels render in light + dark.

### Batch 10: Final cleanup + dependency prune + polish

```bash
# All deleted packages are actually out of package.json
for p in @react-sigma/core @sigma/edge-curve sigma react-force-graph-3d vega vega-embed vega-lite graphology-layout-forceatlas2 d3-delaunay; do
  grep -q "\"${p}\"" package.json && echo "STILL PRESENT: ${p}"
done

# No references to deleted libraries anywhere
grep -rn "from 'sigma'\|from '@react-sigma\|from 'react-force-graph\|from 'vega-embed\|from 'vega-lite\|from '@observablehq/plot\|from '@react-three/" src/   # MUST be 0 (or justified and documented)

# Deprecated shim still compiles (legacy imports allowed during transition; verify shim is 1-liner re-export)
wc -l src/components/theseus/TheseusDotGrid.tsx          # MUST be ≤ 5 lines
```

Manual: full V2 Definition of Done.

---

## 7. Definition of Done (fork-verified)

Everything from V2's Definition of Done, plus:

- `grep -rn "ThreadPrimitive\|ComposerPrimitive\|MessagePrimitive" src/components/theseus/chat/` returns ≥ 6 matches across the forked files (not just re-exports).
- The chat surface visually reads as the Claude clone (https://www.assistant-ui.com/examples/claude) restyled in parchment: serif body, warm composer, attachment affordance preserved, feedback bar on assistant messages, model-selection affordance either kept (behind a feature flag) or removed explicitly in a commit with a one-line reason.
- Existing `src/components/theseus/chat/TheseusThread.tsx` (historic 440 LOC single-file version) has been replaced, not patched. A single-file thread reappearing is the failure mode this document exists to prevent.
- `grep -rn "from '@cosmograph/react'" src/components/theseus/explorer/` returns matches in at least five files (canvas, search, legend, timeline, histogram).
- `grep -rn "from '@uwdata/vgplot'" src/components/theseus/` returns matches in ≥ 1 chat MosaicPart + ≥ 5 intelligence widgets + any library analytics widget.
- `grep -rn "from '@chenglou/pretext'" src/` returns matches in `src/lib/theseus/pretext/inline.ts` AND `src/components/theseus/explorer/PretextLabels.tsx`.
- `wc -l src/components/theseus/TheseusDotGrid.tsx` ≤ 5 (pure re-export).
- `package-lock.json` reflects every installed/removed package; `npm ci && npm run build` is green from a clean install.
- No new file in `src/components/theseus/` or `src/lib/theseus/` hand-rolls behavior that belongs to a forked library (acceptance is grep-based per §6).

---

## 9. Event Bus Contract

V2 preserves a set of `window`-dispatched `CustomEvent`s and renames one. This section gives each event a canonical payload shape so emitters and listeners agree before Batch 4 and Batch 6 wire them together. All events live on `window`; use `new CustomEvent(type, { detail })` to emit, `window.addEventListener(type, handler)` to subscribe. Never pass state through globals or module-level variables instead of these events.

Type definitions go in a new file `src/lib/theseus/events.ts` (Batch 1). Emitters and listeners MUST import types from this file rather than redefining payload shapes ad hoc.

### 9.1 Active events

| Event type | Payload (`CustomEvent<T>.detail`) | Emitted by | Listened by |
|---|---|---|---|
| `theseus:switch-panel` | `{ view: 'ask' \| 'explorer' \| 'intelligence' \| 'library' \| 'notebook' \| 'code' \| 'settings'; source?: 'sidebar' \| 'chat-directive' \| 'keyboard' \| 'url' \| 'node-action' }` | `TheseusSidebar`, `SceneDirectivePart`, keyboard shortcuts, `NodeDetailPanel` actions | `PanelManager` |
| `explorer:apply-directive` | `{ directive: SceneDirective; source: 'chat' \| 'deeplink' \| 'notebook' }` | `SceneDirectivePart` (after a `theseus:switch-panel` to explorer), deep-link handler in `ExplorerPanel` mount, Notebook "view in explorer" action | `ExplorerPanel` |
| `theseus:stage-event` | `{ stage: 'retrieving' \| 'ranking' \| 'composing' \| 'rendering' \| 'complete' \| 'error'; label?: string; messageId?: string }` | `theseus-assistant-runtime` (on SSE stage chunks) | `AssistantMessage` (renders stage label + braille spinner) |
| `theseus:prefill-ask` | `{ text: string; submit?: boolean; context?: { nodeId?: string; modelId?: string; sourceId?: string } }` | `NodeDetailPanel` "Ask about this", LibraryPanel "Ask about this model", any "prefill composer" affordance | `TheseusThread` (calls `runtime.append` if `submit`, else sets composer value) |
| `theseus:chat-followup` | `{ originalMessageId: string; text: string }` | Follow-up affordances in `AssistantMessage` (e.g., "Why do you think that?") | `TheseusThread` |

### 9.2 Renamed events (transition)

`explorer:focus-nodes`, `explorer:select-node`, `explorer:drilldown` collapse into `explorer:apply-directive`. V2 says Batch 6 keeps the old listeners alive for transitional compatibility. Concrete transition procedure:

1. Batch 6: `ExplorerPanel` listens for `explorer:apply-directive` (new) AND the three old events. Old handlers map into a synthesized minimal `SceneDirective` and delegate to the new path.
2. Batch 7: grep confirms no new emitters use the old names. Remove the three legacy listeners.
3. Batch 10: grep confirms zero remaining references anywhere.

### 9.3 Forbidden patterns

- Directly calling methods on a sibling panel's ref or context. Cross-panel coordination goes through events, period.
- Passing React state objects in event payloads. Payloads are plain serializable shapes.
- Event handlers that mutate global state other than through the context the panel already owns.

---

## 10. New Backend Endpoint Sketches

V2 references endpoints under `/api/v2/theseus/` that are not yet implemented in Django. This section sketches each so backend work can proceed in parallel with the frontend rebuild. These are non-binding shapes (Django team may adjust), but any adjustment must be reflected back into the frontend types.

### 10.1 `/api/v2/theseus/graph/` (GET)

Full graph snapshot for Cosmograph initial load. Consumed by `useGraphData.ts` (Batch 6).

Request: none (or `?since=<iso-timestamp>` for incremental, optional).

Response:
```ts
{
  points: Array<{
    id: string;                   // object PK
    label: string;                // display label
    type: 'source' | 'person' | 'concept' | 'claim' | 'hunch' | 'tension' | 'note';
    pagerank: number;             // 0..1, used for point size
    community: number | null;     // cluster id from Louvain
    confidence: number;           // 0..1
    ingested_at: string;          // ISO-8601, used for CosmographTimeline
    degree: number;               // for histogram
  }>;
  links: Array<{
    source: string;               // point id
    target: string;               // point id
    weight: number;               // 0..1
    reason: string;               // why the edge exists (short label)
    created_at: string;           // ISO-8601
  }>;
  metadata: {
    total_nodes: number;
    total_edges: number;
    total_communities: number;
    last_refreshed: string;       // ISO-8601
    schema_version: 1;
  };
}
```

Caching: server-side 60s, with `ETag`; frontend uses `stale-while-revalidate`. Large payload (135K nodes, 261K edges), so GZIP is required.

### 10.2 `/api/v2/theseus/graph/neighborhood/<id>/` (GET)

Progressive subgraph load for `NeighborhoodLoader.tsx` (Batch 6).

Request: path param `id` (object PK), `?hops=1|2|3` (default 1).

Response: same shape as 10.1 `{ points, links, metadata }`, filtered to the requested neighborhood plus a `center_id` metadata field.

### 10.3 `/api/v2/theseus/intelligence/<widget>/` (GET)

One endpoint per Mosaic widget (see §11 for the exact column shape each expects).

- `/iq-trend/`
- `/weather-heatmap/`
- `/cluster-health/`
- `/hypothesis-queue/`
- `/scorer-accuracy/`
- `/library-analytics/` (used by LibraryPanel MosaicAnalytics, Batch 9)

Each returns a payload suitable for direct `vg.parseSpec` consumption. Either:
- An inline Mosaic spec JSON with `data.inline` populated, or
- A Parquet/Arrow download URL plus a Mosaic spec pointing at `data.file`.

Prefer Parquet URLs for widgets with > 1000 rows; inline for small tables. Either way, payload includes a `spec` field (Mosaic JSON) so the frontend never constructs the spec.

### 10.4 `/api/v2/theseus/briefing/` (GET)

Already referenced in V2. Source of suggested questions for `AskIdleHero`.

Response:
```ts
{
  suggestions: Array<{
    text: string;                 // displayed verbatim
    category: 'recent' | 'gap' | 'hypothesis' | 'trending';
    rationale?: string;           // tooltip
  }>;
  weather: {
    score: number;                // 0..1, current epistemic weather
    summary: string;              // short human blurb
  };
}
```

If the endpoint returns `suggestions: []`, AskIdleHero renders with no suggestion pills. Do not render hardcoded defaults (see CLAUDE.md project rule on empty states being honest rather than cosmetic).

### 10.5 Authentication + error shape

All endpoints use the existing API proxy (`next.config.ts` rewrites `/api/*` to Railway). Errors follow the existing `{ error: string, detail?: string, request_id?: string }` shape. Handle 5xx with a retry button and 4xx with a silent empty state (not a scary error card).

---

## 11. Mosaic Widget Data Shapes

Per-widget specification for Batch 8. Each widget is a Mosaic client consuming a table in the shared DuckDB. Columns and plot marks are binding; cross-filter selections are named so they can coordinate across widgets.

### 11.1 Shared coordinator selections

Define once in `src/lib/theseus/mosaic/coordinator.ts` alongside `initMosaicCoordinator`:

```ts
export const timeRangeSelection = Selection.intersect();
export const clusterSelection = Selection.intersect();
export const hypothesisSelection = Selection.intersect();
```

Every widget below either publishes to or subscribes from these named selections. Cross-filter works because multiple widgets bind to the same `Selection` instance.

### 11.2 Widget specs

| Widget | Table | Columns | Plot mark | Publishes | Subscribes |
|---|---|---|---|---|---|
| `IQTrend.tsx` | `iq_snapshot` | `timestamp TIMESTAMP`, `axis VARCHAR` (one of 7 IQ axes), `value DOUBLE` | `lineY({ x: 'timestamp', y: 'value', stroke: 'axis' })` + `intervalX` brush | `timeRangeSelection` | none |
| `EpistemicWeather.tsx` | `weather_heatmap` | `timestamp TIMESTAMP`, `cluster_id VARCHAR`, `weather_score DOUBLE` (0..1) | `cell({ x: 'timestamp', y: 'cluster_id', fill: 'weather_score' })` + click → cluster | `clusterSelection` | `timeRangeSelection`, `clusterSelection` |
| `ClusterHealth.tsx` | `cluster_health` | `cluster_id VARCHAR`, `flag_type VARCHAR` (e.g., 'tension', 'staleness', 'contradiction'), `count INTEGER` | `barX({ x: 'count', y: 'cluster_id', fill: 'flag_type' })` + click → cluster | `clusterSelection` | `clusterSelection` |
| `HypothesisQueue.tsx` | `hypothesis_queue` | `id VARCHAR`, `plausibility DOUBLE`, `novelty DOUBLE`, `status VARCHAR` | `dot({ x: 'novelty', y: 'plausibility', fill: 'status', r: 'priority_score' })` + click → hypothesis | `hypothesisSelection` | `clusterSelection` |
| `ScorerAccuracy.tsx` | `scorer_metrics` | `timestamp TIMESTAMP`, `accuracy DOUBLE`, `auc DOUBLE`, `scorer_version VARCHAR` | `lineY({ x: 'timestamp', y: 'accuracy' })` + secondary series on `auc` | none | `timeRangeSelection` |

### 11.3 Library analytics (Batch 9)

`MosaicAnalytics.tsx` renders three small widgets in a strip:

- **Objects by type**: `barX({ x: 'count', y: 'type', fill: 'type' })` from `object_type_counts`.
- **Ingestion velocity**: `lineY({ x: 'date', y: 'count' })` from `daily_ingestion`.
- **Source breakdown**: `dot({ x: 'count', y: 'source_domain' })` from `source_domain_counts`, top 20 sources.

No cross-filter. These are read-only summaries.

### 11.4 Reduced-motion behavior

When `prefers-reduced-motion: reduce` is set, disable Mosaic transition animations. `vg.parseSpec` accepts a `transitions: false` option on plot specs; wire via a shared `mosaicReducedMotion()` helper.

---

## 12. GraphPart Inline Subgraph Contract

Batch 4 creates `src/components/theseus/chat/parts/GraphPart.tsx`: a small Cosmograph rendered inline inside a chat message when the directive carries an evidence subgraph. This section pins its contract so Batch 4 doesn't invent one.

### 12.1 Data source

From the existing `SceneDirective`, specifically the evidence section:
- Focal objects: `directive.salience.filter(s => s.is_focal).map(s => s.node_id)`
- Context objects: `directive.salience.filter(s => !s.is_focal).map(s => s.node_id)`
- Edges: the subset of `directive.truth_map_topology.tension_bridges` plus any edges explicitly carried in the directive's evidence section.

If the directive has no salience (empty array), GraphPart does not render; the `VisualAnswerPart` falls through to a MosaicPart or text-only rendering.

### 12.2 Dimensions and layout

- Width: 100% of parent, max 640px (matches answer card max-width).
- Height: 320px (320 gives room for settle; smaller feels cramped at our node counts).
- Padding: 12px parchment margin inside the answer card.
- Background: `var(--vie-hero-ground)` (same as main Explorer, so the visual registration is consistent).

### 12.3 Config overrides

On top of `DEFAULT_COSMOGRAPH_CONFIG` from §Cosmograph of V2:

```ts
const INLINE_GRAPH_CONFIG = {
  ...DEFAULT_COSMOGRAPH_CONFIG,
  fitViewOnInit: true,
  fitViewDelay: 300,
  simulationDecay: 300,             // settle fast; user will move on
  showDynamicLabels: false,         // PretextLabels owns labeling here
  showLabelsFor: ['focused'],
  pointSize: 6,                     // bigger at small dataset sizes
  pointSizeBy: undefined,           // do NOT scale by pagerank inline (cluttered)
  spaceSize: 2048,                  // smaller world for a smaller dataset
  enableRightClickRepulsion: false, // no interaction affordances inline
};
```

### 12.4 Interactions

- Click on a point: emit `theseus:switch-panel` with `view: 'explorer'`, `source: 'chat-directive'`, followed by `explorer:apply-directive` carrying the full (not truncated) directive.
- "Expand in Explorer" button in the answer card footer: same dispatch as above.
- No drag, no zoom, no keyboard navigation (those happen in the main Explorer). The inline view is read-only visualization, not interaction.

### 12.5 Accessibility fallback

If WebGL is unavailable (some older devices, some enterprise environments), GraphPart falls back to a non-visual summary: "Evidence subgraph: N focal objects, M context objects" plus a text list of focal object labels. The full interactive graph remains accessible via the "Expand in Explorer" button, which routes to the main canvas (which has its own WebGL detection).

---

## 13. Empty, Error, and Loading States Catalog

V2 mentions empty states in Batch 10 but leaves them underspecified. This catalog is binding for Batch 10 and may be implemented incrementally through Batches 4 to 9 as each panel lands. Every panel gets three states.

### 13.1 AskPanel

- **Empty (no messages):** `AskIdleHero` renders. `CURRENTLY WRITING` eyebrow in Courier Prime terracotta, Vollkorn headline "Ask. *I'll model it.*", up to three suggestion pills from `/api/v2/theseus/briefing/`. If briefing returns zero suggestions, render the headline alone with no pills (no hardcoded fallback prompts; see CLAUDE.md rule).
- **Loading (streaming):** stage label in Courier Prime small caps beneath the partial message, braille spinner glyph to the left. Stage label updates via `theseus:stage-event`.
- **Error (stream failed):** the partial assistant message stays visible; a parchment card below it carries a warm red border (`var(--vie-error)` opacity 0.4), text in Vollkorn: "Couldn't finish that answer. [Try again]". Retry dispatches the same prompt.

### 13.2 ExplorerPanel

- **Empty (graph has no nodes):** full-panel CTA: "No graph data yet. Drop files here to ingest." Background remains `var(--vie-hero-ground)`. The DropZone from `capture/` is mounted even in the empty state so drag-drop works.
- **Loading (initial fetch or neighborhood expansion):** a thin progress bar at the top of the panel; Cosmograph renders progressively as points arrive via streaming JSON (if supported) or renders only after the full payload lands (if not). Histogram and Timeline render skeleton bars.
- **Error (graph fetch failed):** full-panel error card: "Graph failed to load." plus the error detail in Courier Prime small, plus a retry button.

### 13.3 IntelligencePanel

- **Empty (telemetry tables empty on first run):** single message "Theseus telemetry arrives after the first overnight run." plus a timestamp of the next scheduled run.
- **Loading:** each widget shows three skeleton rows.
- **Error (per widget):** every widget is wrapped in its own error boundary. A single widget failure does not break the grid; the failing widget shows "Unavailable" in place of the chart.

### 13.4 LibraryPanel

- **Empty:** "No saved models yet." plus a link "Ask Theseus to model a topic" that navigates to AskPanel.
- **Loading:** skeleton grid.
- **Error:** full-panel retry card.

### 13.5 NotebookPanel

- **Empty:** Tiptap editor with placeholder text. No additional empty-state component; the editor owns this.
- **Loading:** brief skeleton (Tiptap handles this internally).
- **Error:** "Notebook failed to load" card.

### 13.6 CodePanel

- **Empty (no code ingested):** "No code objects in the graph. Run the code ingestion pipeline to populate this view." plus a link to docs.
- **Loading:** skeleton.
- **Error:** retry card.

### 13.7 SettingsPanel

- **Empty:** not applicable; settings always render.
- **Loading / Error:** per-setting inline states (e.g., theme toggle loading briefly while preferences sync).

### 13.8 Error boundary placement

Minimum required boundaries (Batch 10):
- `<ErrorBoundary>` wraps `PanelManager` children (panel-level).
- `<ErrorBoundary>` wraps each Mosaic widget (widget-level).
- `<ErrorBoundary>` wraps `CosmographCanvas` (canvas-level).
- `<ErrorBoundary>` wraps `TheseusThread` (thread-level, distinct from per-message errors).

Use a shared `<TheseusErrorBoundary>` component living at `src/components/theseus/TheseusErrorBoundary.tsx`. It renders a parchment card with warm-red border, human-friendly message, retry button, and (in dev only) the stack trace.

---

## 14. Mobile and Accessibility Contract

V2 mentions `Lighthouse ≥ 95` and "mobile" once each. This section makes both concrete.

### 14.1 Breakpoints

Tailwind defaults, used everywhere:

| Breakpoint | Width | Layout change |
|---|---|---|
| base | 0 to 639px | Sidebar hidden; hamburger top-left opens Vaul sheet sidebar. Composer pinned bottom. NodeDetailPanel is a Vaul bottom sheet. IntelligencePanel: single column. |
| `sm` | 640px | Sidebar still hidden; typography bumps. |
| `md` | 768px | Sidebar still hidden. Composer gains wider max-width. |
| `lg` | 1024px | Sidebar always visible. NodeDetailPanel inline right-rail (resizable 340 to 640px). IntelligencePanel: two columns. |
| `xl` | 1280px | IntelligencePanel: three columns where it helps. Chat max-width stays 760px (reading comfort wins over width). |

### 14.2 Touch targets

Every interactive element has a minimum hit area of 44 by 44 CSS pixels. Decorative affordances (e.g., the braille spinner) are not interactive and have no minimum. Use `padding` to achieve the hit area if the visual element is smaller; never scale up the visual itself.

### 14.3 ARIA contract

| Component | Role / attributes |
|---|---|
| `TheseusSidebar` | `<nav aria-label="Theseus navigation">`. Each item: `aria-current="page"` when active. |
| `ChatComposer` textarea | `aria-label="Ask Theseus"` (unless a visible `<label>` wraps it). |
| `AssistantMessage` streaming text | Wrap the streaming region in `<div aria-live="polite" aria-atomic="false">`. |
| `CitationPart` inline | `role="button"`, `tabindex="0"`, `aria-label="Citation: {source}, {year}"`. Hover card: `role="dialog"`, `aria-describedby` links to metadata block. |
| `NodeDetailPanel` | `<section role="complementary" aria-label="Node detail">`. |
| `CosmographCanvas` | `aria-label` summarizing counts: "Graph with 135,935 objects and 262,507 connections". Tab navigates focal nodes (via `CosmographRef.selectPoints` + focus management), not canvas pixels. |
| Mosaic widgets | Each wrapped in `<figure aria-label="...">` plus an `aria-describedby` pointing to a screen-reader-only `<p>` carrying the "key insight" sentence. |
| `AskIdleHero` suggestion pills | `role="button"` if not already `<button>`; on activation, prefills composer (does not auto-submit). |

### 14.4 Focus management

- On panel switch: focus moves to the new panel's primary region (`aria-label`ed landmark).
- On opening NodeDetailPanel: focus moves to the panel's first interactive element.
- On closing any dialog/sheet: focus returns to the trigger that opened it.
- Cmd/Ctrl + K: focus the command palette input.
- `/` while in AskPanel: focus the composer.
- Esc: close the topmost dialog/sheet; if none, blur the current control.

### 14.5 Reduced motion

`@media (prefers-reduced-motion: reduce)`:
- Cosmograph: call `cosmo.pause()` after `fitView()`. Simulation renders a static layout; user can still interact (search, click, etc.) but no animation.
- Mosaic: `transitions: false` on every plot spec.
- Chat: braille spinner replaced with a static single dot. Streaming still works but the spinner glyph does not rotate.
- Vaul sheets: transition duration reduced to 0 (Vaul respects this automatically when configured).
- Framer Motion components: use `shouldReduceMotion` from Motion to disable variants.

### 14.6 Screen reader behavior

- Streaming assistant messages announce at start ("Theseus replying") and end ("Reply complete") via `aria-live="polite"`.
- Citation focus announces the full metadata (source, year, confidence) via `aria-label` without requiring the hover card to open.
- Cosmograph provides a screen-reader-only summary mode: a `<details>` collapsed by default below the canvas listing focal nodes and their top neighbors, updated via `onSimulationTick` (throttled to once per second).
- Mosaic widgets include a screen-reader-only one-sentence summary (e.g., "IQ trend: Learning axis declined 8% over the last 14 days").

### 14.7 Lighthouse targets

- Accessibility: 95 or higher on every panel (`/theseus?view=ask`, `/theseus?view=explorer`, etc.). CI gate in Batch 10.
- Performance: 85 or higher on AskPanel and LibraryPanel; Explorer exempt (Cosmograph WebGL cost is real). CI gate.
- Best practices: 95 or higher everywhere.
- SEO: not applicable (Theseus is behind a workspace, not indexed).

---

## 15. Keyboard Shortcuts Table

Binding table for Batch 10. Use `react-hotkeys-hook` (already in the dependency list). Global shortcuts bind at `TheseusShell`; panel-local shortcuts bind inside the panel. Command Palette integrates via `cmdk` (already a dep).

| Shortcut | Scope | Action |
|---|---|---|
| Cmd/Ctrl + 1 | global | Switch to AskPanel |
| Cmd/Ctrl + 2 | global | Switch to ExplorerPanel |
| Cmd/Ctrl + 3 | global | Switch to IntelligencePanel |
| Cmd/Ctrl + 4 | global | Switch to LibraryPanel |
| Cmd/Ctrl + 5 | global | Switch to NotebookPanel |
| Cmd/Ctrl + 6 | global | Switch to CodePanel |
| Cmd/Ctrl + , | global | Switch to SettingsPanel |
| Cmd/Ctrl + K | global | Open command palette (cmdk) |
| Cmd/Ctrl + B | global | Toggle sidebar |
| Cmd/Ctrl + Shift + T | global | Toggle theme (light/dark), if exposed |
| `/` | AskPanel | Focus composer |
| Cmd/Ctrl + Enter | AskPanel composer | Submit |
| Cmd/Ctrl + . | AskPanel, while streaming | Cancel (ComposerPrimitive.Cancel) |
| Esc | global | Close topmost sheet/dialog/banner; else blur |
| Cmd/Ctrl + Shift + F | ExplorerPanel | Focus graph search |
| Cmd/Ctrl + 0 | ExplorerPanel | Fit view (reset camera) |
| Cmd/Ctrl + Shift + K | ExplorerPanel | Toggle legend |
| Tab | ExplorerPanel | Cycle through focal nodes (not canvas pixels) |
| Shift + Tab | ExplorerPanel | Cycle focal nodes reverse |

Conflicts with browser or OS shortcuts: Cmd/Ctrl + N (new tab), Cmd/Ctrl + T (new tab), Cmd/Ctrl + W (close tab) are not bound. Cmd/Ctrl + D is not bound (browser bookmark).

Document the table in a Command Palette help entry so users can discover shortcuts without reading the spec.

---

## 16. Rollback and Migration

### 16.1 Rollback

Each batch lands as a single commit or a small cluster with a "Batch N complete" tag. If Batch N+1 breaks production, revert to Batch N's tag with `git revert` (preserves history; auditable), never `git reset --hard` (destroys history).

The deprecated `TheseusDotGrid` shim (Fork F) exists specifically so that a mid-batch partial rollback does not break legacy imports. Leave the shim in place until Batch 10 confirms zero inbound references.

Backend changes (new `/api/v2/theseus/graph/`, intelligence endpoints) deploy independently of the frontend. Frontend batches can revert without reverting backend. Backend reverts may leave frontend endpoints returning 404, which should render as empty states (see §13), not errors.

### 16.2 User state migration

`useChatHistory` currently persists to `localStorage`. Batch 4 must either:
- Preserve the existing key and shape (preferred), OR
- Write a one-time migration that reads the old shape, writes the new, deletes the old. Migration runs at first mount; idempotent.

Saved models in LibraryPanel: Batch 9 must preserve model IDs. Verify by loading an existing saved model in dev before declaring Batch 9 complete.

URL deep links: `/theseus?view=<panel>` must keep working across every batch. Batch 10 audits by loading `?view=ask|explorer|intelligence|library|notebook|code|settings` directly in a fresh browser and confirming each lands on the correct panel.

Users with open chat threads during the rollout will see the new composition on next page load. Streaming state does not persist across the boundary; an in-flight stream when a user reloads will be lost. This is acceptable.

---

## 17. Test Strategy

Per-batch minimum test requirements layered on top of V2's manual Verify lists.

| Batch | Automated tests required |
|---|---|
| 1 | None beyond `npm run build`. Manual light/dark screenshot diff. |
| 2 | Import-smoke via a throwaway page: `getSharedDuckDB()` and `initMosaicCoordinator()` resolve without error. |
| 3 | Unit tests for `predictVizType` covering at least 20 queries across all three classes (graph, chart, text). |
| 4 | Playwright flow: open AskPanel, submit a canned query, wait for stream completion, verify at least one citation renders a hover card, verify composer cancel mid-stream. Axe run on the final DOM; 0 critical violations. |
| 5 | Unit test: parsing `[CITE:...]...[/CITE]` anchors. Playwright: two Mosaic widgets subscribing to the same `Selection.intersect()` cross-filter correctly. |
| 6 | Playwright: open ExplorerPanel, verify node count matches API response, search finds and zooms, legend filters, click-and-detail works, directive banner renders from a chat-driven navigation. |
| 7 | `grep` assertions: no residual imports to deleted modules (folded into Batch 7 fork-verification checklist in §6). |
| 8 | Playwright: open IntelligencePanel, brush time range on IQTrend, verify EpistemicWeather filters. |
| 9 | `grep` (zero hex literals in restyled panels). Visual diff in light + dark across all five restyled panels. |
| 10 | Lighthouse CI: accessibility 95 or higher on every panel, performance 85 or higher on non-Explorer panels. Bundle size diff reported in PR (should be smaller). |

One test is enough per critical path. Exhaustive suites for internal workspace views are waste.

---

## 18. How to use this document alongside SPEC-THESEUS-UI-V2.md

1. Every batch: read V2's batch section first. It's canonical for WHAT changes.
2. Before starting the batch, read §2 for the relevant forks and §6 for the verification checklist.
3. Before deleting anything, confirm against §3's reconciliation matrix.
4. When in doubt about an API, check §4; if §4 doesn't cover it, open `node_modules/<pkg>/` and read the source. Never guess.
5. After each batch, run the §6 checklist. A green build is necessary but not sufficient: fork sentinels must also match.

If a batch ends with all §6 checks passing, V2's per-batch Verify list passing, and `npm run build` green, the batch is done and the next one can start.

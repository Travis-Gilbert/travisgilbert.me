# VIE Workspace Implementation Spec (Locked)

## META
Status: LOCKED
Spec version: 1.0
Author: Travis via spec-compliance
Date: 2026-04-11
Implements: SPEC-VIE-WORKSPACE.md (Panel Manager + Interactive Graph + Chat Surface + Notebook)

Summary: 47 MUST, 14 MUST NOT, 32 VERIFY statements across 4 workstreams.
Audit of current implementation found W0 and W1 substantially complete, W2 structurally present but missing custom features (stage labels, evidence cards, follow-ups, actions, export), W3 missing 6 of 12 required files and all workbench tab functionality.

## SCOPE

Files to create:
- `src/components/theseus/notebook/NotebookGraph.tsx`
- `src/components/theseus/notebook/ClaimsPanel.tsx`
- `src/components/theseus/notebook/TensionsPanel.tsx`
- `src/components/theseus/notebook/GapsPanel.tsx`
- `src/components/theseus/notebook/AlgorithmSettings.tsx`

Files to modify:
- `src/components/theseus/chat/TheseusThread.tsx`
- `src/components/theseus/notebook/NotebookWorkbench.tsx`
- `src/components/theseus/notebook/NotebookLayout.tsx`
- `src/components/theseus/notebook/NotebookEditor.tsx`

Files that exist and are complete (no further changes):
- `src/components/theseus/PanelManager.tsx`
- `src/components/theseus/panels/AskPanel.tsx`
- `src/components/theseus/panels/ExplorerPanel.tsx`
- `src/components/theseus/panels/LibraryPanel.tsx`
- `src/components/theseus/panels/SettingsPanel.tsx`
- `src/components/theseus/panels/NotebookPanel.tsx`
- `src/components/theseus/TheseusSidebar.tsx`
- `src/components/theseus/TheseusMobileNav.tsx`
- `src/components/theseus/TheseusShell.tsx`
- `src/app/theseus/page.tsx`
- `src/app/theseus/explorer/page.tsx`
- `src/app/theseus/artifacts/page.tsx`
- `src/app/theseus/models/page.tsx`
- `src/app/theseus/library/page.tsx`
- `src/lib/theseus-assistant-runtime.ts`
- `src/components/theseus/explorer/ContextPanel.tsx`
- `src/components/theseus/explorer/IdleGraph.tsx`
- `src/components/theseus/notebook/extensions/slashCommandItems.ts`
- `src/components/theseus/notebook/NotebookTiptapEditor.tsx`

Files that MUST NOT be modified:
- `src/components/studio/TiptapEditor.tsx`
- `src/components/studio/extensions/*.tsx` (all Studio extensions)
- `src/components/studio/SlashCommandPopup.tsx`
- `src/components/studio/WordCountBand.tsx`
- `src/components/theseus/explorer/IdleGraph.tsx`
- `src/components/theseus/explorer/ContextPanel.tsx`
- `src/lib/theseus-api.ts`

---

## W0: PANEL MANAGER (COMPLETE)

Current state: All requirements met. No further work needed.

---

## W1: INTERACTIVE GRAPH (COMPLETE)

Current state: All requirements met. ContextPanel tabs wired, camera pan, selection dimming, navigation chain all present in codebase from prior work.

---

## W2: CHAT SURFACE

### W2.1 assistant-ui Integration (DONE)

Current state: `TheseusThread.tsx` imports `AssistantRuntimeProvider`, `ThreadPrimitive`, `MessagePrimitive`, `ComposerPrimitive` from `@assistant-ui/react` and `MarkdownTextPrimitive` from `@assistant-ui/react-markdown`. `theseus-assistant-runtime.ts` imports `useExternalStoreRuntime`, `ExternalStoreAdapter`, `ThreadMessageLike` from `@assistant-ui/react`. Streaming works. No further work needed on the integration layer.

### W2.2 Stage Labels (MISSING)

The old `TheseusMessage.tsx` rendered `stageLabel` ("RETRIEVING EVIDENCE...") during streaming. The new `AssistantMessageComponent` renders only `MessagePrimitive.Content` with `MarkdownTextPrimitive`. Stage labels are lost.

MUST: `AssistantMessageComponent` renders a stage label element when the message is streaming and has a stageLabel in its metadata
MUST: Stage label text uses font-family `var(--vie-font-mono)`, font-size `11px`, letter-spacing `0.08em`, text-transform `uppercase`, color `var(--vie-text-dim)`
MUST: Stage label appears above the markdown content when no text has arrived yet, and below the markdown content while text is still streaming
MUST: Stage label reads the `stageLabel` field from the message's `metadata.custom.stageLabel` (set by `convertMessage` in `theseus-assistant-runtime.ts`)
MUST NOT: Render stage label on completed (non-streaming) messages
VERIFY: Send a query; during the pipeline, the stage label text changes through: STARTING, CLASSIFYING, RETRIEVING EVIDENCE, ASSEMBLING ANSWER
VERIFY: After response completes, no stage label element is visible

### W2.3 Evidence Preview Cards (MISSING)

The old `TheseusMessage.tsx` rendered `<VisualPreviewCard>` for evidence_path and objects sections. The new assistant message does not render these.

MUST: After a completed assistant message, if `response.sections` contains a section with `type === 'evidence_path'`, render `<VisualPreviewCard type="evidence" nodes={section.nodes} edges={section.edges} query={response.query} />`
MUST: After a completed assistant message, if `response.sections` contains a section with `type === 'objects'` and `objects.length > 0`, render `<VisualPreviewCard type="objects" objects={section.objects} query={response.query} />`
MUST: Evidence cards appear below the markdown content, above the action bar
MUST: `VisualPreviewCard` is imported from `./VisualPreviewCard` (already imported but unused)
MUST NOT: Render evidence cards while the message is still streaming
VERIFY: `grep -n 'VisualPreviewCard' src/components/theseus/chat/TheseusThread.tsx` shows at least one JSX usage (not just the import)

### W2.4 Message Action Bar (MISSING)

The old `TheseusMessage.tsx` rendered copy, thumbs-up, thumbs-down, and "Explore in graph" buttons. The new assistant message renders none.

MUST: Completed assistant messages show an action bar with: copy button, thumbs-up button, thumbs-down button
MUST: If the response has an evidence_path section with nodes, show an "Explore in graph" button that calls `useSwitchPanel()('explorer')` and dispatches `explorer:focus-nodes` with the node PKs
MUST: Action bar uses class `theseus-msg-actions`, hidden by default, visible on message hover (CSS already exists in `assistant-ui-theme.css`)
MUST: Copy button calls `navigator.clipboard.writeText(messageText)`
MUST: Feedback buttons dispatch `theseus:feedback` CustomEvent with `{ query, positive: boolean }`
MUST NOT: Show action bar on streaming messages
VERIFY: Hover over a completed assistant message; 3 or 4 action buttons appear
VERIFY: Click copy button; clipboard contains the message text

### W2.5 Follow-up Pills (MISSING)

The old `TheseusMessage.tsx` rendered follow-up suggestion pills from `response.follow_ups`. The new assistant message does not.

MUST: After a completed assistant message that has `response.follow_ups` with length > 0, render up to 3 follow-up pills
MUST: Each pill is a `<button>` with class `theseus-followup-pill` that dispatches `theseus:chat-followup` CustomEvent with `{ query: fu.query }`
MUST: Pills appear below the action bar
MUST NOT: Render follow-up pills on streaming messages
VERIFY: Send a query that returns follow-ups; pills appear below the completed message
VERIFY: Click a follow-up pill; a new query is submitted

### W2.6 Chat Export (MISSING)

MUST: An export function exists that collects all messages and produces markdown in format `## User\n\n{text}\n\n## Theseus\n\n{text}`
MUST: Export is triggerable from the UI (button in panel header or keyboard shortcut)
MUST: Markdown file downloads to the user's machine
VERIFY: After a conversation, trigger export; a `.md` file downloads with the conversation content

---

## W3: NOTEBOOK PANEL

### W3.1 Editor Integration (DONE)

Current state: `NotebookTiptapEditor.tsx` is a proper fork of Studio's `TiptapEditor.tsx` with one import change (slashCommandItems points to notebook's forked version). All 30+ extensions present. `studio.css` imported in layout.tsx. `studio-theme` class applied to layout wrapper. Slash command popup renders correctly at 320px width.

### W3.2 Epistemic Slash Commands (DONE)

Current state: Forked `slashCommandItems.ts` includes Claim, Tension, Ask Theseus, Capture, Connect in the Theseus section. Helper functions `scheduleClaimExtraction`, `executeInlineAsk`, `captureToGraph` implemented.

### W3.3 NotebookGraph.tsx (MISSING)

MUST: Create `src/components/theseus/notebook/NotebookGraph.tsx`
MUST: Fork the `tickForce` function from `IdleGraph.tsx` (copy the function, do not import IdleGraph itself)
MUST: Accept a `relatedObjects` prop of type `Array<{ id: string; title: string; objectType: string }>`
MUST: Render as an SVG with the same node/edge visual style as IdleGraph (type-colored circles, labels on hover)
MUST: Limit to 20-30 nodes maximum
MUST: New connections since last update pulse teal briefly (CSS animation, 600ms)
MUST NOT: Fetch clusters on mount (IdleGraph does this; NotebookGraph receives data via props)
VERIFY: `grep -n 'tickForce' src/components/theseus/notebook/NotebookGraph.tsx` returns matches
VERIFY: `grep -n 'relatedObjects' src/components/theseus/notebook/NotebookGraph.tsx` returns matches

### W3.4 ClaimsPanel.tsx (MISSING)

MUST: Create `src/components/theseus/notebook/ClaimsPanel.tsx`
MUST: Listen for `containType === 'argument'` blocks in the editor content (these are claim markers from the /claim command, which uses `argument` contain type as a stand-in until ContainBlock supports `claim`)
MUST: Show each claim with its text and a status indicator (pending, accepted, contested)
MUST: Auto-extract claims from note content via debounced API call (500ms)
VERIFY: File exists and exports a default component

### W3.5 TensionsPanel.tsx (MISSING)

MUST: Create `src/components/theseus/notebook/TensionsPanel.tsx`
MUST: Show conflicts between the note's content and existing graph knowledge
MUST: Each tension shows the user's text vs the graph's claim, with severity color and a "Resolve" action
MUST: Update reactively with 500ms debounce as user types
VERIFY: File exists and exports a default component

### W3.6 GapsPanel.tsx (MISSING)

MUST: Create `src/components/theseus/notebook/GapsPanel.tsx`
MUST: Show structural gaps detected from the note's entities
MUST: Each gap has a "Learn more" button that dispatches an ask query
VERIFY: File exists and exports a default component

### W3.7 AlgorithmSettings.tsx (MISSING)

Current state: Settings sliders exist inline in `NotebookWorkbench.tsx` as a `SettingsTab` function. The spec calls for a separate `AlgorithmSettings.tsx` file.

MUST: Extract the settings sliders from `NotebookWorkbench.tsx` into `src/components/theseus/notebook/AlgorithmSettings.tsx`
MUST: Include 4 sliders: Personal weight (0.5-3, default 1.5), Traversal depth (1-3, default 2), Recency bias (0-1, default 0.3), Signal mix (0-1, default 0.5)
MUST: Export slider values so the Graph tab can consume them
VERIFY: File exists and exports a default component
VERIFY: `grep -rn 'AlgorithmSettings' src/components/theseus/notebook/NotebookWorkbench.tsx` shows an import

### W3.8 Workbench Tab Content (PARTIAL)

Current state: `NotebookWorkbench.tsx` has 6 tabs (graph, chat, claims, tensions, gaps, settings) but 5 of 6 render placeholder text divs instead of functional components.

MUST: Graph tab renders `<NotebookGraph>` component (from W3.3)
MUST: Chat tab renders `<TheseusThread>` from W2 with a context wrapper that prepends the current note content to every query
MUST: Claims tab renders `<ClaimsPanel>` component (from W3.4)
MUST: Tensions tab renders `<TensionsPanel>` component (from W3.5)
MUST: Gaps tab renders `<GapsPanel>` component (from W3.6)
MUST: Settings tab renders `<AlgorithmSettings>` component (from W3.7)
MUST NOT: Leave any tab rendering placeholder text in the final implementation
VERIFY: `grep -c 'notebook-tab-placeholder' src/components/theseus/notebook/NotebookWorkbench.tsx` returns `0`

### W3.9 Document Status (PARTIAL)

Current state: Status badge exists showing `draft`, `captured`, `in-graph` with data attribute styling. But the status never changes from `draft` because no capture/engine integration exists.

MUST: Status changes from `draft` to `captured` when the user triggers `/capture` slash command
MUST: Status indicator uses class `notebook-doc-status` with `data-status` attribute
VERIFY: After typing `/capture` in the editor, the status badge updates to show `captured`

### W3.10 Proportional Audit

MUST: Slash command popup width is 320px (currently correct via Studio CSS)
MUST: Slash command popup max-height is 400px or 50% of editor height, whichever is smaller
MUST: Slash command popup appears below the cursor, aligned to the left margin of the text
MUST: If near the bottom of the viewport, popup flips to appear above (Floating UI `flip` middleware handles this)
MUST: Contain block inner text aligns with surrounding paragraph text; the left accent border is outside the text column
MUST: Document list items have consistent height with title truncation via `text-overflow: ellipsis`
VERIFY: Type `/` near the bottom of the editor; popup flips to appear above the cursor
VERIFY: Insert an Observation contain block; text inside aligns with the paragraph above it

---

## CONFLICT PROTOCOL

IF CONFLICT: This spec takes precedence over existing code.
IF CONFLICT: If a MUST cannot be met due to a technical constraint, STOP and report.
IF CONFLICT: If you believe a requirement is wrong, implement it as specified anyway and note your concern afterward.

## UNIVERSAL PROHIBITIONS

MUST NOT: Add props, parameters, or features not listed in this spec
MUST NOT: Modify files not listed in SCOPE
MUST NOT: Resolve conflicts with existing code independently (STOP and report)
MUST NOT: Rewrite a component from scratch when the spec says to fork or import an existing one
MUST NOT: Claim a feature is "working" based solely on DOM structure without verifying visual correctness
MUST NOT: Use placeholder text divs as the final implementation for any workbench tab

---

## COMPLETION CHECKLIST

Run all VERIFY statements in order. Report pass/fail for each.
If any VERIFY fails, fix and re-run before marking complete.

### Build Gate
VERIFY: `npm run build` passes with exit code 0
VERIFY: `npx tsc --noEmit` passes with exit code 0
VERIFY: `git diff --stat` shows only files listed in SCOPE

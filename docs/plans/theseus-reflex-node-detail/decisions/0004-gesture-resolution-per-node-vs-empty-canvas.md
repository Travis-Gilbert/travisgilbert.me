# ADR 0004: Per-node double-click opens detail; empty-canvas double-click keeps the existing lens toggle

## Status
Accepted

## Context
The cosmos.gl canvas wrapper has an existing DOM `dblclick` handler (`ExplorerShell.tsx:79-93`) that toggles the lens to `'atlas'`. cosmos.gl's `onPointDoubleClick` callback (currently unwired in `ExplorerShell`, declared on `CosmosGraphCanvas`) fires when the double-click lands on a point. Both events fire from the same user gesture if not separated. This is a gesture-collision risk noted in the research brief.

## Decision
Wire `onPointDoubleClick` to call `event.stopPropagation()` (and set a short-lived ref flag) before invoking `openNodeDetail(pointId)`. The DOM `dblclick` lens-toggle handler stays installed on the canvas wrapper but only fires when the double-click does not land on a point. Per-node double-click opens the Reflex page; empty-canvas double-click toggles the atlas lens.

## Consequences
- Preserves the existing atlas-toggle muscle memory.
- Gives the per-node double-click a meaningful, non-overlapping job.
- No API change to cosmos.gl required; both handlers exist in the codebase already, only the wiring is new.
- Depends on cosmos.gl's `onPointDoubleClick` running before the DOM `dblclick` bubbles. If cosmos.gl ever changes that ordering, the lens toggle would fire on top of node opens. Mitigation: the ref flag belt-and-braces, plus an optional capture-phase listener that consults `getPointAtPosition` if the ref-flag approach is unreliable.
- Reversible: removing the wiring restores prior behavior (only the lens toggle fires, on every double-click).

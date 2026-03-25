# Studio App Transformation Spec (Batch 4)

## 2026-03-25

Repo: Travis-Gilbert/travisgilbert.me
Track: Web App Transformation (Track 1)
Depends on: None (can run in parallel with Batches 1-3)

Studio already has strong app foundation: persistent three-panel layout,
command palette (cmdk), keyboard shortcuts, autosave with retry, Y.js
local-first persistence, mobile drawer and dock. This spec closes the
remaining gaps.

## 4A. Route Loading States

No loading.tsx in (studio) routes. Content area is blank during fetch.

Create loading.tsx for each content type route with skeleton UI:
- essays, field-notes, videos, shelf, projects, toolkit: hero zone + card list skeleton
- [type]/[slug] (editor): stage bar + writing area skeleton
- All use pulse animation on var(--studio-surface) fills

## 4B. Content Search in Command Palette

Cmd+K handles nav and actions but not content search.

Add debounced searchContent() call on input change (200ms).
Show results in a "Content" group below commands.
Click result navigates to /studio/{type}/{slug}.
Requires: searchContent from studio-api.ts, useRouter, getContentTypeIdentity.

## 4C. Studio PWA Manifest

Current manifest targets CommonPlace with start_url /commonplace.

Create Studio-specific manifest via API route at /studio/manifest/route.ts.
name: Studio, start_url: /studio, scope: /studio, display: standalone.
Link in (studio)/layout.tsx metadata.

## 4D. View Transitions (Experimental)

Subtle crossfade on route changes. Next.js 16 experimental viewTransition.
Tag main content area with viewTransitionName. CSS for fade-in/out.
Respects prefers-reduced-motion. Sidebar and workbench excluded.

## 4E. Quick Wins

- Cmd+N for Quick Capture (open NewContentModal from anywhere)
- Browser tab title updates in real time as editor title changes
- Shortcut hints in sidebar tooltips

## Execution Order

1. 4A: loading states (no deps, immediate impact)
2. 4E: quick wins (one-liners)
3. 4B: content search in Cmd+K
4. 4C: PWA manifest
5. 4D: view transitions (experimental)

## Not Included (Future Work)

Service worker, offline caching, background sync, notifications,
Tauri desktop wrapper, global shortcuts outside Studio.

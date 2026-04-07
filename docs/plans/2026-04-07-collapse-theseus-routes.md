# Collapse /theseus and /theseus/ask into a single route

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `travisgilbert.me/theseus` the only ask URL the user sees, with the morph + traveling query + answer experience starting in place on the homepage instead of after a navigation hop.

**Architecture:** Extract the ask experience (state machine, dock, traveling query, answer rendering) from `/theseus/ask/page.tsx` into a reusable `AskExperience` component. Render it inside the homepage at `/theseus`, sitting under the THESEUS title + starter pills which fade out when state leaves IDLE. Convert `/theseus/ask` into a server redirect so existing bookmarks survive. URL stays at `/theseus?q=...` throughout.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, the existing TheseusShell context.

---

## Constraints (locked, do not deviate)

1. URL is `/theseus` (with optional `?q=...` query string). NEVER `/theseus/ask`.
2. Existing bookmarks to `/theseus/ask?q=foo` must continue to work via redirect.
3. The morph + traveling query + bloom must work end-to-end in place, no navigation hop.
4. The homepage chrome (THESEUS title, "What are you curious about?", starter pills) is preserved when state is IDLE and fades out when state moves to THINKING.
5. The dot grid face renders during IDLE just like it does on the current `/theseus/ask`.
6. The visible search input remains the new AskDock (480x56 pill that morphs to 88x88 spinner circle on submit). The legacy custom `<div role="textbox">` input is removed.
7. No emojis, no em/en dashes (project rule).

---

## Tasks

### Task 1: Extract AskExperience component

**Files:**
- Create: `src/components/theseus/AskExperience.tsx`
- Modify: `src/components/theseus/ThinkingScreen.tsx` (update AskState import)

**Step 1:** Create the new file with the entire content of `src/app/theseus/ask/page.tsx` minus the `'use client'` directive, the Suspense wrapper, and the default export. Rename `AskContent` to `AskExperience` and export it as a named export. Keep `AskState` as a named export from the same file. Keep `TravelingQuery`, `AskDock`, `AnswerMetaCard`, `StaticScreen`, `BRAILLE_FRAMES`, `DOCK_*` constants, helpers, and types all inside the file at module scope.

**Step 2:** Add `'use client'` at the top.

**Step 3:** Update `src/components/theseus/ThinkingScreen.tsx` line 6 to import `AskState` from the new path:
```ts
import type { AskState } from '@/components/theseus/AskExperience';
```

**Step 4:** Inside `AskExperience`, find the two `router.push('/theseus/ask?q=...')` call sites in `navigateToQuery` and update both to push to `/theseus?q=...`.

**Step 5:** Verify TypeScript compiles: `./node_modules/.bin/tsc --noEmit -p .`

**Step 6:** Commit. `refactor(theseus): extract AskExperience component for shared use`

### Task 2: Wire AskExperience into the homepage

**Files:**
- Modify: `src/app/theseus/page.tsx` (complete rewrite)

**Step 1:** Replace the entire current `TheseusHomepage` body with a new structure:
- Always renders `<AskExperience />` (which manages its own state machine reading from useSearchParams)
- ALSO renders the homepage chrome (THESEUS title + subtitle + starter pills) as a separate absolutely-positioned overlay layer that watches `useGalaxy().askState` and fades out when `askState !== 'IDLE'` via opacity transition with pointer-events gating.
- The starter pills navigate via `router.push('/theseus?q=' + encodeURIComponent(query))` so the AskExperience's existing useEffect picks up the new query and starts the THINKING state machine.

**Step 2:** The chrome layer must NOT block clicks on the dock when it's faded out (set `pointer-events: none` on the chrome wrapper when `askState !== 'IDLE'`). The chrome must NOT cover the dock at the bottom of the viewport.

**Step 3:** Position the chrome at the upper portion of the viewport (`top: 22vh` or similar). The dock stays at its existing fixed bottom position. The space between chrome and dock is the "thinking area" where the dot grid pulse plays out.

**Step 4:** Verify TypeScript and ESLint pass with no new errors.

**Step 5:** Commit. `feat(theseus): render AskExperience inside homepage with chrome overlay`

### Task 3: Convert /theseus/ask to a redirect

**Files:**
- Modify: `src/app/theseus/ask/page.tsx` (complete rewrite to redirect)

**Step 1:** Replace the entire file with a server-component redirect:
```tsx
import { redirect } from 'next/navigation';

export default async function AskRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.saved) query.set('saved', params.saved);
  const qs = query.toString();
  redirect(qs ? `/theseus?${qs}` : '/theseus');
}
```

**Step 2:** Note that this is now a server component (no `'use client'`). It runs at request time, redirects via the Next.js redirect helper, and never mounts a client component.

**Step 3:** Verify TypeScript passes.

**Step 4:** Commit. `refactor(theseus): convert /theseus/ask to redirect`

### Task 4: End-to-end verification in dev server

**Step 1:** Restart the dev server with a clean cache. Wait for `/theseus` cold compile.

**Step 2:** Navigate to `http://localhost:3000/theseus` and verify:
- Page loads with HTTP 200
- THESEUS title visible at top
- "What are you curious about?" subtitle visible
- 4 starter pills visible
- The new AskDock visible at the bottom of the viewport (480x56 pill input, NOT the old custom textbox)
- Dot grid face visible behind the chrome

**Step 3:** Click a starter pill OR type a query into the dock. Verify:
- The URL changes to `/theseus?q=...` (NOT `/theseus/ask?q=...`)
- The chrome (title + pills) fades out
- The dock morphs to the spinner circle
- The traveling query appears centered above the dock with its backdrop card
- The dot grid radial pulse begins
- No navigation flash or layout reset

**Step 4:** Wait for the answer to arrive (or simulate via fetch delay if backend is slow). Verify:
- The traveling query travels from centered to top-left
- The answer meta card blooms in from near the spinner location
- The morph circle reverts to the input pill so the user can ask a follow-up
- The history chip for the just-asked query appears below the dock

**Step 5:** Navigate to `http://localhost:3000/theseus/ask` directly. Verify it 307s to `/theseus`.

**Step 6:** Navigate to `http://localhost:3000/theseus/ask?q=test` directly. Verify it 307s to `/theseus?q=test` and the THINKING state begins immediately on `/theseus`.

### Task 5: Commit and push

**Step 1:** `git status` to verify only the intended files are dirty.

**Step 2:** Commit if Task 2/3 weren't already committed.

**Step 3:** `git push origin main`

**Step 4:** Confirm Vercel deploys.

---

## Verification before completion

1. `./node_modules/.bin/tsc --noEmit -p .` passes
2. `./node_modules/.bin/eslint src/app/theseus/page.tsx src/app/theseus/ask/page.tsx src/components/theseus/AskExperience.tsx src/components/theseus/ThinkingScreen.tsx` shows zero new errors
3. Live verification per Task 4 passes
4. Existing bookmarks to `/theseus/ask?q=foo` redirect cleanly
5. The morph + traveling query + bloom + answer all work end-to-end on `/theseus`

---

# Studio: remove mock data, wire to real backend

**Status:** spec, not yet executed
**Filed:** 2026-04-26 (after spacetime mock removal session)
**Owner:** TBD (next focused session)

## Why this exists

The Next.js `/studio` route is the real product surface for content
management. The Django `publishing_api/` service is its backend. As of
the spacetime mock-removal pass, `/studio` is the only remaining
production-mounted page on travisgilbert.me that ships hardcoded mock
data as its primary data source.

CLAUDE.md (post-spacetime update) forbids mock data in user-reachable
surfaces. `/studio` violates that rule today. This spec records what it
will take to fix it.

## Current state (snapshot)

Mounted page chain:

- `src/app/(studio)/studio/page.tsx` -> renders `Dashboard`
- `src/components/studio/Dashboard.tsx` (mock-driven)
- `src/components/studio/WorkbenchPanel.tsx` (mock-driven)

Mock surfaces in the mounted components:

| Mock function (in `src/lib/studio-mock-data.ts`) | Used by | Real fetcher in `studio-api.ts`? |
|---|---|---|
| `getMockContentItems()` | Dashboard, WorkbenchPanel | Yes: `fetchContentList()` |
| `getMockTimeline()` | Dashboard | Yes: `fetchTimeline()` |
| `getMockTodayQueue()` | Dashboard | No (not yet designed) |
| `getMockStudioPulse()` | WorkbenchPanel | No (not yet designed) |
| `getMockWorkbenchData()` | WorkbenchPanel | No (not yet designed) |

The non-mock parts of `studio-api.ts` are already real and working:
content CRUD, stage updates, publish, video projects, evidence board,
search, research trail.

`studio-mock-data.ts` itself is 804 lines and includes a
`computeItemMetrics()` utility plus a `THREAD_ENTRY_COLORS` constant
that are pure functions / data, not mock content. Keep those, move
them out of the mock module.

## Outcome

`/studio` renders entirely from real publishing_api endpoints. No
import of `studio-mock-data.ts` from any file under
`src/components/studio/`. The mock module is either deleted or
shrunken to test-only fixtures (and moved to a `__tests__/` directory
if anything still uses it).

## Phased plan

### Phase 1 -- wire the easy half

For each of `getMockContentItems` and `getMockTimeline`, the real
fetcher already exists. Convert Dashboard and WorkbenchPanel from
sync `useMemo(() => getMockX(), [])` to async fetch:

```tsx
const [items, setItems] = useState<StudioContentItem[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;
  fetchContentList()
    .then(data => { if (!cancelled) { setItems(data); setLoading(false); } })
    .catch(err => { if (!cancelled) { setError(err.message); setLoading(false); } });
  return () => { cancelled = true; };
}, []);
```

Add loading + error states for those slots. Keep the rest of the page
rendering its current shape (which still pulls from mock).

After Phase 1: ~50% of the page is real, ~50% is still labeled mock.

### Phase 2 -- decide the missing endpoints

Three slots have no backend yet. For each, decide:

1. **Today queue** (`getMockTodayQueue`): returns a list of
   `StudioTodayQueueItem` -- items the user should work on today.
   Probably derives from content stage + recency + priority.
   Endpoint design needed: GET `/api/studio/today-queue/` returning
   ordered `StudioTodayQueueItem[]`.

2. **Studio pulse** (`getMockStudioPulse`): returns
   `StudioPulseInsight[]` -- summary insights about the user's
   writing activity. Probably derives from sprint history + word
   count deltas + stage transitions.
   Endpoint design needed: GET `/api/studio/pulse/`.

3. **Workbench composite data** (`getMockWorkbenchData`): returns
   `WorkbenchPanelData` -- the full multi-pane state for the
   workbench view. Likely a composite of several per-item endpoints
   plus session state.
   Endpoint design needed: GET `/api/studio/workbench/<slug>/`.

For each, options are:

- **Build the endpoint in publishing_api now** (preferred if the
  domain logic is well-defined).
- **Render an honest empty state in the panel** until the endpoint
  exists (CLAUDE.md-compliant; user sees "No items in today's queue"
  rather than fake content).

The empty-state path should be the default for any panel whose
domain logic is not yet decided. Building a shape just to fill the
slot creates fake-looking data we then have to migrate again.

### Phase 3 -- tear out the mock module

Once Phases 1 and 2 are done:

1. Move `computeItemMetrics` and `THREAD_ENTRY_COLORS` to a real
   library file (e.g. `src/lib/studio-metrics.ts`).
2. Delete `src/lib/studio-mock-data.ts`.
3. Grep `MOCK_`, `getMock`, `studio-mock-data` to confirm zero
   references in `src/`.
4. Add a test that imports `Dashboard` and `WorkbenchPanel` and
   verifies neither pulls from `studio-mock-data` (lint rule or
   spec test).

## Risks

- **Visual regressions:** the mock data is densely-populated;
  switching to live data may produce sparser views that look "broken"
  if the user has not seeded content in their local publishing_api.
  Document the seeding command (`python manage.py import_content`
  per the project README) prominently.
- **API token plumbing:** `studio-api.ts` reads
  `NEXT_PUBLIC_STUDIO_API_TOKEN`. Confirm that's set in Vercel before
  the migration lands; otherwise live `/studio` 401s.
- **`STUDIO_API_BASE` localhost default:** falls back to
  `http://localhost:8000` if `NEXT_PUBLIC_STUDIO_URL` is unset.
  Production MUST set `NEXT_PUBLIC_STUDIO_URL` to the public
  publishing_api URL (likely `https://draftroom.travisgilbert.me`).
- **CORS:** publishing_api's CORS allowlist
  (`STUDIO_API_ALLOWED_ORIGINS`) must include the Next.js origin.

## Test plan

- Unit: each new fetcher mock-tested with `vi.fn` for `fetch`.
- Integration: spin up publishing_api locally, hit Dashboard,
  verify content list, timeline, and any wired Phase-2 panels
  populate from real DB.
- Manual: verify empty states render when DB is empty (no mock
  fallback to populated-looking content).
- Regression: confirm `/studio` does not import `studio-mock-data`
  anywhere under `src/components/studio/` after Phase 3.

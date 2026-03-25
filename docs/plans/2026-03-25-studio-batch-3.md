# Studio Batch 3: Research Panel + Features + Index API Rename

## 2026-03-25

Repos: Travis-Gilbert/travisgilbert.me, Travis-Gilbert/index-api
Depends on: Batch 1 (sheets), Batch 2 (light mode, connections, sheet targets)

## 3A. Research API to Index API Naming Cleanup

All code references to "Research API" become "Index API." The actual
service URLs already point to Index-API on Railway. This is a code
rename, not an infrastructure change.

Frontend (travisgilbert.me):
- studio-api.ts: RESEARCH_API_BASE -> INDEX_API_BASE, env var fallback
- commonplace.ts: RESEARCH_API const -> INDEX_API, env var fallback
- Add NEXT_PUBLIC_INDEX_API_URL to Vercel, keep old var as fallback

Publishing API (publishing_api):
- config/settings.py: RESEARCH_API_URL -> INDEX_API_URL with fallback
- apps/editor/services.py: rename functions and setting refs
- apps/intake/services.py: promote_to_research -> promote_to_index
- apps/editor/views.py: update calls to renamed functions
- Add INDEX_API_URL and INDEX_API_KEY to Railway, keep old vars

## 3B. Research Tab: Source Intake (URL + PDF)

The "Add source" button in WorkbenchPanel ResearchMode has no onClick.
Wire it to the Sourcebox pipeline in publishing_api/apps/intake/.

Step 1: Add JSON API endpoints to publishing API
- SourceboxApiCaptureView: POST url or file, returns JSON
- SourceboxApiStatusView: GET poll scrape status
- SourceboxApiListView: GET list sources by phase
- Routes at editor/api/sourcebox/capture/, status/, list/
- All inherit StudioApiBaseView for auth and CORS

Step 2: Add frontend API client functions
- submitSourceUrl(url): POST to sourcebox capture
- uploadSourceFile(file): POST multipart to sourcebox capture
- pollSourceStatus(id): GET scrape status with polling

Step 3: Redesign Research tab in WorkbenchPanel
- Replace dead "Add source" button with SourceIntakeForm
- URL input with submit button
- PDF upload label (file input)
- Poll 2s intervals for OG scrape completion (15 max attempts)
- Source preview cards when trail has no sources but sourcebox has items
- SourcePreviewCard shows title, description, site name, scrape status

Step 4: Wire onSourceAdded to update recentSources state

## 3C. Delete Button with Custom Confirmation Modal

New component: DeleteConfirmModal.tsx matching Studio design.
Add to ContentCardStandard.tsx (hover reveal) and Editor.tsx.

## 3D. Context-Aware New Button on Content Pages

Add New button to ContentList header, calls createContentItem directly.

## 3E. Empty State with CTA

Replace bare text with dashed border container and create button.

## Backend Dependencies

Publishing API: new JSON sourcebox endpoints, settings rename
Index-API: no changes needed (endpoints exist)
Env vars: add INDEX_API_URL/KEY to Vercel and Railway with fallback

## Build Gate

npm run build after each sub-batch.

## Execution Order

1. 3A: naming cleanup (no behavior change)
2. 3C/3D/3E: delete, new, empty state (frontend only)
3. 3B: research panel intake (backend endpoints first)

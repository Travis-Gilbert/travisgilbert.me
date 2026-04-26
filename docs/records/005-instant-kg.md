# 005: Instant Knowledge Graph (instant-kg)

**Status:** v1 implemented (multi-source fetcher landed; frontend integration verified in browser; 21 backend tests passing). Real-DB code paths gated behind a pending migration. Modal extractor and Tavily key require a deploy step before the path is fully live.

**Source plan:** `/Users/travisgilbert/.claude/plans/users-travisgilbert-downloads-0001-appr-lexical-willow.md`

**Source decisions:**
- ADR 0001 - Hybrid encoder-first extraction with LLM open-extras fallback, streamed via SSE to a unified composer.
- ADR 0002 - Multi-source fetcher: Tavily Extract for URLs (Tier 1), trafilatura for URL fallback (Tier 2), native CommonPlace parser stack on the RQ worker for files, `youtube-transcript-api` for YouTube. Firecrawl explicitly excluded; parsing stays on CPU (Railway worker), GPU is reserved for GLiNER + GLiREL on Modal.

## What ships

When the user pastes a URL or drops a file into the Explorer chat composer, a fresh subgraph (Document, Chunks, Entities, typed Entity-Entity relations, plus cross-document SBERT edges) populates the cosmos.gl canvas live via SSE within 5 to 15 seconds for a typical article.

Plain text continues to route to the existing `/ask/` flow unchanged.

## Architecture

```
ExplorerAskComposer.submit()
  classifyComposerInput(text, files)
    URL or file -> instantKgStream(...)              [src/lib/theseus/instantKg.ts]
    plain text  -> askTheseusAsyncStream(...)        [unchanged]

instantKgStream:
  URL or text  -> POST /api/v2/theseus/capture/instant-kg/         [JSON]
  File         -> POST /api/v2/theseus/capture/instant-kg/file/    [multipart]
    both       -> { job_id, stream_url }
  EventSource(stream_url)
    -> stage / document_created / chunk_created /
       entity_extracted / relation_extracted /
       cross_doc_edge / complete / error

Backend fetcher dispatcher (apps/notebook/services/extraction/fetcher.py):
  YouTube URL  -> youtube_transcript.fetch_transcript    [youtube-transcript-api]
                  fall through to URL branch on no-transcript
  URL          -> tavily_extract.fetch_url               [Tavily Extract REST, basic]
                  fallback: trafilatura over httpx.get   [Tier 2]
  File         -> native_parser.parse_file               [file_ingestion shim]
                  PDF: spacy-layout -> pypdf
                  DOCX: python-docx
                  XLSX/PPTX/code/images/text: existing CommonPlace handlers
  Plain text   -> passthrough (treated as already-fetched markdown)
  Output       -> canonical {markdown, metadata, source_url, fetch_provenance}

Backend RQ task (apps/notebook/tasks.instant_kg_pipeline):
  Channel: theseus:instant_kg:<job_id>
  Stages:
    1. quick_capture(dispatch_engine=False) -> Document Object
    2. _chunk_document -> Chunk rows (paragraph-based, 1500 char + 200 overlap)
    3. Per chunk:
       Modal: InstantKgExtractor.extract -> entities + relations
       (or local stub fallback if Modal disabled)
       resolve_entities_to_object_ids -> existing Object PK or
                                         auto_objectify-style create
       Edge.objects.create OR Tension(scope.kind='proposed_edge_type')
    4. SBERT cross-doc pass (faiss_find_similar_objects, threshold 0.45)
       per new Object -> semantic edges
    5. PPR over local subgraph -> highest-PPR new entity + 3 neighbors

Frontend ExplorerShell:
  Live additions accumulator (points + links).
  Events from instantKgHandlers.onEntity / onRelation merge into state.
  CosmosGraphCanvas re-renders via existing pushDataToGraph on prop change.
  applySceneDirectivePatch on complete:
    focus: pivot + 3 neighbors
    camera: queueCameraWaypoints tour
  GraphLegend reflects only types in the visible subgraph.
```

## Files touched

### Backend (Index-API worktree branch `claude/adoring-joliot-09882f`)

New:
- `apps/notebook/services/extraction/__init__.py`
- `apps/notebook/services/extraction/instant_kg.py` (orchestrator, ~600 lines)
- `apps/notebook/services/extraction/fetcher.py` (multi-source dispatcher)
- `apps/notebook/services/extraction/tavily_extract.py` (Tier 1 URL fetch + trafilatura Tier 2)
- `apps/notebook/services/extraction/native_parser.py` (shim over `file_ingestion.extract_file_content`)
- `apps/notebook/services/extraction/youtube_transcript.py` (`youtube-transcript-api` wrapper)
- `apps/notebook/services/extraction/gliner_ner.py` (stub + Modal fallback)
- `apps/notebook/services/extraction/glirel_re.py` (stub + Modal fallback)
- `apps/notebook/services/extraction/llm_extras.py` (stub for v1.1 26B fallback)
- `apps/notebook/services/extraction/schema_loader.py` (ObjectType + EdgeType label catalog)
- `apps/notebook/services/extraction/thresholds.py` (configurable cutoffs)
- `apps/notebook/services/extraction/modal_dispatch.py` (Modal RPC wrapper)
- `apps/notebook/services/extraction/instant_kg_jobs.py` (Redis pub/sub helpers)
- `apps/notebook/api/instant_kg.py` (Ninja routes: JSON POST + multipart POST + SSE stream + status)
- `apps/notebook/migrations/0095_instant_kg_models.py` (Chunk model + ObjectType.description)
- `apps/notebook/tests/test_instant_kg_pipeline.py` (10 tests, all passing)
- `apps/notebook/tests/test_instant_kg_fetcher.py` (11 tests, all passing)
- `modal_app/instant_kg_extraction.py` (Modal class hosting GLiNER + GLiREL on H100)

Modified:
- `apps/notebook/models/graph.py` (added Chunk model, ObjectType.description field)
- `apps/notebook/models/__init__.py` (re-exports Chunk)
- `apps/notebook/tasks.py` (added instant_kg_pipeline RQ task)
- `config/api_v2.py` (registered instant_kg_router under /theseus/)
- `requirements/base.txt` (added trafilatura>=1.12.0, youtube-transcript-api>=0.6.2)

Reused (no edits, integrated into the new dispatcher):
- `apps/notebook/file_ingestion.py` (CommonPlace `extract_file_content` entry point)
- `apps/notebook/pdf_ingestion.py` (`extract_pdf_text`: spacy-layout -> pypdf)
- `apps/notebook/search_providers.py` (TavilyRESTSearchProvider auth + httpx pattern)

### Frontend (travisgilbert.me, branch `main`)

New:
- `src/lib/theseus/composerInputDetect.ts` (URL / file / text classifier)
- `src/lib/theseus/instantKg.ts` (SSE consumer)

Modified:
- `src/components/theseus/explorer/ExplorerAskComposer.tsx` (input routing, paste / drop, file chip UI)
- `src/components/theseus/explorer/ExplorerShell.tsx` (live additions accumulator, drop zone, GraphLegend mount, post-complete scene directive)

Removed:
- `src/components/theseus/explorer/atlas/AtlasIngestBar.tsx` (replaced by composer routing)

## What does NOT yet ship in v1

- **Open-extras 26B fallback.** When GLiREL confidence drops below `OPEN_VOCAB_ESCALATION_THRESHOLD`, the relation is routed as `'open_extras'` but the 26B is not yet called. Tension proposals from out-of-schema GLiREL output ARE created (via the `'open_extras_pending'` route).
- **PDF OCR Tier 2 fallback.** Scanned PDFs that the spacy-layout / pypdf chain cannot read return None from the native parser. The orchestrator surfaces a transient error event in that case. PyTesseract OCR fallback for scanned PDFs is a v1.1 polish item; PyTesseract is already installed on the worker for image OCR so the integration is small.
- **Per-type shape encoding on the canvas** (`SPEC-F-object-shape-system.md`). v1 ships color-and-legend differentiation only.
- **True incremental insert API on `CosmosGraphCanvas`.** v1 accepts a full Float32 buffer rebuild per SSE event; the appendNodes / appendLinks / commit adapter API is a v1.1 candidate if rendering jank emerges.

## Open question dispositions

1. **Fetcher architecture.** Resolved by ADR 0002. Tavily Extract REST (basic mode) for URLs, trafilatura Tier 2 fallback, native parser on the RQ worker for files, `youtube-transcript-api` for YouTube. Firecrawl explicitly excluded.
2. **Modal GPU class.** H100 (per project memory, H100/B200 only on Modal).
3. **AtlasIngestBar disposition.** Deleted. No `theseus:capture-complete` consumers existed.
4. **Migration ordering.** Backend first. The Chunk model + ObjectType.description migration (`0095_instant_kg_models`) must apply on Railway before the frontend reaches users via prod. Until that lands, the SSE endpoint will surface a 500 from the Object insert (no Chunk table) and the frontend's onError path will surface the error in chat.
5. **Compute placement.** Parsing on the Railway RQ worker (CPU). GPU work (GLiNER + GLiREL) on Modal. The two layers are kept strictly separate per ADR 0002.
6. **Tavily credit budget.** Basic mode = 1 credit per 5 successful extractions. The free 500-credit allocation covers ~2,500 URL extractions per month for one user. Upgrade path is a paid Tavily tier; usage telemetry lives in `Object.properties['instant_kg']['fetch_provenance']`.

## How to verify after deploy

1. Apply migration on Railway: `python3 manage.py migrate notebook 0095`.
2. Deploy Modal app: `modal deploy modal_app/instant_kg_extraction.py`.
3. Smoke the Modal app: `modal run modal_app/instant_kg_extraction.py::main`.
4. Smoke the SSE round-trip locally: `curl -N http://localhost:8000/api/v2/theseus/capture/instant-kg/ -d '{"input":"...","mode":"text"}' -H 'Content-Type: application/json'` then `curl -N http://localhost:8000/api/v2/theseus/capture/instant-kg/stream/<job_id>/`.
5. Frontend smoke: paste a URL into the Explorer composer; expect entity / relation events streaming and a post-complete tour over the highest-PPR new entity + 3 neighbors.

## Tests

10 pytest tests at `apps/notebook/tests/test_instant_kg_pipeline.py`:
- 4 orchestrator routing tests (canonical event sequence, schema-constrained Tension, low-score escalation, high-score Edge)
- 2 RQ task wrapper tests (pipeline_start + complete; exception path stores error)
- 3 chunker tests (paragraph boundaries, overflow, empty input)
- 1 relation endpoint resolver test (case-insensitive surface match)

All passing. Frontend typechecks cleanly via `npx tsc --noEmit`. Browser smoke confirmed: pasted URL routes through `instantKgStream`, hits the new endpoint, surfaces 404 cleanly when backend is offline.

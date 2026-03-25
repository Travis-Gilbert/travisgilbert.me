# Studio Flagship: ML Writing Surface + PWA (Batches 4-5)

## 2026-03-25

Repos: Travis-Gilbert/travisgilbert.me, Travis-Gilbert/index-api
Depends on: Batches 1-3 (complete)

## Batch 5: ML-Powered Writing Surface

The Theseus engine (SBERT, NLI, NER, BM25, KGE) organizes the
research library but never reads the draft. This batch connects
the engine to the writing surface. All ML runs post-save, never
inline (ADHD design constraint: silent inner critic during drafting).

### 5A. New Index-API Endpoints

POST /api/v1/similar/text/
  Accept raw text, embed with SBERT, query pgvector for nearest
  neighbor objects. Bridge between live drafts and stored corpus.
  New function: find_similar_to_embedding() in embeddings.py

POST /api/v1/connections/draft/
  Multi-signal draft analysis: SBERT similarity, spaCy NER entity
  overlap, BM25 keyword scoring against stored objects.
  Returns ranked connections + D3-ready graph (nodes + edges).
  New module: apps/research/draft_analysis.py

POST /api/v1/claims/audit/
  NLI claim decomposition and source checking.
  Gated to revising/production stages only.

POST /api/v1/entities/extract/
  spaCy NER entity extraction for tag suggestions.

### 5B. Publishing API Proxy

New service functions: analyze_draft(), find_similar_text()
New views proxying to Index-API at editor/api/ml/ prefix

### 5C. Frontend API Client

New functions in studio-api.ts:
  analyzeDraft(), findSimilarText(), auditClaims(), extractEntities()
New types: DraftAnalysisResult, DraftConnection, SimilarObject, ClaimAuditResult

### 5D. Connection Constellation (D3 Force Graph)

Flagship visual in the Connections tab. Force-directed graph showing
the draft as center node with engine-discovered connections radiating
outward. Updates after each save.

New component: ConnectionConstellation.tsx
  Uses shared simulation.ts with PRESET_STUDIO config
  Draft node: larger, terracotta fill, pulsing glow
  Connected nodes: colored by content type, sized by score
  Edge thickness = connection strength
  Drag + zoom for exploration
  Click node to navigate to that content

Replaces RelationshipMap in the Connections tab (formerly Links).
Below the graph: ranked connection list + entity pill tags.

### 5E. Source Suggestions

In Research tab, after save: shows top 8 objects from knowledge
graph ranked by SBERT similarity to current draft.

### 5F. Gap Detection (Claim Audit)

Stage-gated (revising/production only). NLI checks claims vs
linked sources. Flags unsupported assertions. Click claim to
scroll editor to that position.

### 5G. Auto-Tag Suggestions (lowest priority)

spaCy NER extracts entities, suggests as tags.

## Batch 4: PWA Transformation (Revised)

Updated to account for ML features. Studio is now an
intelligence-augmented writing environment.

4A: Route loading states (loading.tsx skeletons)
4B: Content search in Cmd+K palette
4C: Studio PWA manifest (standalone, /studio scope)
4D: View transitions (experimental Next.js 16)
4E: Quick wins (Cmd+N, tab titles, shortcut hints)
4F: Service worker strategy for ML endpoints
    ML endpoints: NetworkOnly (not cacheable)
    Draft autosave: BackgroundSync queue
    Graceful degradation when offline
4G: Offline writing with reconnect sync
    Y.js + IndexedDB continues offline
    ML features show degraded state
    On reconnect: saves replay, engine triggers

## Execution Order

Batch 4: loading states, quick wins, Cmd+K search, PWA manifest
Batch 5: Index-API endpoints, proxy, API client, constellation,
         source suggestions, claim audit, auto-tags

## The YouTube Arc

Batches 1 through 5 tell one story:
"I built a writing tool. Then I taught it to read my research.
Then I made it an app."

Hero shot: the connection constellation appearing as you write.

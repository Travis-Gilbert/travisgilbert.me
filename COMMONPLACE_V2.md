# CommonPlace v2

A fork of the CommonPlace surface (`src/components/commonplace`, `src/app/(commonplace)`)
that connects to **Theorem's `commonplace-api` GraphQL** as its single backend,
instead of the (disconnected) Django `research_api` REST.

Branch: `commonplace-v2`. Intended deploy: `https://v2.travisgilbert.me/commonplace`
on its own Vercel project tracking this branch. `main` and the live site are untouched.

## Architecture: one GraphQL front door

```
browser ──POST /api/theorem/graphql (same-origin, no key)──▶ Next route handler
                                                              │ attaches x-api-key (server-side)
                                                              ▼
                                              Theorem commonplace-api (GraphQL)
                                                              │ (later) gRPC
                                                              ▼
                                                          Theseus (canonical)
```

- The browser never holds the Theorem key and never makes a cross-origin call.
  `src/app/api/theorem/graphql/route.ts` is the proxy; it forwards to Theorem with
  the server-side key. (SSR callers dial Theorem directly via the server env.)
- The consumer surfaces read/write through the existing `commonplace-api.ts` mapper
  seam — `src/lib/commonplace-graphql.ts` adapts the Theorem `Item`/`Collection`
  model into the existing frontend shapes (`MockNode`, `ObjectListItem`,
  `ApiObjectDetail`, `ObjectSearchResult`, `ApiCaptureResponse`), so the view
  components are unchanged.

## What is connected to GraphQL

| Surface | Function repointed | Theorem op |
|---|---|---|
| Library / Grid / Timeline | `fetchFeed` | `items` |
| Command palette / search | `searchObjects` | `search` |
| Object drawer / reader | `fetchObjectDetail` | `item(id)` |
| Capture (write) | `captureToApi` (via `syncCapture`) | `ingest` |
| Ask omnibar (agent reads + writes) | `submitQuestion` → `askViaGraph` | `ask` + `ingest` |
| Files (new) | `FilesView` builds a tree from `item.path` | `items` |

**Agents write to the UI:** an omnibar ask runs grounded retrieval over the graph
and writes its answer back as a durable `[ask, agent]` item, which appears live
across surfaces (RECENT / Library / Files) via the `captureVersion` poke.

**Still on the old REST path (honest empty/error until Theorem grows them over
gRPC→Theseus):** Notebooks, Projects, Map (graph), Engine, Models, Resurface.
These map naturally to `collections` / `briefing` / `discover` next.

## Environment

Server-only (set on Vercel; never `NEXT_PUBLIC_`):

| Var | Local default | Production |
|---|---|---|
| `THEOREM_GRAPHQL_URL` | `http://localhost:50090` | the Railway `commonplace-api` URL |
| `THEOREM_API_KEY` | `dev-key` | the instance key (`COMMONPLACE_API_KEY` on the Railway service) |
| `AUTH_SECRET` | (set any value) | a rotated secret (next-auth) |

Public:

| Var | Value |
|---|---|
| `NEXT_PUBLIC_COMMONPLACE_BACKEND` | `graphql` (default) — set `rest` to fall back to Django |

`.env.local` (gitignored) holds the local-dev values.

## Run locally

```bash
# 1. Theorem commonplace-api (from the Theorem repo)
cd apps/commonplace-api && COMMONPLACE_API_KEY=dev-key PORT=50090 cargo run --bin commonplace-api

# 2. this app
npm run dev   # http://localhost:3000/commonplace
```

## Deploy (the two outward-facing steps)

1. **Backend:** deploy `apps/commonplace-api` (Theorem repo) to Railway; note its URL
   and `COMMONPLACE_API_KEY`. (Durable RedCore backing is the named follow-up; the
   slice ships on the in-memory store.)
2. **Frontend:** create a new Vercel project from this repo with production branch
   `commonplace-v2`; set `THEOREM_GRAPHQL_URL`, `THEOREM_API_KEY`, `AUTH_SECRET`;
   assign the domain `v2.travisgilbert.me`.

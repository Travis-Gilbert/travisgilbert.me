# Implementation Plan: Theseus Reflex Node Detail

Slug: `theseus-reflex-node-detail`. Generated 2026-04-24 from `design-doc.md` and the four ADRs in `decisions/`.

This is a multi-file plan. Read this index, then execute the stage files in order.

## Goal

Wire double-click on a `cosmos.gl` graph node in `ExplorerShell` to open a Reflex-rendered node-detail page (`https://node.travisgilbert.me/n/<pk>`) in a new tab. The Reflex page renders Header, Epistemic Weight, Contributors, Connections, Provenance footer sections backed by `GET /api/v1/notebook/objects/<pk>/`. Empty-canvas double-click continues to toggle the atlas lens.

## Scope at a glance

This feature spans two repos. Every task in the stage files declares which repo via an absolute path.

- **Website** (Next.js, Vercel): `/Users/travisgilbert/Tech Dev Local/Creative/Website/`
  - One new helper module
  - One modified component (`ExplorerShell.tsx`)
  - One new env var
- **Index-API** (Django, Railway): `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/`
  - One new top-level directory `reflex_node_detail/`
  - One Dockerfile and Railway TOML
  - Three serializer additions (deferred phase 3)
  - One Railway service + custom domain

## File structure

Final layout after all four stages execute:

```
/Users/travisgilbert/Tech Dev Local/Creative/Website/
  src/
    components/theseus/explorer/
      ExplorerShell.tsx          # MODIFIED (Stage 2)
    lib/theseus/
      nodeDetailUrl.ts           # NEW (Stage 2)
      __tests__/
        nodeDetailUrl.test.ts    # NEW (Stage 2)
  .env.local.example             # MODIFIED (Stage 2)

/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/
  reflex_node_detail/                       # NEW DIR (Stage 1)
    rxconfig.py
    requirements.txt
    Dockerfile.reflex
    README.md
    reflex_node_detail/
      __init__.py
      reflex_node_detail.py
      api_client.py
      epistemic_weight.py             # pure function port of Object.epistemic_weight
      pages/
        __init__.py
        home.py
        node.py
        not_found.py
      state/
        __init__.py
        node_state.py
      components/
        __init__.py
        header.py
        epistemic_weight.py           # render layer (consumes the pure function above)
        contributors.py               # MODIFIED again in Stage 3 (server fallback)
        connections.py
        provenance.py
    tests/
      __init__.py
      test_api_client.py
      test_epistemic_weight.py        # APPENDED in Stage 3
      test_node_state.py
      test_contributors_fallback.py   # NEW in Stage 3
  railway.reflex.toml                       # NEW (Stage 1)
  apps/notebook/
    serializers.py                          # MODIFIED (Stage 3)
    views/graph.py                          # MODIFIED (Stage 3)
    tests/test_object_detail_serializer.py  # NEW (Stage 3)
```

## Stage table

| # | File | Title | Tasks | Primary delegate |
|---|------|-------|-------|------------------|
| 1 | `01-stage-reflex-skeleton.md` | Reflex skeleton + Dockerfile (Index-API repo) | 17 | django-engine-pro |
| 2 | `02-stage-website-wiring.md` | Click-to-URL helper + ExplorerShell wiring (Website repo) | 6 | nextjs-engine-pro |
| 3 | `03-stage-backend-serializer.md` | Object detail serializer enrichment (Index-API repo) | 4 | django-engine-pro |
| 4 | `04-stage-deployment.md` | Railway service, custom domain, production smoke | 4 | plan-pro (self) |

Total tasks: 31.

## Execution order

Strictly serial by stage. Stages 1 and 2 are independent on a code-only level (Stage 1 is Index-API; Stage 2 is Website), but Stage 2 task 22 references Stage 1 outputs through env vars and depends on a working `https://node.travisgilbert.me`. To avoid the chicken-and-egg, Stage 2's `nodeDetailUrl.ts` accepts a configurable base and ships with a sensible production default; the actual deployed origin is Stage 4.

Recommended order:
1. Stage 1 (Reflex code + Dockerfile, all green via `pytest` + local `reflex run` smoke)
2. Stage 2 (Website wiring, all green via Vitest + manual local check; `NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL` left as default for production)
3. Stage 3 (Backend serializer additions, deployed via the Index-API pipeline)
4. Stage 4 (Railway service stand-up, custom domain, production smoke)

If Stage 4 custom domain provisioning is blocked, the fallback path (Vercel rewrite at `/theseus/node/*`) is captured as Task 30 alt branch.

## Per-task discipline

Each stage file lists numbered tasks with: Goal (one line), Files to create/modify (absolute paths), Exact code, Verification command, Acceptance criterion, Delegate.

Hard rules enforced across every task:

- **No dashes** anywhere (em or en) in code, comments, copy, or markdown. Use colons, periods, commas, semicolons, or parentheses.
- **No mock data**, **no `TODO`/`FIXME` runtime branches**, **no fake "coming soon"**. Empty states are honest.
- **Index-API repo discipline**: stage specific files (never `git add .`); run Django import smoke before any push touching `apps/notebook/`.
- **Two repos, two `git` boundaries**: never commit Index-API files from the Website repo or vice versa.
- **Commit format**: `<type>(<scope>): <description>` with no Co-Authored-By trailer. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
- **No `--no-verify`**.

## Cross-cutting concerns

These cross task boundaries; each is owned by a specific task but called out here:

- **Gesture conflict** (per ADR 0004): Stage 2 task 20 wires `onPointDoubleClick` AND modifies the existing DOM `dblclick` listener at `ExplorerShell.tsx:79-93` to consult a ref flag. Stage 2 task 21 is the JSDOM test that proves the lens toggle does not fire on per-point double-click.
- **Recursive Reflex navigation**: Stage 1 task 12 (Connections component) renders each connection's other-side title as a link to `/n/<other_pk>`. Same Reflex page consumes the same URL.
- **Error-state retry**: Stage 1 task 14 wires the centered error banner to a button that re-runs `NodeState.load`. The retry path is exercised by Stage 1 task 5's tests.
- **OG image deferral**: Per design-doc section 10, server-side OG share image is out of scope for v1. Stage 1 task 9 (Header component) does NOT include OG image markup. This is intentional and load-bearing for the "no fake UI" rule.
- **30s TTL cache**: Stage 1 task 3 adds an in-memory dict cache to `api_client`. Stage 1 task 12 (Connections) navigates user to `/n/<other_pk>` which hits cache only when the same Reflex worker handled the previous request. This is acceptable per design doc section 4.
- **Day-1 vs deferred composition**: Day-1 (Stage 1) Reflex computes `epistemic_weight` and `contributors` client-side from existing serializer payload. Stage 3 adds them server-side. Stage 3 task 27 swaps the Reflex page to prefer the server-authoritative fields when present, with the client-side compute as fallback during rollout.
- **Auth posture**: `/api/v1/notebook/` is currently exempt from `APIKeyMiddleware`. `api_client.get_object` (Stage 1 task 2) reads optional `INTERNAL_API_KEY` and adds a Bearer header only when set. Zero-friction now, one env var when the exemption flips.

## Acceptance for the whole feature

All six checks from design-doc section 8 pass:

1. `curl https://node.travisgilbert.me/` returns 200 with the home page HTML.
2. `curl https://node.travisgilbert.me/n/1` returns 200 (with the not-found surface if pk=1 does not exist).
3. From `https://travisgilbert.me/theseus/explorer`, double-clicking a node opens a new tab at `https://node.travisgilbert.me/n/<pk>` with real data in all five sections.
4. Lens is unchanged in the Explorer tab after the per-node double-click.
5. Empty-canvas double-click still toggles the atlas lens.
6. A connection link on the Reflex page navigates to a different `/n/<other_pk>` URL with real data.

## Stage file paths (for reader convenience)

Read these in order:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/docs/plans/theseus-reflex-node-detail/01-stage-reflex-skeleton.md`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/docs/plans/theseus-reflex-node-detail/02-stage-website-wiring.md`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/docs/plans/theseus-reflex-node-detail/03-stage-backend-serializer.md`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/docs/plans/theseus-reflex-node-detail/04-stage-deployment.md`

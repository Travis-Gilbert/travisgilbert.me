# ADR 0001: Deploy Reflex as a standalone Railway service

## Status
Accepted

## Context
The Theseus Reflex node-detail page needs a runtime. The user named Reflex as the framework. Index-API already runs on Railway with two services (web, worker). Three deployment shapes are viable: (1) standalone Railway service, (2) co-deployed inside Index-API as a sibling ASGI app, (3) Vercel-proxied subpath of the main site backed by a Railway service. Each has different release-cadence, networking, and operator-story implications.

## Decision
Deploy Reflex as a new standalone Railway service named `reflex-node-detail`, in the same repo as Index-API, with its own `Dockerfile.reflex` and `railway.reflex.toml`. Public hostname `node.travisgilbert.me` via Railway custom domain.

## Consequences
- Independent release cadence from the engine. Reflex deploys do not risk the DRF API.
- Familiar shape (matches the existing web/worker split). Reflex talks to Index-API as a normal HTTP client, which keeps the auth-exemption flip a single env-var change.
- Clean rollback. Service can be paused without touching the engine.
- A third Railway service to operate (env vars, logs, uptime). Modest operational overhead.
- An HTTP hop per page load (Reflex backend to Index-API). Mitigated by 30-second TTL cache in `api_client.py`.
- Reversible: if we later want to fold Reflex into Index-API, the code lives in the same repo and the move is a Dockerfile and `urls.py` change.

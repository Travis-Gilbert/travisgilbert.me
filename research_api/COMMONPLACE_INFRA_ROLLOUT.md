# CommonPlace Infra Rollout (Post-Merge)

This checklist applies after merge to `main` and targets the Pass 1-3 + infra-core scope.

## 1. Environment Variables

Set these on the Research API service:

- `DATABASE_URL` (PostgreSQL)
- `REDIS_URL`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_STORAGE_BUCKET_NAME`
- `AWS_S3_REGION_NAME` (usually `us-east-1`)

Optional:

- `MODAL_TOKEN_ID`
- `MODAL_TOKEN_SECRET`

## 2. Apply Migrations

```bash
python manage.py migrate --noinput
```

This includes `notebook.0005_postgres_search_vector` (Postgres-only SQL for `search_vector` + GIN index).

## 3. Deploy Mode Options

### Option A: Single Service (default)

Current `railway.toml` starts both web + worker in one service.

### Option B: Separate Worker Service (recommended)

Create a second Railway service from the same repo and use:

```bash
python manage.py migrate --noinput && python manage.py rqworker default engine ingestion --with-scheduler
```

Keep the web service running gunicorn only.

## 4. Smoke Tests

Run once deployed:

1. `POST /api/v1/notebook/compose/related/` with a >20 char text
2. `POST /api/v1/notebook/capture/` with a file upload
3. `GET /api/v1/notebook/export/`
4. `GET /api/v1/notebook/objects/?q=<query>&limit=10`

Expected:

- Compose returns `passes_run`, `objects`, and `degraded`
- Captured objects include persisted file keys/metadata
- Export returns ZIP with `objects.json`, `edges.json`, `nodes.json`, `components.json`, `manifest.json`, and `files/`
- Search returns ranked results on Postgres and deterministic fallback elsewhere

## 5. Notes

- Multi-user migration is intentionally deferred.
- If Redis is unavailable, cache/rate-limit behavior falls back safely.
- If SBERT/KGE are unavailable, compose still returns valid results with degraded metadata.

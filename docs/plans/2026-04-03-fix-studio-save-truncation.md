# Fix Spec: Studio Save Failure (StringDataRightTruncation)

## META
Status: LOCKED
Spec version: 1.0
Author: Travis via spec-compliance
Date: 2026-04-03
Implements: Production 500 error on POST /editor/api/content/{type}/{slug}/update/

## DIAGNOSIS

The production deploy logs show:
```
psycopg2.errors.StringDataRightTruncation: value too long for type character varying(200)
```

The frontend sends an auto-generated `excerpt` (up to ~220 chars) which maps to the
Essay model's `summary` field (`CharField(max_length=200)`). Postgres rejects the
INSERT/UPDATE and Django returns a 500.

## SCOPE

Files to modify:
- `publishing_api/apps/editor/views.py`
- `publishing_api/apps/content/models.py`

Files that MUST NOT be modified:
- Any file outside `publishing_api/`
- `publishing_api/apps/editor/urls.py`
- `publishing_api/apps/editor/auth.py`
- `publishing_api/config/urls.py`

## REQUIREMENTS

### Batch 1: Backend defense in _update_instance_from_payload

MUST: In `publishing_api/apps/editor/views.py`, find the function `_update_instance_from_payload`

MUST: Replace the excerpt assignment block. Find this exact code:

```python
    excerpt_field = config.get("excerpt_field")
    if "excerpt" in payload and excerpt_field:
        setattr(instance, excerpt_field, payload.get("excerpt") or "")
```

MUST: Replace it with:

```python
    excerpt_field = config.get("excerpt_field")
    if "excerpt" in payload and excerpt_field:
        raw_excerpt = payload.get("excerpt") or ""
        try:
            max_len = instance._meta.get_field(excerpt_field).max_length
        except Exception:
            max_len = None
        if max_len and len(raw_excerpt) > max_len:
            raw_excerpt = raw_excerpt[:max_len]
        setattr(instance, excerpt_field, raw_excerpt)
```

MUST NOT: Change any other line in `_update_instance_from_payload`
MUST NOT: Change the function signature
MUST NOT: Add imports for this change (it uses only builtins and Django model _meta)

VERIFY: `grep -A 8 "excerpt_field = config.get" publishing_api/apps/editor/views.py` shows the new truncation logic
VERIFY: `cd publishing_api && python manage.py check` completes with zero errors

### Batch 2: Widen Essay.summary field

MUST: In `publishing_api/apps/content/models.py`, find the Essay model's `summary` field

MUST: Find this exact line:
```python
    summary = models.CharField(max_length=200)
```

MUST: Replace it with:
```python
    summary = models.CharField(max_length=500, blank=True, default="")
```

MUST: `blank=True, default=""` is added because the frontend sometimes sends empty excerpts and the field currently has no default, which could cause issues on create

MUST NOT: Change any other field on the Essay model
MUST NOT: Change any other model in models.py

VERIFY: `grep "summary = models.CharField" publishing_api/apps/content/models.py` shows `max_length=500, blank=True, default=""`

### Batch 3: Generate and apply migration

MUST: Run `cd publishing_api && python manage.py makemigrations content --name widen_essay_summary`
MUST: Confirm the migration file is created in `publishing_api/apps/content/migrations/`
MUST: The migration should contain a single AlterField operation on Essay.summary

MUST NOT: Create any data migration
MUST NOT: Modify any existing migration files

VERIFY: The generated migration contains `field=models.CharField(max_length=500`
VERIFY: `cd publishing_api && python manage.py migrate --check` reports the new migration as pending (expected pre-deploy)

## CONFLICT PROTOCOL

IF CONFLICT: This spec takes precedence over existing code.
IF CONFLICT: If a MUST cannot be met, STOP and report. Do not resolve independently.
IF CONFLICT: If you believe a requirement is wrong, implement it anyway and note your concern afterward.

## DEPLOYMENT NOTE

After merging, Railway will auto-deploy the Studio backend service. The `railway.toml`
start command includes `python manage.py migrate --noinput`, so the migration will
apply automatically on deploy. No manual Railway action needed.

## COMPLETION CHECKLIST

Run all VERIFY statements in order. Report pass/fail for each.
If any VERIFY fails, fix and re-run before marking complete.
Do not mark the session complete with failing verifications.

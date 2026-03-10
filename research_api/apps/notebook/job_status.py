"""
Cache-backed engine job status tracking for CommonPlace capture flows.

The engine already runs asynchronously through django-rq when available, but
the frontend needs a stable job identifier and a lightweight status endpoint.
This module keeps the public status contract independent from RQ internals and
still works when the queue falls back to inline execution.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.core.cache import cache

ENGINE_JOB_TTL_SECONDS = 24 * 60 * 60
ENGINE_JOB_CACHE_PREFIX = 'notebook:engine-job:'


def create_engine_job_id() -> str:
    """Generate a stable public-facing engine job identifier."""
    return uuid.uuid4().hex


def _cache_key(job_id: str) -> str:
    return f'{ENGINE_JOB_CACHE_PREFIX}{job_id}'


def update_engine_job_status(
    job_id: str,
    status: str,
    *,
    summary: dict[str, Any] | None = None,
    error: str = '',
    object_id: int | None = None,
    object_slug: str = '',
    object_title: str = '',
) -> dict[str, Any]:
    """
    Upsert engine job state in cache and return the stored payload.

    Status values are intentionally simple for the frontend:
      queued | running | complete | failed
    """
    existing = cache.get(_cache_key(job_id)) or {}
    payload = {
        'job_id': job_id,
        'status': status,
        'summary': summary if summary is not None else existing.get('summary') or {},
        'error': error or existing.get('error', ''),
        'object_id': object_id if object_id is not None else existing.get('object_id'),
        'object_slug': object_slug or existing.get('object_slug', ''),
        'object_title': object_title or existing.get('object_title', ''),
    }
    cache.set(_cache_key(job_id), payload, timeout=ENGINE_JOB_TTL_SECONDS)
    return payload


def get_engine_job_status(job_id: str) -> dict[str, Any] | None:
    """Fetch the cached engine job payload, if present."""
    return cache.get(_cache_key(job_id))

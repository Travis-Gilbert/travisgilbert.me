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
from django.utils import timezone

ENGINE_JOB_TTL_SECONDS = 24 * 60 * 60
ENGINE_JOB_CACHE_PREFIX = 'notebook:engine-job:'
BATCH_JOB_CACHE_PREFIX = 'notebook:batch-job:'
REORGANIZE_JOB_CACHE_PREFIX = 'notebook:reorganize-job:'
REORGANIZE_LATEST_CACHE_KEY = 'notebook:reorganize-latest'


def create_engine_job_id() -> str:
    """Generate a stable public-facing engine job identifier."""
    return uuid.uuid4().hex


def _cache_key(job_id: str) -> str:
    return f'{ENGINE_JOB_CACHE_PREFIX}{job_id}'


def _batch_cache_key(job_id: str) -> str:
    return f'{BATCH_JOB_CACHE_PREFIX}{job_id}'


def _reorganize_cache_key(job_id: str) -> str:
    return f'{REORGANIZE_JOB_CACHE_PREFIX}{job_id}'


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
    now_iso = timezone.now().isoformat()
    payload = {
        'job_id': job_id,
        'status': status,
        'summary': summary if summary is not None else existing.get('summary') or {},
        'error': error or existing.get('error', ''),
        'object_id': object_id if object_id is not None else existing.get('object_id'),
        'object_slug': object_slug or existing.get('object_slug', ''),
        'object_title': object_title or existing.get('object_title', ''),
        'created_at': existing.get('created_at') or now_iso,
        'updated_at': now_iso,
    }
    cache.set(_cache_key(job_id), payload, timeout=ENGINE_JOB_TTL_SECONDS)
    return payload


def get_engine_job_status(job_id: str) -> dict[str, Any] | None:
    """Fetch the cached engine job payload, if present."""
    return cache.get(_cache_key(job_id))


def create_batch_job_id() -> str:
    """Generate a stable public-facing batch ingestion identifier."""
    return uuid.uuid4().hex


def update_batch_job_status(
    job_id: str,
    status: str,
    *,
    batch_id: str = '',
    notebook_slug: str = '',
    total_files: int | None = None,
    processed_files: int | None = None,
    objects_created: int | None = None,
    failed_files: int | None = None,
    clusters_created: int | None = None,
    error: str = '',
    rq_job_id: str = '',
) -> dict[str, Any]:
    """
    Upsert batch ingestion state in cache and return the stored payload.

    Status values mirror the engine job contract:
      queued | running | complete | failed
    """
    existing = cache.get(_batch_cache_key(job_id)) or {}
    now_iso = timezone.now().isoformat()
    payload = {
        'job_id': job_id,
        'batch_id': batch_id or existing.get('batch_id', ''),
        'status': status,
        'notebook_slug': notebook_slug or existing.get('notebook_slug', ''),
        'total_files': total_files if total_files is not None else existing.get('total_files', 0),
        'processed_files': processed_files if processed_files is not None else existing.get('processed_files', 0),
        'objects_created': objects_created if objects_created is not None else existing.get('objects_created', 0),
        'failed_files': failed_files if failed_files is not None else existing.get('failed_files', 0),
        'clusters_created': clusters_created if clusters_created is not None else existing.get('clusters_created', 0),
        'error': error or existing.get('error', ''),
        'rq_job_id': rq_job_id or existing.get('rq_job_id', ''),
        'created_at': existing.get('created_at') or now_iso,
        'updated_at': now_iso,
    }
    cache.set(_batch_cache_key(job_id), payload, timeout=ENGINE_JOB_TTL_SECONDS)
    return payload


def get_batch_job_status(job_id: str) -> dict[str, Any] | None:
    """Fetch the cached batch job payload, if present."""
    return cache.get(_batch_cache_key(job_id))


def create_reorganize_job_id() -> str:
    """Generate a stable public-facing periodic-reorganize job identifier."""
    return uuid.uuid4().hex


def update_reorganize_job_status(
    job_id: str,
    status: str,
    *,
    summary: dict[str, Any] | None = None,
    error: str = '',
    rq_job_id: str = '',
) -> dict[str, Any]:
    """
    Upsert self-organization job state in cache and return the stored payload.
    """
    existing = cache.get(_reorganize_cache_key(job_id)) or {}
    now_iso = timezone.now().isoformat()
    payload = {
        'job_id': job_id,
        'status': status,
        'summary': summary if summary is not None else existing.get('summary') or {},
        'error': error or existing.get('error', ''),
        'rq_job_id': rq_job_id or existing.get('rq_job_id', ''),
        'created_at': existing.get('created_at') or now_iso,
        'updated_at': now_iso,
    }
    cache.set(_reorganize_cache_key(job_id), payload, timeout=ENGINE_JOB_TTL_SECONDS)
    if status == 'complete':
        cache.set(REORGANIZE_LATEST_CACHE_KEY, payload, timeout=ENGINE_JOB_TTL_SECONDS)
    return payload


def get_reorganize_job_status(job_id: str) -> dict[str, Any] | None:
    """Fetch the cached reorganize-job payload, if present."""
    return cache.get(_reorganize_cache_key(job_id))


def get_latest_reorganize_status() -> dict[str, Any] | None:
    """Fetch the latest completed reorganize-job payload, if present."""
    return cache.get(REORGANIZE_LATEST_CACHE_KEY)

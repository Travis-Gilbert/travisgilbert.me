"""
Service layer for the CommonPlace knowledge graph.

enrich_url(): Fetch OG metadata and update an Object.
quick_capture(): Create an Object from raw input (text, URL, or both).
store_uploaded_file(): Persist original file to S3 for re-processing.

Background engine execution is handled by django-rq tasks (see tasks.py).
The old threading.Thread approach has been replaced with durable task queues.
"""

import logging
from urllib.parse import urlparse

import requests
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.utils import timezone

from .job_status import create_engine_job_id, update_engine_job_status
from .models import Node, Notebook, Object, ObjectType, Project, Timeline

logger = logging.getLogger(__name__)

OG_TAGS = {
    'og:title': 'og_title',
    'og:description': 'og_description',
    'og:image': 'og_image',
    'og:site_name': 'og_site_name',
}

TIMEOUT = 10  # seconds


# ---------------------------------------------------------------------------
# URL enrichment
# ---------------------------------------------------------------------------

def enrich_url(obj: Object) -> dict:
    """
    Fetch OG metadata from an Object's URL and update OG fields.

    Returns dict of fields that were updated (empty if nothing changed
    or the fetch failed).
    """
    if not obj.url:
        return {}

    try:
        resp = requests.get(
            obj.url,
            timeout=TIMEOUT,
            headers={'User-Agent': 'CommonPlace/1.0 (research bot)'},
            allow_redirects=True,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning('OG fetch failed for %s: %s', obj.url, exc)
        return {}

    html = resp.text
    updated = {}

    import re

    for og_property, model_field in OG_TAGS.items():
        pattern = (
            rf'<meta\s+[^>]*property=["\']?{re.escape(og_property)}["\']?'
            rf'\s+[^>]*content=["\']([^"\']*)["\']'
        )
        match = re.search(pattern, html, re.IGNORECASE)
        if not match:
            pattern = (
                rf'<meta\s+[^>]*content=["\']([^"\']*)["\']'
                rf'\s+[^>]*property=["\']?{re.escape(og_property)}["\']?'
            )
            match = re.search(pattern, html, re.IGNORECASE)

        if match:
            value = match.group(1).strip()
            if value:
                updated[model_field] = value

    if updated:
        Object.objects.filter(pk=obj.pk).update(**updated)
        obj.refresh_from_db()
        logger.info('Enriched Object %s with OG: %s', obj.pk, list(updated.keys()))

        if updated.get('og_title') and obj.title == obj.url:
            Object.objects.filter(pk=obj.pk).update(title=updated['og_title'])
            obj.refresh_from_db()

    return updated


# ---------------------------------------------------------------------------
# File storage (S3 or local)
# ---------------------------------------------------------------------------

def store_uploaded_file(obj: Object, file_bytes: bytes, filename: str,
                        content_type: str = '') -> str:
    """
    Persist the original uploaded file to storage (S3 in production,
    local filesystem in development).

    Returns the storage key for later retrieval.
    Stores file metadata in the Object's properties field.
    """
    file_key = f'objects/{obj.sha_hash}/{filename}'

    try:
        default_storage.save(file_key, ContentFile(file_bytes))
        logger.info('Stored file %s for Object %s', file_key, obj.pk)

        # Record file metadata on the Object
        props = obj.properties or {}
        props['file_key'] = file_key
        props['file_name'] = filename
        props['file_size'] = len(file_bytes)
        props['file_mime'] = content_type
        Object.objects.filter(pk=obj.pk).update(properties=props)

        return file_key
    except Exception as exc:
        logger.warning('File storage failed for %s: %s', filename, exc)
        return ''


def get_file_url(file_key: str) -> str:
    """
    Get a URL for a stored file. Returns a signed S3 URL in production,
    or a local media URL in development.
    """
    if not file_key:
        return ''
    try:
        return default_storage.url(file_key)
    except Exception:
        return ''


# ---------------------------------------------------------------------------
# QuickCapture
# ---------------------------------------------------------------------------

def quick_capture(
    body: str = '',
    url: str = '',
    title: str = '',
    object_type_slug: str = '',
    notebook_slug: str = '',
    project_slug: str = '',
    file_bytes: bytes = b'',
    filename: str = '',
    file_content_type: str = '',
    dispatch_engine: bool = True,
) -> tuple[Object, str]:
    """
    Create an Object from raw input.

    Auto-detects type based on input:
      URL provided -> Source
      File provided -> Source (PDF, DOCX) or Note (image, text)
      Text only    -> Note

    Returns the created Object and the public engine job id. Also triggers:
    1. URL enrichment (synchronous, fast)
    2. File storage to S3 (synchronous, fast)
    3. File text extraction (synchronous for Tier 1)
    4. Connection engine (async via RQ task queue)
    5. Heavy file processing (async via RQ if needed)
    """
    # Resolve type
    if object_type_slug:
        object_type = ObjectType.objects.filter(slug=object_type_slug).first()
    elif url:
        object_type = ObjectType.objects.filter(slug='source').first()
    elif file_bytes and _is_document_file(filename):
        object_type = ObjectType.objects.filter(slug='source').first()
    else:
        object_type = ObjectType.objects.filter(slug='note').first()

    if not object_type:
        object_type = ObjectType.objects.first()

    # Resolve title
    if not title:
        if url:
            parsed = urlparse(url)
            title = parsed.netloc + parsed.path[:50]
        elif filename:
            title = filename
        elif body:
            title = body[:80].split('\n')[0]
        else:
            title = f'Capture {timezone.now().strftime("%Y-%m-%d %H:%M")}'

    # Resolve notebook and project
    notebook = None
    project = None

    if notebook_slug:
        notebook = Notebook.objects.filter(slug=notebook_slug).first()

    if project_slug:
        project = Project.objects.filter(slug=project_slug).first()

    # Extract text from file (Tier 1: synchronous, fast)
    if file_bytes and not body:
        from .file_ingestion import extract_file_content
        extracted = extract_file_content(file_bytes, filename, file_content_type)
        if extracted.get('body'):
            body = extracted['body']
        if extracted.get('title') and title == filename:
            title = extracted['title']
        if extracted.get('author'):
            # Will be stored as a Component after Object creation
            pass

    obj = Object.objects.create(
        title=title,
        object_type=object_type,
        body=body,
        url=url,
        status='active',
        capture_method='api',
        notebook=notebook,
        project=project,
    )

    # Enrich URL if provided (synchronous: fast, updates title)
    if url:
        enrich_url(obj)

    # Store uploaded file to S3 (synchronous: fast upload)
    file_key = ''
    if file_bytes:
        file_key = store_uploaded_file(
            obj, file_bytes, filename, file_content_type
        )

    # Run connection engine (queue-backed when available, inline fallback otherwise).
    engine_job_id = ''
    if dispatch_engine:
        engine_job_id = str(_dispatch_engine_job(obj.pk, notebook_slug=notebook_slug))

    # Queue heavy file processing if needed (SAM-2 via Modal, etc.)
    if file_key and _needs_heavy_processing(filename):
        _dispatch_file_ingestion_job(obj.pk, file_key)

    return obj, engine_job_id


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _dispatch_engine_job(obj_pk: int, notebook_slug: str = '') -> str:
    """
    Dispatch engine work to RQ, with synchronous fallback for single-service mode.
    """
    engine_job_id = create_engine_job_id()
    update_engine_job_status(engine_job_id, 'queued', object_id=obj_pk)

    try:
        from .tasks import run_engine_task
        run_engine_task.delay(
            obj_pk,
            notebook_slug=notebook_slug,
            engine_job_id=engine_job_id,
        )
        return engine_job_id
    except Exception as exc:
        logger.warning('Engine queue dispatch failed, falling back inline: %s', exc)

    try:
        from .engine import run_engine

        obj = Object.objects.get(pk=obj_pk)
        notebook = Notebook.objects.filter(slug=notebook_slug).first() if notebook_slug else None
        update_engine_job_status(
            engine_job_id,
            'running',
            object_id=obj.pk,
            object_slug=obj.slug,
            object_title=obj.display_title,
        )
        summary = run_engine(obj, notebook=notebook)
        update_engine_job_status(
            engine_job_id,
            'complete',
            summary=summary,
            object_id=obj.pk,
            object_slug=obj.slug,
            object_title=obj.display_title,
        )
    except Exception as exc:
        logger.warning('Inline engine fallback failed for Object %s: %s', obj_pk, exc)
        update_engine_job_status(
            engine_job_id,
            'failed',
            error=str(exc),
            object_id=obj_pk,
        )

    return engine_job_id


def _dispatch_file_ingestion_job(obj_pk: int, file_key: str) -> None:
    """Dispatch heavy ingestion to queue; no-op fallback if queue unavailable."""
    try:
        from .tasks import run_file_ingestion_task
        run_file_ingestion_task.delay(obj_pk, file_key)
    except Exception as exc:
        logger.warning('Ingestion queue dispatch failed for Object %s: %s', obj_pk, exc)


def _is_document_file(filename: str) -> bool:
    """Check if a filename indicates a document (Source-typed)."""
    doc_extensions = ('.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt')
    return any(filename.lower().endswith(ext) for ext in doc_extensions)


def _needs_heavy_processing(filename: str) -> bool:
    """Check if a file needs async Tier 2 processing (SAM-2, etc.)."""
    from django.conf import settings
    if not settings.MODAL_ENABLED:
        return False
    image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp')
    return any(filename.lower().endswith(ext) for ext in image_extensions)

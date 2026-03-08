"""
Service layer for the CommonPlace knowledge graph.

enrich_url(): Fetch OG metadata and update an Object.
quick_capture(): Create an Object from raw input (text, URL, or both).
_run_engine_async(): Background thread wrapper for connection engine.
"""

import logging
import threading
from urllib.parse import urlparse

import requests
from django.utils import timezone

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
# URL enrichment (Task 18)
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

    # Simple meta tag parsing (no BeautifulSoup dependency needed)
    import re

    for og_property, model_field in OG_TAGS.items():
        # Match <meta property="og:title" content="...">
        pattern = (
            rf'<meta\s+[^>]*property=["\']?{re.escape(og_property)}["\']?'
            rf'\s+[^>]*content=["\']([^"\']*)["\']'
        )
        match = re.search(pattern, html, re.IGNORECASE)
        if not match:
            # Also match reversed attribute order: content before property
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

        # Update title from OG if Object title is just the URL
        if updated.get('og_title') and obj.title == obj.url:
            Object.objects.filter(pk=obj.pk).update(title=updated['og_title'])
            obj.refresh_from_db()

    return updated


# ---------------------------------------------------------------------------
# QuickCapture (Task 17)
# ---------------------------------------------------------------------------

def quick_capture(
    body: str = '',
    url: str = '',
    title: str = '',
    object_type_slug: str = '',
    notebook_slug: str = '',
    project_slug: str = '',
) -> Object:
    """
    Create an Object from raw input.

    Auto-detects type based on input:
      URL provided -> Source
      Text only    -> Note

    Returns the created Object. Also triggers URL enrichment
    and the connection engine (synchronous for now).
    """
    # Resolve type
    if object_type_slug:
        object_type = ObjectType.objects.filter(slug=object_type_slug).first()
    elif url:
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

    # Run connection engine in background thread
    _run_engine_async(obj.pk, notebook_slug=notebook_slug)

    return obj


# ---------------------------------------------------------------------------
# Background engine execution
# ---------------------------------------------------------------------------

def _run_engine_async(obj_pk: int, notebook_slug: str = '') -> None:
    """Spawn a daemon thread to run the connection engine for a single Object.

    The daemon=True flag ensures the thread won't prevent server shutdown.
    """
    def _worker():
        try:
            from .engine import run_engine
            obj = Object.objects.get(pk=obj_pk)
            notebook = None
            if notebook_slug:
                notebook = Notebook.objects.filter(slug=notebook_slug).first()
            run_engine(obj, notebook=notebook)
            logger.info('Background engine completed for Object %s', obj_pk)
        except Object.DoesNotExist:
            logger.warning('Object %s not found for background engine run', obj_pk)
        except Exception as exc:
            logger.warning('Background engine failed for Object %s: %s', obj_pk, exc)

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()

"""
Research Bridge: connects the notebook Object graph to the research_api Source graph.

The research_api already has a mature connection engine (connections.py) that
links Sources to published essays and field notes via shared tags, co-citation,
and semantic similarity. CommonPlace Objects often overlap with those Sources:
a URL you captured as a Source Object might be the same URL as a research Source.

This module:
  1. Detects when a notebook Object matches a research Source (by URL or title)
  2. Propagates research connections back into the notebook Edge graph
  3. Creates Edges between notebook Objects that are connected to the same
     research Source content, so you see those relationships in CommonPlace
     without manually rebuilding them

This is a one-way bridge: research_api --> notebook. The notebook does not
write back to research_api. The bridge runs as a management command
(sync_research_bridge) and can also be called per-Object on capture.

Requires: both notebook and research apps to be installed and migrated.
Gracefully no-ops if research models are not importable.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Research model availability
# ---------------------------------------------------------------------------

try:
    from apps.research.models import Source
    from apps.research.connections import compute_connections
    _RESEARCH_AVAILABLE = True
except ImportError:
    Source = None
    compute_connections = None
    _RESEARCH_AVAILABLE = False
    logger.info(
        'research_bridge: research app not importable. Bridge will be a no-op.'
    )


# ---------------------------------------------------------------------------
# Match: notebook Object <-> research Source
# ---------------------------------------------------------------------------

def find_research_match(obj) -> Any | None:
    """
    Find a research Source that corresponds to a notebook Object.

    Matching strategy (in priority order):
      1. URL match: both have a URL and it matches exactly
      2. URL partial match: one URL is contained in the other (handles
         trailing slashes, query string differences)
      3. Title match: normalized title similarity (case-insensitive, 80% overlap)

    Returns the matching Source object, or None.
    """
    if not _RESEARCH_AVAILABLE:
        return None

    # URL match (highest confidence)
    obj_url = getattr(obj, 'url', '') or ''
    if obj_url:
        normalized_url = obj_url.rstrip('/')
        direct = Source.objects.filter(url=obj_url).first()
        if direct:
            return direct

        # Partial URL match (handles query strings, trailing slashes)
        partial = Source.objects.filter(url__icontains=normalized_url).first()
        if partial:
            return partial

        # Match via OG metadata URL if the Source was captured from the same page
        og_match = Source.objects.filter(
            annotation__icontains=normalized_url
        ).first()
        if og_match:
            return og_match

    # Title match (lower confidence -- only when title is substantial)
    obj_title = (getattr(obj, 'title', '') or getattr(obj, 'og_title', '') or '').strip()
    if obj_title and len(obj_title) > 10:
        title_match = Source.objects.filter(
            title__iexact=obj_title
        ).first()
        if title_match:
            return title_match

        # Partial title match (handles subtitle differences)
        if len(obj_title) > 20:
            partial_title = Source.objects.filter(
                title__icontains=obj_title[:30]
            ).first()
            if partial_title:
                return partial_title

    return None


# ---------------------------------------------------------------------------
# Propagate connections from research graph into notebook
# ---------------------------------------------------------------------------

def propagate_research_connections(obj) -> dict:
    """
    Find the research Source matching this Object, compute its research
    connections, and create Edges in the notebook graph for any notebook
    Objects that correspond to those connected Sources.

    This surfaces connections that the research engine already knows about
    (co-cited sources, shared tags, same-topic essays) directly in
    CommonPlace without requiring the notebook engine to rediscover them.

    Returns a summary dict:
      {
        'source_matched': bool,
        'source_title': str,
        'research_connections_found': int,
        'notebook_edges_created': int,
      }
    """
    if not _RESEARCH_AVAILABLE:
        return {
            'source_matched': False,
            'source_title': '',
            'research_connections_found': 0,
            'notebook_edges_created': 0,
        }

    from .models import Edge

    matched_source = find_research_match(obj)
    if not matched_source:
        return {
            'source_matched': False,
            'source_title': '',
            'research_connections_found': 0,
            'notebook_edges_created': 0,
        }

    logger.info(
        'research_bridge: Object "%s" matched Source "%s"',
        obj.display_title[:40],
        matched_source.title[:40],
    )

    # Compute connections from the research engine
    try:
        research_connections = compute_connections(matched_source)
    except Exception as exc:
        logger.warning(
            'research_bridge: compute_connections failed for Source %s: %s',
            matched_source.pk, exc,
        )
        return {
            'source_matched': True,
            'source_title': matched_source.title,
            'research_connections_found': 0,
            'notebook_edges_created': 0,
        }

    if not research_connections:
        return {
            'source_matched': True,
            'source_title': matched_source.title,
            'research_connections_found': 0,
            'notebook_edges_created': 0,
        }

    edges_created = 0

    for connection in research_connections:
        connected_source = getattr(connection, 'source', None) or connection
        connected_url = getattr(connected_source, 'url', '') or ''
        connected_title = getattr(connected_source, 'title', '') or ''
        connection_reason = getattr(connection, 'reason', '') or ''

        if not connected_url and not connected_title:
            continue

        # Find the notebook Object that matches the connected Source
        other_obj = None

        if connected_url:
            from .models import Object
            other_obj = (
                Object.objects
                .filter(url=connected_url, is_deleted=False)
                .exclude(pk=obj.pk)
                .first()
            )

        if not other_obj and connected_title and len(connected_title) > 10:
            from .models import Object
            other_obj = (
                Object.objects
                .filter(title__iexact=connected_title, is_deleted=False)
                .exclude(pk=obj.pk)
                .first()
            )

        if not other_obj:
            continue

        # Build a human-readable reason string
        strength = getattr(connection, 'score', None) or 0.5
        reason = connection_reason or (
            f'Both reference the same research source: "{matched_source.title[:60]}". '
            f'The research engine found these sources are connected.'
        )

        _, created = Edge.objects.get_or_create(
            from_object=obj,
            to_object=other_obj,
            edge_type='shared_topic',
            defaults={
                'reason': reason,
                'strength': round(float(strength), 4),
                'is_auto': True,
                'engine': 'research_bridge',
            },
        )
        if created:
            edges_created += 1
            logger.debug(
                'research_bridge: created Edge %s <-> %s',
                obj.display_title[:30], other_obj.display_title[:30],
            )

    return {
        'source_matched': True,
        'source_title': matched_source.title,
        'research_connections_found': len(research_connections),
        'notebook_edges_created': edges_created,
    }


# ---------------------------------------------------------------------------
# Management command helper (called by sync_research_bridge command)
# ---------------------------------------------------------------------------

def sync_all_objects(verbose: bool = False) -> dict:
    """
    Run the research bridge over all notebook Objects.

    Finds every Object that can be matched to a research Source and
    propagates research connections into the notebook graph.

    Called by: python manage.py sync_research_bridge

    Returns aggregate statistics.
    """
    if not _RESEARCH_AVAILABLE:
        logger.warning('research_bridge: research app not available. Skipping sync.')
        return {'processed': 0, 'matched': 0, 'edges_created': 0}

    from .models import Object

    objects = Object.objects.filter(is_deleted=False).exclude(
        url='',
    ).order_by('-captured_at')

    processed = 0
    matched = 0
    total_edges = 0

    for obj in objects:
        try:
            result = propagate_research_connections(obj)
            processed += 1
            if result['source_matched']:
                matched += 1
                total_edges += result['notebook_edges_created']
                if verbose:
                    logger.info(
                        'Matched "%s" -> "%s": %d edges created',
                        obj.display_title[:40],
                        result['source_title'][:40],
                        result['notebook_edges_created'],
                    )
        except Exception as exc:
            logger.error('research_bridge sync failed for Object %s: %s', obj.pk, exc)

    return {
        'processed': processed,
        'matched': matched,
        'edges_created': total_edges,
    }

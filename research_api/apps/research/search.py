"""
Full-text search service for sources and threads.

Uses PostgreSQL full-text search (SearchVector, SearchQuery, SearchRank)
in production, and falls back to basic icontains filtering on SQLite
for local development and testing.

The search_vector field on Source is populated by a post_save signal
and the rebuild_search_index management command.
"""

import math

from django.db import connection
from django.db.models import Q, Value, CharField, FloatField
from django.db.models.functions import Coalesce

from apps.research.models import Source, ResearchThread

# Check if we're running PostgreSQL
_is_postgres = None


def is_postgres():
    global _is_postgres
    if _is_postgres is None:
        _is_postgres = connection.vendor == 'postgresql'
    return _is_postgres


def search_sources(query, source_type=None, tag=None, thread_slug=None):
    """
    Search sources by query string.

    Returns a queryset annotated with `rank` (float) and `snippet` (str).
    On PostgreSQL, uses full-text search with ts_rank.
    On SQLite, uses icontains across searchable fields.
    """
    qs = Source.objects.public()

    # Apply filters
    if source_type:
        qs = qs.filter(source_type=source_type)
    if tag:
        if is_postgres():
            qs = qs.filter(tags__contains=[tag])
        else:
            # SQLite: JSON __contains not supported, use text search
            qs = qs.filter(tags__icontains=tag)
    if thread_slug:
        qs = qs.filter(
            thread_entries__thread__slug=thread_slug,
        ).distinct()

    if is_postgres():
        return _search_sources_postgres(qs, query)
    return _search_sources_sqlite(qs, query)


def _search_sources_postgres(qs, query):
    """PostgreSQL full-text search with ranking and headlines."""
    from django.contrib.postgres.search import (
        SearchQuery,
        SearchHeadline,
        SearchRank,
    )

    search_query = SearchQuery(query, search_type='websearch')

    qs = (
        qs
        .filter(search_vector=search_query)
        .annotate(
            rank=SearchRank('search_vector', search_query),
            snippet=SearchHeadline(
                'public_annotation',
                search_query,
                start_sel='<b>',
                stop_sel='</b>',
                max_words=35,
                min_words=15,
            ),
        )
        .order_by('-rank')
    )
    return qs


def _search_sources_sqlite(qs, query):
    """SQLite fallback: icontains across searchable fields."""
    terms = query.split()
    combined = Q()
    for term in terms:
        combined &= (
            Q(title__icontains=term)
            | Q(creator__icontains=term)
            | Q(public_annotation__icontains=term)
            | Q(publication__icontains=term)
        )

    qs = (
        qs
        .filter(combined)
        .annotate(
            rank=Value(1.0, output_field=FloatField()),
            snippet=Coalesce('public_annotation', Value(''), output_field=CharField()),
        )
        .order_by('-created_at')
    )
    return qs


def search_threads(query):
    """
    Search research threads by title and description.

    Returns a queryset annotated with `rank` and `snippet`.
    """
    qs = ResearchThread.objects.public()

    if is_postgres():
        return _search_threads_postgres(qs, query)
    return _search_threads_sqlite(qs, query)


def _search_threads_postgres(qs, query):
    """PostgreSQL full-text search on threads."""
    from django.contrib.postgres.search import (
        SearchQuery,
        SearchHeadline,
        SearchRank,
        SearchVector,
    )

    search_query = SearchQuery(query, search_type='websearch')
    vector = (
        SearchVector('title', weight='A')
        + SearchVector('description', weight='B')
    )

    qs = (
        qs
        .annotate(search_vector=vector)
        .filter(search_vector=search_query)
        .annotate(
            rank=SearchRank(vector, search_query),
            snippet=SearchHeadline(
                'description',
                search_query,
                start_sel='<b>',
                stop_sel='</b>',
                max_words=35,
                min_words=15,
            ),
        )
        .order_by('-rank')
    )
    return qs


def _search_threads_sqlite(qs, query):
    """SQLite fallback for thread search."""
    terms = query.split()
    combined = Q()
    for term in terms:
        combined &= (
            Q(title__icontains=term)
            | Q(description__icontains=term)
        )

    qs = (
        qs
        .filter(combined)
        .annotate(
            rank=Value(1.0, output_field=FloatField()),
            snippet=Coalesce('description', Value(''), output_field=CharField()),
        )
        .order_by('-started_date')
    )
    return qs


def compute_facets(source_qs):
    """
    Compute facet counts for source results.

    Returns dict with source_type and tag facets.
    """
    # Source type facets
    type_facets = list(
        source_qs
        .values('source_type')
        .annotate(count=_count())
        .order_by('-count')
    )
    type_facets = [
        {'value': f['source_type'], 'count': f['count']}
        for f in type_facets
    ]

    # Tag facets: extract from JSONField
    tag_counts = {}
    for tags in source_qs.values_list('tags', flat=True):
        if isinstance(tags, list):
            for tag in tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

    tag_facets = sorted(
        [{'value': k, 'count': v} for k, v in tag_counts.items()],
        key=lambda x: -x['count'],
    )

    return {
        'source_type': type_facets,
        'tag': tag_facets,
    }


def _count():
    from django.db.models import Count
    return Count('id')


def paginate_results(source_results, thread_results, page, per_page):
    """
    Merge and paginate source + thread results.

    Returns (results_list, total, total_pages).
    """
    # Build unified result list
    results = []

    for s in source_results:
        results.append({
            'type': 'source',
            'id': s.id,
            'slug': s.slug,
            'title': s.title,
            'snippet': getattr(s, 'snippet', s.public_annotation or ''),
            'rank': float(getattr(s, 'rank', 1.0)),
            'source_type': s.source_type,
            'tags': s.tags if isinstance(s.tags, list) else [],
            'creator': s.creator,
        })

    for t in thread_results:
        results.append({
            'type': 'thread',
            'id': t.id,
            'slug': t.slug,
            'title': t.title,
            'snippet': getattr(t, 'snippet', t.description or ''),
            'rank': float(getattr(t, 'rank', 1.0)),
            'source_type': '',
            'tags': t.tags if isinstance(t.tags, list) else [],
            'creator': '',
        })

    # Sort by rank descending
    results.sort(key=lambda r: -r['rank'])

    total = len(results)
    total_pages = max(1, math.ceil(total / per_page))
    start = (page - 1) * per_page
    end = start + per_page

    return results[start:end], total, total_pages

"""
Full-text search endpoint with faceted filtering.

GET /api/v1/search/
  Auth: required.
  Query params:
    q         (required) Search query string.
    facets    (optional) Comma-separated: source_type, tag.
    type      (optional) Filter by source_type.
    tag       (optional) Filter by tag.
    thread    (optional) Filter by thread slug.
    page      (optional) Pagination, default 1.
    per_page  (optional) Results per page, default 20, max 100.
"""

from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.research.search import (
    compute_facets,
    paginate_results,
    search_sources,
    search_threads,
)


@api_view(['GET'])
def search(request):
    """
    Full-text search across sources and research threads.

    Uses PostgreSQL websearch query parsing in production
    (supports AND/OR/NOT/phrase queries). Falls back to
    icontains on SQLite for local development.
    """
    query = (request.query_params.get('q') or '').strip()
    if not query:
        return Response(
            {'error': 'q parameter is required.'},
            status=400,
        )

    # Filters
    source_type = request.query_params.get('type', '').strip() or None
    tag = request.query_params.get('tag', '').strip() or None
    thread_slug = request.query_params.get('thread', '').strip() or None

    # Pagination
    try:
        page = max(1, int(request.query_params.get('page', 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        per_page = int(request.query_params.get('per_page', 20))
    except (ValueError, TypeError):
        per_page = 20
    per_page = min(max(per_page, 1), 100)

    # Requested facets
    facet_names = [
        f.strip()
        for f in (request.query_params.get('facets') or '').split(',')
        if f.strip()
    ]

    # Execute searches
    source_qs = search_sources(query, source_type=source_type, tag=tag, thread_slug=thread_slug)
    thread_qs = search_threads(query)

    # Compute facets from source results (before pagination)
    facets = {}
    if facet_names:
        all_facets = compute_facets(source_qs)
        facets = {k: v for k, v in all_facets.items() if k in facet_names}

    # Merge and paginate
    results, total, total_pages = paginate_results(
        list(source_qs),
        list(thread_qs),
        page,
        per_page,
    )

    return Response({
        'query': query,
        'total': total,
        'results': results,
        'facets': facets,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
    })

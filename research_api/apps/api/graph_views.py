"""
Graph algorithm endpoints: PageRank, Path Finding, Reading Order.

GET /api/v1/sources/ranked/   PageRank influence ranking.
GET /api/v1/path/             Shortest path between nodes.
GET /api/v1/reading-order/    Topological reading order.
"""

from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.research.graph import (
    build_graph,
    compute_reading_order,
    find_path,
    get_source_pagerank,
)


@api_view(['GET'])
def sources_ranked(request):
    """
    Return sources ranked by PageRank influence score.

    Sources that are cited by highly-connected content
    rank higher in the bipartite graph.
    """
    try:
        n = int(request.query_params.get('n', 20))
    except (ValueError, TypeError):
        n = 20
    n = min(max(n, 1), 100)

    source_type = request.query_params.get('type', '').strip() or None

    results = get_source_pagerank(source_type=source_type, n=n)

    return Response({'sources': results})


def _resolve_node_id(slug_param):
    """
    Resolve a query parameter slug to a full graph node ID.

    Convention:
      - Prefix 'source:' for source slugs (e.g. 'source:some-book')
      - No prefix or 'content:' prefix for content slugs
      - If no prefix, assume content with essay type as default
    """
    if not slug_param:
        return None
    if slug_param.startswith('source:') or slug_param.startswith('content:'):
        return slug_param
    # Default: treat as content with essay type
    return f'content:essay:{slug_param}'


@api_view(['GET'])
def find_path_view(request):
    """
    Find the shortest path between two nodes in the research graph.

    Nodes can be sources (prefixed with 'source:') or content slugs.
    """
    from_slug = request.query_params.get('from', '').strip()
    to_slug = request.query_params.get('to', '').strip()

    if not from_slug or not to_slug:
        return Response(
            {'error': 'Both "from" and "to" parameters are required.'},
            status=400,
        )

    graph = build_graph()
    from_id = _resolve_node_id(from_slug)
    to_id = _resolve_node_id(to_slug)

    result = find_path(graph, from_id, to_id)
    return Response(result)


@api_view(['GET'])
def reading_order(request):
    """
    Compute a prerequisite reading order for a target content piece.

    Finds content that shares sources with the target and orders
    them by dependency (subset relationship of source sets).
    """
    target = request.query_params.get('target', '').strip()
    if not target:
        return Response(
            {'error': 'target parameter is required.'},
            status=400,
        )

    try:
        max_items = int(request.query_params.get('max', 10))
    except (ValueError, TypeError):
        max_items = 10
    max_items = min(max(max_items, 1), 50)

    graph = build_graph()
    result = compute_reading_order(graph, target, max_items=max_items)
    return Response(result)

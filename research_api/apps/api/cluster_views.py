"""
API view for automatic cluster detection.

NEW ENDPOINT:
    GET /api/v1/clusters/     - Discover thematic clusters in content
"""

import logging

from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.research.clustering import compute_clusters

logger = logging.getLogger(__name__)


@api_view(['GET'])
def content_clusters(request):
    """
    GET /api/v1/clusters/

    Automatically discover thematic clusters in the content.

    Uses agglomerative (hierarchical) clustering on a feature matrix
    built from shared sources and tags. Optionally constrained by the
    source-sharing connectivity graph (structured clustering).

    Query parameters:
        ?n=<int>            Number of clusters (auto-detected if omitted)
        ?structured=true    Use connectivity constraint (default: true)
        ?linkage=ward       Linkage method: ward, average, complete, single
        ?semantic=false     Include embedding features (slower)

    Example response:
    {
        "clusters": [
            {
                "id": 0,
                "label": "housing, zoning, policy",
                "top_tags": ["housing", "zoning", "policy"],
                "members": [
                    {
                        "content_type": "essay",
                        "content_slug": "housing-crisis",
                        "content_title": "The Housing Crisis"
                    },
                    ...
                ],
                "size": 4,
                "tag_distribution": {"housing": 8, "zoning": 5, "policy": 3}
            }
        ],
        "n_clusters": 3,
        "n_content": 12,
        "linkage": "ward",
        "structured": true
    }
    """
    # Parse query parameters
    n_clusters = request.query_params.get('n')
    if n_clusters is not None:
        try:
            n_clusters = int(n_clusters)
            n_clusters = max(2, min(20, n_clusters))
        except (ValueError, TypeError):
            n_clusters = None

    use_connectivity = request.query_params.get('structured', 'true').lower() != 'false'

    linkage = request.query_params.get('linkage', 'ward').lower()
    if linkage not in ('ward', 'average', 'complete', 'single'):
        linkage = 'ward'

    include_semantic = request.query_params.get('semantic', 'false').lower() == 'true'

    try:
        result = compute_clusters(
            n_clusters=n_clusters,
            use_connectivity=use_connectivity,
            linkage=linkage,
            include_semantic=include_semantic,
        )
    except Exception as e:
        logger.error('Cluster computation failed: %s', e)
        return Response(
            {'error': 'Cluster computation failed.', 'detail': str(e)},
            status=500,
        )

    return Response(result)

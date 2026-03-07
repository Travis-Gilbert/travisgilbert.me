"""
Tension detection endpoint.

GET /api/v1/tensions/   Intellectual friction between sources.
"""

from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.research.tensions import detect_tensions


@api_view(['GET'])
def tensions(request):
    """
    Return detected tensions between sources.

    Query params:
        topic      (optional) Tag to filter by.
        content    (optional) Content slug to scope tensions.
        min_score  (optional) Minimum tension score, default 0.3.
    """
    topic = request.query_params.get('topic', '').strip() or None
    content = request.query_params.get('content', '').strip() or None

    min_score = 0.3
    raw_score = request.query_params.get('min_score', '').strip()
    if raw_score:
        try:
            min_score = max(0.0, min(1.0, float(raw_score)))
        except (ValueError, TypeError):
            pass

    results = detect_tensions(
        topic_tag=topic,
        content_slug=content,
        min_score=min_score,
    )

    return Response({'tensions': results})

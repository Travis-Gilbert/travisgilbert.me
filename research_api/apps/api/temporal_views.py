"""
Temporal analysis endpoints: trends and thread velocity.

GET /api/v1/trends/              Time-series trends with moving averages.
GET /api/v1/threads/velocity/    Thread velocity and staleness metrics.
"""

from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.api.temporal import compute_thread_velocity, compute_trends


@api_view(['GET'])
def trends(request):
    """
    Return research activity trends with moving averages and direction.

    Query params:
        window  Moving average window in days (default 30, max 365).
        metric  One of: sources, links, entries, all (default: all).
    """
    try:
        window = int(request.query_params.get('window', 30))
    except (ValueError, TypeError):
        window = 30
    window = min(max(window, 1), 365)

    metric = request.query_params.get('metric', 'all').strip().lower()
    valid_metrics = ('sources', 'links', 'entries', 'all')
    if metric not in valid_metrics:
        return Response(
            {'error': f'Invalid metric. Choose from: {", ".join(valid_metrics)}.'},
            status=400,
        )

    result = compute_trends(window=window, metric=metric)
    return Response(result)


@api_view(['GET'])
def thread_velocity(request):
    """
    Return velocity and staleness metrics for all public threads.

    Velocity is entries per 30-day period.
    Staleness: fresh (within 7 days), cooling (8 to 30), stale (31 to 90), dormant (90+).
    """
    results = compute_thread_velocity()
    return Response({'threads': results})

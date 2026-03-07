"""
Source health monitoring endpoint.

GET /api/v1/sources/health/   Summary and per-source health status.
"""

from django.db.models import Max, Subquery, OuterRef
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.api.models import HealthCheck
from apps.research.models import Source


@api_view(['GET'])
def source_health(request):
    """
    Return health status for all sources with URLs.

    Query params:
        status      Filter: "alive", "dead", "redirect", "unknown" (unchecked).
        stale_days  Only sources not checked in N days.
    """
    sources_with_url = Source.objects.public().exclude(url='').exclude(url__isnull=True)

    # Annotate each source with its latest health check
    latest_check_qs = HealthCheck.objects.filter(
        source=OuterRef('pk'),
    ).order_by('-checked_at')

    sources = sources_with_url.annotate(
        latest_status_code=Subquery(latest_check_qs.values('status_code')[:1]),
        latest_is_alive=Subquery(latest_check_qs.values('is_alive')[:1]),
        latest_redirect_url=Subquery(latest_check_qs.values('redirect_url')[:1]),
        latest_has_archive=Subquery(latest_check_qs.values('has_archive')[:1]),
        latest_archive_url=Subquery(latest_check_qs.values('archive_url')[:1]),
        latest_error=Subquery(latest_check_qs.values('error_message')[:1]),
        latest_checked_at=Subquery(latest_check_qs.values('checked_at')[:1]),
    )

    # Classify each source
    source_list = []
    counts = {'alive': 0, 'dead': 0, 'redirected': 0, 'unchecked': 0, 'archived': 0}
    total_with_url = 0

    for s in sources:
        total_with_url += 1

        if s.latest_is_alive is None:
            health_status = 'unknown'
            counts['unchecked'] += 1
        elif s.latest_is_alive:
            if s.latest_redirect_url:
                health_status = 'redirect'
                counts['redirected'] += 1
            else:
                health_status = 'alive'
                counts['alive'] += 1
        else:
            health_status = 'dead'
            counts['dead'] += 1

        if s.latest_has_archive:
            counts['archived'] += 1

        source_list.append({
            'slug': s.slug,
            'title': s.title,
            'url': s.url,
            'status': health_status,
            'status_code': s.latest_status_code,
            'redirect_url': s.latest_redirect_url or '',
            'has_archive': s.latest_has_archive or False,
            'archive_url': s.latest_archive_url or '',
            'error': s.latest_error or '',
            'last_checked': (
                s.latest_checked_at.isoformat() if s.latest_checked_at else None
            ),
        })

    # Apply filters
    status_filter = request.query_params.get('status', '').strip().lower()
    if status_filter in ('alive', 'dead', 'redirect', 'unknown'):
        source_list = [s for s in source_list if s['status'] == status_filter]

    stale_days = request.query_params.get('stale_days', '').strip()
    if stale_days:
        try:
            stale_days = int(stale_days)
            from django.utils import timezone
            import datetime
            cutoff = timezone.now() - datetime.timedelta(days=stale_days)
            source_list = [
                s for s in source_list
                if s['last_checked'] is None
                or s['last_checked'] < cutoff.isoformat()
            ]
        except (ValueError, TypeError):
            pass

    return Response({
        'summary': {
            'total_with_url': total_with_url,
            **counts,
        },
        'sources': source_list,
    })

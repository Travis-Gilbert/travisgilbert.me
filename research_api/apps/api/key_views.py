"""
API key registration and usage analytics endpoints.

POST /api/v1/keys/register/   Create a free-tier API key (no auth required)
GET  /api/v1/usage/           Usage analytics for the authenticated key
"""

from datetime import timedelta

from django.db.models import Avg, Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import APIKey, UsageLog


@api_view(['POST'])
def register_api_key(request):
    """
    POST /api/v1/keys/register/

    Create a new free-tier API key. No authentication required.

    Body: { "name": "My Research Tool", "email": "user@example.com" }

    Returns the generated key. This is the only time the full key
    is returned in a response; store it securely.
    """
    name = (request.data.get('name') or '').strip()
    email = (request.data.get('email') or '').strip()

    if not name:
        return Response(
            {'error': 'name is required.'},
            status=400,
        )
    if not email:
        return Response(
            {'error': 'email is required.'},
            status=400,
        )

    api_key = APIKey.objects.create(
        name=name,
        owner_email=email,
        tier='free',
        requests_per_hour=100,
    )

    return Response({
        'key': api_key.key,
        'name': api_key.name,
        'tier': api_key.tier,
        'requests_per_hour': api_key.requests_per_hour,
    }, status=201)


@api_view(['GET'])
def usage_analytics(request):
    """
    GET /api/v1/usage/?days=30

    Usage analytics for the authenticated API key.
    Returns total requests, per-endpoint breakdown, daily counts,
    and current rate limit status.
    """
    api_key = getattr(request, 'api_key', None)
    if api_key is None:
        return Response(
            {'error': 'Authentication required.'},
            status=401,
        )

    try:
        days = int(request.query_params.get('days', 30))
    except (ValueError, TypeError):
        days = 30
    days = min(max(days, 1), 90)

    since = timezone.now() - timedelta(days=days)
    logs = UsageLog.objects.filter(api_key=api_key, timestamp__gte=since)

    # Total requests
    total_requests = logs.count()

    # Per-endpoint breakdown
    by_endpoint = list(
        logs
        .values('endpoint')
        .annotate(
            count=Count('id'),
            avg_response_ms=Avg('response_time_ms'),
        )
        .order_by('-count')
    )
    for entry in by_endpoint:
        entry['avg_response_ms'] = int(entry['avg_response_ms'] or 0)

    # Daily counts
    by_day = list(
        logs
        .annotate(date=TruncDate('timestamp'))
        .values('date')
        .annotate(count=Count('id'))
        .order_by('date')
    )
    for entry in by_day:
        entry['date'] = entry['date'].isoformat()

    # Current rate limit status
    one_hour_ago = timezone.now() - timedelta(hours=1)
    used_this_hour = UsageLog.objects.filter(
        api_key=api_key,
        timestamp__gte=one_hour_ago,
    ).count()

    return Response({
        'total_requests': total_requests,
        'days': days,
        'by_endpoint': by_endpoint,
        'by_day': by_day,
        'rate_limit': {
            'tier': api_key.tier,
            'limit': api_key.requests_per_hour,
            'used_this_hour': used_this_hour,
            'remaining': max(0, api_key.requests_per_hour - used_this_hour),
        },
    })

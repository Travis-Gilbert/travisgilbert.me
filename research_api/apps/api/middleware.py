"""
API key authentication and rate limiting middleware.

Intercepts all /api/v1/ requests (with configured exemptions),
validates the Bearer token, enforces per-key rate limits, and
logs usage for analytics.

The middleware pattern keeps auth logic in one place rather than
scattering it across every view. Views receive request.api_key
if authentication succeeds.
"""

import logging
import time

from django.http import JsonResponse
from django.utils import timezone

from datetime import timedelta

logger = logging.getLogger(__name__)

# Paths that do not require an API key
EXEMPT_PREFIXES = (
    '/health/',
    '/admin/',
    '/webhooks/webmention/',
)

EXEMPT_PATHS = (
    '/api/v1/keys/register/',
    '/api/v1/internal/promote/',
)


class APIKeyMiddleware:
    """
    Django middleware for API key authentication and rate limiting.

    1. Checks Authorization: Bearer <key> on all /api/v1/ paths.
    2. Exempts registration, health, admin, webmention, and promote endpoints.
    3. Validates key exists and is active. Returns 401 if not.
    4. Enforces rolling-hour rate limit. Returns 429 with Retry-After if exceeded.
    5. Attaches request.api_key for downstream views.
    6. Logs usage after response completes.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        # Only gate /api/v1/ paths
        if not path.startswith('/api/v1/'):
            return self.get_response(request)

        # Check exemptions
        if path in EXEMPT_PATHS:
            return self.get_response(request)

        for prefix in EXEMPT_PREFIXES:
            if path.startswith(prefix):
                return self.get_response(request)

        # Extract Bearer token
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return JsonResponse(
                {'error': 'Authentication required. Provide Authorization: Bearer <api_key> header.'},
                status=401,
            )

        token = auth_header[7:].strip()
        if not token:
            return JsonResponse(
                {'error': 'Empty API key.'},
                status=401,
            )

        # Look up the key (import here to avoid app-not-ready issues)
        from apps.api.models import APIKey, UsageLog

        try:
            api_key = APIKey.objects.get(key=token)
        except APIKey.DoesNotExist:
            return JsonResponse(
                {'error': 'Invalid API key.'},
                status=401,
            )

        if not api_key.is_active:
            return JsonResponse(
                {'error': 'API key is deactivated.'},
                status=401,
            )

        # Rate limit check: count requests in the last hour
        one_hour_ago = timezone.now() - timedelta(hours=1)
        usage_count = UsageLog.objects.filter(
            api_key=api_key,
            timestamp__gte=one_hour_ago,
        ).count()

        if usage_count >= api_key.requests_per_hour:
            return JsonResponse(
                {
                    'error': 'Rate limit exceeded.',
                    'limit': api_key.requests_per_hour,
                    'used': usage_count,
                    'retry_after_seconds': 3600,
                },
                status=429,
                headers={'Retry-After': '3600'},
            )

        # Attach key to request for downstream views
        request.api_key = api_key

        # Process the request and time it
        start = time.monotonic()
        response = self.get_response(request)
        elapsed_ms = int((time.monotonic() - start) * 1000)

        # Log usage (non-blocking: if this fails, the response still goes through)
        try:
            UsageLog.objects.create(
                api_key=api_key,
                endpoint=path,
                method=request.method,
                status_code=response.status_code,
                response_time_ms=elapsed_ms,
            )
            # Update last_used_at
            APIKey.objects.filter(pk=api_key.pk).update(last_used_at=timezone.now())
        except Exception:
            logger.exception('Failed to log API usage for key %s', api_key.name)

        return response

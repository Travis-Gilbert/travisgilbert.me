from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include


def health_check(request):
    """Health check for Railway and monitoring."""
    from django.db import connection
    health = {'status': 'ok'}
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        health['database'] = 'ok'
    except Exception:
        health['database'] = 'error'
        health['status'] = 'degraded'

    # Check Redis connectivity
    try:
        from django.core.cache import cache
        cache.set('health_check', 'ok', timeout=10)
        if cache.get('health_check') == 'ok':
            health['redis'] = 'ok'
        else:
            health['redis'] = 'error'
            health['status'] = 'degraded'
    except Exception:
        health['redis'] = 'unavailable'

    status_code = 200 if health['status'] == 'ok' else 503
    return JsonResponse(health, status=status_code)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('apps.api.urls', namespace='api')),
    path('api/v1/notebook/', include('apps.notebook.urls', namespace='notebook')),
    path('api/comments/', include('apps.comments.urls', namespace='comments')),
    path('webhooks/', include('apps.mentions.urls', namespace='mentions')),
    path('health/', health_check, name='health-check'),
    path('', include('apps.paper_trail.urls')),
]

try:
    import django_rq  # noqa: F401
    urlpatterns.insert(
        1,
        path('admin/rq/', include('django_rq.urls')),
    )
except Exception:
    pass

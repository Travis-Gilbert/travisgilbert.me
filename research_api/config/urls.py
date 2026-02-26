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
    status_code = 200 if health['status'] == 'ok' else 503
    return JsonResponse(health, status=status_code)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('apps.api.urls', namespace='api')),
    path('webhooks/', include('apps.mentions.urls', namespace='mentions')),
    path('health/', health_check, name='health-check'),
]

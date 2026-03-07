"""
Webhook management endpoints.

POST   /api/v1/webhooks/                 Create subscription (requires can_webhook)
GET    /api/v1/webhooks/                 List subscriptions (key-scoped)
DELETE /api/v1/webhooks/<id>/            Remove subscription
GET    /api/v1/webhooks/<id>/deliveries/ Delivery log
POST   /api/v1/webhooks/test/            Send test event to all subscriptions
"""

import secrets

from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.api.models import WebhookDelivery, WebhookSubscription
from apps.api.webhooks import dispatch_event


def _require_webhooks(request):
    """Return (api_key, error_response). error_response is None on success."""
    api_key = getattr(request, 'api_key', None)
    if not api_key or not api_key.can_webhook:
        return None, Response(
            {'error': 'Webhooks require an API key with can_webhook permission.'},
            status=403,
        )
    return api_key, None


def _subscription_dict(sub):
    """Serialize a WebhookSubscription."""
    return {
        'id': sub.id,
        'callback_url': sub.callback_url,
        'events': sub.events,
        'is_active': sub.is_active,
        'consecutive_failures': sub.consecutive_failures,
        'created_at': sub.created_at.isoformat(),
    }


@api_view(['GET', 'POST'])
def webhook_list(request):
    """List or create webhook subscriptions."""
    api_key, err = _require_webhooks(request)
    if err:
        return err

    if request.method == 'GET':
        subs = WebhookSubscription.objects.filter(api_key=api_key)
        return Response({
            'webhooks': [_subscription_dict(s) for s in subs],
        })

    # POST: create
    callback_url = (request.data.get('callback_url') or '').strip()
    if not callback_url:
        return Response({'error': 'callback_url is required.'}, status=400)

    events = request.data.get('events', [])
    if not events or not isinstance(events, list):
        return Response(
            {'error': 'events must be a non-empty list of event types.'},
            status=400,
        )

    # Validate event types
    invalid = [e for e in events if e not in WebhookSubscription.VALID_EVENTS and e != '*']
    if invalid:
        return Response(
            {
                'error': f'Invalid event types: {", ".join(invalid)}.',
                'valid_events': WebhookSubscription.VALID_EVENTS,
            },
            status=400,
        )

    if WebhookSubscription.objects.filter(api_key=api_key, callback_url=callback_url).exists():
        return Response(
            {'error': 'A subscription for this callback URL already exists.'},
            status=409,
        )

    # Generate a secret if not provided
    secret = (request.data.get('secret') or '').strip()
    if not secret:
        secret = secrets.token_hex(32)

    sub = WebhookSubscription.objects.create(
        api_key=api_key,
        callback_url=callback_url,
        events=events,
        secret=secret,
    )

    return Response({
        'id': sub.id,
        'callback_url': sub.callback_url,
        'events': sub.events,
        'secret': sub.secret,
        'is_active': sub.is_active,
        'created_at': sub.created_at.isoformat(),
    }, status=201)


@api_view(['DELETE'])
def webhook_detail(request, pk):
    """Delete a webhook subscription."""
    api_key, err = _require_webhooks(request)
    if err:
        return err

    try:
        sub = WebhookSubscription.objects.get(pk=pk, api_key=api_key)
    except WebhookSubscription.DoesNotExist:
        return Response({'error': 'Webhook not found.'}, status=404)

    sub.delete()
    return Response(status=204)


@api_view(['GET'])
def webhook_deliveries(request, pk):
    """List delivery attempts for a webhook subscription."""
    api_key, err = _require_webhooks(request)
    if err:
        return err

    try:
        sub = WebhookSubscription.objects.get(pk=pk, api_key=api_key)
    except WebhookSubscription.DoesNotExist:
        return Response({'error': 'Webhook not found.'}, status=404)

    deliveries = sub.deliveries.all()[:50]
    return Response({
        'deliveries': [
            {
                'id': d.id,
                'event_type': d.event_type,
                'status_code': d.status_code,
                'success': d.success,
                'error_message': d.error_message,
                'attempted_at': d.attempted_at.isoformat(),
            }
            for d in deliveries
        ],
    })


@api_view(['POST'])
def webhook_test(request):
    """Send a test event to all active subscriptions for this key."""
    api_key, err = _require_webhooks(request)
    if err:
        return err

    deliveries = dispatch_event('test', {
        'message': 'This is a test webhook delivery.',
    })

    # Filter to only this key's deliveries
    key_deliveries = [
        d for d in deliveries
        if d.subscription.api_key_id == api_key.id
    ]

    return Response({
        'delivered': len(key_deliveries),
        'results': [
            {
                'callback_url': d.subscription.callback_url,
                'success': d.success,
                'status_code': d.status_code,
                'error_message': d.error_message,
            }
            for d in key_deliveries
        ],
    })

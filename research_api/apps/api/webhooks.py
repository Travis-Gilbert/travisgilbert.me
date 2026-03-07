"""
Webhook dispatch service.

Delivers webhook events to subscribed endpoints with HMAC signatures.
Deactivates subscriptions after 5 consecutive failures.

Usage:
    from apps.api.webhooks import dispatch_event

    dispatch_event('source.created', {
        'slug': source.slug,
        'title': source.title,
    })
"""

import hashlib
import hmac
import json
import logging
import uuid

import requests

from apps.api.models import WebhookDelivery, WebhookSubscription

logger = logging.getLogger(__name__)

MAX_CONSECUTIVE_FAILURES = 5
DELIVERY_TIMEOUT = 10


def _sign_payload(payload_bytes, secret):
    """Generate HMAC-SHA256 signature for a payload."""
    return hmac.new(
        secret.encode('utf-8'),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()


def _deliver(subscription, event_type, payload):
    """
    Deliver a single webhook event to a subscription.

    Returns a WebhookDelivery record (already saved).
    """
    delivery_id = str(uuid.uuid4())
    payload_with_meta = {
        'delivery_id': delivery_id,
        'event': event_type,
        'data': payload,
    }
    payload_bytes = json.dumps(payload_with_meta, default=str).encode('utf-8')
    signature = _sign_payload(payload_bytes, subscription.secret)

    headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event_type,
        'X-Webhook-Delivery': delivery_id,
        'X-Webhook-Signature': f'sha256={signature}',
    }

    status_code = None
    success = False
    error_message = ''

    try:
        response = requests.post(
            subscription.callback_url,
            data=payload_bytes,
            headers=headers,
            timeout=DELIVERY_TIMEOUT,
        )
        status_code = response.status_code
        success = 200 <= response.status_code < 300
    except requests.Timeout:
        error_message = 'Connection timed out'
    except requests.ConnectionError:
        error_message = 'Connection refused'
    except Exception as exc:
        error_message = str(exc)[:500]

    delivery = WebhookDelivery.objects.create(
        subscription=subscription,
        event_type=event_type,
        payload=payload_with_meta,
        status_code=status_code,
        success=success,
        error_message=error_message,
    )

    # Track consecutive failures
    if success:
        if subscription.consecutive_failures > 0:
            subscription.consecutive_failures = 0
            subscription.save(update_fields=['consecutive_failures'])
    else:
        subscription.consecutive_failures += 1
        fields_to_update = ['consecutive_failures']

        if subscription.consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            subscription.is_active = False
            fields_to_update.append('is_active')
            logger.warning(
                'Webhook %s deactivated after %d consecutive failures.',
                subscription.callback_url,
                subscription.consecutive_failures,
            )

        subscription.save(update_fields=fields_to_update)

    return delivery


def dispatch_event(event_type, payload):
    """
    Send an event to all active subscriptions listening for it.

    Args:
        event_type: One of the valid event types (e.g. 'source.created').
        payload: Dict of event data.

    Returns:
        List of WebhookDelivery records created.
    """
    subscriptions = WebhookSubscription.objects.filter(
        is_active=True,
    )

    deliveries = []
    for sub in subscriptions:
        events = sub.events or []
        if event_type in events or '*' in events:
            try:
                delivery = _deliver(sub, event_type, payload)
                deliveries.append(delivery)
            except Exception as exc:
                logger.error(
                    'Failed to deliver webhook to %s: %s',
                    sub.callback_url,
                    exc,
                )

    return deliveries

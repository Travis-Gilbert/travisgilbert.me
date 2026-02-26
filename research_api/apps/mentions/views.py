"""
Webmention webhook receiver.

Implements the W3C Webmention spec endpoint:
https://www.w3.org/TR/webmention/#receiving-webmentions

Accepts POST requests with source and target URL parameters.
Validation and verification happen synchronously for simplicity
(no background task queue needed at this scale).
"""

import logging
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import MentionStatus, Webmention

logger = logging.getLogger(__name__)

# The domain we accept as valid targets
ALLOWED_TARGET_DOMAIN = getattr(settings, 'WEBMENTION_TARGET_DOMAIN', 'travisgilbert.com')


@csrf_exempt
@require_POST
def receive_webmention(request):
    """
    Accept an inbound Webmention notification.

    Required POST parameters:
        source: URL of the page that mentions our content
        target: URL on our site being mentioned
    """
    source = request.POST.get('source', '').strip()
    target = request.POST.get('target', '').strip()

    # Validate required fields
    if not source or not target:
        return JsonResponse(
            {'error': 'Both source and target parameters are required.'},
            status=400,
        )

    # Validate URLs
    for url, label in [(source, 'source'), (target, 'target')]:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return JsonResponse(
                {'error': f'Invalid {label} URL scheme.'},
                status=400,
            )

    # Target must be on our domain
    target_domain = urlparse(target).hostname
    if target_domain and not target_domain.endswith(ALLOWED_TARGET_DOMAIN):
        return JsonResponse(
            {'error': 'Target URL is not on this site.'},
            status=400,
        )

    # Source and target must differ
    if source == target:
        return JsonResponse(
            {'error': 'Source and target must be different URLs.'},
            status=400,
        )

    # Create or update the mention (idempotent on source+target pair)
    mention, created = Webmention.objects.update_or_create(
        source_url=source,
        target_url=target,
        defaults={
            'status': MentionStatus.PENDING,
            'verified': False,
        },
    )

    # Attempt verification: fetch source and check for target link
    verified = _verify_mention(source, target)
    if verified:
        mention.verified = True
        mention.verified_at = timezone.now()
        mention.save(update_fields=['verified', 'verified_at'])

    status_code = 201 if created else 200
    return JsonResponse(
        {
            'status': 'accepted' if created else 'updated',
            'verified': mention.verified,
        },
        status=status_code,
    )


def _verify_mention(source_url, target_url):
    """
    Fetch the source URL and confirm it contains a link to the target.

    Returns True if the source page contains the target URL.
    """
    try:
        resp = requests.get(
            source_url,
            timeout=10,
            headers={'User-Agent': 'research_api Webmention verifier'},
            allow_redirects=True,
        )
        resp.raise_for_status()
        return target_url in resp.text
    except requests.exceptions.RequestException as e:
        logger.warning('Webmention verification failed for %s: %s', source_url, e)
        return False

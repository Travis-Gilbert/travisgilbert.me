"""
Webhook receivers for the mentions app.

Two ingestion endpoints:

1. W3C Webmention endpoint (open protocol):
   Accepts POST with source and target URL params. Validates that the
   target is on travisgilbert.me, verifies the source actually links
   to the target, extracts the target slug, and creates/updates a
   Mention record.

2. HMAC-authenticated webhook (private/controlled sources):
   Accepts POST with JSON body and X-Webhook-Signature header. Verifies
   HMAC-SHA256 signature against WEBHOOK_SECRET, then creates/updates
   a Mention from the structured payload.
"""

import hashlib
import hmac
import json
import logging
import re
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import DiscoveryMethod, Mention, MentionType, TargetContentType

logger = logging.getLogger(__name__)

# The domain we accept as valid targets
ALLOWED_TARGET_DOMAIN = getattr(
    settings, 'WEBMENTION_TARGET_DOMAIN', 'travisgilbert.me'
)


# ---------------------------------------------------------------------------
# W3C Webmention Endpoint
# ---------------------------------------------------------------------------

@csrf_exempt
@require_POST
def receive_webmention(request):
    """
    Accept an inbound Webmention notification.

    Required POST parameters:
        source: URL of the page that mentions our content
        target: URL on our site being mentioned

    Optional POST parameters:
        vouch: Vouch URL for extended verification
    """
    source = request.POST.get('source', '').strip()
    target = request.POST.get('target', '').strip()
    vouch = request.POST.get('vouch', '').strip()

    # Validate required fields
    if not source or not target:
        return JsonResponse(
            {'error': 'Both source and target parameters are required.'},
            status=400,
        )

    # Validate URL schemes
    for url, label in [(source, 'source'), (target, 'target')]:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return JsonResponse(
                {'error': f'Invalid {label} URL scheme.'},
                status=400,
            )

    # Target must be on our domain
    target_parsed = urlparse(target)
    target_hostname = target_parsed.hostname or ''
    if not target_hostname.endswith(ALLOWED_TARGET_DOMAIN):
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

    # Extract content type and slug from the target path
    content_type, slug = _parse_target_path(target_parsed.path)
    if not slug:
        return JsonResponse(
            {'error': 'Could not determine target content from URL.'},
            status=400,
        )

    # Create or update the mention (idempotent on source_url + target_slug)
    mention, created = Mention.objects.update_or_create(
        source_url=source,
        target_slug=slug,
        defaults={
            'target_content_type': content_type,
            'target_url': target,
            'discovery_method': DiscoveryMethod.WEBMENTION,
            'webmention_vouch': vouch,
        },
    )

    # Attempt verification: fetch source and check for target link
    verified = _verify_mention(source, target)
    if verified:
        mention.verified = True
        mention.verified_at = timezone.now()
        mention.save(update_fields=['verified', 'verified_at', 'updated_at'])

    status_code = 201 if created else 200
    return JsonResponse(
        {
            'status': 'accepted' if created else 'updated',
            'verified': mention.verified,
        },
        status=status_code,
    )


# ---------------------------------------------------------------------------
# HMAC-Authenticated Webhook
# ---------------------------------------------------------------------------

@csrf_exempt
@require_POST
def receive_webhook(request):
    """
    Accept a mention via HMAC-signed JSON webhook.

    Expects:
        Header X-Webhook-Signature: sha256=<hex digest>
        Body: JSON with at least source_url and target_slug.

    The HMAC is computed as SHA256(WEBHOOK_SECRET, request body).
    """
    secret = getattr(settings, 'WEBHOOK_SECRET', '')
    if not secret:
        logger.error('WEBHOOK_SECRET not configured; rejecting webhook.')
        return JsonResponse(
            {'error': 'Webhook endpoint not configured.'},
            status=503,
        )

    # Verify signature
    signature_header = request.headers.get('X-Webhook-Signature', '')
    if not signature_header.startswith('sha256='):
        return JsonResponse(
            {'error': 'Missing or malformed X-Webhook-Signature header.'},
            status=401,
        )

    expected_sig = signature_header[7:]  # strip "sha256=" prefix
    body = request.body
    computed_sig = hmac.new(
        secret.encode('utf-8'),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, computed_sig):
        logger.warning('Webhook signature mismatch.')
        return JsonResponse(
            {'error': 'Invalid signature.'},
            status=403,
        )

    # Parse JSON body
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return JsonResponse(
            {'error': 'Invalid JSON body.'},
            status=400,
        )

    source_url = payload.get('source_url', '').strip()
    target_slug = payload.get('target_slug', '').strip()

    if not source_url or not target_slug:
        return JsonResponse(
            {'error': 'source_url and target_slug are required.'},
            status=400,
        )

    # Build defaults from payload
    defaults = {
        'discovery_method': DiscoveryMethod.MANUAL,
    }

    # Map optional fields
    field_map = {
        'source_title': 'source_title',
        'source_excerpt': 'source_excerpt',
        'source_author': 'source_author',
        'source_author_url': 'source_author_url',
        'target_url': 'target_url',
        'webmention_vouch': 'webmention_vouch',
    }
    for payload_key, model_field in field_map.items():
        if payload_key in payload:
            defaults[model_field] = payload[payload_key]

    # Handle typed fields
    if 'target_content_type' in payload:
        defaults['target_content_type'] = payload['target_content_type']
    if 'mention_type' in payload:
        defaults['mention_type'] = payload['mention_type']
    if 'discovery_method' in payload:
        defaults['discovery_method'] = payload['discovery_method']
    if 'source_published' in payload and payload['source_published']:
        from django.utils.dateparse import parse_datetime
        dt = parse_datetime(payload['source_published'])
        if dt:
            defaults['source_published'] = dt

    # Boolean fields (explicit True/False in payload)
    if 'verified' in payload:
        defaults['verified'] = bool(payload['verified'])
        if defaults['verified']:
            defaults['verified_at'] = timezone.now()
    if 'public' in payload:
        defaults['public'] = bool(payload['public'])
    if 'featured' in payload:
        defaults['featured'] = bool(payload['featured'])

    # Create or update
    mention, created = Mention.objects.update_or_create(
        source_url=source_url,
        target_slug=target_slug,
        defaults=defaults,
    )

    status_code = 201 if created else 200
    return JsonResponse(
        {
            'status': 'accepted' if created else 'updated',
            'mention_id': mention.id,
        },
        status=status_code,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# URL path patterns for the Next.js site
_PATH_PATTERNS = [
    (r'^/on/(?P<slug>[\w-]+)/?$', TargetContentType.ESSAY),
    (r'^/field-notes/(?P<slug>[\w-]+)/?$', TargetContentType.FIELD_NOTE),
    (r'^/projects/(?P<slug>[\w-]+)/?$', TargetContentType.PROJECT),
    (r'^/toolkit/(?P<slug>[\w-]+)/?$', TargetContentType.TOOLKIT),
    (r'^/shelf/(?P<slug>[\w-]+)/?$', TargetContentType.SHELF),
]


def _parse_target_path(path):
    """
    Extract content type and slug from a URL path.

    Returns (content_type, slug) or (TargetContentType.OTHER, '') if
    no pattern matches. The path patterns match the Next.js route
    structure.
    """
    for pattern, content_type in _PATH_PATTERNS:
        match = re.match(pattern, path)
        if match:
            return content_type, match.group('slug')

    # Fallback: treat the last path segment as the slug
    segments = [s for s in path.strip('/').split('/') if s]
    if segments:
        return TargetContentType.OTHER, segments[-1]
    return TargetContentType.OTHER, ''


def _verify_mention(source_url, target_url):
    """
    Fetch the source URL and confirm it contains a link to the target.

    Returns True if the source page contains the target URL (or its path).
    """
    try:
        resp = requests.get(
            source_url,
            timeout=10,
            headers={'User-Agent': 'research_api Webmention verifier'},
            allow_redirects=True,
        )
        resp.raise_for_status()

        # Check for full URL or just the path portion
        target_path = urlparse(target_url).path
        return target_url in resp.text or target_path in resp.text

    except requests.exceptions.RequestException as e:
        logger.warning(
            'Webmention verification failed for %s: %s', source_url, e
        )
        return False

"""
API views for research data.

Two patterns used here:
  - Function views (@api_view) for custom aggregation (trail, backlinks, graph)
  - Generic class-based views (ListAPIView, RetrieveAPIView) for standard list/detail

Public endpoints are AllowAny. The promote endpoint is authenticated via
a shared API key (INTERNAL_API_KEY) for cross-service calls from publishing_api.
"""

import logging
from collections import defaultdict
from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Prefetch
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.decorators import api_view
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response

from apps.mentions.models import Mention
from apps.research.models import (
    ResearchThread,
    Source,
    SourceLink,
    SourceType,
    ThreadEntry,
)
from apps.research.services import detect_content_type, get_backlinks

from .serializers import (
    MentionSerializer,
    SourceDetailSerializer,
    SourceLinkSerializer,
    SourceListSerializer,
    ThreadDetailSerializer,
    ThreadListSerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Trail: the primary BFF endpoint
# ---------------------------------------------------------------------------


@api_view(['GET'])
def research_trail(request, slug):
    """
    Full research context for a single piece of content.

    GET /api/v1/trail/<slug>/

    Aggregates sources, backlinks, active thread, and verified mentions
    into one response. The Next.js frontend calls this once per page
    instead of making four separate requests.

    Tries essay first, then field_note. This covers the two content
    types that have research trails on the site.
    """
    content_type = detect_content_type(slug)

    # Sources linked to this content (public only at DB level)
    links = (
        SourceLink.objects
        .filter(
            content_type=content_type,
            content_slug=slug,
            source__public=True,
        )
        .select_related('source')
        .order_by('role', 'source__title')
    )
    sources = [
        {
            'id': lnk.source.id,
            'title': lnk.source.title,
            'slug': lnk.source.slug,
            'creator': lnk.source.creator,
            'sourceType': lnk.source.source_type,
            'url': lnk.source.url,
            'publication': lnk.source.publication,
            'publicAnnotation': lnk.source.public_annotation,
            'role': lnk.role,
            'keyQuote': lnk.key_quote,
        }
        for lnk in links
    ]

    # Backlinks (other content sharing sources with this one)
    backlinks = get_backlinks(content_type, slug)
    backlinks_out = [
        {
            'contentType': bl['content_type'],
            'contentSlug': bl['content_slug'],
            'contentTitle': bl['content_title'],
            'sharedSources': [
                {'sourceId': s['source_id'], 'sourceTitle': s['source_title']}
                for s in bl['shared_sources']
            ],
        }
        for bl in backlinks
    ]

    # Active research thread mentioning this slug
    thread_data = None
    thread = (
        ResearchThread.objects.public()
        .filter(resulting_essay_slug=slug)
        .prefetch_related(
            Prefetch(
                'entries',
                queryset=ThreadEntry.objects.select_related('source').order_by('order', '-date'),
            )
        )
        .first()
    )
    if thread:
        thread_data = {
            'title': thread.title,
            'slug': thread.slug,
            'description': thread.description,
            'status': thread.status,
            'startedDate': thread.started_date.isoformat() if thread.started_date else None,
            'entries': [
                {
                    'entryType': e.entry_type,
                    'date': e.date.isoformat(),
                    'title': e.title,
                    'description': e.description,
                    'sourceTitle': e.source.title if e.source else '',
                }
                for e in thread.entries.all()
            ],
        }

    # Verified, public mentions
    mentions = (
        Mention.objects.public()
        .filter(target_slug=slug)
        .select_related('mention_source')
        .order_by('-created_at')[:20]
    )
    mentions_out = [
        {
            'sourceUrl': m.source_url,
            'sourceTitle': m.source_title,
            'sourceExcerpt': m.source_excerpt,
            'sourceAuthor': m.source_author,
            'mentionType': m.mention_type,
            'featured': m.featured,
            'mentionSourceName': m.mention_source.name if m.mention_source else '',
            'mentionSourceAvatar': m.mention_source.avatar_url if m.mention_source else '',
            'createdAt': m.created_at.isoformat(),
        }
        for m in mentions
    ]

    return Response({
        'slug': slug,
        'contentType': content_type,
        'sources': sources,
        'backlinks': backlinks_out,
        'thread': thread_data,
        'mentions': mentions_out,
    })


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------


class SourceListView(ListAPIView):
    """
    GET /api/v1/sources/

    All public sources, newest first. Supports ?type= and ?tag= filters.
    """
    serializer_class = SourceListSerializer

    def get_queryset(self):
        qs = Source.objects.public().annotate(link_count=Count('links'))
        source_type = self.request.query_params.get('type')
        if source_type:
            qs = qs.filter(source_type=source_type)
        tag = self.request.query_params.get('tag')
        if tag:
            qs = qs.filter(tags__contains=[tag])
        return qs


class SourceDetailView(RetrieveAPIView):
    """
    GET /api/v1/sources/<slug>/

    Full source with nested links and backlink peers.
    """
    serializer_class = SourceDetailSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        return (
            Source.objects.public()
            .annotate(link_count=Count('links'))
            .prefetch_related(
                Prefetch(
                    'links',
                    queryset=SourceLink.objects.select_related('source'),
                ),
            )
        )


# ---------------------------------------------------------------------------
# Threads
# ---------------------------------------------------------------------------


class ThreadListView(ListAPIView):
    """
    GET /api/v1/threads/

    Public research threads with entry count. Supports ?status= filter.
    """
    serializer_class = ThreadListSerializer

    def get_queryset(self):
        qs = ResearchThread.objects.public().annotate(entry_count=Count('entries'))
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs


class ThreadDetailView(RetrieveAPIView):
    """
    GET /api/v1/threads/<slug>/

    Full thread with all entries and entry count.
    """
    serializer_class = ThreadDetailSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        return (
            ResearchThread.objects.public()
            .annotate(entry_count=Count('entries'))
            .prefetch_related(
                Prefetch(
                    'entries',
                    queryset=ThreadEntry.objects.select_related('source').order_by('order', '-date'),
                ),
            )
        )


# ---------------------------------------------------------------------------
# Mentions
# ---------------------------------------------------------------------------


@api_view(['GET'])
def mentions_for_content(request, slug):
    """
    GET /api/v1/mentions/<slug>/

    Verified, public mentions for a content slug.
    """
    mentions = (
        Mention.objects.public()
        .filter(target_slug=slug)
        .select_related('mention_source')
        .order_by('-created_at')
    )
    serializer = MentionSerializer(mentions, many=True)
    return Response({
        'slug': slug,
        'mentions': serializer.data,
    })


# ---------------------------------------------------------------------------
# Backlinks
# ---------------------------------------------------------------------------


@api_view(['GET'])
def backlinks_for_content(request, slug):
    """
    GET /api/v1/backlinks/<slug>/

    Backlink connections for a content slug. Tries essay first,
    then field_note (same heuristic as research_trail).
    """
    content_type = detect_content_type(slug)

    backlinks = get_backlinks(content_type, slug)
    return Response({
        'slug': slug,
        'contentType': content_type,
        'backlinks': [
            {
                'contentType': bl['content_type'],
                'contentSlug': bl['content_slug'],
                'contentTitle': bl['content_title'],
                'sharedSources': [
                    {'sourceId': s['source_id'], 'sourceTitle': s['source_title']}
                    for s in bl['shared_sources']
                ],
            }
            for bl in backlinks
        ],
    })


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------


@api_view(['GET'])
def source_graph(request):
    """
    GET /api/v1/graph/

    Full source graph as nodes + edges for D3.js visualization.

    Nodes are sources and content pieces. Edges are SourceLinks.
    Orphaned sources (no links yet) still appear as isolated nodes
    so newly promoted sources are visible immediately.
    """
    links = (
        SourceLink.objects
        .select_related('source')
        .filter(source__public=True)
    )

    # Build node sets (deduplicated)
    source_nodes = {}
    content_nodes = {}
    edges = []

    for lnk in links:
        src = lnk.source
        source_key = f'source:{src.slug}'
        content_key = f'{lnk.content_type}:{lnk.content_slug}'

        if source_key not in source_nodes:
            source_nodes[source_key] = {
                'id': source_key,
                'type': 'source',
                'label': src.title,
                'slug': src.slug,
                'sourceType': src.source_type,
                'creator': src.creator,
            }

        if content_key not in content_nodes:
            content_nodes[content_key] = {
                'id': content_key,
                'type': lnk.content_type,
                'label': lnk.content_title or lnk.content_slug,
                'slug': lnk.content_slug,
            }

        edges.append({
            'source': source_key,
            'target': content_key,
            'role': lnk.role,
        })

    # Include orphaned public sources (promoted but not yet linked)
    orphaned = (
        Source.objects.public()
        .exclude(slug__in=[
            key.removeprefix('source:') for key in source_nodes
        ])
    )
    for src in orphaned:
        source_key = f'source:{src.slug}'
        source_nodes[source_key] = {
            'id': source_key,
            'type': 'source',
            'label': src.title,
            'slug': src.slug,
            'sourceType': src.source_type,
            'creator': src.creator,
        }

    nodes = list(source_nodes.values()) + list(content_nodes.values())

    return Response({
        'nodes': nodes,
        'edges': edges,
    })


# ---------------------------------------------------------------------------
# Activity (for heatmap visualization)
# ---------------------------------------------------------------------------


@api_view(['GET'])
def research_activity(request):
    """
    GET /api/v1/activity/?days=365

    Daily counts of research activity: sources added, links created,
    and thread entries logged. Powers the ActivityHeatmap visualization
    on the Paper Trail page.

    Returns a flat array of {date, sources, links, entries} objects,
    one per day that had any activity. Days with zero activity across
    all three categories are omitted to keep the response compact.
    """
    try:
        days = int(request.query_params.get('days', 365))
    except (ValueError, TypeError):
        days = 365
    days = min(days, 730)  # cap at 2 years

    since = timezone.now() - timedelta(days=days)

    # Aggregate each model by creation date
    source_counts = dict(
        Source.objects.public()
        .filter(created_at__gte=since)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .values_list('day', 'count')
    )

    link_counts = dict(
        SourceLink.objects
        .filter(created_at__gte=since)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .values_list('day', 'count')
    )

    entry_counts = dict(
        ThreadEntry.objects
        .filter(created_at__gte=since)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .values_list('day', 'count')
    )

    # Merge all dates into one response
    all_dates = sorted(
        set(source_counts.keys()) | set(link_counts.keys()) | set(entry_counts.keys())
    )

    activity = [
        {
            'date': day.isoformat(),
            'sources': source_counts.get(day, 0),
            'links': link_counts.get(day, 0),
            'entries': entry_counts.get(day, 0),
        }
        for day in all_dates
    ]

    return Response(activity)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


@api_view(['GET'])
def research_stats(request):
    """
    GET /api/v1/stats/

    Aggregate counts for the research collection: total public sources,
    links, threads, and a breakdown of sources by type.
    """
    total_sources = Source.objects.public().count()
    total_links = SourceLink.objects.count()
    total_threads = ResearchThread.objects.public().count()

    type_rows = (
        Source.objects.public()
        .values('source_type')
        .annotate(count=Count('id'))
        .order_by('source_type')
    )
    sources_by_type = {row['source_type']: row['count'] for row in type_rows}

    return Response({
        'total_sources': total_sources,
        'total_links': total_links,
        'total_threads': total_threads,
        'sources_by_type': sources_by_type,
    })


# ---------------------------------------------------------------------------
# Internal: Source promotion (from publishing_api Sourcebox)
# ---------------------------------------------------------------------------


def _check_internal_api_key(request):
    """Validate the Authorization: Bearer <key> header against INTERNAL_API_KEY."""
    api_key = settings.INTERNAL_API_KEY
    if not api_key:
        return False
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header.startswith('Bearer '):
        return False
    return auth_header[7:] == api_key


# Mapping from URL domain patterns to likely source types
_DOMAIN_TYPE_HINTS = {
    'youtube.com': SourceType.VIDEO,
    'youtu.be': SourceType.VIDEO,
    'vimeo.com': SourceType.VIDEO,
    'arxiv.org': SourceType.PAPER,
    'scholar.google': SourceType.PAPER,
    'jstor.org': SourceType.PAPER,
    'doi.org': SourceType.PAPER,
    'podcasts.apple.com': SourceType.PODCAST,
    'open.spotify.com/show': SourceType.PODCAST,
    'open.spotify.com/episode': SourceType.PODCAST,
    'archive.org': SourceType.ARCHIVE,
}


def _infer_source_type(url):
    """Best-effort source type from URL. Falls back to 'article'."""
    url_lower = url.lower()
    for pattern, source_type in _DOMAIN_TYPE_HINTS.items():
        if pattern in url_lower:
            return source_type
    return SourceType.ARTICLE


def _unique_slug(title, max_length=500):
    """Generate a unique slug, appending -2, -3, etc. on collision."""
    base = slugify(title)[:max_length]
    slug = base
    counter = 2
    while Source.objects.filter(slug=slug).exists():
        suffix = f'-{counter}'
        slug = base[:max_length - len(suffix)] + suffix
        counter += 1
    return slug


@api_view(['POST'])
def promote_source(request):
    """
    POST /api/v1/internal/promote/

    Create a Source record from Sourcebox triage data. Called by
    publishing_api when a RawSource is accepted.

    Expects:
        Authorization: Bearer <INTERNAL_API_KEY>
        {
            "url": "https://...",
            "title": "...",
            "description": "...",
            "site_name": "...",
            "tags": ["tag1", "tag2"],
            "source_type": "article" (optional, inferred from URL if missing)
        }

    Returns:
        201: {"slug": "...", "id": N, "title": "..."}
        400: {"error": "..."}
        401: {"error": "Invalid API key"}
        409: {"slug": "...", "id": N, "title": "...", "existing": true}
    """
    if not _check_internal_api_key(request):
        return Response({'error': 'Invalid API key'}, status=401)

    data = request.data
    url = data.get('url', '').strip()
    title = data.get('title', '').strip()

    if not url:
        return Response({'error': 'url is required'}, status=400)
    if not title:
        return Response({'error': 'title is required'}, status=400)

    # Check for duplicate by URL
    existing = Source.objects.filter(url=url).first()
    if existing:
        logger.info('Promote: source already exists for URL %s (slug=%s)', url, existing.slug)
        return Response({
            'slug': existing.slug,
            'id': existing.id,
            'title': existing.title,
            'existing': True,
        }, status=409)

    # Determine source type
    source_type = data.get('source_type', '')
    if not source_type or source_type not in dict(SourceType.choices):
        source_type = _infer_source_type(url)

    source = Source.objects.create(
        title=title,
        slug=_unique_slug(title),
        url=url,
        source_type=source_type,
        publication=data.get('site_name', ''),
        public_annotation=data.get('description', ''),
        tags=data.get('tags', []),
        public=True,
        date_encountered=timezone.now().date(),
    )

    logger.info('Promote: created source %s (slug=%s) from URL %s', source.id, source.slug, url)

    return Response({
        'slug': source.slug,
        'id': source.id,
        'title': source.title,
    }, status=201)

"""
Read-only API views for research data.

Two patterns used here:
  - Function views (@api_view) for custom aggregation (trail, backlinks, graph)
  - Generic class-based views (ListAPIView, RetrieveAPIView) for standard list/detail

All endpoints are AllowAny. Data is never written through the API; that
happens through the Django admin or management commands.
"""

from collections import defaultdict

from django.db.models import Count, Prefetch
from rest_framework.decorators import api_view
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response

from apps.mentions.models import Mention
from apps.research.models import (
    ResearchThread,
    Source,
    SourceLink,
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
    This gives the visual explorer everything it needs in one request.
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

    nodes = list(source_nodes.values()) + list(content_nodes.values())

    return Response({
        'nodes': nodes,
        'edges': edges,
    })

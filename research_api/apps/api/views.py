from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.mentions.models import MentionStatus, Webmention
from apps.research.models import ContentReference, ResearchThread, Source
from apps.research.services import get_backlinks

from .serializers import (
    ContentReferenceSerializer,
    ResearchThreadListSerializer,
    ResearchThreadSerializer,
    SourceSerializer,
    WebmentionSerializer,
)


class SourceViewSet(viewsets.ReadOnlyModelViewSet):
    """Public read-only API for research sources."""
    serializer_class = SourceSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        qs = Source.objects.annotate(content_count=Count('references'))
        source_type = self.request.query_params.get('type')
        if source_type:
            qs = qs.filter(source_type=source_type)
        tag = self.request.query_params.get('tag')
        if tag:
            qs = qs.filter(tags__contains=[tag])
        return qs


class ContentReferenceViewSet(viewsets.ReadOnlyModelViewSet):
    """Public read-only API for content references (source citations)."""
    serializer_class = ContentReferenceSerializer

    def get_queryset(self):
        qs = ContentReference.objects.select_related('source')
        content_type = self.request.query_params.get('content_type')
        content_slug = self.request.query_params.get('content_slug')
        if content_type:
            qs = qs.filter(content_type=content_type)
        if content_slug:
            qs = qs.filter(content_slug=content_slug)
        return qs


class ResearchThreadViewSet(viewsets.ReadOnlyModelViewSet):
    """Public read-only API for research threads."""
    lookup_field = 'slug'

    def get_queryset(self):
        qs = ResearchThread.objects.annotate(entry_count=Count('entries'))
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs.prefetch_related('entries__sources')

    def get_serializer_class(self):
        if self.action == 'list':
            return ResearchThreadListSerializer
        return ResearchThreadSerializer


class WebmentionViewSet(viewsets.ReadOnlyModelViewSet):
    """Public read-only API for approved webmentions."""
    serializer_class = WebmentionSerializer

    def get_queryset(self):
        qs = Webmention.objects.filter(status=MentionStatus.APPROVED)
        target = self.request.query_params.get('target')
        if target:
            qs = qs.filter(target_url__contains=target)
        return qs


@api_view(['GET'])
def backlinks_view(request):
    """
    Compute backlinks for a specific content piece.

    Query params:
        content_type: e.g. "essay"
        content_slug: e.g. "housing-crisis"
    """
    content_type = request.query_params.get('content_type', '')
    content_slug = request.query_params.get('content_slug', '')

    if not content_type or not content_slug:
        return Response(
            {'error': 'Both content_type and content_slug are required.'},
            status=400,
        )

    backlinks = get_backlinks(content_type, content_slug)
    return Response({'backlinks': backlinks})

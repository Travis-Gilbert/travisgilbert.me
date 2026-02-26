from rest_framework import serializers

from apps.mentions.models import Webmention
from apps.research.models import (
    ContentReference,
    ResearchThread,
    Source,
    ThreadEntry,
)


class SourceSerializer(serializers.ModelSerializer):
    content_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Source
        fields = [
            'id', 'title', 'slug', 'source_type',
            'authors', 'publisher', 'publication_date',
            'url', 'isbn', 'doi',
            'notes', 'tags', 'cover_image_url',
            'content_count', 'created_at', 'updated_at',
        ]


class ContentReferenceSerializer(serializers.ModelSerializer):
    source_title = serializers.CharField(source='source.title', read_only=True)
    source_slug = serializers.CharField(source='source.slug', read_only=True)

    class Meta:
        model = ContentReference
        fields = [
            'id', 'source', 'source_title', 'source_slug',
            'content_type', 'content_slug', 'content_title',
            'context', 'paragraph_index',
        ]


class ThreadEntrySerializer(serializers.ModelSerializer):
    source_ids = serializers.PrimaryKeyRelatedField(
        source='sources', many=True, read_only=True,
    )

    class Meta:
        model = ThreadEntry
        fields = [
            'id', 'date', 'title', 'body',
            'source_ids', 'content_type', 'content_slug',
        ]


class ResearchThreadSerializer(serializers.ModelSerializer):
    entries = ThreadEntrySerializer(many=True, read_only=True)
    entry_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ResearchThread
        fields = [
            'id', 'title', 'slug', 'description',
            'status', 'started_date', 'tags',
            'entry_count', 'entries',
            'created_at', 'updated_at',
        ]


class ResearchThreadListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list endpoints (no nested entries)."""
    entry_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ResearchThread
        fields = [
            'id', 'title', 'slug', 'description',
            'status', 'started_date', 'tags',
            'entry_count', 'created_at',
        ]


class WebmentionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webmention
        fields = [
            'id', 'source_url', 'target_url',
            'author_name', 'author_url', 'author_photo',
            'content', 'mention_type',
            'verified', 'verified_at',
            'status', 'created_at',
        ]

from rest_framework import serializers

from apps.mentions.models import Mention, MentionSource
from apps.research.models import (
    ResearchThread,
    Source,
    SourceLink,
    ThreadEntry,
)


class SourceSerializer(serializers.ModelSerializer):
    link_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Source
        fields = [
            'id', 'title', 'slug', 'creator', 'source_type',
            'url', 'publication', 'date_published', 'date_encountered',
            'public_annotation', 'key_findings',
            'tags', 'public',
            'location_name', 'latitude', 'longitude',
            'link_count', 'created_at', 'updated_at',
        ]


class SourceLinkSerializer(serializers.ModelSerializer):
    source_title = serializers.CharField(source='source.title', read_only=True)
    source_slug = serializers.CharField(source='source.slug', read_only=True)

    class Meta:
        model = SourceLink
        fields = [
            'id', 'source', 'source_title', 'source_slug',
            'content_type', 'content_slug', 'content_title',
            'role', 'key_quote', 'date_linked',
        ]


class ThreadEntrySerializer(serializers.ModelSerializer):
    source_id = serializers.PrimaryKeyRelatedField(
        source='source', read_only=True,
    )

    class Meta:
        model = ThreadEntry
        fields = [
            'id', 'entry_type', 'date', 'order',
            'title', 'description',
            'source_id', 'field_note_slug',
        ]


class ResearchThreadSerializer(serializers.ModelSerializer):
    entries = ThreadEntrySerializer(many=True, read_only=True)
    entry_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ResearchThread
        fields = [
            'id', 'title', 'slug', 'description',
            'status', 'started_date', 'completed_date',
            'resulting_essay_slug', 'tags', 'public',
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
            'status', 'started_date', 'tags', 'public',
            'entry_count', 'created_at',
        ]


class MentionSourceSerializer(serializers.ModelSerializer):
    mention_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = MentionSource
        fields = [
            'id', 'name', 'slug', 'domain', 'url',
            'description', 'avatar_url', 'trusted',
            'mention_count',
        ]


class MentionSerializer(serializers.ModelSerializer):
    mention_source_name = serializers.CharField(
        source='mention_source.name', read_only=True, default='',
    )

    class Meta:
        model = Mention
        fields = [
            'id', 'source_url', 'source_title', 'source_excerpt',
            'source_author', 'source_author_url', 'source_published',
            'target_content_type', 'target_slug', 'target_url',
            'mention_type', 'discovery_method',
            'verified', 'verified_at', 'public', 'featured',
            'mention_source', 'mention_source_name',
            'created_at',
        ]

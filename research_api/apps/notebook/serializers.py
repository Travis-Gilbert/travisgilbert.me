"""
DRF serializers for the Notebook knowledge graph API.

Unlike the research API (read-only), this API supports writes:
KnowledgeNode create/update and QuickCapture.
"""

from rest_framework import serializers

from .models import (
    DailyLog,
    Edge,
    KnowledgeNode,
    NodeType,
    Notebook,
    ResolvedEntity,
)


# ---------------------------------------------------------------------------
# NodeType
# ---------------------------------------------------------------------------

class NodeTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = NodeType
        fields = [
            'id', 'name', 'slug', 'icon', 'color',
            'schema', 'is_built_in', 'sort_order',
        ]


# ---------------------------------------------------------------------------
# KnowledgeNode
# ---------------------------------------------------------------------------

class KnowledgeNodeListSerializer(serializers.ModelSerializer):
    """Compact node for list views."""
    display_title = serializers.CharField(read_only=True)
    node_type_name = serializers.CharField(
        source='node_type.name', read_only=True, default='',
    )
    node_type_slug = serializers.CharField(
        source='node_type.slug', read_only=True, default='',
    )
    node_type_icon = serializers.CharField(
        source='node_type.icon', read_only=True, default='',
    )
    node_type_color = serializers.CharField(
        source='node_type.color', read_only=True, default='',
    )
    edge_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = KnowledgeNode
        fields = [
            'id', 'title', 'display_title', 'slug',
            'node_type', 'node_type_name', 'node_type_slug',
            'node_type_icon', 'node_type_color',
            'url', 'status', 'is_pinned', 'is_starred',
            'captured_at', 'capture_method',
            'edge_count',
        ]


class KnowledgeNodeDetailSerializer(serializers.ModelSerializer):
    """Full node with nested edges and entities."""
    display_title = serializers.CharField(read_only=True)
    node_type_name = serializers.CharField(
        source='node_type.name', read_only=True, default='',
    )
    node_type_slug = serializers.CharField(
        source='node_type.slug', read_only=True, default='',
    )
    node_type_icon = serializers.CharField(
        source='node_type.icon', read_only=True, default='',
    )
    node_type_color = serializers.CharField(
        source='node_type.color', read_only=True, default='',
    )
    edges_out = serializers.SerializerMethodField()
    edges_in = serializers.SerializerMethodField()
    entities = serializers.SerializerMethodField()
    edge_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = KnowledgeNode
        fields = [
            'id', 'title', 'display_title', 'slug',
            'node_type', 'node_type_name', 'node_type_slug',
            'node_type_icon', 'node_type_color',
            'body', 'url', 'properties',
            'og_title', 'og_description', 'og_image', 'og_site_name',
            'status', 'is_pinned', 'is_starred',
            'notebooks', 'related_essays', 'related_field_notes',
            'captured_at', 'capture_method',
            'edge_count', 'edges_out', 'edges_in', 'entities',
            'created_at', 'updated_at',
        ]

    def get_edges_out(self, obj):
        edges = obj.edges_out.select_related('to_node__node_type')[:20]
        return EdgeCompactSerializer(edges, many=True).data

    def get_edges_in(self, obj):
        edges = obj.edges_in.select_related('from_node__node_type')[:20]
        return EdgeCompactSerializer(edges, many=True).data

    def get_entities(self, obj):
        entities = obj.extracted_entities.all()[:30]
        return ResolvedEntitySerializer(entities, many=True).data


class KnowledgeNodeWriteSerializer(serializers.ModelSerializer):
    """Writable serializer for create/update operations."""

    class Meta:
        model = KnowledgeNode
        fields = [
            'title', 'node_type', 'body', 'url', 'properties',
            'status', 'is_pinned', 'is_starred',
            'notebooks', 'related_essays', 'related_field_notes',
        ]
        extra_kwargs = {
            'title': {'required': False},
            'body': {'required': False},
        }

    def validate(self, data):
        """At least title, body, or url must be provided."""
        title = data.get('title', getattr(self.instance, 'title', ''))
        body = data.get('body', getattr(self.instance, 'body', ''))
        url = data.get('url', getattr(self.instance, 'url', ''))
        if not any([title, body, url]):
            raise serializers.ValidationError(
                'At least one of title, body, or url is required.'
            )
        return data


class QuickCaptureSerializer(serializers.Serializer):
    """Minimal serializer for quick capture: URL or body, nothing else required."""
    url = serializers.URLField(required=False, allow_blank=True, default='')
    body = serializers.CharField(required=False, allow_blank=True, default='')
    title = serializers.CharField(required=False, allow_blank=True, default='')
    node_type = serializers.SlugRelatedField(
        slug_field='slug',
        queryset=NodeType.objects.all(),
        required=False,
        allow_null=True,
        default=None,
    )

    def validate(self, data):
        if not data.get('url') and not data.get('body'):
            raise serializers.ValidationError(
                'Provide at least url or body.'
            )
        return data


# ---------------------------------------------------------------------------
# Edge
# ---------------------------------------------------------------------------

class EdgeSerializer(serializers.ModelSerializer):
    """Full edge with denormalized node info."""
    from_node_title = serializers.CharField(
        source='from_node.display_title', read_only=True,
    )
    from_node_slug = serializers.CharField(
        source='from_node.slug', read_only=True,
    )
    from_node_type = serializers.CharField(
        source='from_node.node_type.slug', read_only=True, default='',
    )
    to_node_title = serializers.CharField(
        source='to_node.display_title', read_only=True,
    )
    to_node_slug = serializers.CharField(
        source='to_node.slug', read_only=True,
    )
    to_node_type = serializers.CharField(
        source='to_node.node_type.slug', read_only=True, default='',
    )

    class Meta:
        model = Edge
        fields = [
            'id', 'from_node', 'to_node',
            'from_node_title', 'from_node_slug', 'from_node_type',
            'to_node_title', 'to_node_slug', 'to_node_type',
            'edge_type', 'reason', 'strength', 'is_auto',
            'created_at',
        ]


class EdgeCompactSerializer(serializers.ModelSerializer):
    """Compact edge for nesting inside node detail."""
    other_node_id = serializers.SerializerMethodField()
    other_node_title = serializers.SerializerMethodField()
    other_node_slug = serializers.SerializerMethodField()
    other_node_type = serializers.SerializerMethodField()

    class Meta:
        model = Edge
        fields = [
            'id', 'edge_type', 'reason', 'strength', 'is_auto',
            'other_node_id', 'other_node_title',
            'other_node_slug', 'other_node_type',
        ]

    def get_other_node_id(self, obj):
        return obj.to_node_id

    def get_other_node_title(self, obj):
        node = obj.to_node
        return node.display_title if node else ''

    def get_other_node_slug(self, obj):
        node = obj.to_node
        return node.slug if node else ''

    def get_other_node_type(self, obj):
        node = obj.to_node
        if node and node.node_type:
            return node.node_type.slug
        return ''


# ---------------------------------------------------------------------------
# ResolvedEntity
# ---------------------------------------------------------------------------

class ResolvedEntitySerializer(serializers.ModelSerializer):
    resolved_node_title = serializers.CharField(
        source='resolved_node.display_title', read_only=True, default='',
    )
    resolved_node_slug = serializers.CharField(
        source='resolved_node.slug', read_only=True, default='',
    )

    class Meta:
        model = ResolvedEntity
        fields = [
            'id', 'text', 'entity_type', 'normalized_text',
            'resolved_node', 'resolved_node_title', 'resolved_node_slug',
            'created_at',
        ]


# ---------------------------------------------------------------------------
# DailyLog
# ---------------------------------------------------------------------------

class DailyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyLog
        fields = [
            'id', 'date',
            'nodes_created', 'nodes_updated',
            'edges_created', 'entities_resolved',
            'summary',
        ]


# ---------------------------------------------------------------------------
# Notebook
# ---------------------------------------------------------------------------

class NotebookListSerializer(serializers.ModelSerializer):
    node_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Notebook
        fields = [
            'id', 'name', 'slug', 'description',
            'color', 'icon', 'is_active', 'sort_order',
            'target_essay_slug', 'target_video_slug',
            'node_count',
        ]


class NotebookDetailSerializer(serializers.ModelSerializer):
    nodes = KnowledgeNodeListSerializer(many=True, read_only=True)
    node_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Notebook
        fields = [
            'id', 'name', 'slug', 'description',
            'color', 'icon', 'is_active', 'sort_order',
            'target_essay_slug', 'target_video_slug',
            'node_count', 'nodes',
            'created_at', 'updated_at',
        ]

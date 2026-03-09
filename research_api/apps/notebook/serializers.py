"""
DRF serializers for the CommonPlace knowledge graph API.

Provides List/Detail/Write serializer tiers for Object, Node, Component,
plus flat serializers for supporting models.
"""

from django.db.models import Q
from rest_framework import serializers

from .models import (
    Component,
    ComponentType,
    DailyLog,
    Edge,
    Layout,
    Node,
    Notebook,
    Object,
    ObjectType,
    Project,
    ResolvedEntity,
    Timeline,
)


# ---------------------------------------------------------------------------
# ObjectType
# ---------------------------------------------------------------------------

class ObjectTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ObjectType
        fields = [
            'id', 'name', 'slug', 'icon', 'color',
            'schema', 'default_components', 'is_built_in', 'sort_order',
        ]


# ---------------------------------------------------------------------------
# ComponentType
# ---------------------------------------------------------------------------

class ComponentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComponentType
        fields = [
            'id', 'name', 'slug', 'data_type',
            'triggers_node', 'schema', 'is_built_in', 'sort_order',
        ]


# ---------------------------------------------------------------------------
# Component
# ---------------------------------------------------------------------------

class ComponentSerializer(serializers.ModelSerializer):
    component_type_name = serializers.CharField(
        source='component_type.name', read_only=True,
    )
    data_type = serializers.CharField(
        source='component_type.data_type', read_only=True,
    )

    class Meta:
        model = Component
        fields = [
            'id', 'object', 'component_type', 'component_type_name',
            'data_type', 'key', 'value', 'sort_order',
        ]


class ComponentWriteSerializer(serializers.ModelSerializer):
    component_type_slug = serializers.SlugField(write_only=True, required=False)

    class Meta:
        model = Component
        fields = [
            'object', 'component_type', 'component_type_slug',
            'key', 'value', 'sort_order',
        ]
        validators = []
        extra_kwargs = {
            'object': {'required': False},
            'component_type': {'required': False},
        }

    def validate(self, attrs):
        slug = attrs.pop('component_type_slug', None)
        if slug and 'component_type' not in attrs:
            component_type = ComponentType.objects.filter(slug=slug).first()
            # Backward compatibility: treat task as status if task type is not seeded yet.
            if component_type is None and slug == 'task':
                component_type = ComponentType.objects.filter(slug='status').first()
            if component_type is None:
                raise serializers.ValidationError({
                    'component_type_slug': f'Unknown component type: {slug}',
                })
            attrs['component_type'] = component_type

        if 'component_type' not in attrs:
            if self.instance is not None:
                attrs['component_type'] = self.instance.component_type
            else:
                raise serializers.ValidationError({
                    'component_type': 'This field is required.',
                })

        if 'object' not in attrs and self.instance is not None:
            attrs['object'] = self.instance.object

        if (
            self.instance is None and
            'object' in attrs and
            'component_type' in attrs and
            'key' in attrs
        ):
            exists = Component.objects.filter(
                object=attrs['object'],
                component_type=attrs['component_type'],
                key=attrs['key'],
            ).exists()
            if exists:
                raise serializers.ValidationError({
                    'key': 'A component with this key already exists for this object/type.',
                })

        return attrs


# ---------------------------------------------------------------------------
# Edge
# ---------------------------------------------------------------------------

class ObjectConnectionSerializer(serializers.Serializer):
    """One connection (Edge) for the Object detail panel."""
    connected_object = serializers.SerializerMethodField()
    explanation = serializers.CharField(source='reason')
    is_manual = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField()
    edge_type = serializers.CharField()

    def get_connected_object(self, edge):
        # Return the OTHER end of the edge, not the current object
        current_id = self.context.get('current_object_id')
        other = edge.to_object if edge.from_object_id == current_id else edge.from_object
        return {
            'id': f'object:{other.pk}',
            'type': other.object_type.slug if other.object_type else 'unknown',
            'type_color': other.object_type.color if other.object_type else '#9A8E82',
            'title': other.display_title,
            'slug': other.slug,
        }

    def get_is_manual(self, edge):
        return not edge.is_auto


class EdgeSerializer(serializers.ModelSerializer):
    from_title = serializers.CharField(
        source='from_object.display_title', read_only=True,
    )
    from_slug = serializers.SlugField(
        source='from_object.slug', read_only=True,
    )
    from_type = serializers.CharField(
        source='from_object.object_type.slug', read_only=True, default='',
    )
    to_title = serializers.CharField(
        source='to_object.display_title', read_only=True,
    )
    to_slug = serializers.SlugField(
        source='to_object.slug', read_only=True,
    )
    to_type = serializers.CharField(
        source='to_object.object_type.slug', read_only=True, default='',
    )

    class Meta:
        model = Edge
        fields = [
            'id', 'from_object', 'to_object',
            'from_title', 'from_slug', 'from_type',
            'to_title', 'to_slug', 'to_type',
            'edge_type', 'reason', 'strength', 'is_auto', 'engine',
            'created_at',
        ]


class EdgeCompactSerializer(serializers.ModelSerializer):
    """Compact edge for nesting in Object detail."""
    other_title = serializers.SerializerMethodField()
    other_id = serializers.SerializerMethodField()
    direction = serializers.SerializerMethodField()

    class Meta:
        model = Edge
        fields = [
            'id', 'other_id', 'other_title', 'direction',
            'edge_type', 'reason', 'strength', 'engine',
        ]

    def get_other_title(self, edge):
        context_obj_id = self.context.get('object_id')
        if edge.from_object_id == context_obj_id:
            return edge.to_object.display_title
        return edge.from_object.display_title

    def get_other_id(self, edge):
        context_obj_id = self.context.get('object_id')
        if edge.from_object_id == context_obj_id:
            return edge.to_object_id
        return edge.from_object_id

    def get_direction(self, edge):
        context_obj_id = self.context.get('object_id')
        if edge.from_object_id == context_obj_id:
            return 'outgoing'
        return 'incoming'


# ---------------------------------------------------------------------------
# ResolvedEntity
# ---------------------------------------------------------------------------

class ResolvedEntitySerializer(serializers.ModelSerializer):
    source_title = serializers.CharField(
        source='source_object.display_title', read_only=True,
    )
    resolved_title = serializers.CharField(
        source='resolved_object.display_title', read_only=True, default='',
    )

    class Meta:
        model = ResolvedEntity
        fields = [
            'id', 'text', 'entity_type', 'normalized_text',
            'source_object', 'source_title',
            'resolved_object', 'resolved_title',
            'created_at',
        ]


# ---------------------------------------------------------------------------
# Node (timeline events)
# ---------------------------------------------------------------------------

class NodeListSerializer(serializers.ModelSerializer):
    object_title = serializers.CharField(
        source='object_ref.display_title', read_only=True, default='',
    )
    object_type = serializers.CharField(
        source='object_ref.object_type.slug', read_only=True, default='',
    )
    object_slug = serializers.CharField(
        source='object_ref.slug', read_only=True, default='',
    )

    class Meta:
        model = Node
        fields = [
            'id', 'sha_hash', 'node_type', 'occurred_at',
            'title', 'object_ref', 'object_title', 'object_type',
            'object_slug',
        ]


class NodeDetailSerializer(serializers.ModelSerializer):
    object_title = serializers.CharField(
        source='object_ref.display_title', read_only=True, default='',
    )
    project_name = serializers.CharField(
        source='project_ref.name', read_only=True, default='',
    )
    timeline_name = serializers.CharField(
        source='timeline.name', read_only=True, default='',
    )

    class Meta:
        model = Node
        fields = [
            'id', 'sha_hash', 'node_type', 'occurred_at',
            'title', 'body',
            'object_ref', 'object_title',
            'project_ref', 'project_name',
            'component_ref',
            'timeline', 'timeline_name',
            'retrospective_notes', 'severity', 'tags', 'documents',
            'created_at', 'updated_at',
        ]


class RetrospectiveNoteSerializer(serializers.Serializer):
    """For adding retrospective notes to an existing Node."""
    text = serializers.CharField(max_length=2000)


# ---------------------------------------------------------------------------
# Object
# ---------------------------------------------------------------------------

class ObjectListSerializer(serializers.ModelSerializer):
    display_title = serializers.CharField(read_only=True)
    object_type_name = serializers.CharField(
        source='object_type.name', read_only=True, default='',
    )
    object_type_color = serializers.CharField(
        source='object_type.color', read_only=True, default='',
    )
    object_type_icon = serializers.CharField(
        source='object_type.icon', read_only=True, default='',
    )
    edge_count = serializers.IntegerField(read_only=True, default=0)
    component_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Object
        fields = [
            'id', 'title', 'display_title', 'slug',
            'object_type', 'object_type_name', 'object_type_color', 'object_type_icon',
            'status', 'is_pinned', 'is_starred',
            'captured_at', 'capture_method',
            'edge_count', 'component_count',
        ]


class ObjectDetailSerializer(serializers.ModelSerializer):
    display_title = serializers.CharField(read_only=True)
    object_type_data = ObjectTypeSerializer(source='object_type', read_only=True)
    components = ComponentSerializer(many=True, read_only=True)
    entities = ResolvedEntitySerializer(
        source='extracted_entities', many=True, read_only=True,
    )
    edges = serializers.SerializerMethodField()
    recent_nodes = serializers.SerializerMethodField()
    id_prefixed = serializers.SerializerMethodField()
    connections = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()
    projects = serializers.SerializerMethodField()
    notebooks = serializers.SerializerMethodField()

    class Meta:
        model = Object
        fields = [
            'id', 'id_prefixed', 'title', 'display_title', 'slug', 'sha_hash',
            'object_type', 'object_type_data',
            'body', 'url', 'properties',
            'og_title', 'og_description', 'og_image', 'og_site_name',
            'status', 'is_pinned', 'is_starred',
            'notebook', 'project',
            'related_essays', 'related_field_notes',
            'promoted_source',
            'captured_at', 'capture_method',
            'created_at', 'updated_at',
            'components', 'entities', 'edges', 'recent_nodes',
            'connections', 'history', 'projects', 'notebooks',
        ]

    def get_id_prefixed(self, obj):
        return f'object:{obj.pk}'

    def get_edges(self, obj):
        all_edges = list(obj.edges_out.all()) + list(obj.edges_in.all())
        return EdgeCompactSerializer(
            all_edges, many=True,
            context={'object_id': obj.id},
        ).data

    def get_recent_nodes(self, obj):
        nodes = obj.timeline_nodes.order_by('-occurred_at')[:10]
        return NodeListSerializer(nodes, many=True).data

    def get_connections(self, obj):
        from .models import Edge
        edges = Edge.objects.filter(
            Q(from_object=obj) | Q(to_object=obj)
        ).select_related(
            'from_object', 'from_object__object_type',
            'to_object', 'to_object__object_type',
        ).order_by('-strength')[:20]
        return ObjectConnectionSerializer(
            edges, many=True, context={'current_object_id': obj.pk}
        ).data

    def get_history(self, obj):
        from .views import NODE_ICONS
        nodes = obj.timeline_nodes.order_by('-occurred_at')[:20]
        return [
            {
                'node_type': n.node_type,
                'icon': NODE_ICONS.get(n.node_type, 'circle'),
                'timestamp': n.occurred_at.isoformat(),
                'summary': n.title,
            }
            for n in nodes
        ]

    def get_projects(self, obj):
        if obj.project:
            return [obj.project.slug]
        return []

    def get_notebooks(self, obj):
        if obj.notebook:
            return [obj.notebook.slug]
        return []


class ObjectWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Object
        fields = [
            'title', 'object_type', 'body', 'url', 'properties',
            'status', 'is_pinned', 'is_starred',
            'notebook', 'project',
            'related_essays', 'related_field_notes',
        ]


# ---------------------------------------------------------------------------
# Notebook
# ---------------------------------------------------------------------------

class NotebookListSerializer(serializers.ModelSerializer):
    object_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Notebook
        fields = [
            'id', 'name', 'slug', 'description',
            'color', 'icon', 'is_active', 'sort_order',
            'object_count',
        ]


class NotebookDetailSerializer(serializers.ModelSerializer):
    objects = ObjectListSerializer(
        source='notebook_objects', many=True, read_only=True,
    )
    object_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Notebook
        fields = [
            'id', 'name', 'slug', 'description',
            'color', 'icon', 'is_active', 'sort_order',
            'target_essay_slug', 'target_video_slug',
            'engine_config', 'available_types', 'default_layout',
            'theme', 'context_behavior', 'default_project_mode',
            'object_count', 'objects',
        ]


class NotebookWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notebook
        fields = [
            'name', 'slug', 'description', 'color', 'icon',
            'is_active', 'sort_order',
            'engine_config', 'available_types', 'default_layout',
            'theme', 'context_behavior', 'default_project_mode',
        ]


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

class ProjectListSerializer(serializers.ModelSerializer):
    notebook_name = serializers.CharField(
        source='notebook.name', read_only=True, default='',
    )

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'slug', 'mode', 'status',
            'notebook', 'notebook_name',
            'is_template', 'reminder_at',
        ]


class ProjectDetailSerializer(serializers.ModelSerializer):
    notebook_name = serializers.CharField(
        source='notebook.name', read_only=True, default='',
    )
    objects = ObjectListSerializer(
        source='project_objects', many=True, read_only=True,
    )

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'slug', 'sha_hash',
            'mode', 'status', 'description',
            'notebook', 'notebook_name',
            'is_template', 'template_from', 'reminder_at',
            'settings_override',
            'objects',
        ]


class ProjectWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            'name', 'slug', 'mode', 'status', 'description',
            'notebook', 'is_template', 'template_from', 'reminder_at',
            'settings_override',
        ]


# ---------------------------------------------------------------------------
# Timeline
# ---------------------------------------------------------------------------

class TimelineSerializer(serializers.ModelSerializer):
    recent_nodes = serializers.SerializerMethodField()
    node_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Timeline
        fields = [
            'id', 'name', 'slug', 'is_master',
            'project', 'notebook',
            'filter_config', 'engine_config',
            'node_count', 'recent_nodes',
        ]

    def get_recent_nodes(self, obj):
        nodes = obj.nodes.order_by('-occurred_at')[:20]
        return NodeListSerializer(nodes, many=True).data


# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------

class LayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Layout
        fields = ['id', 'name', 'slug', 'config', 'is_preset']


# ---------------------------------------------------------------------------
# DailyLog
# ---------------------------------------------------------------------------

class DailyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyLog
        fields = [
            'id', 'date',
            'objects_created', 'objects_updated',
            'edges_created', 'entities_resolved',
            'summary',
        ]

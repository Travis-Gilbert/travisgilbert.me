"""
Admin configuration for the Notebooks knowledge graph.

Optimized for fast knowledge capture and browsing the connection graph.
Rich list views, inline edges, and custom actions for bulk operations.
"""

from django.contrib import admin
from django.db.models import Count, Q
from django.utils.html import format_html

from .models import (
    DailyLog,
    Edge,
    KnowledgeNode,
    NodeType,
    Notebook,
    ResolvedEntity,
)


# ---------------------------------------------------------------------------
# Inlines
# ---------------------------------------------------------------------------


class EdgeFromInline(admin.TabularInline):
    """Edges going OUT from this node."""

    model = Edge
    fk_name = 'from_node'
    extra = 0
    fields = ['to_node', 'edge_type', 'reason', 'strength', 'is_auto']
    readonly_fields = ['is_auto']
    raw_id_fields = ['to_node']
    verbose_name = 'outgoing connection'
    verbose_name_plural = 'outgoing connections'


class EdgeToInline(admin.TabularInline):
    """Edges coming IN to this node."""

    model = Edge
    fk_name = 'to_node'
    extra = 0
    fields = ['from_node', 'edge_type', 'reason', 'strength', 'is_auto']
    readonly_fields = ['is_auto']
    raw_id_fields = ['from_node']
    verbose_name = 'incoming connection'
    verbose_name_plural = 'incoming connections'


class ResolvedEntityInline(admin.TabularInline):
    """Entities extracted from this node by spaCy."""

    model = ResolvedEntity
    fk_name = 'source_node'
    extra = 0
    fields = ['text', 'entity_type', 'normalized_text', 'resolved_node']
    readonly_fields = ['text', 'entity_type', 'normalized_text']
    raw_id_fields = ['resolved_node']


# ---------------------------------------------------------------------------
# NodeType
# ---------------------------------------------------------------------------


@admin.register(NodeType)
class NodeTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'color_swatch', 'icon', 'is_built_in', 'node_count', 'sort_order']
    list_editable = ['sort_order']
    list_filter = ['is_built_in']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = [
        (None, {
            'fields': ['name', 'slug', 'icon', 'color', 'sort_order'],
        }),
        ('Schema', {
            'fields': ['schema'],
            'classes': ['collapse'],
            'description': 'JSON schema for type-specific properties.',
        }),
        ('System', {
            'fields': ['is_built_in', 'created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _node_count=Count('nodes'),
        )

    @admin.display(description='Nodes', ordering='_node_count')
    def node_count(self, obj):
        return obj._node_count

    @admin.display(description='Color')
    def color_swatch(self, obj):
        return format_html(
            '<span style="display:inline-block;width:14px;height:14px;'
            'border-radius:3px;background:{};vertical-align:middle;'
            'margin-right:6px;border:1px solid #ccc;"></span>{}',
            obj.color, obj.color,
        )


# ---------------------------------------------------------------------------
# KnowledgeNode
# ---------------------------------------------------------------------------


@admin.register(KnowledgeNode)
class KnowledgeNodeAdmin(admin.ModelAdmin):
    list_display = [
        'display_title_short', 'node_type', 'status',
        'is_pinned', 'is_starred', 'edge_count',
        'capture_method', 'captured_at',
    ]
    list_filter = ['status', 'node_type', 'is_pinned', 'is_starred', 'capture_method']
    search_fields = ['title', 'body', 'search_text', 'url']
    list_editable = ['status', 'is_pinned', 'is_starred']
    date_hierarchy = 'captured_at'
    raw_id_fields = ['promoted_source']
    readonly_fields = ['search_text', 'captured_at', 'created_at', 'updated_at']
    inlines = [ResolvedEntityInline, EdgeFromInline, EdgeToInline]

    fieldsets = [
        (None, {
            'fields': ['title', 'slug', 'node_type', 'status'],
        }),
        ('Content', {
            'fields': ['body', 'url', 'properties'],
        }),
        ('OG Metadata', {
            'fields': ['og_title', 'og_description', 'og_image', 'og_site_name'],
            'classes': ['collapse'],
        }),
        ('Organization', {
            'fields': ['is_pinned', 'is_starred', 'notebooks'],
        }),
        ('Published Content Links', {
            'fields': ['related_essays', 'related_field_notes', 'promoted_source'],
            'classes': ['collapse'],
        }),
        ('Capture', {
            'fields': ['capture_method', 'captured_at'],
            'classes': ['collapse'],
        }),
        ('System', {
            'fields': ['search_text', 'created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]

    def get_queryset(self, request):
        return (
            super().get_queryset(request)
            .select_related('node_type')
            .annotate(
                _edge_count=Count('edges_out', distinct=True) + Count('edges_in', distinct=True),
            )
        )

    @admin.display(description='Title')
    def display_title_short(self, obj):
        title = obj.display_title
        if len(title) > 60:
            return title[:57] + '...'
        return title

    @admin.display(description='Edges', ordering='_edge_count')
    def edge_count(self, obj):
        return obj._edge_count


# ---------------------------------------------------------------------------
# Edge
# ---------------------------------------------------------------------------


@admin.register(Edge)
class EdgeAdmin(admin.ModelAdmin):
    list_display = [
        'from_node_short', 'arrow', 'to_node_short',
        'edge_type', 'strength_bar', 'is_auto', 'created_at',
    ]
    list_filter = ['edge_type', 'is_auto']
    search_fields = ['reason', 'from_node__title', 'to_node__title']
    raw_id_fields = ['from_node', 'to_node']
    readonly_fields = ['created_at', 'updated_at']
    list_select_related = ['from_node', 'to_node']

    fieldsets = [
        (None, {
            'fields': ['from_node', 'to_node', 'edge_type'],
        }),
        ('Explanation', {
            'fields': ['reason', 'strength', 'is_auto'],
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]

    @admin.display(description='From')
    def from_node_short(self, obj):
        return obj.from_node.display_title[:40]

    @admin.display(description='')
    def arrow(self, obj):
        return '->'

    @admin.display(description='To')
    def to_node_short(self, obj):
        return obj.to_node.display_title[:40]

    @admin.display(description='Strength')
    def strength_bar(self, obj):
        pct = int(obj.strength * 100)
        return format_html(
            '<div style="background:#eee;width:60px;height:10px;border-radius:3px;">'
            '<div style="background:#2D5F6B;width:{}%;height:100%;border-radius:3px;"></div>'
            '</div>',
            pct,
        )


# ---------------------------------------------------------------------------
# ResolvedEntity
# ---------------------------------------------------------------------------


@admin.register(ResolvedEntity)
class ResolvedEntityAdmin(admin.ModelAdmin):
    list_display = [
        'text', 'entity_type', 'source_node_short',
        'resolved_node_short', 'created_at',
    ]
    list_filter = ['entity_type']
    search_fields = ['text', 'normalized_text', 'source_node__title']
    raw_id_fields = ['source_node', 'resolved_node']
    readonly_fields = ['created_at', 'updated_at']
    list_select_related = ['source_node', 'resolved_node']

    @admin.display(description='From Node')
    def source_node_short(self, obj):
        return obj.source_node.display_title[:40]

    @admin.display(description='Resolved To')
    def resolved_node_short(self, obj):
        if obj.resolved_node:
            return obj.resolved_node.display_title[:40]
        return ''


# ---------------------------------------------------------------------------
# DailyLog
# ---------------------------------------------------------------------------


@admin.register(DailyLog)
class DailyLogAdmin(admin.ModelAdmin):
    list_display = [
        'date', 'nodes_created_count', 'nodes_updated_count',
        'edges_created_count', 'entities_count',
    ]
    readonly_fields = [
        'date', 'nodes_created', 'nodes_updated',
        'edges_created', 'entities_resolved', 'summary',
        'created_at', 'updated_at',
    ]
    date_hierarchy = 'date'
    ordering = ['-date']

    @admin.display(description='Created')
    def nodes_created_count(self, obj):
        return len(obj.nodes_created) if obj.nodes_created else 0

    @admin.display(description='Updated')
    def nodes_updated_count(self, obj):
        return len(obj.nodes_updated) if obj.nodes_updated else 0

    @admin.display(description='Edges')
    def edges_created_count(self, obj):
        return len(obj.edges_created) if obj.edges_created else 0

    @admin.display(description='Entities')
    def entities_count(self, obj):
        return len(obj.entities_resolved) if obj.entities_resolved else 0


# ---------------------------------------------------------------------------
# Notebook
# ---------------------------------------------------------------------------


@admin.register(Notebook)
class NotebookAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'slug', 'color_swatch', 'is_active',
        'node_count', 'target_essay_slug', 'sort_order',
    ]
    list_filter = ['is_active']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    list_editable = ['sort_order', 'is_active']
    readonly_fields = ['created_at', 'updated_at']
    filter_horizontal = ['nodes']

    fieldsets = [
        (None, {
            'fields': ['name', 'slug', 'description', 'color', 'icon'],
        }),
        ('Organization', {
            'fields': ['is_active', 'sort_order'],
        }),
        ('Content Targets', {
            'fields': ['target_essay_slug', 'target_video_slug'],
            'classes': ['collapse'],
        }),
        ('Nodes', {
            'fields': ['nodes'],
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _node_count=Count('nodes'),
        )

    @admin.display(description='Nodes', ordering='_node_count')
    def node_count(self, obj):
        return obj._node_count

    @admin.display(description='Color')
    def color_swatch(self, obj):
        return format_html(
            '<span style="display:inline-block;width:14px;height:14px;'
            'border-radius:3px;background:{};vertical-align:middle;'
            'margin-right:6px;border:1px solid #ccc;"></span>{}',
            obj.color, obj.color,
        )

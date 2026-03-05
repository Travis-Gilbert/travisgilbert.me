"""
Django admin for CommonPlace knowledge graph.

Rich list views with color swatches, inline Components/Edges,
edge count annotations, and status filters for all 11 models.
"""

from django.contrib import admin
from django.db.models import Count
from django.utils.html import format_html

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
# Inlines
# ---------------------------------------------------------------------------

class ComponentInline(admin.TabularInline):
    model = Component
    extra = 1
    fields = ('component_type', 'key', 'value', 'sort_order')
    autocomplete_fields = ('component_type',)


class EdgeFromInline(admin.TabularInline):
    model = Edge
    fk_name = 'from_object'
    extra = 0
    fields = ('to_object', 'edge_type', 'strength', 'reason', 'is_auto', 'engine')
    autocomplete_fields = ('to_object',)
    verbose_name = 'Outgoing edge'
    verbose_name_plural = 'Outgoing edges'


class EdgeToInline(admin.TabularInline):
    model = Edge
    fk_name = 'to_object'
    extra = 0
    fields = ('from_object', 'edge_type', 'strength', 'reason', 'is_auto', 'engine')
    autocomplete_fields = ('from_object',)
    verbose_name = 'Incoming edge'
    verbose_name_plural = 'Incoming edges'


# ---------------------------------------------------------------------------
# ObjectType
# ---------------------------------------------------------------------------

@admin.register(ObjectType)
class ObjectTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'color_swatch', 'icon', 'object_count', 'default_components_display', 'is_built_in', 'sort_order')
    list_filter = ('is_built_in',)
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('object_count',)

    def color_swatch(self, obj):
        return format_html(
            '<span style="display:inline-block;width:18px;height:18px;'
            'border-radius:3px;background:{};border:1px solid #ccc;"></span> {}',
            obj.color, obj.color,
        )
    color_swatch.short_description = 'Color'

    def default_components_display(self, obj):
        if obj.default_components:
            return ', '.join(obj.default_components)
        return ''
    default_components_display.short_description = 'Default components'

    def object_count(self, obj):
        return obj.typed_objects.count()
    object_count.short_description = 'Objects'

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('typed_objects')


# ---------------------------------------------------------------------------
# Object
# ---------------------------------------------------------------------------

@admin.register(Object)
class ObjectAdmin(admin.ModelAdmin):
    list_display = (
        'display_title', 'type_badge', 'status', 'is_pinned', 'is_starred',
        'notebook', 'edge_count', 'component_count', 'captured_at',
    )
    list_filter = ('status', 'object_type', 'is_pinned', 'is_starred', 'notebook', 'capture_method')
    search_fields = ('title', 'body', 'search_text', 'slug')
    readonly_fields = ('sha_hash', 'search_text', 'display_title', 'captured_at', 'created_at', 'updated_at')
    autocomplete_fields = ('object_type', 'notebook', 'project', 'promoted_source')
    prepopulated_fields = {'slug': ('title',)}
    inlines = [ComponentInline, EdgeFromInline, EdgeToInline]
    date_hierarchy = 'captured_at'

    fieldsets = (
        (None, {
            'fields': ('title', 'slug', 'object_type', 'status'),
        }),
        ('Content', {
            'fields': ('body', 'url', 'properties'),
        }),
        ('Organization', {
            'fields': ('notebook', 'project', 'is_pinned', 'is_starred'),
        }),
        ('OG Metadata', {
            'classes': ('collapse',),
            'fields': ('og_title', 'og_description', 'og_image', 'og_site_name'),
        }),
        ('Related Content', {
            'classes': ('collapse',),
            'fields': ('related_essays', 'related_field_notes', 'promoted_source'),
        }),
        ('Read-only', {
            'classes': ('collapse',),
            'fields': ('sha_hash', 'search_text', 'display_title', 'capture_method', 'captured_at', 'created_at', 'updated_at'),
        }),
    )

    def type_badge(self, obj):
        if obj.object_type:
            return format_html(
                '<span style="display:inline-block;padding:2px 8px;border-radius:3px;'
                'background:{};color:#fff;font-size:11px;">{}</span>',
                obj.object_type.color, obj.object_type.name,
            )
        return ''
    type_badge.short_description = 'Type'
    type_badge.admin_order_field = 'object_type__name'

    def edge_count(self, obj):
        return obj._edge_count
    edge_count.short_description = 'Edges'
    edge_count.admin_order_field = '_edge_count'

    def component_count(self, obj):
        return obj._component_count
    component_count.short_description = 'Cmps'
    component_count.admin_order_field = '_component_count'

    def get_queryset(self, request):
        return (
            super().get_queryset(request)
            .select_related('object_type', 'notebook', 'project')
            .annotate(
                _edge_count=Count('edges_out', distinct=True) + Count('edges_in', distinct=True),
                _component_count=Count('components', distinct=True),
            )
        )


# ---------------------------------------------------------------------------
# ComponentType
# ---------------------------------------------------------------------------

@admin.register(ComponentType)
class ComponentTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'data_type', 'triggers_node', 'is_built_in', 'sort_order')
    list_filter = ('data_type', 'triggers_node', 'is_built_in')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


# ---------------------------------------------------------------------------
# Component
# ---------------------------------------------------------------------------

@admin.register(Component)
class ComponentAdmin(admin.ModelAdmin):
    list_display = ('key', 'component_type', 'object_link', 'value_preview', 'sort_order')
    list_filter = ('component_type',)
    search_fields = ('key', 'object__title')
    autocomplete_fields = ('object', 'component_type')

    def object_link(self, obj):
        return format_html(
            '<a href="/admin/notebook/object/{}/change/">{}</a>',
            obj.object_id, obj.object.display_title[:40],
        )
    object_link.short_description = 'Object'

    def value_preview(self, obj):
        v = str(obj.value)
        return v[:80] + '...' if len(v) > 80 else v
    value_preview.short_description = 'Value'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('object', 'component_type')


# ---------------------------------------------------------------------------
# Node (immutable timeline events)
# ---------------------------------------------------------------------------

@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    list_display = ('title_display', 'node_type', 'object_ref_link', 'timeline', 'occurred_at')
    list_filter = ('node_type', 'timeline')
    search_fields = ('title', 'body', 'sha_hash')
    readonly_fields = (
        'sha_hash', 'node_type', 'occurred_at', 'title', 'body',
        'object_ref', 'project_ref', 'component_ref', 'timeline',
        'severity', 'tags', 'documents', 'retrospective_notes',
        'created_at', 'updated_at',
    )
    date_hierarchy = 'occurred_at'

    def title_display(self, obj):
        return obj.title[:60] if obj.title else f'[{obj.node_type}]'
    title_display.short_description = 'Title'

    def object_ref_link(self, obj):
        if obj.object_ref:
            return format_html(
                '<a href="/admin/notebook/object/{}/change/">{}</a>',
                obj.object_ref_id, obj.object_ref.display_title[:40],
            )
        return ''
    object_ref_link.short_description = 'Object'

    def has_add_permission(self, request):
        return False  # Nodes are created by signals only

    def has_delete_permission(self, request, obj=None):
        return False  # Nodes are immutable

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('object_ref', 'timeline')


# ---------------------------------------------------------------------------
# Edge
# ---------------------------------------------------------------------------

@admin.register(Edge)
class EdgeAdmin(admin.ModelAdmin):
    list_display = ('from_object', 'edge_type', 'to_object', 'strength_bar', 'engine', 'is_auto')
    list_filter = ('edge_type', 'engine', 'is_auto')
    search_fields = ('from_object__title', 'to_object__title', 'reason')
    autocomplete_fields = ('from_object', 'to_object')

    def strength_bar(self, obj):
        pct = int((obj.strength or 0) * 100)
        return format_html(
            '<div style="width:60px;background:#eee;border-radius:3px;">'
            '<div style="width:{}%;background:#2D5F6B;height:8px;border-radius:3px;"></div>'
            '</div> {}',
            pct, f'{obj.strength:.2f}',
        )
    strength_bar.short_description = 'Strength'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('from_object', 'to_object')


# ---------------------------------------------------------------------------
# ResolvedEntity
# ---------------------------------------------------------------------------

@admin.register(ResolvedEntity)
class ResolvedEntityAdmin(admin.ModelAdmin):
    list_display = ('text', 'entity_type', 'normalized_text', 'source_link', 'resolved_link')
    list_filter = ('entity_type',)
    search_fields = ('text', 'normalized_text')
    autocomplete_fields = ('source_object', 'resolved_object')

    def source_link(self, obj):
        return format_html(
            '<a href="/admin/notebook/object/{}/change/">{}</a>',
            obj.source_object_id, obj.source_object.display_title[:30],
        )
    source_link.short_description = 'Source'

    def resolved_link(self, obj):
        if obj.resolved_object:
            return format_html(
                '<a href="/admin/notebook/object/{}/change/">{}</a>',
                obj.resolved_object_id, obj.resolved_object.display_title[:30],
            )
        return ''
    resolved_link.short_description = 'Resolved to'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('source_object', 'resolved_object')


# ---------------------------------------------------------------------------
# Notebook
# ---------------------------------------------------------------------------

@admin.register(Notebook)
class NotebookAdmin(admin.ModelAdmin):
    list_display = ('name', 'color_swatch', 'object_count', 'is_active', 'default_project_mode', 'sort_order')
    list_filter = ('is_active', 'default_project_mode')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}

    fieldsets = (
        (None, {
            'fields': ('name', 'slug', 'description', 'color', 'icon', 'is_active', 'sort_order'),
        }),
        ('Publishing Links', {
            'classes': ('collapse',),
            'fields': ('target_essay_slug', 'target_video_slug'),
        }),
        ('Configuration', {
            'classes': ('collapse',),
            'fields': ('engine_config', 'available_types', 'default_layout', 'theme', 'context_behavior', 'default_project_mode'),
        }),
    )

    def color_swatch(self, obj):
        return format_html(
            '<span style="display:inline-block;width:18px;height:18px;'
            'border-radius:3px;background:{};border:1px solid #ccc;"></span> {}',
            obj.color, obj.color,
        )
    color_swatch.short_description = 'Color'

    def object_count(self, obj):
        return obj.notebook_objects.count()
    object_count.short_description = 'Objects'


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'mode', 'status', 'notebook', 'is_template', 'reminder_at')
    list_filter = ('mode', 'status', 'is_template')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    autocomplete_fields = ('notebook', 'template_from')
    readonly_fields = ('sha_hash',)


# ---------------------------------------------------------------------------
# Timeline
# ---------------------------------------------------------------------------

@admin.register(Timeline)
class TimelineAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_master', 'node_count', 'project', 'notebook')
    list_filter = ('is_master',)
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    autocomplete_fields = ('project', 'notebook')

    def node_count(self, obj):
        return obj.nodes.count()
    node_count.short_description = 'Nodes'


# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------

@admin.register(Layout)
class LayoutAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_preset')
    list_filter = ('is_preset',)
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


# ---------------------------------------------------------------------------
# DailyLog
# ---------------------------------------------------------------------------

@admin.register(DailyLog)
class DailyLogAdmin(admin.ModelAdmin):
    list_display = ('date', 'objects_created_count', 'objects_updated_count', 'edges_created_count')
    date_hierarchy = 'date'
    readonly_fields = ('date', 'objects_created', 'objects_updated', 'edges_created', 'entities_resolved')

    def objects_created_count(self, obj):
        return len(obj.objects_created) if obj.objects_created else 0
    objects_created_count.short_description = 'Created'

    def objects_updated_count(self, obj):
        return len(obj.objects_updated) if obj.objects_updated else 0
    objects_updated_count.short_description = 'Updated'

    def edges_created_count(self, obj):
        return len(obj.edges_created) if obj.edges_created else 0
    edges_created_count.short_description = 'Edges'

    def has_add_permission(self, request):
        return False  # DailyLogs are auto-created by signals

from django.contrib import admin

from apps.content.models import (
    DesignTokenSet,
    Essay,
    FieldNote,
    NavItem,
    NowPage,
    PageComposition,
    Project,
    PublishLog,
    ShelfEntry,
    SiteSettings,
    ToolkitEntry,
    VideoDeliverable,
    VideoProject,
    VideoScene,
    VideoSession,
)


@admin.register(Essay)
class EssayAdmin(admin.ModelAdmin):
    list_display = ["title", "date", "stage", "draft", "updated_at"]
    list_filter = ["draft", "stage"]
    search_fields = ["title", "summary"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(FieldNote)
class FieldNoteAdmin(admin.ModelAdmin):
    list_display = ["title", "date", "status", "draft", "updated_at"]
    list_filter = ["draft", "status"]
    search_fields = ["title"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(ShelfEntry)
class ShelfEntryAdmin(admin.ModelAdmin):
    list_display = ["title", "creator", "type", "date", "stage"]
    list_filter = ["stage", "type"]
    search_fields = ["title", "creator"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["title", "role", "year", "stage", "featured"]
    list_filter = ["stage", "featured", "role"]
    search_fields = ["title", "description"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(NowPage)
class NowPageAdmin(admin.ModelAdmin):
    list_display = ["__str__", "updated"]


@admin.register(ToolkitEntry)
class ToolkitEntryAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "order", "stage"]
    list_filter = ["stage", "category"]
    search_fields = ["title"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(DesignTokenSet)
class DesignTokenSetAdmin(admin.ModelAdmin):
    list_display = ["__str__", "updated_at"]


@admin.register(NavItem)
class NavItemAdmin(admin.ModelAdmin):
    list_display = ["label", "path", "icon", "visible", "order"]
    list_filter = ["visible"]
    list_editable = ["order", "visible"]


@admin.register(PageComposition)
class PageCompositionAdmin(admin.ModelAdmin):
    list_display = ["page_key", "updated_at"]


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ["__str__", "updated_at"]


class VideoSceneInline(admin.TabularInline):
    model = VideoScene
    extra = 1
    fields = ["order", "title", "scene_type", "script_locked", "vo_recorded",
              "filmed", "assembled", "polished"]
    ordering = ["order"]


class VideoDeliverableInline(admin.TabularInline):
    model = VideoDeliverable
    extra = 0
    fields = ["phase", "deliverable_type", "file_path", "approved"]


@admin.register(VideoProject)
class VideoProjectAdmin(admin.ModelAdmin):
    list_display = ["title", "phase", "draft", "updated_at"]
    list_filter = ["draft", "phase"]
    search_fields = ["title", "short_title", "thesis"]
    prepopulated_fields = {"slug": ("title",)}
    inlines = [VideoSceneInline, VideoDeliverableInline]


@admin.register(VideoSession)
class VideoSessionAdmin(admin.ModelAdmin):
    list_display = ["video", "phase", "started_at", "duration_minutes", "next_tool"]
    list_filter = ["phase"]
    search_fields = ["summary", "next_action"]


@admin.register(PublishLog)
class PublishLogAdmin(admin.ModelAdmin):
    list_display = ["content_title", "content_type", "success", "created_at", "commit_sha"]
    list_filter = ["success", "content_type"]
    readonly_fields = [
        "content_type",
        "content_slug",
        "content_title",
        "commit_sha",
        "commit_url",
        "success",
        "error_message",
        "created_at",
    ]

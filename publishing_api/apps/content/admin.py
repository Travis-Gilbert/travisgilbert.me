from django.contrib import admin

from apps.content.models import (
    Essay,
    FieldNote,
    NowPage,
    Project,
    PublishLog,
    ShelfEntry,
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
    list_display = ["title", "creator", "type", "date"]
    list_filter = ["type"]
    search_fields = ["title", "creator"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["title", "role", "year", "draft", "featured"]
    list_filter = ["draft", "featured", "role"]
    search_fields = ["title", "description"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(NowPage)
class NowPageAdmin(admin.ModelAdmin):
    list_display = ["__str__", "updated"]


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

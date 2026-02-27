from django.contrib import admin

from apps.intake.models import RawSource, SuggestedConnection


class SuggestedConnectionInline(admin.TabularInline):
    model = SuggestedConnection
    extra = 0
    readonly_fields = ("content_type", "content_slug", "content_title", "confidence", "reason")
    fields = ("content_type", "content_slug", "content_title", "confidence", "reason", "accepted")


@admin.register(RawSource)
class RawSourceAdmin(admin.ModelAdmin):
    list_display = ("display_title", "decision", "og_site_name", "created_at")
    list_filter = ("decision",)
    search_fields = ("url", "og_title", "og_description")
    readonly_fields = ("og_title", "og_description", "og_image", "og_site_name", "created_at", "updated_at")
    inlines = [SuggestedConnectionInline]

    fieldsets = (
        (None, {"fields": ("url", "tags")}),
        ("OG Metadata", {"fields": ("og_title", "og_description", "og_image", "og_site_name")}),
        ("Triage", {"fields": ("decision", "decision_note", "decided_at", "promoted_source_slug")}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(SuggestedConnection)
class SuggestedConnectionAdmin(admin.ModelAdmin):
    list_display = ("raw_source", "content_type", "content_slug", "confidence", "accepted")
    list_filter = ("content_type", "accepted")
    search_fields = ("content_slug", "content_title", "reason")

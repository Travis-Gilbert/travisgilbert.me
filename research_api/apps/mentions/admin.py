from django.contrib import admin

from .models import Webmention


@admin.register(Webmention)
class WebmentionAdmin(admin.ModelAdmin):
    list_display = ['source_url_short', 'target_path', 'mention_type', 'status', 'verified', 'created_at']
    list_filter = ['status', 'mention_type', 'verified']
    search_fields = ['source_url', 'target_url', 'author_name', 'content']
    readonly_fields = ['created_at', 'updated_at', 'verified_at']
    actions = ['approve_mentions', 'reject_mentions', 'mark_spam']
    fieldsets = [
        (None, {
            'fields': ['source_url', 'target_url', 'mention_type'],
        }),
        ('Author', {
            'fields': ['author_name', 'author_url', 'author_photo'],
        }),
        ('Content', {
            'fields': ['content'],
        }),
        ('Verification', {
            'fields': ['verified', 'verified_at'],
        }),
        ('Moderation', {
            'fields': ['status'],
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]

    @admin.display(description='Source')
    def source_url_short(self, obj):
        """Truncate long URLs for the list display."""
        url = obj.source_url
        if len(url) > 60:
            return f'{url[:57]}...'
        return url

    @admin.action(description='Approve selected mentions')
    def approve_mentions(self, request, queryset):
        queryset.update(status='approved')

    @admin.action(description='Reject selected mentions')
    def reject_mentions(self, request, queryset):
        queryset.update(status='rejected')

    @admin.action(description='Mark as spam')
    def mark_spam(self, request, queryset):
        queryset.update(status='spam')

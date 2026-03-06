from django.contrib import admin
from django.utils.html import escape

from apps.comments.models import Comment


@admin.action(description='Approve selected (unflag)')
def approve_comments(modeladmin, request, queryset):
    queryset.update(is_flagged=False)


@admin.action(description='Flag selected')
def flag_comments(modeladmin, request, queryset):
    queryset.update(is_flagged=True)


@admin.action(description='Delete all flagged comments')
def delete_flagged(modeladmin, request, queryset):
    Comment.objects.filter(is_flagged=True).delete()


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = [
        'truncated_body',
        'author_name',
        'content_type',
        'article_slug',
        'paragraph_index',
        'is_flagged',
        'recaptcha_score',
        'created_at',
    ]
    list_filter = ['is_flagged', 'content_type', 'created_at']
    search_fields = ['author_name', 'body', 'article_slug']
    list_editable = ['is_flagged']
    date_hierarchy = 'created_at'
    actions = [approve_comments, flag_comments, delete_flagged]
    readonly_fields = ['id', 'ip_address', 'recaptcha_score', 'created_at', 'updated_at']

    fieldsets = [
        ('Content', {
            'fields': ('author_name', 'body'),
        }),
        ('Article', {
            'fields': ('content_type', 'article_slug', 'paragraph_index'),
        }),
        ('Moderation', {
            'fields': ('is_flagged', 'ip_address', 'recaptcha_score'),
        }),
        ('Timestamps', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    ]

    @admin.display(description='Body')
    def truncated_body(self, obj):
        text = escape(obj.body)
        if len(text) > 60:
            return text[:60] + '...'
        return text

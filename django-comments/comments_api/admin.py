from django.contrib import admin
from .models import Comment


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = [
        "author_name",
        "content_type",
        "article_slug",
        "paragraph_index",
        "is_flagged",
        "created_at",
        "body_preview",
    ]
    list_filter = ["is_flagged", "content_type", "article_slug"]
    search_fields = ["author_name", "body", "article_slug"]
    readonly_fields = ["id", "created_at", "paragraph_snapshot"]
    actions = ["unflag_comments", "delete_flagged"]
    ordering = ["-created_at"]

    @admin.display(description="Comment preview")
    def body_preview(self, obj):
        return obj.body[:80] + "..." if len(obj.body) > 80 else obj.body

    @admin.action(description="Unflag selected comments")
    def unflag_comments(self, request, queryset):
        updated = queryset.update(is_flagged=False)
        self.message_user(request, f"{updated} comment(s) unflagged.")

    @admin.action(description="Delete flagged comments")
    def delete_flagged(self, request, queryset):
        flagged = queryset.filter(is_flagged=True)
        count = flagged.count()
        flagged.delete()
        self.message_user(request, f"{count} flagged comment(s) deleted.")

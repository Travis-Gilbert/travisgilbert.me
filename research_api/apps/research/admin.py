"""
Admin configuration for research models.

Optimized for Travis's daily workflow: adding sources and linking them
to essays/field notes should be fast and require minimal clicks.
"""

from django.contrib import admin
from django.db.models import Count

from .models import (
    ConnectionSuggestion,
    ResearchThread,
    Source,
    SourceLink,
    SourceSuggestion,
    ThreadEntry,
)


# ---------------------------------------------------------------------------
# Inlines
# ---------------------------------------------------------------------------


class SourceLinkInline(admin.StackedInline):
    """Inline for adding content links directly from the Source edit page.

    When adding a new source, you can immediately link it to one or more
    essays or field notes without leaving the page.
    """

    model = SourceLink
    extra = 1
    fields = [
        'content_type', 'content_slug', 'content_title',
        'role', 'key_quote', 'date_linked', 'notes',
    ]


class ThreadEntryInline(admin.TabularInline):
    """Inline for adding entries directly on the ResearchThread page.

    Each entry represents a moment in the research journey. The inline
    lets you build the timeline as you go.
    """

    model = ThreadEntry
    extra = 1
    fields = [
        'order', 'entry_type', 'date', 'title',
        'description', 'source', 'field_note_slug',
    ]
    ordering = ['order', '-date']
    raw_id_fields = ['source']


# ---------------------------------------------------------------------------
# Model Admins
# ---------------------------------------------------------------------------


@admin.register(Source)
class SourceAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'source_type', 'creator', 'public',
        'link_count', 'date_encountered',
    ]
    list_filter = ['source_type', 'public', 'created_at']
    search_fields = ['title', 'creator', 'publication', 'private_annotation']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['created_at', 'updated_at']
    list_editable = ['public']
    date_hierarchy = 'date_encountered'
    inlines = [SourceLinkInline]

    fieldsets = [
        (None, {
            'fields': [
                'title', 'slug', 'creator', 'source_type',
                'url', 'publication',
            ],
        }),
        ('Dates', {
            'fields': ['date_published', 'date_encountered'],
        }),
        ('Annotations', {
            'fields': ['private_annotation', 'public_annotation', 'key_findings'],
        }),
        ('Classification', {
            'fields': ['tags', 'public'],
        }),
        ('Location (optional)', {
            'fields': ['location_name', 'latitude', 'longitude'],
            'classes': ['collapse'],
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _link_count=Count('links'),
        )

    @admin.display(description='Links', ordering='_link_count')
    def link_count(self, obj):
        return obj._link_count


@admin.register(SourceLink)
class SourceLinkAdmin(admin.ModelAdmin):
    """Standalone view of all source-content links.

    Useful for browsing the full backlink web and for bulk operations.
    """

    list_display = ['source', 'content_type', 'content_slug', 'role', 'date_linked']
    list_filter = ['content_type', 'role']
    search_fields = ['source__title', 'content_slug', 'content_title']
    raw_id_fields = ['source']
    list_select_related = ['source']


@admin.register(ResearchThread)
class ResearchThreadAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'status', 'public', 'started_date',
        'entry_count', 'resulting_essay_slug',
    ]
    list_filter = ['status', 'public']
    search_fields = ['title', 'description']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['created_at', 'updated_at']
    list_editable = ['status', 'public']
    inlines = [ThreadEntryInline]

    fieldsets = [
        (None, {
            'fields': ['title', 'slug', 'description', 'status'],
        }),
        ('Timeline', {
            'fields': ['started_date', 'completed_date', 'resulting_essay_slug'],
        }),
        ('Classification', {
            'fields': ['tags', 'public'],
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _entry_count=Count('entries'),
        )

    @admin.display(description='Entries', ordering='_entry_count')
    def entry_count(self, obj):
        return obj._entry_count


@admin.register(ThreadEntry)
class ThreadEntryAdmin(admin.ModelAdmin):
    list_display = ['title', 'thread', 'entry_type', 'date', 'order']
    list_filter = ['entry_type', 'thread']
    search_fields = ['title', 'description']
    raw_id_fields = ['thread', 'source']


# ---------------------------------------------------------------------------
# Community contribution admin
# ---------------------------------------------------------------------------


@admin.register(SourceSuggestion)
class SourceSuggestionAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'target_slug', 'contributor_name',
        'status', 'is_flagged', 'created_at',
    ]
    list_filter = ['status', 'is_flagged', 'source_type']
    search_fields = ['title', 'relevance_note', 'contributor_name', 'target_slug']
    list_editable = ['status']
    date_hierarchy = 'created_at'
    actions = ['promote_to_source', 'reject_suggestions']

    fieldsets = [
        ('Submitted Content', {
            'fields': ['title', 'url', 'source_type', 'relevance_note'],
        }),
        ('Target', {
            'fields': ['target_content_type', 'target_slug'],
        }),
        ('Contributor', {
            'fields': ['contributor_name', 'contributor_url'],
        }),
        ('Review', {
            'fields': [
                'status', 'reviewed_at', 'reviewer_note',
                'promoted_source',
            ],
        }),
        ('Spam Detection', {
            'classes': ['collapse'],
            'fields': ['ip_address', 'is_flagged'],
        }),
    ]

    @admin.action(description='Promote selected to Source (approve and create)')
    def promote_to_source(self, request, queryset):
        """Create a real Source + SourceLink from each selected suggestion.

        This is the one-click approval flow. It creates the Source with
        the contributor's information preserved in the public annotation,
        links it to the target content, and marks the suggestion as approved.
        """
        from django.utils import timezone

        promoted = 0
        for suggestion in queryset.filter(status='pending'):
            # Create the Source
            source = Source.objects.create(
                title=suggestion.title,
                source_type=suggestion.source_type,
                url=suggestion.url,
                date_encountered=suggestion.created_at.date(),
                public_annotation=(
                    f'Suggested by {suggestion.contributor_name}: '
                    f'{suggestion.relevance_note}'
                ),
                tags=['community-suggested'],
                public=True,
            )

            # Create the SourceLink
            SourceLink.objects.create(
                source=source,
                content_type=suggestion.target_content_type,
                content_slug=suggestion.target_slug,
                role='reference',
                notes=f'Community contribution by {suggestion.contributor_name}',
            )

            # Update the suggestion
            suggestion.status = 'approved'
            suggestion.reviewed_at = timezone.now()
            suggestion.promoted_source = source
            suggestion.save()
            promoted += 1

        self.message_user(
            request,
            f'Promoted {promoted} suggestions to Sources.',
        )

    @admin.action(description='Reject selected suggestions')
    def reject_suggestions(self, request, queryset):
        from django.utils import timezone

        count = queryset.filter(status='pending').update(
            status='rejected',
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f'Rejected {count} suggestions.')


@admin.register(ConnectionSuggestion)
class ConnectionSuggestionAdmin(admin.ModelAdmin):
    list_display = [
        'from_slug', 'to_slug', 'contributor_name',
        'status', 'is_flagged', 'created_at',
    ]
    list_filter = ['status', 'is_flagged']
    search_fields = ['from_slug', 'to_slug', 'explanation', 'contributor_name']
    list_editable = ['status']
    actions = ['approve_connections', 'reject_connections']

    @admin.action(description='Approve selected connections')
    def approve_connections(self, request, queryset):
        from django.utils import timezone

        count = queryset.filter(status='pending').update(
            status='approved',
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f'Approved {count} connections.')

    @admin.action(description='Reject selected connections')
    def reject_connections(self, request, queryset):
        from django.utils import timezone

        count = queryset.filter(status='pending').update(
            status='rejected',
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f'Rejected {count} connections.')

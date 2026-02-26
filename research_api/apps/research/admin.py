from django.contrib import admin

from .models import ContentReference, ResearchThread, Source, ThreadEntry


class ContentReferenceInline(admin.StackedInline):
    model = ContentReference
    extra = 1
    fields = ['content_type', 'content_slug', 'content_title', 'context', 'paragraph_index']


@admin.register(Source)
class SourceAdmin(admin.ModelAdmin):
    list_display = ['title', 'source_type', 'first_author', 'content_count', 'created_at']
    list_filter = ['source_type', 'created_at']
    search_fields = ['title', 'authors', 'publisher', 'isbn', 'doi']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ContentReferenceInline]
    fieldsets = [
        (None, {
            'fields': ['title', 'slug', 'source_type'],
        }),
        ('Attribution', {
            'fields': ['authors', 'publisher', 'publication_date'],
        }),
        ('Identifiers', {
            'fields': ['url', 'isbn', 'doi'],
        }),
        ('Notes', {
            'fields': ['notes', 'tags', 'cover_image_url'],
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]

    @admin.display(description='Author')
    def first_author(self, obj):
        if obj.authors:
            return obj.authors[0]
        return ''


@admin.register(ContentReference)
class ContentReferenceAdmin(admin.ModelAdmin):
    list_display = ['source', 'content_type', 'content_slug', 'content_title']
    list_filter = ['content_type']
    search_fields = ['source__title', 'content_slug', 'content_title']
    raw_id_fields = ['source']


class ThreadEntryInline(admin.TabularInline):
    model = ThreadEntry
    extra = 1
    fields = ['date', 'title', 'body', 'content_type', 'content_slug']
    ordering = ['-date']


@admin.register(ResearchThread)
class ResearchThreadAdmin(admin.ModelAdmin):
    list_display = ['title', 'status', 'started_date', 'entry_count', 'created_at']
    list_filter = ['status']
    search_fields = ['title', 'description']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ThreadEntryInline]


@admin.register(ThreadEntry)
class ThreadEntryAdmin(admin.ModelAdmin):
    list_display = ['title', 'thread', 'date', 'content_type', 'content_slug']
    list_filter = ['thread', 'date']
    search_fields = ['title', 'body']
    raw_id_fields = ['thread']
    filter_horizontal = ['sources']

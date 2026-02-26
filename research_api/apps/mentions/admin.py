from django.contrib import admin

from .models import Mention, MentionSource


@admin.register(MentionSource)
class MentionSourceAdmin(admin.ModelAdmin):
    list_display = ['name', 'domain', 'trusted', 'mention_count', 'created_at']
    list_filter = ['trusted']
    search_fields = ['name', 'domain', 'description']
    readonly_fields = ['created_at', 'updated_at']
    prepopulated_fields = {'slug': ('name',)}

    fieldsets = [
        (None, {
            'fields': ['name', 'slug', 'domain', 'url'],
        }),
        ('Details', {
            'fields': ['description', 'avatar_url'],
        }),
        ('Trust', {
            'fields': ['trusted'],
            'description': (
                'Trusted sources auto-verify and auto-publish their mentions.'
            ),
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]

    @admin.display(description='Mentions')
    def mention_count(self, obj):
        return obj.mentions.count()


@admin.register(Mention)
class MentionAdmin(admin.ModelAdmin):
    list_display = [
        'source_url_short', 'target_slug', 'target_content_type',
        'mention_type', 'discovery_method', 'verified', 'public',
        'featured', 'created_at',
    ]
    list_filter = [
        'mention_type', 'discovery_method', 'target_content_type',
        'verified', 'public', 'featured',
    ]
    search_fields = [
        'source_url', 'source_title', 'source_author',
        'target_slug', 'source_excerpt',
    ]
    readonly_fields = ['created_at', 'updated_at', 'verified_at']
    list_select_related = ['mention_source']
    raw_id_fields = ['mention_source']
    actions = ['verify_and_publish', 'make_public', 'make_private', 'toggle_featured']

    fieldsets = [
        ('Source (external page)', {
            'fields': [
                'source_url', 'source_title', 'source_excerpt',
                'source_author', 'source_author_url', 'source_published',
            ],
        }),
        ('Target (your content)', {
            'fields': ['target_content_type', 'target_slug', 'target_url'],
        }),
        ('Classification', {
            'fields': ['mention_type', 'discovery_method', 'mention_source'],
        }),
        ('Verification and Visibility', {
            'fields': ['verified', 'verified_at', 'public', 'featured'],
        }),
        ('Webmention Extensions', {
            'fields': ['webmention_vouch'],
            'classes': ['collapse'],
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]

    @admin.display(description='Source URL')
    def source_url_short(self, obj):
        url = obj.source_url
        if len(url) > 60:
            return f'{url[:57]}...'
        return url

    @admin.action(description='Verify and publish selected mentions')
    def verify_and_publish(self, request, queryset):
        from django.utils import timezone as tz
        now = tz.now()
        queryset.update(verified=True, verified_at=now, public=True)

    @admin.action(description='Make selected mentions public')
    def make_public(self, request, queryset):
        queryset.update(public=True)

    @admin.action(description='Make selected mentions private')
    def make_private(self, request, queryset):
        queryset.update(public=False)

    @admin.action(description='Toggle featured status')
    def toggle_featured(self, request, queryset):
        for mention in queryset:
            mention.featured = not mention.featured
            mention.save(update_fields=['featured', 'updated_at'])

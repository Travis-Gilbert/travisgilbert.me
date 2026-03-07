from django.contrib import admin

from .models import APIKey, UsageLog


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'tier', 'is_active', 'requests_per_hour',
        'last_used_at', 'created_at',
    ]
    list_filter = ['tier', 'is_active']
    search_fields = ['name', 'owner_email']
    readonly_fields = ['key', 'created_at', 'updated_at', 'last_used_at']
    fieldsets = [
        (None, {
            'fields': ['name', 'owner_email', 'key', 'tier', 'is_active'],
        }),
        ('Rate Limiting', {
            'fields': ['requests_per_hour'],
        }),
        ('Feature Flags', {
            'fields': ['can_import', 'can_webhook', 'can_sessions'],
        }),
        ('Timestamps', {
            'fields': ['last_used_at', 'created_at', 'updated_at'],
        }),
    ]


@admin.register(UsageLog)
class UsageLogAdmin(admin.ModelAdmin):
    list_display = ['api_key', 'method', 'endpoint', 'status_code', 'response_time_ms', 'timestamp']
    list_filter = ['endpoint', 'method', 'status_code', 'api_key']
    readonly_fields = [
        'api_key', 'endpoint', 'method', 'status_code',
        'response_time_ms', 'timestamp',
    ]
    date_hierarchy = 'timestamp'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

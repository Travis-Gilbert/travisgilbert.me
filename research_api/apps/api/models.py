"""
API key management and usage tracking models.

APIKey gates access to the Research API. Each key belongs to a named
owner, has a tier that determines rate limits and feature access, and
logs per-request usage for analytics and enforcement.
"""

import secrets

from django.db import models

from apps.core.models import TimeStampedModel


def generate_api_key():
    """Generate a prefixed API key: rk_live_ + 48 random hex chars."""
    return f'rk_live_{secrets.token_hex(24)}'


class APIKey(TimeStampedModel):
    """
    API key for authenticating external consumers.

    Each key belongs to a named owner and has a tier
    that determines rate limits and feature access.
    """
    key = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        default=generate_api_key,
    )
    name = models.CharField(
        max_length=200,
        help_text='Human-readable label for this key.',
    )
    owner_email = models.EmailField(
        help_text='Contact email for the key holder.',
    )
    tier = models.CharField(
        max_length=20,
        choices=[
            ('free', 'Free'),
            ('researcher', 'Researcher'),
            ('institutional', 'Institutional'),
            ('internal', 'Internal'),
        ],
        default='free',
        db_index=True,
    )
    is_active = models.BooleanField(default=True, db_index=True)
    requests_per_hour = models.PositiveIntegerField(
        default=100,
        help_text='Rate limit ceiling per rolling hour.',
    )
    last_used_at = models.DateTimeField(null=True, blank=True)

    # Feature flags per key
    can_import = models.BooleanField(default=False)
    can_webhook = models.BooleanField(default=False)
    can_sessions = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'API key'
        verbose_name_plural = 'API keys'

    def __str__(self):
        return f'{self.name} ({self.tier})'


class UsageLog(models.Model):
    """
    Per-request log for analytics and rate limit enforcement.

    Indexed by (api_key, timestamp) for efficient rolling-window
    queries during rate limit checks.
    """
    api_key = models.ForeignKey(
        APIKey,
        on_delete=models.CASCADE,
        related_name='usage_logs',
    )
    endpoint = models.CharField(max_length=200)
    method = models.CharField(max_length=10)
    status_code = models.PositiveSmallIntegerField()
    response_time_ms = models.PositiveIntegerField()
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['api_key', 'timestamp'],
                name='idx_usage_key_time',
            ),
            models.Index(
                fields=['endpoint', 'timestamp'],
                name='idx_usage_endpoint_time',
            ),
        ]

    def __str__(self):
        return f'{self.api_key.name} {self.method} {self.endpoint} ({self.status_code})'


class ImportJob(TimeStampedModel):
    """Audit trail for import operations."""
    api_key = models.ForeignKey(APIKey, on_delete=models.CASCADE, related_name='import_jobs')
    format = models.CharField(max_length=20)
    filename = models.CharField(max_length=500)
    record_count = models.PositiveIntegerField(default=0)
    created_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    errors = models.JSONField(default=list)
    dry_run = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.filename} ({self.format}) by {self.api_key.name}'


class HealthCheck(TimeStampedModel):
    """Records the result of a periodic URL health check for a source."""
    source = models.ForeignKey(
        'research.Source',
        on_delete=models.CASCADE,
        related_name='health_checks',
    )
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    is_alive = models.BooleanField()
    redirect_url = models.URLField(max_length=2000, blank=True)
    has_archive = models.BooleanField(default=False)
    archive_url = models.URLField(max_length=2000, blank=True)
    error_message = models.CharField(max_length=500, blank=True)
    checked_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['source', '-checked_at'],
                name='idx_health_source_time',
            ),
        ]
        get_latest_by = 'checked_at'

    def __str__(self):
        status = 'alive' if self.is_alive else 'dead'
        return f'{self.source.title} ({status}, {self.status_code})'


class ResearchSession(TimeStampedModel):
    """A named snapshot of a research working set."""
    api_key = models.ForeignKey(
        APIKey,
        on_delete=models.CASCADE,
        related_name='sessions',
    )
    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=300)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        unique_together = [('api_key', 'slug')]
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.title} ({self.api_key.name})'


class SessionNode(models.Model):
    """A node in a research session's working set."""
    session = models.ForeignKey(
        ResearchSession,
        on_delete=models.CASCADE,
        related_name='nodes',
    )
    node_type = models.CharField(
        max_length=20,
        choices=[
            ('source', 'Source'),
            ('essay', 'Essay'),
            ('field_note', 'Field Note'),
            ('thread', 'Thread'),
        ],
    )
    node_slug = models.SlugField(max_length=300)
    notes = models.TextField(blank=True)
    position_x = models.FloatField(null=True, blank=True)
    position_y = models.FloatField(null=True, blank=True)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('session', 'node_type', 'node_slug')]

    def __str__(self):
        return f'{self.node_type}:{self.node_slug}'


class WebhookSubscription(TimeStampedModel):
    """A registered webhook endpoint for an API key."""
    VALID_EVENTS = [
        'source.created',
        'source.updated',
        'source.linked',
        'thread.created',
        'thread.entry_added',
        'thread.completed',
        'mention.received',
        'similarity.updated',
        'health.alert',
    ]

    api_key = models.ForeignKey(
        APIKey,
        on_delete=models.CASCADE,
        related_name='webhooks',
    )
    callback_url = models.URLField(max_length=2000)
    events = models.JSONField(
        help_text='List of event types to subscribe to.',
    )
    secret = models.CharField(
        max_length=64,
        help_text='Shared secret for HMAC signature verification.',
    )
    is_active = models.BooleanField(default=True)
    consecutive_failures = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = [('api_key', 'callback_url')]

    def __str__(self):
        return f'{self.callback_url} ({self.api_key.name})'


class WebhookDelivery(models.Model):
    """Log of individual webhook delivery attempts."""
    subscription = models.ForeignKey(
        WebhookSubscription,
        on_delete=models.CASCADE,
        related_name='deliveries',
    )
    event_type = models.CharField(max_length=50)
    payload = models.JSONField()
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    success = models.BooleanField()
    error_message = models.CharField(max_length=500, blank=True)
    attempted_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-attempted_at']

    def __str__(self):
        status = 'ok' if self.success else 'fail'
        return f'{self.event_type} -> {self.subscription.callback_url} ({status})'

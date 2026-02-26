from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.models import TimeStampedModel


# ---------------------------------------------------------------------------
# Choices
# ---------------------------------------------------------------------------

class MentionType(models.TextChoices):
    """How the external page references your content."""
    REPLY = 'reply', 'Reply'
    LINK = 'link', 'Link'
    REPOST = 'repost', 'Repost'
    LIKE = 'like', 'Like'
    MENTION = 'mention', 'Mention'
    QUOTE = 'quote', 'Quote'


class DiscoveryMethod(models.TextChoices):
    """How this mention was discovered."""
    WEBMENTION = 'webmention', 'Webmention'
    MANUAL = 'manual', 'Manual'
    REFERRER = 'referrer', 'Referrer'
    SEARCH = 'search', 'Search'


class TargetContentType(models.TextChoices):
    """Content types on the site that can receive mentions."""
    ESSAY = 'essay', 'Essay'
    FIELD_NOTE = 'field_note', 'Field Note'
    PROJECT = 'project', 'Project'
    TOOLKIT = 'toolkit', 'Toolkit'
    SHELF = 'shelf', 'Shelf'
    PAGE = 'page', 'Page'
    OTHER = 'other', 'Other'


# ---------------------------------------------------------------------------
# QuerySets / Managers
# ---------------------------------------------------------------------------

class MentionSourceQuerySet(models.QuerySet):
    """Reusable query filters for MentionSource."""

    def trusted(self):
        return self.filter(trusted=True)


class MentionSourceManager(models.Manager):
    def get_queryset(self):
        return MentionSourceQuerySet(self.model, using=self._db)

    def trusted(self):
        return self.get_queryset().trusted()


class MentionQuerySet(models.QuerySet):
    """Reusable query filters for Mention."""

    def public(self):
        return self.filter(public=True)

    def verified(self):
        return self.filter(verified=True)

    def featured(self):
        return self.filter(featured=True, public=True)

    def for_content(self, content_type, slug):
        return self.filter(
            target_content_type=content_type,
            target_slug=slug,
        )


class MentionManager(models.Manager):
    def get_queryset(self):
        return MentionQuerySet(self.model, using=self._db)

    def public(self):
        return self.get_queryset().public()

    def featured(self):
        return self.get_queryset().featured()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class MentionSource(TimeStampedModel):
    """A known external site or author that mentions your content.

    Trusted sources auto-verify and auto-publish their mentions on save,
    skipping the HTTP fetch verification step. This creates a curated
    allowlist for sites you recognize and want to surface immediately.
    """

    name = models.CharField(
        max_length=300,
        help_text='Display name (person or site).',
    )
    slug = models.SlugField(
        max_length=300,
        unique=True,
        blank=True,
    )
    domain = models.CharField(
        max_length=300,
        unique=True,
        help_text='Root domain (e.g. "example.com"). Used to match incoming mentions.',
    )
    url = models.URLField(
        max_length=2000,
        blank=True,
        help_text='Home page of the site or author profile.',
    )
    description = models.TextField(
        blank=True,
        help_text='Short description of this source.',
    )
    avatar_url = models.URLField(
        max_length=2000,
        blank=True,
        help_text='Avatar or logo URL for display.',
    )
    trusted = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Mentions from this source auto-verify and auto-publish.',
    )

    objects = MentionSourceManager()

    class Meta:
        ordering = ['name']
        verbose_name = 'mention source'
        verbose_name_plural = 'mention sources'

    def __str__(self):
        label = self.name
        if self.trusted:
            label = f'{label} (trusted)'
        return label

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:300]
        super().save(*args, **kwargs)


class Mention(TimeStampedModel):
    """An external page that references your content.

    Each mention links a source URL to a specific piece of content on
    the site (identified by content type and slug). Discovery can happen
    via the W3C Webmention protocol, referrer logs, manual entry, or
    an HMAC-authenticated webhook.

    When a mention's source belongs to a trusted MentionSource, it is
    automatically verified and made public on save.
    """

    # Source (the external page)
    source_url = models.URLField(
        max_length=2000,
        help_text='URL of the page that mentions your content.',
    )
    source_title = models.CharField(
        max_length=500,
        blank=True,
        help_text='Title of the linking page.',
    )
    source_excerpt = models.TextField(
        blank=True,
        help_text='Relevant excerpt from the source page.',
    )
    source_author = models.CharField(
        max_length=300,
        blank=True,
        help_text='Author name extracted from the source.',
    )
    source_author_url = models.URLField(
        max_length=2000,
        blank=True,
        help_text='Author profile URL.',
    )
    source_published = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the source page was published.',
    )

    # Target (your content)
    target_content_type = models.CharField(
        max_length=20,
        choices=TargetContentType.choices,
        default=TargetContentType.ESSAY,
        db_index=True,
        help_text='Type of content being mentioned.',
    )
    target_slug = models.SlugField(
        max_length=300,
        help_text='Slug of the content being mentioned.',
    )
    target_url = models.URLField(
        max_length=2000,
        blank=True,
        help_text='Full URL of the target page (for Webmention protocol).',
    )

    # Classification
    mention_type = models.CharField(
        max_length=20,
        choices=MentionType.choices,
        default=MentionType.MENTION,
        db_index=True,
    )
    discovery_method = models.CharField(
        max_length=20,
        choices=DiscoveryMethod.choices,
        default=DiscoveryMethod.WEBMENTION,
        db_index=True,
    )

    # Verification and visibility
    verified = models.BooleanField(
        default=False,
        help_text='Source URL fetched and confirmed to link to the target.',
    )
    verified_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    public = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Whether this mention appears on the public site.',
    )
    featured = models.BooleanField(
        default=False,
        help_text='Highlighted in the Conversation section.',
    )

    # Optional link to known source
    mention_source = models.ForeignKey(
        MentionSource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mentions',
        help_text='Known source site (auto-matched by domain or set manually).',
    )

    # Webmention extensions
    webmention_vouch = models.URLField(
        max_length=2000,
        blank=True,
        help_text='Vouch URL for extended Webmention verification.',
    )

    objects = MentionManager()

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'mention'
        verbose_name_plural = 'mentions'
        constraints = [
            models.UniqueConstraint(
                fields=['source_url', 'target_slug'],
                name='unique_mention_per_target',
            ),
        ]
        indexes = [
            models.Index(
                fields=['target_content_type', 'target_slug'],
                name='idx_mention_target_lookup',
            ),
            models.Index(
                fields=['public', '-created_at'],
                name='idx_mention_public_date',
            ),
            models.Index(
                fields=['verified', '-created_at'],
                name='idx_mention_verified_date',
            ),
        ]

    def __str__(self):
        return f'{self.source_url} -> {self.target_content_type}:{self.target_slug}'

    def save(self, *args, **kwargs):
        # Auto-match mention_source by domain if not already set
        if not self.mention_source_id:
            self._try_match_source()
        # Auto-verify and auto-publish from trusted sources
        if self.mention_source and self.mention_source.trusted:
            if not self.verified:
                self.verified = True
                self.verified_at = timezone.now()
            if not self.public:
                self.public = True
        super().save(*args, **kwargs)

    def _try_match_source(self):
        """Attempt to match this mention to a known MentionSource by domain."""
        from urllib.parse import urlparse

        parsed = urlparse(self.source_url)
        hostname = parsed.hostname or ''

        # Try exact domain match, then strip www. prefix
        match = MentionSource.objects.filter(domain=hostname).first()
        if not match and hostname.startswith('www.'):
            match = MentionSource.objects.filter(
                domain=hostname[4:]
            ).first()

        if match:
            self.mention_source = match

    @property
    def target_path(self):
        """Construct a path from content type and slug."""
        type_prefix = {
            TargetContentType.ESSAY: 'on',
            TargetContentType.FIELD_NOTE: 'field-notes',
            TargetContentType.PROJECT: 'projects',
            TargetContentType.TOOLKIT: 'toolkit',
            TargetContentType.SHELF: 'shelf',
        }
        prefix = type_prefix.get(self.target_content_type, self.target_content_type)
        return f'/{prefix}/{self.target_slug}'

    @property
    def is_trusted(self):
        """Whether this mention comes from a trusted source."""
        return bool(self.mention_source and self.mention_source.trusted)

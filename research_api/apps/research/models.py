from django.db import models
from django.utils.text import slugify

from apps.core.models import TimeStampedModel


# ---------------------------------------------------------------------------
# Choices
# ---------------------------------------------------------------------------

class SourceType(models.TextChoices):
    BOOK = 'book', 'Book'
    ARTICLE = 'article', 'Article'
    PAPER = 'paper', 'Academic Paper'
    VIDEO = 'video', 'Video'
    PODCAST = 'podcast', 'Podcast'
    DATASET = 'dataset', 'Dataset'
    DOCUMENT = 'document', 'Document'
    REPORT = 'report', 'Report'
    MAP = 'map', 'Map'
    ARCHIVE = 'archive', 'Archive'
    INTERVIEW = 'interview', 'Interview'
    WEBSITE = 'website', 'Website'
    OTHER = 'other', 'Other'


class ContentType(models.TextChoices):
    """Content types on the Next.js site that can reference sources."""
    ESSAY = 'essay', 'Essay'
    FIELD_NOTE = 'field_note', 'Field Note'


class LinkRole(models.TextChoices):
    """How a source is used in a piece of content."""
    PRIMARY = 'primary', 'Primary'
    BACKGROUND = 'background', 'Background'
    INSPIRATION = 'inspiration', 'Inspiration'
    DATA = 'data', 'Data'
    COUNTERARGUMENT = 'counterargument', 'Counterargument'
    METHODOLOGY = 'methodology', 'Methodology'
    REFERENCE = 'reference', 'Reference'


class EntryType(models.TextChoices):
    """What kind of event a thread entry represents."""
    SOURCE = 'source', 'Source'
    NOTE = 'note', 'Note'
    MILESTONE = 'milestone', 'Milestone'
    CONNECTION = 'connection', 'Connection'
    QUESTION = 'question', 'Question'


class ThreadStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    PAUSED = 'paused', 'Paused'
    COMPLETED = 'completed', 'Completed'
    ABANDONED = 'abandoned', 'Abandoned'


# ---------------------------------------------------------------------------
# QuerySets / Managers
# ---------------------------------------------------------------------------

class SourceQuerySet(models.QuerySet):
    """Reusable query filters for Source."""

    def public(self):
        return self.filter(public=True)

    def by_type(self, source_type):
        return self.filter(source_type=source_type)

    def tagged(self, tag):
        return self.filter(tags__contains=[tag])


class SourceManager(models.Manager):
    def get_queryset(self):
        return SourceQuerySet(self.model, using=self._db)

    def public(self):
        return self.get_queryset().public()


class ResearchThreadQuerySet(models.QuerySet):
    """Reusable query filters for ResearchThread."""

    def public(self):
        return self.filter(public=True)

    def active(self):
        return self.filter(status=ThreadStatus.ACTIVE)


class ResearchThreadManager(models.Manager):
    def get_queryset(self):
        return ResearchThreadQuerySet(self.model, using=self._db)

    def public(self):
        return self.get_queryset().public()

    def active(self):
        return self.get_queryset().active()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Source(TimeStampedModel):
    """Anything consumed during research: a book, article, dataset, map, etc.

    The central entity. Sources are linked to site content via SourceLink,
    and shared sources between content pieces create automatic backlinks
    (computed by the backlink service, not stored separately).
    """

    # Core identity
    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=500, unique=True, blank=True)
    creator = models.CharField(
        max_length=500,
        blank=True,
        help_text='Author, director, or primary creator.',
    )
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        default=SourceType.ARTICLE,
        db_index=True,
    )

    # Publication
    url = models.URLField(max_length=2000, blank=True)
    publication = models.CharField(
        max_length=300,
        blank=True,
        help_text='Publisher, journal, outlet, or platform.',
    )
    date_published = models.DateField(
        null=True,
        blank=True,
        help_text='When this source was originally published.',
    )
    date_encountered = models.DateField(
        null=True,
        blank=True,
        help_text='When you first encountered this source.',
    )

    # Annotations
    private_annotation = models.TextField(
        blank=True,
        help_text='Personal notes. Not published to the site.',
    )
    public_annotation = models.TextField(
        blank=True,
        help_text='What readers see on the site.',
    )
    key_findings = models.JSONField(
        default=list,
        blank=True,
        help_text='Key takeaways, e.g. ["Finding one", "Finding two"].',
    )

    # Categorization
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text='Tags for categorization, e.g. ["urban-design", "housing"].',
    )
    public = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Whether this source appears on the public site.',
    )

    # Location (for place-based research: maps, field visits, archives)
    location_name = models.CharField(
        max_length=300,
        blank=True,
        help_text='Human readable location name.',
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )

    objects = SourceManager()

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['source_type', '-created_at'],
                name='idx_source_type_date',
            ),
            models.Index(
                fields=['public', '-created_at'],
                name='idx_source_public_date',
            ),
        ]

    def __str__(self):
        if self.creator:
            return f'{self.title} ({self.creator})'
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:500]
        super().save(*args, **kwargs)

    # link_count is provided by queryset annotation (Count('links'))
    # in API views and publisher. Do not define a @property here
    # because it conflicts with Django's annotate() attribute setting.

    @property
    def linked_content(self):
        """Distinct content pieces referencing this source."""
        return list(
            self.links
            .values('content_type', 'content_slug', 'content_title')
            .distinct()
        )

    @property
    def sibling_sources(self):
        """Other sources linked to the same content pieces (backlink peers).

        If Source A and Source B are both linked to Essay 1, they are siblings.
        """
        my_content_keys = set(
            self.links.values_list('content_type', 'content_slug')
        )
        if not my_content_keys:
            return Source.objects.none()

        from django.db.models import Q
        content_filter = Q()
        for ct, cs in my_content_keys:
            content_filter |= Q(
                links__content_type=ct,
                links__content_slug=cs,
            )

        return (
            Source.objects
            .filter(content_filter)
            .exclude(pk=self.pk)
            .distinct()
        )


class SourceLink(TimeStampedModel):
    """Many-to-many join between Source and published content.

    References content by type and slug (strings, not FKs) because content
    lives in a separate Django service (publishing_api) and the Next.js repo.
    When two content pieces share a Source through SourceLinks, that creates
    an automatic backlink (computed, not stored).
    """

    source = models.ForeignKey(
        Source,
        on_delete=models.CASCADE,
        related_name='links',
    )
    content_type = models.CharField(
        max_length=20,
        choices=ContentType.choices,
        db_index=True,
    )
    content_slug = models.SlugField(max_length=300)
    content_title = models.CharField(
        max_length=500,
        blank=True,
        help_text='Display title (denormalized for admin convenience).',
    )

    # How the source is used in this content
    role = models.CharField(
        max_length=20,
        choices=LinkRole.choices,
        default=LinkRole.REFERENCE,
        db_index=True,
        help_text='How this source was used in the content.',
    )
    key_quote = models.TextField(
        blank=True,
        help_text='Representative quote from or about this source in context.',
    )
    date_linked = models.DateField(
        null=True,
        blank=True,
        help_text='When this source was connected to the content.',
    )
    notes = models.TextField(
        blank=True,
        help_text='Internal notes about this link.',
    )

    class Meta:
        ordering = ['content_type', 'content_slug']
        verbose_name = 'source link'
        verbose_name_plural = 'source links'
        constraints = [
            models.UniqueConstraint(
                fields=['source', 'content_type', 'content_slug'],
                name='unique_source_per_content',
            ),
        ]
        indexes = [
            models.Index(
                fields=['content_type', 'content_slug'],
                name='idx_link_content_lookup',
            ),
            models.Index(
                fields=['role'],
                name='idx_link_role',
            ),
        ]

    def __str__(self):
        return f'{self.source.title} -> {self.content_type}:{self.content_slug}'


class ResearchThread(TimeStampedModel):
    """Tracks how an investigation develops over time.

    A thread is a narrative arc connecting sources, content pieces,
    and milestones. It shows the reader (and the author) how a line
    of inquiry evolved from initial question to published work.
    """

    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=300, unique=True, blank=True)
    description = models.TextField(
        blank=True,
        help_text='What this research thread is investigating.',
    )
    status = models.CharField(
        max_length=20,
        choices=ThreadStatus.choices,
        default=ThreadStatus.ACTIVE,
        db_index=True,
    )
    started_date = models.DateField(
        null=True,
        blank=True,
        help_text='When this line of investigation began.',
    )
    completed_date = models.DateField(
        null=True,
        blank=True,
        help_text='When the investigation concluded.',
    )
    resulting_essay_slug = models.SlugField(
        max_length=300,
        blank=True,
        help_text='Slug of the essay this thread produced (if any).',
    )
    tags = models.JSONField(
        default=list,
        blank=True,
    )
    public = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Whether this thread appears on the public site.',
    )

    objects = ResearchThreadManager()

    class Meta:
        ordering = ['-started_date', '-created_at']
        indexes = [
            models.Index(
                fields=['public', '-started_date'],
                name='idx_thread_public_date',
            ),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:300]
        super().save(*args, **kwargs)

    @property
    def entry_count(self):
        return self.entries.count()


class ThreadEntry(TimeStampedModel):
    """An ordered entry within a research thread.

    Entries record progress: a new source discovered, a connection
    made, a piece published, a question that changed direction.
    Each entry has an explicit type and order within its thread.
    """

    thread = models.ForeignKey(
        ResearchThread,
        on_delete=models.CASCADE,
        related_name='entries',
    )
    entry_type = models.CharField(
        max_length=20,
        choices=EntryType.choices,
        default=EntryType.NOTE,
        db_index=True,
    )
    date = models.DateField(
        help_text='When this entry occurred.',
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text='Display order within the thread (lower first).',
    )

    # Optional links to source or field note
    source = models.ForeignKey(
        Source,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='thread_entries',
        help_text='Source relevant to this entry (for "source" type entries).',
    )
    field_note_slug = models.SlugField(
        max_length=300,
        blank=True,
        help_text='Slug of a related field note (cross-service reference).',
    )

    # Content
    title = models.CharField(max_length=300)
    description = models.TextField(
        blank=True,
        help_text='What happened or what was discovered.',
    )

    class Meta:
        ordering = ['order', '-date']
        verbose_name_plural = 'thread entries'
        indexes = [
            models.Index(
                fields=['thread', 'order'],
                name='idx_entry_thread_order',
            ),
        ]

    def __str__(self):
        return f'{self.thread.title}: {self.title} ({self.date})'


# ---------------------------------------------------------------------------
# Community contributions
# ---------------------------------------------------------------------------

class ReviewStatus(models.TextChoices):
    PENDING = 'pending', 'Pending Review'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'


class SourceSuggestion(TimeStampedModel):
    """A reader-submitted source suggestion tied to a specific essay or note.

    Visitors discover a source you missed, fill out a short form (with
    reCAPTCHA v3), and the suggestion lands here for review. Promoting it
    creates a real Source + SourceLink with one admin action, preserving
    contributor attribution in the public annotation.
    """

    # Submitted content
    title = models.CharField(
        max_length=500,
        help_text='Title of the suggested source.',
    )
    url = models.URLField(
        max_length=2000,
        blank=True,
        help_text='Link to the source.',
    )
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        default=SourceType.ARTICLE,
    )
    relevance_note = models.TextField(
        max_length=1000,
        help_text='Why this source is relevant (the contributor\'s words).',
    )

    # Target content
    target_content_type = models.CharField(
        max_length=20,
        choices=ContentType.choices,
        default=ContentType.ESSAY,
        help_text='essay or field_note.',
    )
    target_slug = models.CharField(
        max_length=300,
        help_text='Slug of the content this source relates to.',
    )

    # Contributor identity (no account required)
    contributor_name = models.CharField(
        max_length=100,
        help_text='Display name of the contributor.',
    )
    contributor_url = models.URLField(
        max_length=500,
        blank=True,
        help_text='Optional website or social link for attribution.',
    )

    # Moderation
    status = models.CharField(
        max_length=20,
        choices=ReviewStatus.choices,
        default=ReviewStatus.PENDING,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewer_note = models.TextField(
        blank=True,
        help_text='Internal note about why this was approved/rejected.',
    )

    # If promoted, link to the created Source
    promoted_source = models.ForeignKey(
        Source,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='suggestions',
        help_text='The Source created when this suggestion was approved.',
    )

    # Spam protection metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    is_flagged = models.BooleanField(
        default=False,
        help_text='Flagged as potential spam by reCAPTCHA score.',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['status', 'created_at'],
                name='idx_suggestion_status_date',
            ),
            models.Index(
                fields=['target_slug'],
                name='idx_suggestion_target',
            ),
        ]

    def __str__(self):
        return f'[{self.status}] {self.title} -> {self.target_slug} (by {self.contributor_name})'


class ConnectionSuggestion(TimeStampedModel):
    """A reader-suggested connection between two pieces of content.

    "Your field note about sidewalk width relates to your essay about
    ADA compliance." These surface as proposed links you can approve
    in the admin.
    """

    # The two pieces of content the visitor thinks are connected
    from_content_type = models.CharField(
        max_length=20,
        choices=ContentType.choices,
        default=ContentType.ESSAY,
    )
    from_slug = models.CharField(max_length=300)
    to_content_type = models.CharField(
        max_length=20,
        choices=ContentType.choices,
        default=ContentType.ESSAY,
    )
    to_slug = models.CharField(max_length=300)

    # Why they think these are connected
    explanation = models.TextField(
        max_length=1000,
        help_text='How these pieces of content relate to each other.',
    )

    # Contributor
    contributor_name = models.CharField(max_length=100)
    contributor_url = models.URLField(max_length=500, blank=True)

    # Moderation
    status = models.CharField(
        max_length=20,
        choices=ReviewStatus.choices,
        default=ReviewStatus.PENDING,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # Spam protection
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    is_flagged = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['status'],
                name='idx_connection_status',
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['from_slug', 'to_slug'],
                name='unique_connection_suggestion',
            ),
        ]

    def __str__(self):
        return f'[{self.status}] {self.from_slug} <-> {self.to_slug} (by {self.contributor_name})'

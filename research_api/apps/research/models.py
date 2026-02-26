from django.db import models
from django.utils.text import slugify

from apps.core.models import TimeStampedModel


class SourceType(models.TextChoices):
    BOOK = 'book', 'Book'
    ARTICLE = 'article', 'Article'
    PAPER = 'paper', 'Academic Paper'
    PODCAST = 'podcast', 'Podcast'
    TALK = 'talk', 'Talk / Lecture'
    VIDEO = 'video', 'Video'
    REPORT = 'report', 'Report'
    DATASET = 'dataset', 'Dataset'
    OTHER = 'other', 'Other'


class ContentType(models.TextChoices):
    """Content types on the Next.js site that can reference sources."""
    ESSAY = 'essay', 'Essay'
    FIELD_NOTE = 'field-note', 'Field Note'
    PROJECT = 'project', 'Project'


class ThreadStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    PAUSED = 'paused', 'Paused'
    COMPLETED = 'completed', 'Completed'


class Source(TimeStampedModel):
    """A research source: book, article, paper, podcast, etc.

    The central entity. Sources are linked to site content via
    ContentReference, and shared sources between content pieces
    create automatic backlinks.
    """
    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=500, unique=True, blank=True)
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        default=SourceType.ARTICLE,
        db_index=True,
    )

    # Attribution
    authors = models.JSONField(
        default=list,
        blank=True,
        help_text='List of author names, e.g. ["Jane Jacobs", "Robert Caro"]',
    )
    publisher = models.CharField(max_length=300, blank=True)
    publication_date = models.DateField(null=True, blank=True)

    # Identifiers
    url = models.URLField(max_length=2000, blank=True)
    isbn = models.CharField('ISBN', max_length=20, blank=True)
    doi = models.CharField('DOI', max_length=200, blank=True)

    # Personal annotations
    notes = models.TextField(
        blank=True,
        help_text='Personal notes, key takeaways, or why this source matters.',
    )
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text='Tags for categorization, e.g. ["urban-design", "housing"]',
    )
    cover_image_url = models.URLField(max_length=2000, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['source_type', '-created_at'], name='idx_source_type_date'),
        ]

    def __str__(self):
        if self.authors:
            return f'{self.title} ({self.authors[0]})'
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:500]
        super().save(*args, **kwargs)

    @property
    def content_count(self):
        """Number of content pieces that reference this source."""
        return self.references.count()


class ContentReference(TimeStampedModel):
    """Links a Source to a published content piece on the site.

    This is the core join table. When two content pieces share
    a Source, that creates a backlink between them (computed by
    the backlink service, not stored separately).
    """
    source = models.ForeignKey(
        Source,
        on_delete=models.CASCADE,
        related_name='references',
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
        help_text='Display title of the content piece (for admin convenience).',
    )

    # How the source is used in this content
    context = models.TextField(
        blank=True,
        help_text='How or where this source is referenced in the content.',
    )
    paragraph_index = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='1-based paragraph number where this source is cited.',
    )

    class Meta:
        ordering = ['content_type', 'content_slug']
        constraints = [
            models.UniqueConstraint(
                fields=['source', 'content_type', 'content_slug'],
                name='unique_source_per_content',
            ),
        ]
        indexes = [
            models.Index(
                fields=['content_type', 'content_slug'],
                name='idx_content_ref_lookup',
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
    tags = models.JSONField(
        default=list,
        blank=True,
    )

    class Meta:
        ordering = ['-started_date', '-created_at']

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
    """A milestone or snapshot in a research thread.

    Entries record progress: a new source discovered, a connection
    made, a piece published, or a question that changed direction.
    """
    thread = models.ForeignKey(
        ResearchThread,
        on_delete=models.CASCADE,
        related_name='entries',
    )
    date = models.DateField(
        help_text='When this milestone occurred.',
    )
    title = models.CharField(max_length=300)
    body = models.TextField(
        blank=True,
        help_text='Description of what happened or what was discovered.',
    )

    # Optional links to sources and content
    sources = models.ManyToManyField(
        Source,
        blank=True,
        related_name='thread_entries',
        help_text='Sources relevant to this milestone.',
    )
    content_type = models.CharField(
        max_length=20,
        choices=ContentType.choices,
        blank=True,
        help_text='If this entry produced published content, its type.',
    )
    content_slug = models.SlugField(
        max_length=300,
        blank=True,
        help_text='If this entry produced published content, its slug.',
    )

    class Meta:
        ordering = ['-date']
        verbose_name_plural = 'thread entries'

    def __str__(self):
        return f'{self.thread.title}: {self.title} ({self.date})'

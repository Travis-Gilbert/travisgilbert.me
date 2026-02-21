"""
Content models mirroring the Zod schemas in src/lib/content.ts.

Each model produces frontmatter + body that the Next.js site can validate
and render without changes. The publisher app serializes these to .md files.
"""

from django.db import models
from django.utils.text import slugify

from apps.core.models import TimeStampedModel


class Essay(TimeStampedModel):
    """Maps to essaySchema in content.ts."""

    class Stage(models.TextChoices):
        RESEARCH = "research", "Research"
        DRAFTING = "drafting", "Drafting"
        PRODUCTION = "production", "Production"
        PUBLISHED = "published", "Published"

    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=300, unique=True, blank=True)
    date = models.DateField()
    summary = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    youtube_id = models.CharField(max_length=20, blank=True, default="")
    thumbnail = models.CharField(max_length=500, blank=True, default="")
    image = models.CharField(max_length=500, blank=True, default="")
    tags = models.JSONField(default=list, blank=True)
    sources = models.JSONField(
        default=list,
        blank=True,
        help_text='Array of {title, url} objects',
    )
    related = models.JSONField(default=list, blank=True)
    draft = models.BooleanField(default=True)
    callout = models.CharField(max_length=500, blank=True, default="")
    callouts = models.JSONField(default=list, blank=True)
    stage = models.CharField(
        max_length=20,
        choices=Stage.choices,
        default=Stage.RESEARCH,
    )
    annotations = models.JSONField(
        default=list,
        blank=True,
        help_text='Array of {paragraph, text} objects',
    )

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)


class FieldNote(TimeStampedModel):
    """Maps to fieldNoteSchema in content.ts."""

    class Status(models.TextChoices):
        OBSERVATION = "observation", "Observation"
        DEVELOPING = "developing", "Developing"
        CONNECTED = "connected", "Connected"

    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=300, unique=True, blank=True)
    date = models.DateField()
    body = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True)
    excerpt = models.CharField(max_length=300, blank=True, default="")
    draft = models.BooleanField(default=True)
    callout = models.CharField(max_length=500, blank=True, default="")
    callouts = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OBSERVATION,
        blank=True,
    )
    featured = models.BooleanField(default=False)
    connected_to = models.CharField(
        max_length=300,
        blank=True,
        default="",
        help_text="Slug of the parent essay this note connects to",
    )

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)


class ShelfEntry(TimeStampedModel):
    """Maps to shelfSchema in content.ts."""

    class EntryType(models.TextChoices):
        BOOK = "book", "Book"
        VIDEO = "video", "Video"
        PODCAST = "podcast", "Podcast"
        ARTICLE = "article", "Article"
        TOOL = "tool", "Tool"
        ALBUM = "album", "Album"
        OTHER = "other", "Other"

    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=300, unique=True, blank=True)
    creator = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=EntryType.choices)
    annotation = models.TextField()
    url = models.URLField(blank=True, default="")
    date = models.DateField()
    tags = models.JSONField(default=list, blank=True)
    connected_essay = models.CharField(
        max_length=300,
        blank=True,
        default="",
        help_text="Essay slug this source relates to",
    )

    class Meta:
        ordering = ["-date"]
        verbose_name_plural = "shelf entries"

    def __str__(self):
        return f"{self.title} by {self.creator}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)


class Project(TimeStampedModel):
    """Maps to projectSchema in content.ts."""

    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=300, unique=True, blank=True)
    role = models.CharField(max_length=100)
    description = models.CharField(max_length=300)
    year = models.PositiveIntegerField()
    date = models.DateField()
    organization = models.CharField(max_length=200, blank=True, default="")
    urls = models.JSONField(
        default=list,
        blank=True,
        help_text='Array of {label, url} objects',
    )
    tags = models.JSONField(default=list, blank=True)
    featured = models.BooleanField(default=False)
    draft = models.BooleanField(default=True)
    order = models.IntegerField(default=0)
    callout = models.CharField(max_length=500, blank=True, default="")
    body = models.TextField(blank=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)


class NowPage(TimeStampedModel):
    """
    Single-row model for the /now page.

    Unlike other content types, there is always exactly one NowPage.
    The publisher serializes it to src/content/now.md.
    """

    updated = models.DateField()
    researching = models.CharField(max_length=300, blank=True, default="")
    researching_context = models.TextField(blank=True, default="")
    reading = models.CharField(max_length=300, blank=True, default="")
    reading_context = models.TextField(blank=True, default="")
    building = models.CharField(max_length=300, blank=True, default="")
    building_context = models.TextField(blank=True, default="")
    listening = models.CharField(max_length=300, blank=True, default="")
    listening_context = models.TextField(blank=True, default="")
    thinking = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Now page"
        verbose_name_plural = "Now page"

    def __str__(self):
        return f"Now (updated {self.updated})"


class PublishLog(TimeStampedModel):
    """
    Audit trail for every publish action.

    Records which content was published, the commit SHA, and whether
    it succeeded. Useful for debugging and giving you confidence
    that the button actually did something.
    """

    class ContentType(models.TextChoices):
        ESSAY = "essay", "Essay"
        FIELD_NOTE = "field_note", "Field Note"
        SHELF = "shelf", "Shelf Entry"
        PROJECT = "project", "Project"
        NOW = "now", "Now Page"

    content_type = models.CharField(max_length=20, choices=ContentType.choices)
    content_slug = models.CharField(max_length=300)
    content_title = models.CharField(max_length=300)
    commit_sha = models.CharField(max_length=40, blank=True, default="")
    commit_url = models.URLField(blank=True, default="")
    success = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        status = "OK" if self.success else "FAILED"
        return f"[{status}] {self.content_type}: {self.content_title}"

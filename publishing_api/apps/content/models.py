"""
Content models mirroring the Zod schemas in src/lib/content.ts.

Each model produces frontmatter + body that the Next.js site can validate
and render without changes. The publisher app serializes these to .md files.

Site configuration models (DesignTokenSet, NavItem, PageComposition,
SiteSettings) serialize to a single src/config/site.json file.
"""

from django.db import models
from django.utils.text import slugify

from apps.core.models import TimeStampedModel


# ---------------------------------------------------------------------------
# Stage definitions shared between models and templates
# ---------------------------------------------------------------------------

ESSAY_STAGES = ["research", "drafting", "production", "published"]
NOTE_STAGES = ["observation", "developing", "connected"]
SIMPLE_STAGES = ["draft", "published"]


# ---------------------------------------------------------------------------
# Content models
# ---------------------------------------------------------------------------


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
    composition = models.JSONField(
        default=dict,
        blank=True,
        help_text="Per-instance visual overrides (heroStyle, overlay, accent)",
    )

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return self.title

    @property
    def is_draft(self):
        return self.stage != self.Stage.PUBLISHED

    @property
    def stage_list(self):
        return ESSAY_STAGES

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
    composition = models.JSONField(
        default=dict,
        blank=True,
        help_text="Per-instance visual overrides",
    )

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return self.title

    @property
    def is_draft(self):
        return self.status != self.Status.CONNECTED

    @property
    def stage_list(self):
        return NOTE_STAGES

    @property
    def stage(self):
        """Alias so templates can use a uniform `obj.stage` attribute."""
        return self.status

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

    class Stage(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

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
    stage = models.CharField(
        max_length=20,
        choices=Stage.choices,
        default=Stage.DRAFT,
    )
    composition = models.JSONField(
        default=dict,
        blank=True,
        help_text="Per-instance visual overrides",
    )

    class Meta:
        ordering = ["-date"]
        verbose_name_plural = "shelf entries"

    def __str__(self):
        return f"{self.title} by {self.creator}"

    @property
    def is_draft(self):
        return self.stage != self.Stage.PUBLISHED

    @property
    def stage_list(self):
        return SIMPLE_STAGES

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)


class Project(TimeStampedModel):
    """Maps to projectSchema in content.ts."""

    class Stage(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

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
    stage = models.CharField(
        max_length=20,
        choices=Stage.choices,
        default=Stage.DRAFT,
    )
    composition = models.JSONField(
        default=dict,
        blank=True,
        help_text="Per-instance visual overrides (tint override, etc.)",
    )

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return self.title

    @property
    def is_draft(self):
        return self.stage != self.Stage.PUBLISHED

    @property
    def stage_list(self):
        return SIMPLE_STAGES

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)


class ToolkitEntry(TimeStampedModel):
    """
    Toolkit content type: tools, workflows, and processes.

    Maps to toolkitSchema in content.ts. Frontmatter fields:
    title, category, order. Body is markdown.
    """

    class Stage(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=300, unique=True, blank=True)
    category = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Toolkit category (e.g. production, research, automation)",
    )
    order = models.IntegerField(default=0)
    body = models.TextField(blank=True)
    stage = models.CharField(
        max_length=20,
        choices=Stage.choices,
        default=Stage.DRAFT,
    )
    composition = models.JSONField(
        default=dict,
        blank=True,
        help_text="Per-instance visual overrides",
    )

    class Meta:
        ordering = ["order", "title"]
        verbose_name_plural = "toolkit entries"

    def __str__(self):
        return self.title

    @property
    def is_draft(self):
        return self.stage != self.Stage.PUBLISHED

    @property
    def stage_list(self):
        return SIMPLE_STAGES

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


# ---------------------------------------------------------------------------
# Site configuration models (serialize to src/config/site.json)
# ---------------------------------------------------------------------------


class DesignTokenSet(TimeStampedModel):
    """
    Singleton model for site-wide design tokens.

    Colors, fonts, spacing, and section color assignments. Serialized
    into the `tokens` key of site.json.
    """

    colors = models.JSONField(
        default=dict,
        blank=True,
        help_text="Brand and surface colors: {terracotta, teal, gold, green, parchment, darkGround, cream}",
    )
    fonts = models.JSONField(
        default=dict,
        blank=True,
        help_text="Font mappings: {title, body, mono, annotation, tagline}",
    )
    spacing = models.JSONField(
        default=dict,
        blank=True,
        help_text="Spacing values: {contentMaxWidth, heroMaxWidth}",
    )
    section_colors = models.JSONField(
        default=dict,
        blank=True,
        help_text="Which brand color maps to which section",
    )

    class Meta:
        verbose_name = "Design tokens"
        verbose_name_plural = "Design tokens"

    def __str__(self):
        return "Design Tokens"

    def save(self, *args, **kwargs):
        # Enforce singleton: always use pk=1
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class NavItem(TimeStampedModel):
    """
    Ordered navigation item for the site header.

    Serialized into the `nav` array of site.json.
    """

    label = models.CharField(max_length=100)
    path = models.CharField(max_length=200)
    icon = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="SketchIcon name (e.g. file-text, note-pencil)",
    )
    visible = models.BooleanField(default=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        vis = "" if self.visible else " (hidden)"
        return f"{self.label} -> {self.path}{vis}"


class PageComposition(TimeStampedModel):
    """
    Per-page composition settings.

    One row per page key (home, essays, essay_detail, etc.). The settings
    JSONField holds page-specific configuration validated at the form layer.
    Serialized into the `pages` key of site.json.
    """

    PAGE_KEY_CHOICES = [
        ("home", "Homepage"),
        ("essays", "Essays listing"),
        ("essay_detail", "Essay detail"),
        ("field_notes", "Field Notes listing"),
        ("field_note_detail", "Field Note detail"),
        ("projects", "Projects"),
        ("shelf", "Shelf"),
        ("toolkit", "Toolkit"),
        ("connect", "Connect"),
        ("colophon", "Colophon"),
        ("now", "Now"),
    ]

    page_key = models.CharField(
        max_length=50,
        unique=True,
        choices=PAGE_KEY_CHOICES,
    )
    settings = models.JSONField(
        default=dict,
        blank=True,
        help_text="Page-specific component configuration",
    )

    class Meta:
        ordering = ["page_key"]

    def __str__(self):
        return f"Page: {self.get_page_key_display()}"


class SiteSettings(TimeStampedModel):
    """
    Singleton model for global site settings.

    Footer, SEO defaults, and global feature toggles. Serialized
    into the `footer`, `seo`, and `toggles` keys of site.json.
    """

    footer_tagline = models.CharField(max_length=500, blank=True, default="")
    footer_links = models.JSONField(
        default=list,
        blank=True,
        help_text="Array of {label, url} objects",
    )
    seo_title_template = models.CharField(
        max_length=200,
        blank=True,
        default="%s | travisgilbert.me",
    )
    seo_description = models.TextField(blank=True, default="")
    seo_og_image_fallback = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )
    global_toggles = models.JSONField(
        default=dict,
        blank=True,
        help_text="Feature flags: {dotgrid_enabled, paper_grain_enabled, console_easter_egg}",
    )

    class Meta:
        verbose_name = "Site settings"
        verbose_name_plural = "Site settings"

    def __str__(self):
        return "Site Settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


# ---------------------------------------------------------------------------
# Publish audit log
# ---------------------------------------------------------------------------


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
        TOOLKIT = "toolkit", "Toolkit Entry"
        NOW = "now", "Now Page"
        SITE_CONFIG = "site_config", "Site Config"

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

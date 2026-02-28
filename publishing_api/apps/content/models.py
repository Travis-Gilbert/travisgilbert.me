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
# Video production models (YouTube production pipeline P0 through P7)
# ---------------------------------------------------------------------------

VIDEO_PHASES = [
    "research", "scripting", "voiceover", "filming",
    "assembly", "polish", "metadata", "publish", "published",
]


class VideoProject(TimeStampedModel):
    """
    A YouTube video production project. Tracks the full P0 through P7
    lifecycle. Can be linked to essays that share research and content.
    """

    class Phase(models.TextChoices):
        P0_RESEARCH = "research", "P0: Topic Research"
        P1_SCRIPTING = "scripting", "P1: Script Lock"
        P2_VOICEOVER = "voiceover", "P2: Voiceover Record"
        P3_FILMING = "filming", "P3: On-Camera Filming"
        P4_ASSEMBLY = "assembly", "P4: Assembly Edit"
        P5_POLISH = "polish", "P5: Graphics and Polish"
        P6_METADATA = "metadata", "P6: Export and Metadata"
        P7_PUBLISH = "publish", "P7: Publish"
        PUBLISHED = "published", "Published"

    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=300, unique=True, blank=True)
    short_title = models.CharField(
        max_length=60,
        blank=True,
        default="",
        help_text="Short title for TickTick tasks and dashboards",
    )

    # Production state
    phase = models.CharField(
        max_length=20,
        choices=Phase.choices,
        default=Phase.P0_RESEARCH,
    )
    phase_locked_through = models.CharField(
        max_length=20,
        choices=Phase.choices,
        blank=True,
        default="",
        help_text="Highest phase that is permanently locked (completed)",
    )
    draft = models.BooleanField(default=True)

    # Connections to existing content
    linked_essays = models.ManyToManyField(
        "Essay",
        blank=True,
        related_name="video_projects",
        help_text="Essays that share research or content with this video",
    )
    linked_field_notes = models.ManyToManyField(
        "FieldNote",
        blank=True,
        related_name="video_projects",
        help_text="Field notes connected to this video's research",
    )

    # Research
    thesis = models.TextField(
        blank=True,
        default="",
        help_text="One-sentence thesis. Often shared with linked essay.",
    )
    sources = models.JSONField(
        default=list,
        blank=True,
        help_text="Array of {title, url, type, role} objects",
    )
    research_notes = models.TextField(
        blank=True,
        default="",
        help_text="Free-form research notes (Markdown)",
    )

    # Script
    script_body = models.TextField(
        blank=True,
        default="",
        help_text="Full script in Markdown with [VO], [ON-CAMERA], [B-ROLL], [GRAPHIC] tags",
    )
    script_word_count = models.IntegerField(default=0)
    script_estimated_duration = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Estimated video duration based on ~150 words/min VO pace",
    )

    # YouTube metadata (prepared during P6, used during P7)
    youtube_title = models.CharField(max_length=100, blank=True, default="")
    youtube_description = models.TextField(blank=True, default="")
    youtube_tags = models.JSONField(default=list, blank=True)
    youtube_category = models.CharField(
        max_length=50, blank=True, default="Education"
    )
    youtube_chapters = models.JSONField(
        default=list,
        blank=True,
        help_text="Array of {timecode, label} objects",
    )
    youtube_thumbnail_path = models.CharField(
        max_length=500, blank=True, default=""
    )

    # Post-publish
    youtube_id = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="YouTube video ID after upload",
    )
    youtube_url = models.URLField(blank=True, default="")
    published_at = models.DateTimeField(null=True, blank=True)

    # External tool references
    ticktick_task_id = models.CharField(
        max_length=30,
        blank=True,
        default="",
        help_text="TickTick task ID for the active phase",
    )
    ulysses_sheet_id = models.CharField(max_length=50, blank=True, default="")
    descript_project_id = models.CharField(
        max_length=50, blank=True, default=""
    )
    resolve_project_name = models.CharField(
        max_length=200, blank=True, default=""
    )

    # Visual overrides
    composition = models.JSONField(
        default=dict,
        blank=True,
        help_text="Per-instance visual overrides",
    )

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        label = self.short_title or self.title
        return f"{label} ({self.get_phase_display()})"

    @property
    def is_draft(self):
        return self.phase != self.Phase.PUBLISHED

    @property
    def stage_list(self):
        return VIDEO_PHASES

    @property
    def stage(self):
        """Alias so templates can use a uniform `obj.stage` attribute."""
        return self.phase

    @property
    def phase_number(self):
        """Returns integer phase index (0 through 8)."""
        phases = [c[0] for c in self.Phase.choices]
        return phases.index(self.phase)

    @property
    def locked_phase_number(self):
        if not self.phase_locked_through:
            return -1
        phases = [c[0] for c in self.Phase.choices]
        return phases.index(self.phase_locked_through)

    def can_advance(self):
        """Whether the current phase can advance (not already published)."""
        return self.phase != self.Phase.PUBLISHED

    def advance_phase(self):
        """
        Lock current phase and advance to next.
        Returns the new phase string, or None if already published.
        """
        if not self.can_advance():
            return None
        self.phase_locked_through = self.phase
        phases = [c[0] for c in self.Phase.choices]
        current_idx = phases.index(self.phase)
        self.phase = phases[current_idx + 1]
        self.save()
        return self.phase

    def rollback_phase(self):
        """
        Roll back to previous phase. Only allowed if the previous phase
        is not locked through.
        Returns new phase string or None if cannot roll back.
        """
        phases = [c[0] for c in self.Phase.choices]
        current_idx = phases.index(self.phase)
        if current_idx <= 0:
            return None
        prev_phase = phases[current_idx - 1]
        if self.locked_phase_number >= phases.index(prev_phase):
            return None
        self.phase = prev_phase
        self.save()
        return self.phase

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        # Auto-calculate script stats
        if self.script_body:
            self.script_word_count = len(self.script_body.split())
            minutes = self.script_word_count / 150
            mins = int(minutes)
            secs = int((minutes - mins) * 60)
            self.script_estimated_duration = f"{mins}:{secs:02d}"
        super().save(*args, **kwargs)


class VideoScene(TimeStampedModel):
    """
    A scene within a video script. Tracks type (VO, on-camera, B-roll),
    estimated duration, and per-phase completion status.
    """

    class SceneType(models.TextChoices):
        VO = "vo", "Voiceover"
        ON_CAMERA = "on_camera", "On-Camera"
        BROLL = "broll", "B-Roll"
        GRAPHIC = "graphic", "Graphic/Animation"
        MIXED = "mixed", "Mixed"

    video = models.ForeignKey(
        VideoProject, on_delete=models.CASCADE, related_name="scenes"
    )
    order = models.IntegerField(default=0)
    title = models.CharField(max_length=200)
    scene_type = models.CharField(
        max_length=12,
        choices=SceneType.choices,
        default=SceneType.VO,
    )

    script_text = models.TextField(blank=True, default="")
    word_count = models.IntegerField(default=0)
    estimated_seconds = models.IntegerField(
        default=0,
        help_text="Estimated duration in seconds (auto from word count at ~150 wpm)",
    )

    # Per-phase completion tracking
    script_locked = models.BooleanField(default=False)
    vo_recorded = models.BooleanField(default=False)
    filmed = models.BooleanField(default=False)
    assembled = models.BooleanField(default=False)
    polished = models.BooleanField(default=False)

    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["order"]
        unique_together = [("video", "order")]

    def __str__(self):
        return f"Scene {self.order}: {self.title} ({self.get_scene_type_display()})"

    def save(self, *args, **kwargs):
        if self.script_text:
            self.word_count = len(self.script_text.split())
            self.estimated_seconds = int((self.word_count / 150) * 60)
        super().save(*args, **kwargs)


class VideoDeliverable(TimeStampedModel):
    """
    A concrete artifact produced during a video phase. Tracks file paths,
    which phase produced it, and approval status.
    """

    class DeliverableType(models.TextChoices):
        RESEARCH_NOTES = "research_notes", "Research Notes"
        SCRIPT_PDF = "script_pdf", "Locked Script PDF"
        SCRIPT_MARKDOWN = "script_markdown", "Script Markdown Export"
        VO_AUDIO = "vo_audio", "VO Audio"
        VO_TRANSCRIPT = "vo_transcript", "VO Marked-Up Transcript"
        FOOTAGE = "footage", "Camera Footage"
        ROUGH_CUT = "rough_cut", "Rough Cut"
        FINAL_CUT = "final_cut", "Final Cut"
        THUMBNAIL = "thumbnail", "Thumbnail"
        RENDERED_VIDEO = "rendered_video", "Rendered Video"
        YOUTUBE_METADATA = "youtube_metadata", "YouTube Metadata"

    video = models.ForeignKey(
        VideoProject, on_delete=models.CASCADE, related_name="deliverables"
    )
    phase = models.CharField(
        max_length=20, choices=VideoProject.Phase.choices
    )
    deliverable_type = models.CharField(
        max_length=20, choices=DeliverableType.choices
    )
    file_path = models.CharField(max_length=500, blank=True, default="")
    file_url = models.URLField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    approved = models.BooleanField(default=False)

    class Meta:
        ordering = ["phase", "created_at"]

    def __str__(self):
        return f"{self.get_deliverable_type_display()} ({self.phase})"


class VideoSession(TimeStampedModel):
    """
    A work session on a video project. Records what was done, which phase
    it was in, and what the next action is. Feeds the Session Launcher
    skill and process notes on the site.
    """

    video = models.ForeignKey(
        VideoProject, on_delete=models.CASCADE, related_name="sessions"
    )
    phase = models.CharField(
        max_length=20, choices=VideoProject.Phase.choices
    )
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(default=0)

    # What happened
    summary = models.TextField(
        blank=True,
        default="",
        help_text="Brief description of what was accomplished this session",
    )
    subtasks_completed = models.JSONField(
        default=list,
        blank=True,
        help_text="Array of subtask titles completed",
    )

    # What's next (feeds Session Launcher)
    next_action = models.TextField(
        blank=True,
        default="",
        help_text="The single next action identified at end of session",
    )
    next_tool = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Which app/tool the next action requires (Ulysses, Descript, etc.)",
    )

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        label = self.video.short_title or self.video.title
        return f"{label} session ({self.started_at.strftime('%Y-%m-%d')})"


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
        VIDEO = "video", "Video"
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

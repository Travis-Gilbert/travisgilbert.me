from django import forms

from crispy_forms.helper import FormHelper
from crispy_forms.layout import Fieldset, Layout

from apps.content.models import (
    DesignTokenSet,
    Essay,
    FieldNote,
    NavItem,
    NowPage,
    PageComposition,
    Project,
    ShelfEntry,
    SiteSettings,
    ToolkitEntry,
    VideoDeliverable,
    VideoProject,
    VideoScene,
)
from apps.editor.widgets import (
    ANNOTATIONS_SCHEMA,
    CALLOUTS_SCHEMA,
    FOOTER_LINKS_SCHEMA,
    SOURCES_SCHEMA,
    URLS_SCHEMA,
    VIDEO_SOURCES_SCHEMA,
    YOUTUBE_CHAPTERS_SCHEMA,
    CompositionWidget,
    JsonObjectListWidget,
    SlugListWidget,
    StructuredListWidget,
    TagsWidget,
)


class EssayForm(forms.ModelForm):
    class Meta:
        model = Essay
        fields = [
            "title",
            "slug",
            "date",
            "summary",
            "body",
            "youtube_id",
            "thumbnail",
            "image",
            "tags",
            "sources",
            "related",
            "draft",
            "callout",
            "callouts",
            "stage",
            "annotations",
            "composition",
            "thesis",
            "source_count",
            "research_started",
            "revision_count",
            "research_notes",
            "source_summary",
            "connected_types",
            "connection_notes",
        ]
        widgets = {
            "title": forms.TextInput(attrs={
                "placeholder": "Essay title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "placeholder": "auto-generated-from-title",
            }),
            "date": forms.DateInput(attrs={
                "type": "date",
            }),
            "summary": forms.Textarea(attrs={
                "rows": 2,
                "maxlength": 200,
                "placeholder": "A brief summary (max 200 chars)...",
            }),
            "body": forms.Textarea(attrs={
                "id": "editor-body",
                "placeholder": "Start writing...",
                "class": (
                    "w-full min-h-[400px] px-6 py-4 font-mono text-[14px]"
                    " leading-relaxed text-ink bg-transparent border-none"
                    " outline-none resize-y placeholder:text-ink-muted"
                ),
            }),
            "youtube_id": forms.TextInput(attrs={
                "placeholder": "YouTube video ID",
            }),
            "thumbnail": forms.TextInput(attrs={
                "placeholder": "/collage/thumbnail.png",
            }),
            "image": forms.TextInput(attrs={
                "placeholder": "/collage/image.png",
            }),
            "callout": forms.Textarea(attrs={
                "rows": 2,
                "placeholder": "Callout text. Use [link text](url) for hyperlinks.",
            }),
            "stage": forms.Select(),
            "composition": CompositionWidget(),
            # JSON fields with structured widgets
            "tags": TagsWidget(),
            "sources": StructuredListWidget(fields_schema=SOURCES_SCHEMA),
            "related": SlugListWidget(attrs={
                "placeholder": "essay-slug-1, essay-slug-2",
            }),
            "callouts": StructuredListWidget(fields_schema=CALLOUTS_SCHEMA),
            "annotations": StructuredListWidget(fields_schema=ANNOTATIONS_SCHEMA),
            # Process proof fields
            "thesis": forms.Textarea(attrs={
                "rows": 2,
                "placeholder": "One-sentence thesis for this essay...",
            }),
            "research_started": forms.DateInput(attrs={
                "type": "date",
            }),
            "source_summary": forms.TextInput(attrs={
                "placeholder": "e.g. 4 articles, 2 books, 1 interview",
            }),
            "connected_types": TagsWidget(attrs={
                "placeholder": "field-note, project, shelf-entry",
            }),
            "research_notes": forms.Textarea(attrs={
                "rows": 4,
                "placeholder": "Research notes, open questions, leads...",
            }),
            "connection_notes": forms.Textarea(attrs={
                "rows": 3,
                "placeholder": "How this essay connects to other content...",
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.layout = Layout(
            Fieldset(
                "Identity",
                "title", "slug", "date",
                css_class="section-terracotta",
            ),
            Fieldset(
                "Content",
                "summary", "stage",
                css_class="",
            ),
            Fieldset(
                "Media",
                "youtube_id", "thumbnail", "image",
                css_class="",
            ),
            Fieldset(
                "Taxonomy",
                "tags", "related",
                css_class="section-teal",
            ),
            Fieldset(
                "Structured Data",
                "sources", "annotations", "callouts", "callout",
                css_class="section-gold with-grid",
            ),
            Fieldset(
                "Process Proof",
                "thesis", "source_count", "research_started",
                "revision_count", "source_summary", "connected_types",
                "research_notes", "connection_notes",
                css_class="section-teal",
            ),
            Fieldset(
                "Advanced",
                "draft", "composition",
                css_class="",
            ),
        )


class FieldNoteForm(forms.ModelForm):
    class Meta:
        model = FieldNote
        fields = [
            "title",
            "slug",
            "date",
            "body",
            "tags",
            "excerpt",
            "draft",
            "callout",
            "callouts",
            "status",
            "featured",
            "connected_to",
            "composition",
        ]
        widgets = {
            "title": forms.TextInput(attrs={
                "placeholder": "Note title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "placeholder": "auto-generated-from-title",
            }),
            "date": forms.DateInput(attrs={"type": "date"}),
            "body": forms.Textarea(attrs={
                "id": "editor-body",
                "placeholder": "Start writing...",
                "class": (
                    "w-full min-h-[400px] px-6 py-4 font-mono text-[14px]"
                    " leading-relaxed text-ink bg-transparent border-none"
                    " outline-none resize-y placeholder:text-ink-muted"
                ),
            }),
            "excerpt": forms.Textarea(attrs={
                "rows": 2,
                "maxlength": 300,
                "placeholder": "Brief excerpt (max 300 chars)...",
            }),
            "status": forms.Select(),
            "connected_to": forms.TextInput(attrs={
                "placeholder": "Parent essay slug",
            }),
            "callout": forms.Textarea(attrs={
                "rows": 2,
                "placeholder": "Callout text. Use [link text](url) for hyperlinks.",
            }),
            "composition": JsonObjectListWidget(
                attrs={"rows": 3},
                placeholder_hint='{\n  "layout": "compact"\n}',
            ),
            # JSON fields with structured widgets
            "tags": TagsWidget(),
            "callouts": StructuredListWidget(fields_schema=CALLOUTS_SCHEMA),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.layout = Layout(
            Fieldset(
                "Identity",
                "title", "slug", "date",
                css_class="section-terracotta",
            ),
            Fieldset(
                "Content",
                "excerpt", "status",
                css_class="",
            ),
            Fieldset(
                "Taxonomy",
                "tags", "connected_to",
                css_class="section-teal",
            ),
            Fieldset(
                "Structured Data",
                "callouts", "callout",
                css_class="section-gold with-grid",
            ),
            Fieldset(
                "Advanced",
                "draft", "featured", "composition",
                css_class="",
            ),
        )


class ShelfEntryForm(forms.ModelForm):
    class Meta:
        model = ShelfEntry
        fields = [
            "title",
            "slug",
            "creator",
            "type",
            "annotation",
            "url",
            "date",
            "tags",
            "connected_essay",
            "stage",
            "composition",
        ]
        widgets = {
            "title": forms.TextInput(attrs={
                "placeholder": "Title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "placeholder": "auto-generated-from-title",
            }),
            "creator": forms.TextInput(attrs={
                "placeholder": "Author / creator",
            }),
            "type": forms.Select(),
            "annotation": forms.Textarea(attrs={
                "id": "editor-body",
                "rows": 6,
                "placeholder": "Your annotation...",
                "class": (
                    "w-full min-h-[200px] px-6 py-4 font-mono text-[14px]"
                    " leading-relaxed text-ink bg-transparent border-none"
                    " outline-none resize-y placeholder:text-ink-muted"
                ),
            }),
            "url": forms.URLInput(attrs={
                "placeholder": "https://...",
            }),
            "date": forms.DateInput(attrs={"type": "date"}),
            "connected_essay": forms.TextInput(attrs={
                "placeholder": "Related essay slug",
            }),
            "stage": forms.Select(),
            "composition": JsonObjectListWidget(
                attrs={"rows": 3},
                placeholder_hint='{}',
            ),
            # JSON fields with custom widgets
            "tags": TagsWidget(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.layout = Layout(
            Fieldset(
                "Identity",
                "title", "slug", "date",
                css_class="section-terracotta",
            ),
            Fieldset(
                "Details",
                "creator", "type", "url",
                css_class="",
            ),
            Fieldset(
                "Content",
                "stage",
                css_class="",
            ),
            Fieldset(
                "Taxonomy",
                "tags", "connected_essay",
                css_class="section-teal",
            ),
            Fieldset(
                "Advanced",
                "composition",
                css_class="",
            ),
        )


class ProjectForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = [
            "title",
            "slug",
            "role",
            "description",
            "year",
            "date",
            "organization",
            "urls",
            "tags",
            "featured",
            "draft",
            "order",
            "callout",
            "body",
            "stage",
            "composition",
        ]
        widgets = {
            "title": forms.TextInput(attrs={
                "placeholder": "Project title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "placeholder": "auto-generated-from-title",
            }),
            "role": forms.TextInput(attrs={
                "placeholder": "Your role (e.g. Built & Designed)",
            }),
            "description": forms.Textarea(attrs={
                "rows": 2,
                "maxlength": 300,
                "placeholder": "Brief description (max 300 chars)...",
            }),
            "year": forms.NumberInput(),
            "date": forms.DateInput(attrs={"type": "date"}),
            "organization": forms.TextInput(attrs={
                "placeholder": "Organization name",
            }),
            "body": forms.Textarea(attrs={
                "id": "editor-body",
                "placeholder": "Project details...",
                "class": (
                    "w-full min-h-[400px] px-6 py-4 font-mono text-[14px]"
                    " leading-relaxed text-ink bg-transparent border-none"
                    " outline-none resize-y placeholder:text-ink-muted"
                ),
            }),
            "callout": forms.Textarea(attrs={
                "rows": 2,
                "placeholder": "Callout text. Use [link text](url) for hyperlinks.",
            }),
            "order": forms.NumberInput(attrs={
                "placeholder": "Sort order (0 = default)",
            }),
            "stage": forms.Select(),
            "composition": JsonObjectListWidget(
                attrs={"rows": 3},
                placeholder_hint='{\n  "tint": "teal"\n}',
            ),
            # JSON fields with structured widgets
            "tags": TagsWidget(),
            "urls": StructuredListWidget(fields_schema=URLS_SCHEMA),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.layout = Layout(
            Fieldset(
                "Identity",
                "title", "slug", "date", "year",
                css_class="section-terracotta",
            ),
            Fieldset(
                "Details",
                "role", "organization", "description", "order",
                css_class="",
            ),
            Fieldset(
                "Content",
                "callout", "stage",
                css_class="",
            ),
            Fieldset(
                "Taxonomy",
                "tags",
                css_class="section-teal",
            ),
            Fieldset(
                "Structured Data",
                "urls",
                css_class="section-gold with-grid",
            ),
            Fieldset(
                "Advanced",
                "draft", "featured", "composition",
                css_class="",
            ),
        )


class ToolkitEntryForm(forms.ModelForm):
    class Meta:
        model = ToolkitEntry
        fields = [
            "title",
            "slug",
            "category",
            "order",
            "body",
            "stage",
            "composition",
        ]
        widgets = {
            "title": forms.TextInput(attrs={
                "placeholder": "Tool or process name...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "placeholder": "auto-generated-from-title",
            }),
            "category": forms.TextInput(attrs={
                "placeholder": "e.g. production, research, automation",
            }),
            "order": forms.NumberInput(attrs={
                "placeholder": "Sort order (0 = default)",
            }),
            "body": forms.Textarea(attrs={
                "id": "editor-body",
                "placeholder": "Describe this tool or process...",
                "class": (
                    "w-full min-h-[400px] px-6 py-4 font-mono text-[14px]"
                    " leading-relaxed text-ink bg-transparent border-none"
                    " outline-none resize-y placeholder:text-ink-muted"
                ),
            }),
            "stage": forms.Select(),
            "composition": JsonObjectListWidget(
                attrs={"rows": 3},
                placeholder_hint='{}',
            ),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.layout = Layout(
            Fieldset(
                "Identity",
                "title", "slug",
                css_class="section-terracotta",
            ),
            Fieldset(
                "Details",
                "category", "order",
                css_class="",
            ),
            Fieldset(
                "Content",
                "stage",
                css_class="",
            ),
            Fieldset(
                "Advanced",
                "composition",
                css_class="",
            ),
        )


class NowPageForm(forms.ModelForm):
    class Meta:
        model = NowPage
        fields = [
            "updated",
            "researching",
            "researching_context",
            "reading",
            "reading_context",
            "building",
            "building_context",
            "listening",
            "listening_context",
            "thinking",
        ]
        widgets = {
            "updated": forms.DateInput(attrs={"type": "date"}),
            "researching": forms.TextInput(attrs={
                "placeholder": "Currently researching...",
            }),
            "researching_context": forms.Textarea(attrs={
                "rows": 2,
                "placeholder": "Context...",
            }),
            "reading": forms.TextInput(attrs={
                "placeholder": "Currently reading...",
            }),
            "reading_context": forms.Textarea(attrs={
                "rows": 2,
                "placeholder": "Context...",
            }),
            "building": forms.TextInput(attrs={
                "placeholder": "Currently building...",
            }),
            "building_context": forms.Textarea(attrs={
                "rows": 2,
                "placeholder": "Context...",
            }),
            "listening": forms.TextInput(attrs={
                "placeholder": "Currently listening to...",
            }),
            "listening_context": forms.Textarea(attrs={
                "rows": 2,
                "placeholder": "Context...",
            }),
            "thinking": forms.Textarea(attrs={
                "rows": 4,
                "placeholder": "What you're thinking about...",
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.layout = Layout(
            Fieldset(
                "Status",
                "updated",
                css_class="section-terracotta",
            ),
            Fieldset(
                "Activities",
                "researching", "researching_context",
                "reading", "reading_context",
                "building", "building_context",
                "listening", "listening_context",
                css_class="section-teal",
            ),
            Fieldset(
                "Reflection",
                "thinking",
                css_class="section-gold",
            ),
        )


# ---------------------------------------------------------------------------
# Site configuration forms
# ---------------------------------------------------------------------------


class DesignTokenSetForm(forms.ModelForm):
    class Meta:
        model = DesignTokenSet
        fields = ["colors", "fonts", "spacing", "section_colors"]
        widgets = {
            "colors": JsonObjectListWidget(
                attrs={"rows": 8},
                placeholder_hint=(
                    '{\n'
                    '  "terracotta": "#B45A2D",\n'
                    '  "teal": "#2D5F6B",\n'
                    '  "gold": "#C49A4A",\n'
                    '  "green": "#5A7A4A",\n'
                    '  "parchment": "#F5F0E8",\n'
                    '  "darkGround": "#2A2824",\n'
                    '  "cream": "#F0EBE3"\n'
                    '}'
                ),
            ),
            "fonts": JsonObjectListWidget(
                attrs={"rows": 6},
                placeholder_hint=(
                    '{\n'
                    '  "title": "Vollkorn",\n'
                    '  "body": "Cabin",\n'
                    '  "mono": "Courier Prime",\n'
                    '  "annotation": "Caveat",\n'
                    '  "tagline": "Ysabeau"\n'
                    '}'
                ),
            ),
            "spacing": JsonObjectListWidget(
                attrs={"rows": 4},
                placeholder_hint=(
                    '{\n'
                    '  "contentMaxWidth": "896px",\n'
                    '  "heroMaxWidth": "1152px"\n'
                    '}'
                ),
            ),
            "section_colors": JsonObjectListWidget(
                attrs={"rows": 6},
                placeholder_hint=(
                    '{\n'
                    '  "essays": "terracotta",\n'
                    '  "fieldNotes": "teal",\n'
                    '  "projects": "gold"\n'
                    '}'
                ),
            ),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.layout = Layout(
            Fieldset(
                "Design Tokens",
                "colors", "fonts", "spacing", "section_colors",
                css_class="section-terracotta with-grid",
            ),
        )


class NavItemForm(forms.ModelForm):
    class Meta:
        model = NavItem
        fields = ["label", "path", "icon", "visible", "order"]
        widgets = {
            "label": forms.TextInput(attrs={
                "placeholder": "Nav label",
            }),
            "path": forms.TextInput(attrs={
                "placeholder": "/section-path",
            }),
            "icon": forms.TextInput(attrs={
                "placeholder": "SketchIcon name (e.g. file-text)",
            }),
            "order": forms.NumberInput(attrs={
                "placeholder": "0",
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.layout = Layout(
            "label", "path", "icon", "visible", "order",
        )


NavItemFormSet = forms.modelformset_factory(
    NavItem,
    form=NavItemForm,
    extra=1,
    can_delete=True,
)


class PageCompositionForm(forms.ModelForm):
    class Meta:
        model = PageComposition
        fields = ["page_key", "settings"]
        widgets = {
            "page_key": forms.Select(),
            "settings": JsonObjectListWidget(
                attrs={"rows": 12},
                placeholder_hint='{\n  "key": "value"\n}',
            ),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.layout = Layout(
            Fieldset(
                "Page Composition",
                "page_key", "settings",
                css_class="section-gold with-grid",
            ),
        )


class SiteSettingsForm(forms.ModelForm):
    class Meta:
        model = SiteSettings
        fields = [
            "footer_tagline",
            "footer_links",
            "seo_title_template",
            "seo_description",
            "seo_og_image_fallback",
            "global_toggles",
        ]
        widgets = {
            "footer_tagline": forms.TextInput(attrs={
                "placeholder": "Footer tagline text",
            }),
            "footer_links": StructuredListWidget(fields_schema=FOOTER_LINKS_SCHEMA),
            "seo_title_template": forms.TextInput(attrs={
                "placeholder": "%s | travisgilbert.me",
            }),
            "seo_description": forms.Textarea(attrs={
                "rows": 3,
                "placeholder": "Default meta description...",
            }),
            "seo_og_image_fallback": forms.TextInput(attrs={
                "placeholder": "https://travisgilbert.me/og-image.png",
            }),
            "global_toggles": JsonObjectListWidget(
                attrs={"rows": 5},
                placeholder_hint=(
                    '{\n'
                    '  "dotgrid_enabled": true,\n'
                    '  "paper_grain_enabled": true,\n'
                    '  "console_easter_egg": true\n'
                    '}'
                ),
            ),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.layout = Layout(
            Fieldset(
                "Footer",
                "footer_tagline", "footer_links",
                css_class="section-teal",
            ),
            Fieldset(
                "SEO",
                "seo_title_template", "seo_description", "seo_og_image_fallback",
                css_class="section-terracotta",
            ),
            Fieldset(
                "Toggles",
                "global_toggles",
                css_class="section-gold",
            ),
        )


# ---------------------------------------------------------------------------
# Video production forms
# ---------------------------------------------------------------------------


class VideoProjectForm(forms.ModelForm):
    class Meta:
        model = VideoProject
        fields = [
            "title",
            "slug",
            "short_title",
            "thesis",
            "sources",
            "research_notes",
            "script_body",
            "youtube_title",
            "youtube_description",
            "youtube_tags",
            "youtube_category",
            "youtube_chapters",
            "youtube_thumbnail_path",
            "youtube_id",
            "youtube_url",
            "ticktick_task_id",
            "ulysses_sheet_id",
            "descript_project_id",
            "resolve_project_name",
            "linked_essays",
            "linked_field_notes",
            "composition",
        ]
        widgets = {
            "title": forms.TextInput(attrs={
                "placeholder": "Video title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "placeholder": "auto-generated-from-title",
            }),
            "short_title": forms.TextInput(attrs={
                "placeholder": "Short title for dashboards...",
            }),
            "thesis": forms.Textarea(attrs={
                "rows": 2,
                "placeholder": "One-sentence thesis for this video...",
            }),
            "research_notes": forms.Textarea(attrs={
                "rows": 6,
                "placeholder": "Research notes (Markdown)...",
            }),
            "script_body": forms.Textarea(attrs={
                "id": "editor-body",
                "placeholder": "Full script with [VO], [ON-CAMERA], [B-ROLL], [GRAPHIC] tags...",
                "class": (
                    "w-full min-h-[400px] px-6 py-4 font-mono text-[14px]"
                    " leading-relaxed text-ink bg-transparent border-none"
                    " outline-none resize-y placeholder:text-ink-muted"
                ),
            }),
            "youtube_title": forms.TextInput(attrs={
                "placeholder": "YouTube title (max 100 chars)",
                "maxlength": 100,
            }),
            "youtube_description": forms.Textarea(attrs={
                "rows": 4,
                "placeholder": "YouTube description...",
            }),
            "youtube_category": forms.TextInput(attrs={
                "placeholder": "Education",
            }),
            "youtube_thumbnail_path": forms.TextInput(attrs={
                "placeholder": "/videos/thumbnails/filename.png",
            }),
            "youtube_id": forms.TextInput(attrs={
                "placeholder": "YouTube video ID after upload",
            }),
            "youtube_url": forms.URLInput(attrs={
                "placeholder": "https://youtube.com/watch?v=...",
            }),
            "ticktick_task_id": forms.TextInput(attrs={
                "placeholder": "TickTick task ID",
            }),
            "ulysses_sheet_id": forms.TextInput(attrs={
                "placeholder": "Ulysses sheet identifier",
            }),
            "descript_project_id": forms.TextInput(attrs={
                "placeholder": "Descript project ID",
            }),
            "resolve_project_name": forms.TextInput(attrs={
                "placeholder": "DaVinci Resolve project name",
            }),
            # JSON fields with structured widgets
            "sources": StructuredListWidget(fields_schema=VIDEO_SOURCES_SCHEMA),
            "youtube_tags": TagsWidget(),
            "youtube_chapters": StructuredListWidget(fields_schema=YOUTUBE_CHAPTERS_SCHEMA),
            "composition": CompositionWidget(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.layout = Layout(
            Fieldset(
                "Identity",
                "title", "slug", "short_title",
                css_class="section-green",
            ),
            Fieldset(
                "Research",
                "thesis", "sources", "research_notes",
                css_class="section-teal",
            ),
            Fieldset(
                "Connections",
                "linked_essays", "linked_field_notes",
                css_class="section-teal",
            ),
            Fieldset(
                "YouTube Metadata",
                "youtube_title", "youtube_description",
                "youtube_tags", "youtube_category",
                "youtube_chapters", "youtube_thumbnail_path",
                css_class="section-gold",
            ),
            Fieldset(
                "Post-Publish",
                "youtube_id", "youtube_url",
                css_class="",
            ),
            Fieldset(
                "External Tools",
                "ticktick_task_id", "ulysses_sheet_id",
                "descript_project_id", "resolve_project_name",
                css_class="",
            ),
            Fieldset(
                "Advanced",
                "composition",
                css_class="",
            ),
        )


class VideoSceneForm(forms.ModelForm):
    """Inline editing form for individual scenes."""

    class Meta:
        model = VideoScene
        fields = [
            "order",
            "title",
            "scene_type",
            "script_text",
            "notes",
            "script_locked",
            "vo_recorded",
            "filmed",
            "assembled",
            "polished",
        ]
        widgets = {
            "title": forms.TextInput(attrs={
                "placeholder": "Scene title...",
            }),
            "script_text": forms.Textarea(attrs={
                "rows": 6,
                "placeholder": "Scene script text...",
                "class": (
                    "w-full px-4 py-3 font-mono text-[13px]"
                    " leading-relaxed text-ink bg-transparent"
                    " border-none outline-none resize-y"
                    " placeholder:text-ink-muted"
                ),
            }),
            "notes": forms.Textarea(attrs={
                "rows": 2,
                "placeholder": "Production notes...",
            }),
            "order": forms.NumberInput(attrs={
                "min": 0,
                "class": "w-20",
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_tag = False


class VideoDeliverableForm(forms.ModelForm):
    """Inline editing form for deliverables."""

    class Meta:
        model = VideoDeliverable
        fields = [
            "phase",
            "deliverable_type",
            "file_path",
            "file_url",
            "notes",
            "approved",
        ]
        widgets = {
            "file_path": forms.TextInput(attrs={
                "placeholder": "/videos/deliverables/...",
            }),
            "file_url": forms.URLInput(attrs={
                "placeholder": "https://...",
            }),
            "notes": forms.Textarea(attrs={
                "rows": 2,
                "placeholder": "Notes about this deliverable...",
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()

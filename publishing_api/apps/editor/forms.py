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
)
from apps.editor.widgets import (
    ANNOTATIONS_SCHEMA,
    CALLOUTS_SCHEMA,
    FOOTER_LINKS_SCHEMA,
    SOURCES_SCHEMA,
    URLS_SCHEMA,
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

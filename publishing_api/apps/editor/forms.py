from django import forms

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
                "class": "field-title",
                "placeholder": "Essay title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "class": "field-slug",
                "placeholder": "auto-generated-from-title",
            }),
            "date": forms.DateInput(attrs={
                "type": "date",
                "class": "field-date",
            }),
            "summary": forms.Textarea(attrs={
                "class": "field-summary",
                "rows": 2,
                "maxlength": 200,
                "placeholder": "A brief summary (max 200 chars)...",
            }),
            "body": forms.Textarea(attrs={
                "class": "field-body",
                "id": "editor-body",
                "placeholder": "Start writing...",
            }),
            "youtube_id": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "YouTube video ID",
            }),
            "thumbnail": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "/collage/thumbnail.png",
            }),
            "image": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "/collage/image.png",
            }),
            "callout": forms.Textarea(attrs={
                "class": "field-summary",
                "rows": 2,
                "placeholder": "Callout text. Use [link text](url) for hyperlinks.",
            }),
            "stage": forms.Select(attrs={"class": "field-meta"}),
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
                "class": "field-title",
                "placeholder": "Note title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "class": "field-slug",
                "placeholder": "auto-generated-from-title",
            }),
            "date": forms.DateInput(attrs={"type": "date", "class": "field-date"}),
            "body": forms.Textarea(attrs={
                "class": "field-body",
                "id": "editor-body",
                "placeholder": "Start writing...",
            }),
            "excerpt": forms.Textarea(attrs={
                "class": "field-summary",
                "rows": 2,
                "maxlength": 300,
                "placeholder": "Brief excerpt (max 300 chars)...",
            }),
            "status": forms.Select(attrs={"class": "field-meta"}),
            "connected_to": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Parent essay slug",
            }),
            "callout": forms.Textarea(attrs={
                "class": "field-summary",
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
                "class": "field-title",
                "placeholder": "Title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "class": "field-slug",
                "placeholder": "auto-generated-from-title",
            }),
            "creator": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Author / creator",
            }),
            "type": forms.Select(attrs={"class": "field-meta"}),
            "annotation": forms.Textarea(attrs={
                "class": "field-body",
                "id": "editor-body",
                "rows": 6,
                "placeholder": "Your annotation...",
            }),
            "url": forms.URLInput(attrs={
                "class": "field-meta",
                "placeholder": "https://...",
            }),
            "date": forms.DateInput(attrs={"type": "date", "class": "field-date"}),
            "connected_essay": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Related essay slug",
            }),
            "stage": forms.Select(attrs={"class": "field-meta"}),
            "composition": JsonObjectListWidget(
                attrs={"rows": 3},
                placeholder_hint='{}',
            ),
            # JSON fields with custom widgets
            "tags": TagsWidget(),
        }


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
                "class": "field-title",
                "placeholder": "Project title...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "class": "field-slug",
                "placeholder": "auto-generated-from-title",
            }),
            "role": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Your role (e.g. Built & Designed)",
            }),
            "description": forms.Textarea(attrs={
                "class": "field-summary",
                "rows": 2,
                "maxlength": 300,
                "placeholder": "Brief description (max 300 chars)...",
            }),
            "year": forms.NumberInput(attrs={"class": "field-meta"}),
            "date": forms.DateInput(attrs={"type": "date", "class": "field-date"}),
            "organization": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Organization name",
            }),
            "body": forms.Textarea(attrs={
                "class": "field-body",
                "id": "editor-body",
                "placeholder": "Project details...",
            }),
            "callout": forms.Textarea(attrs={
                "class": "field-summary",
                "rows": 2,
                "placeholder": "Callout text. Use [link text](url) for hyperlinks.",
            }),
            "order": forms.NumberInput(attrs={
                "class": "field-meta",
                "placeholder": "Sort order (0 = default)",
            }),
            "stage": forms.Select(attrs={"class": "field-meta"}),
            "composition": JsonObjectListWidget(
                attrs={"rows": 3},
                placeholder_hint='{\n  "tint": "teal"\n}',
            ),
            # JSON fields with structured widgets
            "tags": TagsWidget(),
            "urls": StructuredListWidget(fields_schema=URLS_SCHEMA),
        }


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
                "class": "field-title",
                "placeholder": "Tool or process name...",
                "autocomplete": "off",
            }),
            "slug": forms.TextInput(attrs={
                "class": "field-slug",
                "placeholder": "auto-generated-from-title",
            }),
            "category": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "e.g. production, research, automation",
            }),
            "order": forms.NumberInput(attrs={
                "class": "field-meta",
                "placeholder": "Sort order (0 = default)",
            }),
            "body": forms.Textarea(attrs={
                "class": "field-body",
                "id": "editor-body",
                "placeholder": "Describe this tool or process...",
            }),
            "stage": forms.Select(attrs={"class": "field-meta"}),
            "composition": JsonObjectListWidget(
                attrs={"rows": 3},
                placeholder_hint='{}',
            ),
        }


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
            "updated": forms.DateInput(attrs={"type": "date", "class": "field-date"}),
            "researching": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Currently researching...",
            }),
            "researching_context": forms.Textarea(attrs={
                "class": "field-context",
                "rows": 2,
                "placeholder": "Context...",
            }),
            "reading": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Currently reading...",
            }),
            "reading_context": forms.Textarea(attrs={
                "class": "field-context",
                "rows": 2,
                "placeholder": "Context...",
            }),
            "building": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Currently building...",
            }),
            "building_context": forms.Textarea(attrs={
                "class": "field-context",
                "rows": 2,
                "placeholder": "Context...",
            }),
            "listening": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Currently listening to...",
            }),
            "listening_context": forms.Textarea(attrs={
                "class": "field-context",
                "rows": 2,
                "placeholder": "Context...",
            }),
            "thinking": forms.Textarea(attrs={
                "class": "field-body",
                "rows": 4,
                "placeholder": "What you're thinking about...",
            }),
        }


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


class NavItemForm(forms.ModelForm):
    class Meta:
        model = NavItem
        fields = ["label", "path", "icon", "visible", "order"]
        widgets = {
            "label": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "Nav label",
            }),
            "path": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "/section-path",
            }),
            "icon": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "SketchIcon name (e.g. file-text)",
            }),
            "order": forms.NumberInput(attrs={
                "class": "field-meta",
                "placeholder": "0",
            }),
        }


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
            "page_key": forms.Select(attrs={"class": "field-meta"}),
            "settings": JsonObjectListWidget(
                attrs={"rows": 12},
                placeholder_hint='{\n  "key": "value"\n}',
            ),
        }


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
                "class": "field-meta",
                "placeholder": "Footer tagline text",
            }),
            "footer_links": StructuredListWidget(fields_schema=FOOTER_LINKS_SCHEMA),
            "seo_title_template": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "%s | travisgilbert.com",
            }),
            "seo_description": forms.Textarea(attrs={
                "class": "field-summary",
                "rows": 3,
                "placeholder": "Default meta description...",
            }),
            "seo_og_image_fallback": forms.TextInput(attrs={
                "class": "field-meta",
                "placeholder": "https://travisgilbert.com/og-image.png",
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

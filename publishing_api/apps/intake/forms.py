from django import forms
from django.core.validators import URLValidator

from apps.intake.models import RawSource

# Shared input styling for light-theme forms
INPUT_CLASS = (
    "w-full bg-cream border border-border rounded-brand"
    " px-4 py-[10px] text-ink text-[15px]"
    " font-body"
    " placeholder:text-ink-muted placeholder:font-body"
    " shadow-warm-sm"
    " outline-none transition-all duration-200"
    " focus:border-terracotta focus:shadow-[0_0_0_3px_rgba(180,90,45,0.12)]"
)

SMALL_INPUT_CLASS = (
    "w-full bg-cream border border-border rounded-brand"
    " px-3 py-2 text-ink text-sm"
    " font-body"
    " placeholder:text-ink-muted placeholder:font-body"
    " shadow-warm-sm"
    " outline-none transition-all duration-200"
    " focus:border-terracotta focus:shadow-[0_0_0_3px_rgba(180,90,45,0.12)]"
)

SOURCE_TYPE_CHOICES = [
    ("article", "Article"),
    ("video", "Video"),
    ("paper", "Paper"),
    ("podcast", "Podcast"),
    ("book", "Book"),
    ("tool", "Tool"),
    ("dataset", "Dataset"),
    ("repository", "Repository"),
    ("document", "Document"),
    ("other", "Other"),
]


class CaptureForm(forms.Form):
    """
    Unified capture: paste one or many URLs (newline separated).
    File uploads are handled separately via multipart POST.
    """

    urls = forms.CharField(
        widget=forms.Textarea(attrs={
            "placeholder": "Paste URLs, drop files, or click to upload...",
            "class": INPUT_CLASS,
            "rows": 1,
            "style": "resize: none; overflow: hidden;",
        }),
    )

    def clean_urls(self):
        raw = self.cleaned_data["urls"]
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        if not lines:
            raise forms.ValidationError("Enter at least one URL.")

        validator = URLValidator()
        valid_urls = []
        for line in lines:
            try:
                validator(line)
                valid_urls.append(line)
            except forms.ValidationError:
                raise forms.ValidationError(f"Invalid URL: {line}")

        return raw  # Keep raw value; cleaned list in url_list

    @property
    def cleaned_url_list(self):
        """Access the parsed URL list after validation."""
        raw = self.cleaned_data.get("urls", "")
        return [line.strip() for line in raw.splitlines() if line.strip()]

    def clean(self):
        cleaned = super().clean()
        if "urls" in cleaned:
            raw = cleaned["urls"]
            cleaned["url_list"] = [
                line.strip() for line in raw.splitlines() if line.strip()
            ]
        return cleaned


class EnrichmentForm(forms.Form):
    """Enrichment fields for the detail panel: importance, type, tags, notes."""

    importance = forms.ChoiceField(
        choices=RawSource.Importance.choices,
        initial=RawSource.Importance.MEDIUM,
        widget=forms.RadioSelect(attrs={"class": "hidden peer"}),
    )
    source_type = forms.ChoiceField(
        choices=SOURCE_TYPE_CHOICES,
        initial="article",
        widget=forms.Select(attrs={"class": SMALL_INPUT_CLASS}),
    )
    tags_raw = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            "placeholder": "Add tags (comma separated)...",
            "class": SMALL_INPUT_CLASS,
        }),
    )
    decision_note = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            "rows": 3,
            "placeholder": "Why does this source matter? What caught your attention?",
            "class": SMALL_INPUT_CLASS,
        }),
    )

    def clean(self):
        cleaned = super().clean()
        raw_tags = cleaned.get("tags_raw", "")
        cleaned["tag_list"] = [
            t.strip() for t in raw_tags.split(",") if t.strip()
        ]
        return cleaned


class TriageForm(forms.Form):
    """Accept/reject/defer a RawSource with an optional note."""

    decision = forms.ChoiceField(choices=RawSource.Decision.choices)
    decision_note = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            "rows": 2,
            "placeholder": "Optional note...",
            "class": SMALL_INPUT_CLASS,
        }),
    )


class MoveForm(forms.Form):
    """Move a card between kanban columns."""

    source_id = forms.IntegerField()
    phase = forms.ChoiceField(choices=RawSource.Phase.choices)


# Backward compatibility alias (views.py still references old name)
SourceboxAddForm = CaptureForm

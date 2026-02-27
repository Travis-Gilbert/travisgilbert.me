from django import forms

from apps.intake.models import RawSource


class SourceboxAddForm(forms.Form):
    """Simple URL input for adding a source to the Sourcebox."""

    url = forms.URLField(
        max_length=2000,
        widget=forms.URLInput(attrs={
            "placeholder": "Paste a URL to add to the Sourcebox...",
            "class": (
                "w-full bg-white/5 border border-white/10 rounded-brand"
                " px-4 py-3 text-cream placeholder-cream/40"
                " font-mono text-sm"
                " focus:outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/30"
                " transition-colors"
            ),
            "autofocus": True,
        }),
    )


class TriageForm(forms.Form):
    """Accept/reject/defer a RawSource with an optional note."""

    decision = forms.ChoiceField(choices=RawSource.Decision.choices)
    decision_note = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            "rows": 2,
            "placeholder": "Optional note...",
            "class": (
                "w-full bg-white/5 border border-white/10 rounded-brand"
                " px-3 py-2 text-cream placeholder-cream/40"
                " font-mono text-xs"
                " focus:outline-none focus:border-white/20"
            ),
        }),
    )

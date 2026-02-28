"""
Context processors for the editor app.

Provides sidebar navigation data (draft counts, composition counts) to all
templates rendered through Django's template engine.
"""

from apps.content.models import (
    Essay,
    FieldNote,
    PageComposition,
    Project,
    VideoProject,
)
from apps.intake.models import RawSource


def sidebar_counts(request):
    """
    Inject draft and composition counts for the sidebar navigation badges.

    Only queries the database for authenticated users (the editor is
    login-protected, so anonymous requests skip the queries entirely).
    """
    if not request.user.is_authenticated:
        return {}

    return {
        "sidebar_drafts": {
            "essays": Essay.objects.filter(draft=True).count(),
            "field_notes": FieldNote.objects.filter(draft=True).count(),
            "projects": Project.objects.filter(draft=True).count(),
            "videos": VideoProject.objects.filter(draft=True).count(),
        },
        "sidebar_compose_count": PageComposition.objects.count(),
        "sidebar_intake_pending": RawSource.objects.filter(
            decision=RawSource.Decision.PENDING
        ).count(),
    }

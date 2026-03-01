"""
Context processors for the editor app.

Provides sidebar navigation data (draft counts, group totals, composition
counts) to all templates rendered through Django's template engine.
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
    Inject draft counts, group totals, and composition counts for the
    sidebar navigation badges.

    Returns both per-item counts (``sidebar_drafts``) and per-group
    aggregates (``sidebar_groups``) so collapsed nav groups still show
    a total badge.

    Only queries the database for authenticated users (the editor is
    login-protected, so anonymous requests skip the queries entirely).
    """
    if not request.user.is_authenticated:
        return {}

    essay_drafts = Essay.objects.filter(draft=True).count()
    note_drafts = FieldNote.objects.filter(draft=True).count()
    project_drafts = Project.objects.filter(draft=True).count()
    video_drafts = VideoProject.objects.filter(draft=True).count()
    compose_count = PageComposition.objects.count()
    intake_pending = RawSource.objects.filter(
        decision=RawSource.Decision.PENDING
    ).count()

    return {
        "sidebar_drafts": {
            "essays": essay_drafts,
            "field_notes": note_drafts,
            "projects": project_drafts,
            "videos": video_drafts,
        },
        "sidebar_groups": {
            "make": essay_drafts + note_drafts,
            "collect": intake_pending,
            "build": project_drafts + video_drafts,
            "design": compose_count,
        },
        "sidebar_compose_count": compose_count,
        "sidebar_intake_pending": intake_pending,
    }

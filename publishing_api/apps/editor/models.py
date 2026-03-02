"""
Editor models: lightweight working data that supports the writing interface.

Content models live in apps.content. This module holds editor-specific
state that does not belong in the content layer (e.g. research notes
captured during a writing session).
"""

from django.conf import settings
from django.db import models


class ResearchNote(models.Model):
    """
    A research note captured inside the editor's research panel.

    Linked to any content type (essay, field_note, shelf, project, toolkit,
    video) via a content_type + content_slug pair. This keeps working notes
    separate from the published ``research_notes`` TextField on Essay and
    VideoProject, allowing every content type to have research annotations.
    """

    CONTENT_TYPE_CHOICES = [
        ("essay", "Essay"),
        ("field_note", "Field Note"),
        ("shelf", "Shelf Entry"),
        ("project", "Project"),
        ("toolkit", "Toolkit Entry"),
        ("video", "Video Project"),
    ]

    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES)
    content_slug = models.SlugField(max_length=255)
    text = models.TextField(help_text="Markdown research note")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="research_notes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["content_type", "content_slug"],
                name="editor_rn_ct_slug_idx",
            ),
        ]

    def __str__(self):
        return f"ResearchNote({self.content_type}/{self.content_slug}) @ {self.created_at:%Y-%m-%d %H:%M}"

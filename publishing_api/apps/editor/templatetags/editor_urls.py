"""
Custom template tags for building editor URL patterns with placeholders.

The ``research_note_delete_url`` tag generates a URL with a ``__PK__``
sentinel so that JavaScript can substitute the real note ID at runtime
without a per-row ``{% url %}`` call.
"""

from django import template
from django.urls import reverse

register = template.Library()


@register.simple_tag
def research_note_delete_url(content_type, slug):
    """
    Return the delete-note URL with ``__PK__`` as a placeholder.

    Usage::

        {% load editor_urls %}
        {% research_note_delete_url content_type object.slug %}

    Produces something like::

        /editor/api/research/essay/my-slug/notes/__PK__/delete/
    """
    url = reverse(
        "editor:api-research-note-delete",
        kwargs={"content_type": content_type, "slug": slug, "pk": 0},
    )
    return url.replace("/0/delete/", "/__PK__/delete/")

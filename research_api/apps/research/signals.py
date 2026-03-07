"""
Signals for the research app.

Updates the search vector on Source save (PostgreSQL only).
Invalidates the graph cache on Source or SourceLink save.
"""

import logging

from django.db import connection
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender='research.Source')
def update_source_search_vector(sender, instance, **kwargs):
    """Rebuild search vector for a single source after save."""
    if connection.vendor != 'postgresql':
        return

    from django.contrib.postgres.search import SearchVector

    try:
        sender.objects.filter(pk=instance.pk).update(
            search_vector=(
                SearchVector('title', weight='A')
                + SearchVector('creator', weight='B')
                + SearchVector('public_annotation', weight='C')
                + SearchVector('publication', weight='C')
            )
        )
    except Exception:
        logger.exception(
            'Failed to update search vector for source %s',
            instance.pk,
        )


@receiver(post_save, sender='research.Source')
def invalidate_graph_on_source_save(sender, instance, **kwargs):
    """Clear graph cache when a source is created or updated."""
    from apps.research.graph import invalidate_graph_cache
    invalidate_graph_cache()


@receiver(post_save, sender='research.SourceLink')
def invalidate_graph_on_link_save(sender, instance, **kwargs):
    """Clear graph cache when a source link is created or updated."""
    from apps.research.graph import invalidate_graph_cache
    invalidate_graph_cache()

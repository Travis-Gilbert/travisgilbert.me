"""
Django signals for automatic DailyLog recording.

Whenever a KnowledgeNode or Edge is created or updated, the corresponding
DailyLog entry for today gets appended with the activity. This powers
the calendar view and daily summary without any manual logging.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

logger = logging.getLogger(__name__)


@receiver(post_save, sender='notebook.KnowledgeNode')
def log_node_activity(sender, instance, created, **kwargs):
    """Record node creation or update in today's DailyLog."""
    from .models import DailyLog

    today = timezone.localdate()
    log, _ = DailyLog.objects.get_or_create(date=today)

    node_type_name = ''
    if instance.node_type_id:
        try:
            node_type_name = instance.node_type.name
        except Exception:
            node_type_name = ''

    entry = {
        'id': instance.pk,
        'title': instance.display_title[:100],
        'node_type': node_type_name,
    }

    if created:
        log.nodes_created.append(entry)
    else:
        entry['action'] = 'updated'
        # Avoid duplicate update entries for the same node on the same day
        existing_ids = {e.get('id') for e in log.nodes_updated}
        if instance.pk not in existing_ids:
            log.nodes_updated.append(entry)

    log.save(update_fields=['nodes_created', 'nodes_updated', 'updated_at'])


@receiver(post_save, sender='notebook.Edge')
def log_edge_activity(sender, instance, created, **kwargs):
    """Record new edge creation in today's DailyLog."""
    if not created:
        return

    from .models import DailyLog

    today = timezone.localdate()
    log, _ = DailyLog.objects.get_or_create(date=today)

    entry = {
        'id': instance.pk,
        'from_title': instance.from_node.display_title[:60],
        'to_title': instance.to_node.display_title[:60],
        'reason': instance.reason[:200] if instance.reason else '',
        'edge_type': instance.edge_type,
    }
    log.edges_created.append(entry)
    log.save(update_fields=['edges_created', 'updated_at'])


@receiver(post_save, sender='notebook.ResolvedEntity')
def log_entity_resolution(sender, instance, created, **kwargs):
    """Record entity resolution in today's DailyLog."""
    if not created:
        return
    if not instance.resolved_node:
        return

    from .models import DailyLog

    today = timezone.localdate()
    log, _ = DailyLog.objects.get_or_create(date=today)

    entry = {
        'text': instance.text,
        'entity_type': instance.entity_type,
        'resolved_to': instance.resolved_node.display_title[:60],
    }
    log.entities_resolved.append(entry)
    log.save(update_fields=['entities_resolved', 'updated_at'])

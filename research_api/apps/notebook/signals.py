"""
Django signals for automatic Node creation and DailyLog recording.

Object lifecycle:
  - post_save on Object: creates Node(type='creation') or Node(type='modification')
  - post_delete on Object: creates Node(type='deletion')

Component triggers:
  - post_save on Component: if component_type.triggers_node, creates Node
    - Date/RecurringDate: Node type='component_trigger'
    - Relationship: Node type='connection' + Edge creation
    - Status: Node type='status_change'

All Nodes are auto-assigned to the master Timeline.
DailyLog recording is preserved for all Object/Edge/Entity activity.

TF-IDF cache: invalidated whenever the Object corpus changes.
"""

import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone

logger = logging.getLogger(__name__)


def _get_master_timeline():
    """Fetch the master Timeline, creating it if missing."""
    from .models import Timeline
    timeline, _ = Timeline.objects.get_or_create(
        is_master=True,
        defaults={'name': 'Master Timeline', 'slug': 'master'},
    )
    return timeline


# ---------------------------------------------------------------------------
# Object lifecycle signals
# ---------------------------------------------------------------------------

@receiver(post_save, sender='notebook.Object')
def create_object_node(sender, instance, created, **kwargs):
    """Create a creation Node on the master Timeline when an Object is first created.

    Modification Nodes are created explicitly via ObjectViewSet.perform_update(),
    not from this signal, to avoid noise from engine saves and internal updates.
    Deletion Nodes are created via the soft_delete ViewSet action.
    """
    from .models import Node

    if kwargs.get('raw', False):
        return
    if instance.is_deleted:
        return

    if created:
        timeline = _get_master_timeline()
        Node.objects.create(
            node_type='creation',
            title=f'Created: {instance.display_title[:80]}',
            object_ref=instance,
            timeline=timeline,
        )
        logger.debug('Created creation Node for Object %s', instance.pk)


@receiver(post_save, sender='notebook.Object')
def invalidate_tfidf_on_object_change(sender, instance, created, **kwargs):
    """
    Invalidate the module-level TF-IDF corpus cache whenever an Object
    is created or deleted. Deletion signal handled separately below.

    The cache rebuilds lazily on the next engine run. This ensures
    TF-IDF similarity scores always reflect the current corpus.
    The cache has a secondary drift threshold (50 objects) as a
    backup, but signal-driven invalidation is the primary mechanism.
    """
    if kwargs.get('raw', False):
        return

    if created:
        try:
            from .engine import invalidate_tfidf_cache
            invalidate_tfidf_cache()
        except ImportError:
            pass


@receiver(post_delete, sender='notebook.Object')
def invalidate_tfidf_on_object_delete(sender, instance, **kwargs):
    """Invalidate TF-IDF cache on hard delete."""
    try:
        from .engine import invalidate_tfidf_cache
        invalidate_tfidf_cache()
    except ImportError:
        pass


# ---------------------------------------------------------------------------
# Component trigger signals
# ---------------------------------------------------------------------------

@receiver(post_save, sender='notebook.Component')
def component_trigger_node(sender, instance, created, **kwargs):
    """Create a Node when a triggering Component is saved."""
    from .models import Edge, Node

    if kwargs.get('raw', False):
        return

    if not instance.component_type.triggers_node:
        return

    timeline = _get_master_timeline()
    data_type = instance.component_type.data_type

    if data_type in ('date', 'recurring_date'):
        Node.objects.create(
            node_type='component_trigger',
            title=f'{instance.component_type.name}: {instance.key}',
            body=f'Value: {instance.value}',
            object_ref=instance.object,
            component_ref=instance,
            timeline=timeline,
        )
        logger.debug(
            'Created component_trigger Node for %s on Object %s',
            instance.key, instance.object_id,
        )

    elif data_type == 'relationship':
        Node.objects.create(
            node_type='connection',
            title=f'Relationship: {instance.key}',
            body=f'Connected from {instance.object.display_title[:60]}',
            object_ref=instance.object,
            component_ref=instance,
            timeline=timeline,
        )
        target_id = None
        if isinstance(instance.value, dict):
            target_id = instance.value.get('object_id')
        elif isinstance(instance.value, (int, str)):
            try:
                target_id = int(instance.value)
            except (ValueError, TypeError):
                pass

        if target_id:
            from .models import Object
            try:
                target = Object.objects.get(pk=target_id)
                Edge.objects.get_or_create(
                    from_object=instance.object,
                    to_object=target,
                    edge_type='related',
                    defaults={
                        'reason': f'Relationship component: {instance.key}',
                        'strength': 0.8,
                        'is_auto': True,
                        'engine': 'signal',
                    },
                )
                logger.debug(
                    'Created Edge from Object %s to %s via relationship component',
                    instance.object_id, target_id,
                )
            except Object.DoesNotExist:
                logger.warning(
                    'Relationship component references Object %s which does not exist',
                    target_id,
                )

    elif data_type == 'status':
        Node.objects.create(
            node_type='status_change',
            title=f'Status changed: {instance.key}',
            body=f'New status: {instance.value}',
            object_ref=instance.object,
            component_ref=instance,
            timeline=timeline,
        )
        logger.debug(
            'Created status_change Node for Object %s',
            instance.object_id,
        )

    else:
        Node.objects.create(
            node_type='component_trigger',
            title=f'{instance.component_type.name}: {instance.key}',
            body=f'Value: {instance.value}',
            object_ref=instance.object,
            component_ref=instance,
            timeline=timeline,
        )


# ---------------------------------------------------------------------------
# DailyLog recording
# ---------------------------------------------------------------------------

@receiver(post_save, sender='notebook.Object')
def log_object_activity(sender, instance, created, **kwargs):
    """Record object creation or update in today's DailyLog.

    Skips engine-driven saves to avoid noisy DailyLog entries.
    """
    from .models import DailyLog

    if kwargs.get('raw', False):
        return

    update_fields = kwargs.get('update_fields')
    if not created and update_fields and 'search_text' in update_fields:
        return
    if not created and instance.capture_method == 'auto':
        return

    today = timezone.localdate()
    log, _ = DailyLog.objects.get_or_create(date=today)

    object_type_name = ''
    if instance.object_type_id:
        try:
            object_type_name = instance.object_type.name
        except Exception:
            object_type_name = ''

    entry = {
        'id': instance.pk,
        'title': instance.display_title[:100],
        'object_type': object_type_name,
    }

    if created:
        log.objects_created.append(entry)
    else:
        entry['action'] = 'updated'
        existing_ids = {e.get('id') for e in log.objects_updated}
        if instance.pk not in existing_ids:
            log.objects_updated.append(entry)

    log.save(update_fields=['objects_created', 'objects_updated', 'updated_at'])


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
        'from_title': instance.from_object.display_title[:60],
        'to_title': instance.to_object.display_title[:60],
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
    if not instance.resolved_object:
        return

    from .models import DailyLog

    today = timezone.localdate()
    log, _ = DailyLog.objects.get_or_create(date=today)

    entry = {
        'text': instance.text,
        'entity_type': instance.entity_type,
        'resolved_to': instance.resolved_object.display_title[:60],
    }
    log.entities_resolved.append(entry)
    log.save(update_fields=['entities_resolved', 'updated_at'])

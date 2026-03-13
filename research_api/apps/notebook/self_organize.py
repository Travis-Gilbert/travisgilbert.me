"""
Self-organizing knowledge graph loops.

Loop 1: Auto-classify newly ingested objects.
Loop 2: Promote strong communities into auto-generated notebooks.
Loop 3: Promote frequently-mentioned entities into first-class objects.
Loop 4: Decay and prune stale auto-generated edges.
Loop 5: Surface emergent object-type suggestions.
"""

from __future__ import annotations

import logging
import math
from collections import Counter

from django.db.models import Count
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify

logger = logging.getLogger(__name__)

MIN_CLUSTER_FOR_NOTEBOOK = 5
MIN_MODULARITY = 0.15
ENTITY_PROMOTION_THRESHOLD = 5
DECAY_HALF_LIFE_DAYS = 60
MIN_EDGE_STRENGTH = 0.05
EMERGENT_TYPE_MIN_CLUSTER_SIZE = 8
EMERGENT_TYPE_HOMOGENEITY_THRESHOLD = 0.7


def form_notebooks_from_communities(notebook=None, resolution: float = 1.0):
    """
    Create notebooks from strong communities when structure is clear.
    """
    from .community import detect_communities
    from .models import Cluster, Notebook, Object

    result = detect_communities(notebook=notebook, resolution=resolution)
    modularity = float(result.get('modularity', 0.0) or 0.0)
    if modularity < MIN_MODULARITY:
        return []

    created_notebooks = []
    for community in result.get('communities', []):
        if int(community.get('size', 0) or 0) < MIN_CLUSTER_FOR_NOTEBOOK:
            continue

        member_pks = list(community.get('member_pks', []))
        if not member_pks:
            continue

        member_qs = Object.objects.filter(pk__in=member_pks, is_deleted=False).select_related('notebook')
        existing_notebooks = Counter(obj.notebook_id for obj in member_qs if obj.notebook_id)
        if existing_notebooks:
            _top_notebook_id, top_count = existing_notebooks.most_common(1)[0]
            if top_count / max(len(member_pks), 1) > 0.70:
                continue

        label = _generate_cluster_label(community, member_qs)
        notebook_slug = _unique_notebook_slug(label)

        created_notebook = Notebook.objects.create(
            name=label,
            slug=notebook_slug,
            description=f'Auto-organized: {len(member_pks)} related objects.',
            is_auto_generated=True,
        )

        # Move only unassigned objects to avoid destructive notebook reshuffles.
        Object.objects.filter(pk__in=member_pks, notebook__isnull=True).update(notebook=created_notebook)

        cluster = Cluster.objects.create(
            name=label,
            notebook=created_notebook,
            label_tags=list((community.get('top_types') or {}).keys()),
            modularity_score=modularity,
            member_count=len(member_pks),
        )
        Object.objects.filter(pk__in=member_pks).update(cluster=cluster)

        created_notebooks.append(created_notebook)

    return created_notebooks


def _unique_notebook_slug(label: str) -> str:
    from .models import Notebook

    base = slugify(label)[:180] or 'auto-cluster'
    slug = base
    suffix = 1
    while Notebook.objects.filter(slug=slug).exists():
        slug = f'{base}-{suffix}'
        suffix += 1
    return slug


def _generate_cluster_label(community: dict, member_objects) -> str:
    from .models import ResolvedEntity

    member_pks = [obj.pk for obj in member_objects]
    entity_counts = Counter(
        ResolvedEntity.objects
        .filter(source_object_id__in=member_pks)
        .values_list('normalized_text', flat=True)
    )
    if entity_counts:
        return (entity_counts.most_common(1)[0][0] or '').title()[:200]
    return str(community.get('label') or f'Cluster {community.get("id", "")}')[:200]


def promote_frequent_entities():
    """
    Promote entities that repeatedly appear across different objects.
    """
    from .models import Edge, Object, ObjectType, ResolvedEntity

    frequent_entities = (
        ResolvedEntity.objects
        .filter(resolved_object__isnull=True)
        .values('normalized_text', 'entity_type')
        .annotate(mention_count=Count('source_object', distinct=True))
        .filter(mention_count__gte=ENTITY_PROMOTION_THRESHOLD)
        .order_by('-mention_count')
    )

    entity_to_object_type = {
        'PERSON': 'person',
        'ORG': 'organization',
        'GPE': 'place',
        'LOC': 'place',
        'EVENT': 'event',
        'WORK_OF_ART': 'source',
        'CONCEPT': 'concept',
    }
    type_cache = {
        obj_type.slug: obj_type for obj_type in ObjectType.objects.filter(slug__in=set(entity_to_object_type.values()))
    }

    promoted_objects = []
    for entity_group in frequent_entities:
        normalized_text = entity_group.get('normalized_text') or ''
        entity_type = entity_group.get('entity_type') or ''
        mention_count = int(entity_group.get('mention_count') or 0)
        object_type_slug = entity_to_object_type.get(entity_type)
        object_type = type_cache.get(object_type_slug or '')
        if object_type is None:
            continue

        existing = Object.objects.filter(
            object_type=object_type,
            is_deleted=False,
            title__iexact=normalized_text,
        ).first()

        if existing is None:
            title = (
                ResolvedEntity.objects
                .filter(normalized_text=normalized_text, entity_type=entity_type)
                .values_list('text', flat=True)
                .first()
            ) or normalized_text.title()
            existing = Object.objects.create(
                title=title,
                object_type=object_type,
                body=(
                    f'Auto-promoted: mentioned in {mention_count} different objects. '
                    f'Entity type: {entity_type}.'
                ),
                capture_method='auto',
            )
            promoted_objects.append(existing)

        unresolved = ResolvedEntity.objects.filter(
            normalized_text=normalized_text,
            entity_type=entity_type,
            resolved_object__isnull=True,
        )
        source_object_ids = set(unresolved.values_list('source_object_id', flat=True))
        unresolved.update(resolved_object=existing)

        for source_object_id in source_object_ids:
            if source_object_id == existing.pk:
                continue
            Edge.objects.get_or_create(
                from_object_id=source_object_id,
                to_object=existing,
                edge_type='mentions',
                defaults={
                    'reason': (
                        f'Mentions {existing.display_title} '
                        f'({mention_count} mentions across your graph).'
                    ),
                    'strength': min(0.5 + mention_count * 0.05, 1.0),
                    'is_auto': True,
                    'engine': 'entity_promotion',
                },
            )

    return promoted_objects


def evolve_edges():
    """
    Apply exponential decay to stale auto-generated edges and prune weak links.
    """
    from .models import Edge, Node, Timeline

    now = timezone.now()
    updated = 0
    pruned = 0
    master_timeline = Timeline.objects.filter(is_master=True).first()

    auto_edges = Edge.objects.filter(is_auto=True).select_related('from_object', 'to_object')
    for edge in auto_edges:
        if edge.strength is None:
            continue
        days_since_update = max((now - edge.updated_at).days, 0)
        decay_factor = math.exp(-0.693 * days_since_update / DECAY_HALF_LIFE_DAYS)
        new_strength = float(edge.strength) * decay_factor

        if new_strength < MIN_EDGE_STRENGTH:
            if master_timeline is not None:
                Node.objects.create(
                    node_type='modification',
                    title=(
                        f'Connection faded: {edge.from_object.display_title[:30]} '
                        f'and {edge.to_object.display_title[:30]}'
                    ),
                    body=(
                        f'This auto-detected connection decayed below threshold '
                        f'after {days_since_update} days without engagement.'
                    ),
                    object_ref=edge.from_object,
                    timeline=master_timeline,
                )
            edge.delete()
            pruned += 1
            continue

        rounded = round(new_strength, 4)
        if abs(rounded - float(edge.strength)) > 0.01:
            edge.strength = rounded
            edge.save(update_fields=['strength', 'updated_at'])
            updated += 1

    return {'updated': updated, 'pruned': pruned}


def detect_emergent_types():
    """
    Suggest possible new object types from highly homogeneous note clusters.
    """
    from .community import detect_communities
    from .models import Object, ObjectType, ResolvedEntity

    result = detect_communities(resolution=1.5)
    note_type = ObjectType.objects.filter(slug='note').first()
    if note_type is None:
        return []

    suggestions = []
    for community in result.get('communities', []):
        member_pks = list(community.get('member_pks', []))
        size = len(member_pks)
        if size < EMERGENT_TYPE_MIN_CLUSTER_SIZE:
            continue

        members = list(Object.objects.filter(pk__in=member_pks).select_related('object_type'))
        note_count = sum(1 for member in members if member.object_type_id == note_type.id)
        homogeneity = note_count / size
        if homogeneity < EMERGENT_TYPE_HOMOGENEITY_THRESHOLD:
            continue

        urls = [member.url for member in members if member.url]
        if len(urls) > size * 0.5:
            from urllib.parse import urlparse

            domains = Counter(urlparse(url).netloc for url in urls if url)
            top_domain = domains.most_common(1)[0][0] if domains else ''
            if top_domain:
                suggestions.append(
                    {
                        'reason': f'{size} notes share URLs from {top_domain}',
                        'suggested_name': f'{top_domain} resource',
                        'suggested_slug': slugify(f'{top_domain}-resource'),
                        'member_count': size,
                        'member_pks': member_pks,
                    },
                )
                continue

        entity_counts = Counter(
            ResolvedEntity.objects
            .filter(source_object_id__in=member_pks)
            .values_list('normalized_text', flat=True)
        )
        if not entity_counts:
            continue

        top_entity = entity_counts.most_common(1)[0][0]
        suggestions.append(
            {
                'reason': f'{size} notes cluster around {top_entity}',
                'suggested_name': f'{top_entity} notes',
                'suggested_slug': slugify(f'{top_entity}-notes'),
                'member_count': size,
                'member_pks': member_pks,
            },
        )

    return suggestions


def organize_batch(object_pks: list[int], notebook=None):
    """
    Run self-organization loops for a newly ingested object batch.
    """
    from .auto_classify import auto_classify_batch
    from .models import Object

    objects = list(Object.objects.filter(pk__in=object_pks))
    if not objects:
        return {
            'triggered': False,
            'reason': 'no_objects',
            'classified': 0,
            'clusters_created': 0,
            'notebooks_created': 0,
            'entities_promoted': 0,
        }

    classified = auto_classify_batch(objects)
    clusters_created = 0
    notebooks_created = 0

    if len(objects) >= 3 and notebook is not None:
        from .community import detect_communities, persist_communities

        result = detect_communities(notebook=notebook)
        clusters_created = len(persist_communities(result, notebook=notebook))

    if len(objects) >= 10:
        notebooks_created = len(form_notebooks_from_communities(notebook=notebook))

    promoted = promote_frequent_entities()

    return {
        'triggered': True,
        'reason': '',
        'classified': classified,
        'clusters_created': clusters_created,
        'notebooks_created': notebooks_created,
        'entities_promoted': len(promoted),
    }


def periodic_reorganize():
    """
    Run periodic graph-wide self-organization.
    """
    notebooks_created = form_notebooks_from_communities()
    promoted = promote_frequent_entities()
    edge_results = evolve_edges()
    emergent_types = detect_emergent_types()
    return {
        'notebooks_created': len(notebooks_created),
        'entities_promoted': len(promoted),
        'edges_updated': edge_results['updated'],
        'edges_pruned': edge_results['pruned'],
        'type_suggestions': len(emergent_types),
    }


def preview_notebook_formation(notebook=None, resolution: float = 1.0, max_samples: int = 12) -> dict:
    """
    Return notebook-formation candidates without mutating state.
    """
    from .community import detect_communities
    from .models import Object

    result = detect_communities(notebook=notebook, resolution=resolution)
    modularity = float(result.get('modularity', 0.0) or 0.0)
    candidates = []

    for community in result.get('communities', []):
        member_pks = list(community.get('member_pks', []))
        size = len(member_pks)
        if size < MIN_CLUSTER_FOR_NOTEBOOK:
            continue

        members = list(
            Object.objects
            .filter(pk__in=member_pks, is_deleted=False)
            .select_related('notebook')
        )
        if not members:
            continue

        existing_notebooks = Counter(obj.notebook_id for obj in members if obj.notebook_id)
        top_notebook_share = 0.0
        if existing_notebooks:
            _nb_id, top_count = existing_notebooks.most_common(1)[0]
            top_notebook_share = top_count / size

        if top_notebook_share > 0.70:
            continue

        unassigned = sum(1 for obj in members if obj.notebook_id is None)
        label = _generate_cluster_label(community, members)
        candidates.append(
            {
                'label': label,
                'member_count': size,
                'unassigned_count': unassigned,
                'top_notebook_share': round(top_notebook_share, 3),
                'top_types': community.get('top_types', {}),
            },
        )

    return {
        'modularity': modularity,
        'threshold': MIN_MODULARITY,
        'eligible': modularity >= MIN_MODULARITY,
        'candidate_count': len(candidates),
        'candidates': candidates[:max_samples],
    }


def preview_entity_promotions(max_samples: int = 20) -> dict:
    """
    Return frequent unresolved entities that would be promoted.
    """
    from .models import ResolvedEntity

    entity_to_object_type = {
        'PERSON': 'person',
        'ORG': 'organization',
        'GPE': 'place',
        'LOC': 'place',
        'EVENT': 'event',
        'WORK_OF_ART': 'source',
        'CONCEPT': 'concept',
    }

    rows = (
        ResolvedEntity.objects
        .filter(resolved_object__isnull=True)
        .values('normalized_text', 'entity_type')
        .annotate(mention_count=Count('source_object', distinct=True))
        .filter(mention_count__gte=ENTITY_PROMOTION_THRESHOLD)
        .order_by('-mention_count')
    )

    candidates = []
    for row in rows[:max_samples]:
        entity_type = row.get('entity_type') or ''
        candidates.append(
            {
                'normalized_text': row.get('normalized_text') or '',
                'entity_type': entity_type,
                'mention_count': int(row.get('mention_count') or 0),
                'suggested_object_type': entity_to_object_type.get(entity_type, ''),
            },
        )

    return {
        'threshold': ENTITY_PROMOTION_THRESHOLD,
        'candidate_count': len(candidates),
        'candidates': candidates,
    }


def preview_edge_evolution(max_samples: int = 20) -> dict:
    """
    Return edge decay/prune candidates without applying updates.
    """
    from .models import Edge

    now = timezone.now()
    to_prune = []
    to_decay = []

    edges = (
        Edge.objects
        .filter(is_auto=True)
        .select_related('from_object', 'to_object')
    )
    for edge in edges:
        if edge.strength is None:
            continue

        days_since_update = max((now - edge.updated_at).days, 0)
        decay_factor = math.exp(-0.693 * days_since_update / DECAY_HALF_LIFE_DAYS)
        projected_strength = round(float(edge.strength) * decay_factor, 4)
        sample = {
            'edge_id': edge.pk,
            'from_object_id': edge.from_object_id,
            'to_object_id': edge.to_object_id,
            'from_title': edge.from_object.display_title[:60],
            'to_title': edge.to_object.display_title[:60],
            'current_strength': float(edge.strength),
            'projected_strength': projected_strength,
            'days_since_update': days_since_update,
        }
        if projected_strength < MIN_EDGE_STRENGTH:
            to_prune.append(sample)
        elif abs(projected_strength - float(edge.strength)) > 0.01:
            to_decay.append(sample)

    return {
        'half_life_days': DECAY_HALF_LIFE_DAYS,
        'prune_threshold': MIN_EDGE_STRENGTH,
        'to_prune_count': len(to_prune),
        'to_decay_count': len(to_decay),
        'to_prune_samples': to_prune[:max_samples],
        'to_decay_samples': to_decay[:max_samples],
    }


def preview_periodic_reorganize(max_samples: int = 20) -> dict:
    """
    Preview the next periodic reorganization run without mutating state.
    """
    notebook_preview = preview_notebook_formation(max_samples=max_samples)
    entity_preview = preview_entity_promotions(max_samples=max_samples)
    edge_preview = preview_edge_evolution(max_samples=max_samples)
    emergent = detect_emergent_types()

    return {
        'notebook_formation': notebook_preview,
        'entity_promotions': entity_preview,
        'edge_evolution': edge_preview,
        'emergent_types': {
            'candidate_count': len(emergent),
            'candidates': emergent[:max_samples],
        },
    }


def _unique_object_type_slug(base_slug: str) -> str:
    from .models import ObjectType

    candidate = base_slug[:100] or 'emergent-type'
    suffix = 1
    while ObjectType.objects.filter(slug=candidate).exists():
        suffix_str = f'-{suffix}'
        candidate = f'{base_slug[: max(1, 100 - len(suffix_str))]}{suffix_str}'
        suffix += 1
    return candidate


def _unique_object_type_name(base_name: str) -> str:
    from .models import ObjectType

    candidate = base_name[:100] or 'Emergent Type'
    suffix = 1
    while ObjectType.objects.filter(name=candidate).exists():
        suffix_str = f' {suffix}'
        candidate = f'{base_name[: max(1, 100 - len(suffix_str))]}{suffix_str}'
        suffix += 1
    return candidate


def apply_emergent_type_suggestion(
    suggested_name: str,
    suggested_slug: str,
    member_pks: list[int],
    *,
    restrict_to_note: bool = True,
    icon: str = 'sparkle',
    color: str = '#6A6A8A',
) -> dict:
    """
    Create or reuse an object type and assign selected objects to it.
    """
    from .models import Object, ObjectType

    member_ids = [int(pk) for pk in member_pks if pk]
    if not member_ids:
        return {
            'created_type': False,
            'objects_updated': 0,
            'object_type': None,
            'member_count': 0,
            'restrict_to_note': restrict_to_note,
        }

    normalized_slug = slugify((suggested_slug or suggested_name or '').strip())[:100] or 'emergent-type'
    base_name = (suggested_name or normalized_slug.replace('-', ' ').title()).strip()[:100] or 'Emergent Type'

    object_type = ObjectType.objects.filter(slug=normalized_slug).first()
    created_type = False
    if object_type is None:
        object_type = ObjectType.objects.create(
            name=_unique_object_type_name(base_name),
            slug=_unique_object_type_slug(normalized_slug),
            icon=icon[:50] or 'sparkle',
            color=color,
            default_components=['body'],
            is_built_in=False,
            sort_order=100,
        )
        created_type = True

    members_qs = Object.objects.filter(pk__in=member_ids, is_deleted=False)
    if restrict_to_note:
        note_type = ObjectType.objects.filter(slug='note').first()
        if note_type is not None:
            members_qs = members_qs.filter(Q(object_type=note_type) | Q(object_type__isnull=True))
        else:
            members_qs = members_qs.filter(object_type__isnull=True)

    objects_updated = members_qs.update(object_type=object_type)

    return {
        'created_type': created_type,
        'objects_updated': objects_updated,
        'object_type': {
            'id': object_type.pk,
            'name': object_type.name,
            'slug': object_type.slug,
            'icon': object_type.icon,
            'color': object_type.color,
        },
        'member_count': len(member_ids),
        'restrict_to_note': restrict_to_note,
    }

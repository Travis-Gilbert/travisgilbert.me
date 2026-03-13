"""
Provenance tracing for notebook objects.

Combines timeline history with causal lineage for an auditable object story.
"""

from __future__ import annotations

from .causal_engine import trace_lineage


def trace_provenance(object_pk: int, include_downstream: bool = True):
    """
    Build the provenance payload for a single object.
    """
    from .models import Edge, Node, Object

    obj = (
        Object.objects
        .filter(pk=object_pk, is_deleted=False)
        .select_related('object_type', 'notebook', 'cluster')
        .first()
    )
    if obj is None:
        return None

    nodes = Node.objects.filter(object_ref=obj).order_by('occurred_at')
    origin_story = [
        {
            'timestamp': node.occurred_at.isoformat() if node.occurred_at else '',
            'event_type': node.node_type,
            'description': node.title or '',
            'body': (node.body or '')[:300],
            'sha_hash': node.sha_hash,
        }
        for node in nodes
    ]

    ancestors = [
        {
            'pk': ancestor_obj.pk,
            'title': ancestor_obj.display_title,
            'type': ancestor_obj.object_type.slug if ancestor_obj.object_type else 'note',
            'depth': depth,
            'influence_reason': reason,
            'created_at': ancestor_obj.captured_at.isoformat() if ancestor_obj.captured_at else '',
        }
        for ancestor_obj, depth, reason in trace_lineage(
            obj.pk,
            direction='ancestors',
            notebook=obj.notebook,
        )
    ]

    descendants = []
    if include_downstream:
        descendants = [
            {
                'pk': descendant_obj.pk,
                'title': descendant_obj.display_title,
                'type': descendant_obj.object_type.slug if descendant_obj.object_type else 'note',
                'depth': depth,
                'influence_reason': reason,
                'created_at': descendant_obj.captured_at.isoformat() if descendant_obj.captured_at else '',
            }
            for descendant_obj, depth, reason in trace_lineage(
                obj.pk,
                direction='descendants',
                notebook=obj.notebook,
            )
        ]

    contradiction_edges = (
        Edge.objects
        .filter(edge_type='contradicts')
        .filter(from_object=obj)
        .select_related('to_object')
        .order_by('created_at')
    )
    belief_revisions = [
        {
            'timestamp': edge.created_at.isoformat() if edge.created_at else '',
            'contradicting_object': {
                'pk': edge.to_object.pk,
                'title': edge.to_object.display_title,
            },
            'reason': edge.reason,
            'confidence': float(edge.strength),
        }
        for edge in contradiction_edges
    ]

    cluster_history = []
    if obj.cluster is not None:
        cluster_history.append(
            {
                'timestamp': obj.cluster.computed_at.isoformat() if obj.cluster.computed_at else '',
                'cluster_name': obj.cluster.name,
                'action': 'currently_in',
                'cluster_size': obj.cluster.member_count,
            },
        )

    return {
        'object': {
            'pk': obj.pk,
            'title': obj.display_title,
            'type': obj.object_type.slug if obj.object_type else 'note',
            'sha_hash': obj.sha_hash,
            'created_at': obj.captured_at.isoformat() if obj.captured_at else '',
            'notebook': obj.notebook.name if obj.notebook else None,
        },
        'origin_story': origin_story,
        'ancestors': ancestors,
        'descendants': descendants,
        'belief_revisions': belief_revisions,
        'cluster_history': cluster_history,
    }


def generate_provenance_narrative(object_pk: int) -> str:
    """
    Generate a compact English summary of the provenance payload.
    """
    provenance = trace_provenance(object_pk)
    if provenance is None:
        return 'No provenance data available.'

    obj = provenance['object']
    parts = [f'"{obj["title"]}" ({obj["type"]}) was created on {obj["created_at"][:10]}.' if obj['created_at'] else f'"{obj["title"]}" ({obj["type"]}) is tracked in provenance.']

    if provenance['ancestors']:
        names = [item['title'] for item in provenance['ancestors'][:3]]
        parts.append(f'It was influenced by: {", ".join(names)}.')

    connection_events = [
        event for event in provenance['origin_story'] if event.get('event_type') == 'connection'
    ]
    if connection_events:
        parts.append(f'The engine discovered {len(connection_events)} connection events over time.')

    if provenance['belief_revisions']:
        first_revision = provenance['belief_revisions'][0]
        parts.append(
            f'A contradiction was found with "{first_revision["contradicting_object"]["title"]}" '
            f'(confidence: {first_revision["confidence"]:.0%}).'
        )

    if provenance['cluster_history']:
        cluster = provenance['cluster_history'][0]
        parts.append(
            f'It is currently in "{cluster["cluster_name"]}" '
            f'({cluster["cluster_size"]} objects).'
        )

    if provenance['descendants']:
        names = [item['title'] for item in provenance['descendants'][:3]]
        parts.append(f'It influenced: {", ".join(names)}.')

    return ' '.join(parts)

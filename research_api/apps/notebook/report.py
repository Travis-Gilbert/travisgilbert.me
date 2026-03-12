"""
Structured organization reporting for the notebook graph.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime

from django.db.models import Count, Q


def generate_organization_report(notebook=None, timeline_limit: int = 50):
    """
    Build a scoped organization summary suitable for API export/rendering.
    """
    from .models import Cluster, Edge, Node, Object, ResolvedEntity
    from .provenance import trace_provenance

    objects_qs = Object.objects.filter(is_deleted=False)
    if notebook is not None:
        objects_qs = objects_qs.filter(notebook=notebook)
    objects = list(objects_qs.select_related('object_type', 'cluster'))
    object_ids = [obj.pk for obj in objects]

    type_counts = Counter(
        obj.object_type.name if obj.object_type else 'Untyped'
        for obj in objects
    )

    clusters_qs = Cluster.objects.all()
    if notebook is not None:
        clusters_qs = clusters_qs.filter(notebook=notebook)

    cluster_summaries = []
    for cluster in clusters_qs.order_by('-member_count'):
        members = Object.objects.filter(cluster=cluster, is_deleted=False)
        if notebook is not None:
            members = members.filter(notebook=notebook)

        top_entities = list(
            ResolvedEntity.objects
            .filter(source_object__in=members)
            .values('normalized_text', 'entity_type')
            .annotate(count=Count('id'))
            .order_by('-count')[:5]
        )
        cluster_summaries.append(
            {
                'name': cluster.name,
                'size': int(cluster.member_count or members.count()),
                'top_entities': top_entities,
                'summary': cluster.summary or '',
            },
        )

    tensions_qs = (
        Edge.objects
        .filter(edge_type='contradicts')
        .select_related('from_object', 'to_object')
    )
    if object_ids:
        tensions_qs = tensions_qs.filter(from_object_id__in=object_ids, to_object_id__in=object_ids)
    tensions_qs = tensions_qs.order_by('-strength')[:10]
    tension_list = [
        {
            'object_a': edge.from_object.display_title,
            'object_b': edge.to_object.display_title,
            'reason': edge.reason,
            'confidence': float(edge.strength),
        }
        for edge in tensions_qs
    ]

    hubs = (
        Object.objects
        .filter(pk__in=object_ids)
        .annotate(
            incident_edges=Count('edges_out', distinct=True) + Count('edges_in', distinct=True),
        )
        .order_by('-incident_edges', '-captured_at')[:5]
    )
    hub_provenances = []
    for hub in hubs:
        provenance = trace_provenance(hub.pk, include_downstream=False)
        if provenance is not None:
            hub_provenances.append(provenance)

    total_edges_qs = Edge.objects.filter(Q(from_object_id__in=object_ids) | Q(to_object_id__in=object_ids))
    if object_ids:
        total_edges_qs = total_edges_qs.filter(from_object_id__in=object_ids, to_object_id__in=object_ids)

    timeline_qs = Node.objects.select_related('object_ref').order_by('-occurred_at')
    if object_ids:
        timeline_qs = timeline_qs.filter(object_ref_id__in=object_ids)
    timeline_events = []
    for node in timeline_qs[:timeline_limit]:
        timeline_events.append(
            {
                'timestamp': node.occurred_at.isoformat() if node.occurred_at else '',
                'node_type': node.node_type,
                'title': node.title or '',
                'object_id': node.object_ref_id,
                'object_title': node.object_ref.display_title if node.object_ref else '',
            },
        )

    return {
        'summary': {
            'total_objects': len(objects),
            'type_breakdown': dict(type_counts),
            'total_edges': total_edges_qs.count(),
            'total_clusters': len(cluster_summaries),
        },
        'clusters': cluster_summaries,
        'tensions': tension_list,
        'hub_objects': hub_provenances,
        'timeline': timeline_events,
    }


def render_organization_report_markdown(report: dict) -> str:
    """
    Render report payload to a human-readable markdown summary.
    """
    summary = report.get('summary', {})
    lines = [
        '# Organization Report',
        '',
        f'- Total objects: {summary.get("total_objects", 0)}',
        f'- Total edges: {summary.get("total_edges", 0)}',
        f'- Total clusters: {summary.get("total_clusters", 0)}',
        '',
        '## Type Breakdown',
    ]

    type_breakdown = summary.get('type_breakdown', {})
    if type_breakdown:
        for label, count in sorted(type_breakdown.items(), key=lambda item: (-item[1], item[0])):
            lines.append(f'- {label}: {count}')
    else:
        lines.append('- No typed objects available.')

    lines.append('')
    lines.append('## Clusters')
    clusters = report.get('clusters', [])
    if clusters:
        for cluster in clusters:
            lines.append(f'- {cluster.get("name") or "Unnamed cluster"} ({cluster.get("size", 0)} objects)')
    else:
        lines.append('- No clusters.')

    lines.append('')
    lines.append('## Top Tensions')
    tensions = report.get('tensions', [])
    if tensions:
        for tension in tensions[:10]:
            lines.append(
                f'- {tension.get("object_a", "")} vs {tension.get("object_b", "")} '
                f'({tension.get("confidence", 0):.2f})'
            )
            if tension.get('reason'):
                lines.append(f'  Reason: {tension["reason"]}')
    else:
        lines.append('- No contradictions detected.')

    lines.append('')
    lines.append('## Timeline (Recent)')
    timeline_events = report.get('timeline', [])
    if timeline_events:
        for event in timeline_events[:20]:
            timestamp = event.get('timestamp') or ''
            date_label = timestamp
            try:
                date_label = datetime.fromisoformat(timestamp).strftime('%Y-%m-%d %H:%M')
            except Exception:
                pass
            title = event.get('title') or event.get('node_type') or 'event'
            object_title = event.get('object_title') or ''
            if object_title:
                lines.append(f'- {date_label}: {title} ({object_title})')
            else:
                lines.append(f'- {date_label}: {title}')
    else:
        lines.append('- No timeline events in scope.')

    lines.append('')
    return '\n'.join(lines)

"""
Temporal evolution analysis for the notebook knowledge graph.

Builds sliding-window graph snapshots and reports how the graph is growing
or concentrating over time.
"""

from __future__ import annotations

from collections import Counter
from datetime import timedelta

import networkx as nx


def _snapshot_graph(objects, edges):
    graph = nx.Graph()
    for obj in objects:
        graph.add_node(
            obj.pk,
            title=obj.display_title,
            type=obj.object_type.slug if obj.object_type else 'note',
        )
    for edge in edges:
        graph.add_edge(
            edge.from_object_id,
            edge.to_object_id,
            weight=float(edge.strength or 0.0),
        )
    return graph


def build_temporal_snapshots(
    notebook=None,
    window_days: int = 30,
    step_days: int = 7,
    max_windows: int = 12,
) -> list[dict]:
    """Build sliding-window graph snapshots from object and edge timestamps."""
    from .models import Edge, Object

    objects_qs = Object.objects.filter(is_deleted=False)
    if notebook is not None:
        objects_qs = objects_qs.filter(notebook=notebook)
    objects = list(objects_qs.select_related('object_type').order_by('captured_at'))
    if not objects:
        return []

    earliest = objects[0].captured_at
    latest = objects[-1].captured_at
    if earliest is None or latest is None:
        return []

    window = timedelta(days=max(int(window_days), 1))
    step = timedelta(days=max(int(step_days), 1))
    current_start = earliest
    snapshots = []

    while current_start <= latest and len(snapshots) < max_windows:
        current_end = current_start + window
        window_objects = [obj for obj in objects if obj.captured_at and current_start <= obj.captured_at < current_end]
        window_pks = [obj.pk for obj in window_objects]

        edges_qs = Edge.objects.filter(
            from_object_id__in=window_pks,
            to_object_id__in=window_pks,
            from_object__is_deleted=False,
            to_object__is_deleted=False,
            created_at__gte=current_start,
            created_at__lt=current_end,
        ).select_related('from_object', 'to_object')
        graph = _snapshot_graph(window_objects, edges_qs)

        type_counts = Counter(
            obj.object_type.slug if obj.object_type else 'note'
            for obj in window_objects
        )
        snapshots.append(
            {
                'window_start': current_start.isoformat(),
                'window_end': current_end.isoformat(),
                'object_count': len(window_objects),
                'edge_count': graph.number_of_edges(),
                'density': round(nx.density(graph), 4) if graph.number_of_nodes() > 1 else 0.0,
                'component_count': nx.number_connected_components(graph) if graph.number_of_nodes() else 0,
                'top_types': dict(type_counts.most_common(3)),
                'object_pks': window_pks,
            },
        )
        current_start += step

    return snapshots


def analyze_temporal_evolution(
    notebook=None,
    window_days: int = 30,
    step_days: int = 7,
    max_windows: int = 12,
) -> dict:
    """Compute growth and density changes across snapshots."""
    snapshots = build_temporal_snapshots(
        notebook=notebook,
        window_days=window_days,
        step_days=step_days,
        max_windows=max_windows,
    )
    if not snapshots:
        return {'snapshots': [], 'trajectory': {}, 'summary': 'No temporal data available.'}

    trajectory = []
    previous = None
    for snapshot in snapshots:
        delta = {
            'window_start': snapshot['window_start'],
            'object_growth': snapshot['object_count'] - (previous['object_count'] if previous else 0),
            'edge_growth': snapshot['edge_count'] - (previous['edge_count'] if previous else 0),
            'density_change': round(
                snapshot['density'] - (previous['density'] if previous else 0.0),
                4,
            ),
        }
        trajectory.append(delta)
        previous = snapshot

    latest = snapshots[-1]
    summary = (
        f'Latest window contains {latest["object_count"]} objects and '
        f'{latest["edge_count"]} edges across {latest["component_count"]} components.'
    )

    return {
        'snapshots': snapshots,
        'trajectory': trajectory,
        'summary': summary,
    }

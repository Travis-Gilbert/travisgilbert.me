"""
Causal inference helpers for notebook Objects.

This is influence detection, not formal causal inference. It uses temporal
precedence plus claim-level support edges as a proxy for intellectual lineage.
"""

from __future__ import annotations

import re
from collections import defaultdict, deque


_CLAIM_QUOTE_PATTERN = re.compile(r'"([^"]+)"')


def _extract_claim_pair(reason: str) -> dict | None:
    matches = _CLAIM_QUOTE_PATTERN.findall(reason or '')
    if len(matches) < 2:
        return None
    return {
        'from_claim': matches[0],
        'to_claim': matches[1],
    }


def build_influence_dag(notebook=None, min_entailment: float = 0.6) -> dict:
    """
    Build a forward-in-time influence DAG from support-style NLI edges.
    """
    from .models import Edge, Object

    edges_qs = (
        Edge.objects
        .filter(
            edge_type__in=['supports', 'entailment'],
            strength__gte=min_entailment,
            from_object__is_deleted=False,
            to_object__is_deleted=False,
        )
        .select_related('from_object__object_type', 'to_object__object_type')
    )
    if notebook is not None:
        edges_qs = edges_qs.filter(
            from_object__notebook=notebook,
            to_object__notebook=notebook,
        )

    candidates = []
    for edge in edges_qs:
        if not edge.from_object.captured_at or not edge.to_object.captured_at:
            continue
        if edge.from_object.captured_at >= edge.to_object.captured_at:
            continue

        candidates.append(
            {
                'from_pk': edge.from_object.pk,
                'to_pk': edge.to_object.pk,
                'from_title': edge.from_object.display_title,
                'to_title': edge.to_object.display_title,
                'from_captured_at': edge.from_object.captured_at,
                'to_captured_at': edge.to_object.captured_at,
                'strength': float(edge.strength),
                'reason': edge.reason,
                'claim_pair': _extract_claim_pair(edge.reason),
            },
        )

    if not candidates:
        return {'nodes': [], 'edges': [], 'roots': [], 'leaves': []}

    accepted = []
    for candidate in sorted(
        candidates,
        key=lambda item: (item['to_pk'], -item['strength'], item['from_captured_at']),
    ):
        stronger_earlier = any(
            existing['to_pk'] == candidate['to_pk']
            and existing['from_captured_at'] <= candidate['from_captured_at']
            and existing['strength'] >= candidate['strength']
            for existing in accepted
        )
        if stronger_earlier:
            continue
        accepted.append(candidate)

    node_pks = {
        pk
        for edge in accepted
        for pk in (edge['from_pk'], edge['to_pk'])
    }
    objects = (
        Object.objects
        .filter(pk__in=node_pks)
        .select_related('object_type')
        .order_by('captured_at', 'pk')
    )
    nodes = [
        {
            'pk': obj.pk,
            'title': obj.display_title,
            'captured_at': obj.captured_at.isoformat() if obj.captured_at else None,
            'type': obj.object_type.slug if obj.object_type else 'note',
        }
        for obj in objects
    ]

    incoming = {edge['to_pk'] for edge in accepted}
    outgoing = {edge['from_pk'] for edge in accepted}
    roots = sorted(node_pks - incoming)
    leaves = sorted(node_pks - outgoing)

    accepted.sort(key=lambda item: (item['from_captured_at'], item['to_captured_at']))
    return {
        'nodes': nodes,
        'edges': accepted,
        'roots': roots,
        'leaves': leaves,
    }


def trace_lineage(
    object_pk: int,
    direction: str = 'ancestors',
    max_depth: int = 10,
    notebook=None,
    min_entailment: float = 0.6,
) -> list[tuple]:
    """
    Trace an object's influence lineage in breadth-first order.
    """
    from .models import Object

    dag = build_influence_dag(notebook=notebook, min_entailment=min_entailment)
    if not dag['edges']:
        return []

    objects = {
        obj.pk: obj
        for obj in Object.objects.filter(
            pk__in={
                pk
                for edge in dag['edges']
                for pk in (edge['from_pk'], edge['to_pk'])
            },
        ).select_related('object_type')
    }

    adjacency = defaultdict(list)
    if direction == 'ancestors':
        for edge in dag['edges']:
            adjacency[edge['to_pk']].append(edge)
    else:
        for edge in dag['edges']:
            adjacency[edge['from_pk']].append(edge)

    visited = {object_pk}
    queue = deque([(object_pk, 0)])
    lineage = []

    while queue:
        current_pk, depth = queue.popleft()
        if depth >= max_depth:
            continue

        for edge in adjacency.get(current_pk, []):
            next_pk = edge['from_pk'] if direction == 'ancestors' else edge['to_pk']
            if next_pk in visited:
                continue
            visited.add(next_pk)

            target_obj = objects.get(next_pk)
            if target_obj is None:
                continue
            lineage.append((target_obj, depth + 1, edge['reason']))
            queue.append((next_pk, depth + 1))

    return lineage

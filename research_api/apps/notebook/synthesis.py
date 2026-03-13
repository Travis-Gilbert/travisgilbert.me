"""
Cluster synthesis helpers.

Provides an LLM-optional path for cluster summaries with a deterministic
heuristic fallback that keeps notebook-facing output plain English.
"""

from __future__ import annotations

import logging
import os
import re
from collections import Counter

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
LLM_SYNTHESIS_ENABLED = bool(ANTHROPIC_API_KEY) and os.environ.get(
    'CLUSTER_SYNTHESIS_LLM',
    'false',
).lower() == 'true'
SYNTHESIS_MODEL = os.environ.get(
    'CLUSTER_SYNTHESIS_MODEL',
    'claude-haiku-4-5-20251001',
)
STOP_WORDS = {
    'the', 'and', 'for', 'that', 'with', 'this', 'from', 'into', 'when',
    'where', 'what', 'have', 'has', 'had', 'were', 'been', 'their', 'they',
    'them', 'your', 'about', 'there', 'here', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'note', 'notes',
}


def _extract_keywords(text: str) -> list[str]:
    return [
        token
        for token in re.findall(r'\b[a-z]{4,}\b', (text or '').lower())
        if token not in STOP_WORDS
    ]


def _heuristic_cluster_summary(cluster) -> str:
    members = list(
        cluster.members.select_related('object_type').order_by('-captured_at')[:8],
    )
    if not members:
        return 'No objects are currently assigned to this cluster.'

    type_counts = Counter(
        member.object_type.slug if member.object_type else 'note'
        for member in members
    )
    keyword_counts = Counter()
    for member in members:
        keyword_counts.update(_extract_keywords(member.title or ''))
        keyword_counts.update(_extract_keywords(member.body or ''))

    top_types = ', '.join(slug for slug, _count in type_counts.most_common(2))
    top_keywords = ', '.join(word for word, _count in keyword_counts.most_common(3))
    exemplar_titles = ', '.join(member.display_title for member in members[:3])

    if top_keywords:
        return (
            f'A {cluster.member_count}-object cluster centered on {top_keywords}. '
            f'It is mostly composed of {top_types or "mixed"} objects, with recent '
            f'examples including {exemplar_titles}.'
        )

    return (
        f'A {cluster.member_count}-object cluster with recent examples including '
        f'{exemplar_titles}.'
    )


def _llm_cluster_summary(cluster) -> str | None:
    if not LLM_SYNTHESIS_ENABLED:
        return None

    members = list(
        cluster.members.select_related('object_type').order_by('-captured_at')[:10],
    )
    if not members:
        return None

    prompt_lines = [
        'Summarize this notebook cluster in 2 plain-English sentences.',
        'Focus on the shared theme, not generic similarity language.',
        'Mention recurring ideas if they are obvious from the member titles/bodies.',
        '',
    ]
    for member in members:
        prompt_lines.append(
            f'- {member.display_title}: {(member.body or "")[:180]}',
        )
    prompt = '\n'.join(prompt_lines)

    try:
        import httpx

        response = httpx.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            json={
                'model': SYNTHESIS_MODEL,
                'max_tokens': 160,
                'messages': [{'role': 'user', 'content': prompt}],
            },
            timeout=12.0,
        )
        response.raise_for_status()
        text = response.json()['content'][0]['text'].strip()
        return text or None
    except Exception as exc:
        logger.warning('Cluster synthesis failed: %s', exc)
        return None


def summarize_cluster(cluster, persist: bool = False) -> str:
    """Summarize a single cluster, optionally persisting the result."""
    summary = _llm_cluster_summary(cluster) or _heuristic_cluster_summary(cluster)
    if persist and cluster.summary != summary:
        cluster.summary = summary
        cluster.save(update_fields=['summary'])
    return summary


def summarize_clusters(notebook=None, persist: bool = False) -> list[dict]:
    """Summarize all clusters in scope and optionally persist summaries."""
    from .models import Cluster

    clusters_qs = Cluster.objects.all().prefetch_related('members__object_type')
    if notebook is not None:
        clusters_qs = clusters_qs.filter(notebook=notebook)

    summaries = []
    for cluster in clusters_qs.order_by('-member_count'):
        summaries.append(
            {
                'cluster_id': cluster.pk,
                'name': cluster.name,
                'member_count': cluster.member_count,
                'summary': summarize_cluster(cluster, persist=persist),
            },
        )
    return summaries

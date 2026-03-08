"""
Resurface service: selects Objects for serendipitous rediscovery.

Five signals, each returning (object_id, score, signal_name, explanation).
All signals are merged, deduplicated (keep highest score per object),
sorted by score, and returned as ordered candidates.
"""
import logging
from datetime import timedelta

from django.db.models import Count, Max, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

logger = logging.getLogger(__name__)


def connection_recency(qs, now, **kwargs):
    """
    Boost Objects that recently acquired a new connection but were
    created more than 30 days ago. Weight: 0.30.
    """
    results = []
    candidates = qs.annotate(
        latest_edge_at=Coalesce(
            Max('edges_out__created_at'),
            Max('edges_in__created_at'),
            Value(None),
        ),
    ).filter(latest_edge_at__gte=now - timedelta(days=14))

    for obj in candidates:
        obj_age = (now - obj.captured_at).days if obj.captured_at else 0
        edge_age = (now - obj.latest_edge_at).days
        if obj_age > 30 and edge_age < 14:
            score = 0.30 * max(0, 1.0 - edge_age / 14)
            results.append((
                obj.pk, score, 'connection_recency',
                f'This {getattr(obj.object_type, "name", "object").lower()} '
                f'recently connected to something new.',
            ))
    return results


def orphan_score(qs, **kwargs):
    """
    Boost Objects with zero or very few connections. Weight: 0.25.
    """
    results = []
    candidates = qs.annotate(
        ec=Count('edges_out', distinct=True) + Count('edges_in', distinct=True)
    )
    for obj in candidates:
        ec = obj.ec or 0
        if ec == 0:
            results.append((obj.pk, 0.25, 'orphan', 'No connections yet. Ripe for discovery.'))
        elif ec <= 2:
            results.append((obj.pk, 0.15, 'orphan', 'Lightly connected. Could use more links.'))
    return results


def engagement_decay(qs, now, **kwargs):
    """
    Boost Objects not updated recently. Weight: 0.20.
    """
    results = []
    for obj in qs:
        days = (now - obj.updated_at).days if obj.updated_at else 365
        if days > 30:
            score = min(0.20, 0.20 * (days / 180))
            results.append((
                obj.pk, score, 'engagement_decay',
                f'Not revisited in {days} days.',
            ))
    return results


def temporal_resonance(qs, now, **kwargs):
    """
    Boost Objects captured on or around the same calendar date in past years.
    Weight: 0.15 exact match, 0.05 same month.
    """
    results = []
    for obj in qs:
        if not obj.captured_at:
            continue
        if (obj.captured_at.month == now.month
                and obj.captured_at.day == now.day
                and obj.captured_at.year != now.year):
            years_ago = now.year - obj.captured_at.year
            results.append((
                obj.pk, 0.15, 'temporal_resonance',
                f'Captured on this day {years_ago} year(s) ago.',
            ))
        elif abs(obj.captured_at.month - now.month) <= 1 and obj.captured_at.year != now.year:
            results.append((
                obj.pk, 0.05, 'temporal_resonance',
                'Captured around this time of year.',
            ))
    return results


def contextual_fit(qs, notebook_slug=None, project_slug=None, **kwargs):
    """
    Boost Objects in the currently active Notebook or Project. Weight: 0.10.
    """
    results = []
    for obj in qs:
        if notebook_slug and obj.notebook and obj.notebook.slug == notebook_slug:
            results.append((obj.pk, 0.10, 'contextual_fit', 'In your active notebook.'))
        elif project_slug and obj.project and obj.project.slug == project_slug:
            results.append((obj.pk, 0.10, 'contextual_fit', 'In your active project.'))
    return results


SIGNAL_LABELS = {
    'connection_recency': 'Connection Recency',
    'orphan': 'Waiting for Connections',
    'engagement_decay': 'Fading From View',
    'temporal_resonance': 'This Day in History',
    'contextual_fit': 'In Your Current Context',
}


def score_candidates(qs, notebook_slug=None, project_slug=None):
    """
    Run all signals against a queryset of Objects.
    Returns a list of dicts: {object_id, score, signal, signal_label, explanation}
    ordered by score descending.
    """
    now = timezone.now()
    all_results = []

    for signal_fn in [connection_recency, orphan_score, engagement_decay,
                      temporal_resonance, contextual_fit]:
        try:
            results = signal_fn(
                qs=qs, now=now,
                notebook_slug=notebook_slug,
                project_slug=project_slug,
            )
            all_results.extend(results)
        except Exception as exc:
            logger.warning('Resurface signal %s failed: %s', signal_fn.__name__, exc)

    # Deduplicate: keep highest score per object
    best = {}
    for obj_id, score, signal, explanation in all_results:
        if obj_id not in best or score > best[obj_id]['score']:
            best[obj_id] = {
                'object_id': obj_id,
                'score': score,
                'signal': signal,
                'signal_label': SIGNAL_LABELS.get(signal, signal),
                'explanation': explanation,
            }

    # Sort and return
    return sorted(best.values(), key=lambda x: x['score'], reverse=True)

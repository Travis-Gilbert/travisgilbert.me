"""
Tension detection service: find intellectual friction between sources.

Surfaces source pairs that disagree, diverge, or represent competing
perspectives on shared topics. Four tension types:

1. Role-based: explicit counterargument vs primary/data roles on same content.
2. Publisher divergence: same tags but different publications.
3. Temporal: same topic, significant time gap (>5 years).
4. Tag divergence: mostly shared tags with a few differing.

No new models. All computation derives from existing Source, SourceLink,
and their metadata fields.
"""

from collections import defaultdict
from itertools import combinations

from apps.research.models import Source, SourceLink


def _source_summary(source):
    """Compact dict for a source in tension results."""
    return {
        'slug': source.slug,
        'title': source.title,
        'creator': source.creator,
        'publication': source.publication,
    }


def _shared_content_slugs(source_a, source_b):
    """Content slugs that both sources are linked to."""
    a_slugs = set(
        SourceLink.objects.filter(source=source_a)
        .values_list('content_slug', flat=True)
    )
    b_slugs = set(
        SourceLink.objects.filter(source=source_b)
        .values_list('content_slug', flat=True)
    )
    return sorted(a_slugs & b_slugs)


def _shared_tags(source_a, source_b):
    """Tags shared by both sources."""
    a_tags = set(source_a.tags or [])
    b_tags = set(source_b.tags or [])
    return sorted(a_tags & b_tags)


# ── Tension detectors ────────────────────────────────────────────────


def _role_based_tensions(content_slug=None):
    """
    Find pairs where one source is primary/data and another is
    counterargument on the same content piece.
    """
    tensions = []

    # Group source links by content piece
    links_qs = SourceLink.objects.select_related('source').filter(
        source__public=True,
    )
    if content_slug:
        links_qs = links_qs.filter(content_slug=content_slug)

    by_content = defaultdict(list)
    for link in links_qs:
        by_content[link.content_slug].append(link)

    primary_roles = {'primary', 'data'}
    counter_roles = {'counterargument'}

    for slug, links in by_content.items():
        primaries = [lk for lk in links if lk.role in primary_roles]
        counters = [lk for lk in links if lk.role in counter_roles]

        for p in primaries:
            for c in counters:
                if p.source_id == c.source_id:
                    continue
                tensions.append({
                    'source_a': _source_summary(p.source),
                    'source_b': _source_summary(c.source),
                    'score': 0.9,
                    'tension_type': 'counterargument',
                    'explanation': (
                        f'{c.source.title} explicitly counters '
                        f'{p.source.title} in "{slug}".'
                    ),
                    'shared_content': [slug],
                    'shared_tags': _shared_tags(p.source, c.source),
                })

    return tensions


def _publisher_divergence_tensions(topic_tag=None):
    """
    Sources sharing tags or content links but from different publications.
    """
    tensions = []

    sources = Source.objects.public().exclude(publication='')
    source_list = list(sources)
    if topic_tag:
        source_list = [s for s in source_list if topic_tag in (s.tags or [])]

    for a, b in combinations(source_list, 2):
        if a.publication == b.publication:
            continue

        shared = _shared_tags(a, b)
        shared_content = _shared_content_slugs(a, b)

        if not shared and not shared_content:
            continue

        # Score based on tag overlap ratio
        a_tags = set(a.tags or [])
        b_tags = set(b.tags or [])
        union = a_tags | b_tags
        if not union:
            continue

        overlap = len(shared) / len(union)
        score = round(0.3 + overlap * 0.5, 4)

        tensions.append({
            'source_a': _source_summary(a),
            'source_b': _source_summary(b),
            'score': score,
            'tension_type': 'publisher_divergence',
            'explanation': (
                f'{a.publication} and {b.publication} cover '
                f'overlapping topics ({", ".join(shared[:3])}).'
            ),
            'shared_content': shared_content,
            'shared_tags': shared,
        })

    return tensions


def _temporal_tensions(topic_tag=None):
    """
    Sources on the same topic from >5 years apart.
    """
    tensions = []

    sources = Source.objects.public().exclude(date_published__isnull=True)
    source_list = list(sources)
    if topic_tag:
        source_list = [s for s in source_list if topic_tag in (s.tags or [])]
    five_years = 365 * 5

    for a, b in combinations(source_list, 2):
        shared = _shared_tags(a, b)
        if not shared:
            continue

        gap_days = abs((a.date_published - b.date_published).days)
        if gap_days < five_years:
            continue

        gap_years = round(gap_days / 365, 1)
        score = round(min(0.3 + (gap_days - five_years) / (365 * 10), 0.85), 4)

        older, newer = (a, b) if a.date_published < b.date_published else (b, a)

        tensions.append({
            'source_a': _source_summary(older),
            'source_b': _source_summary(newer),
            'score': score,
            'tension_type': 'temporal',
            'explanation': (
                f'{newer.title} ({newer.date_published.year}) may update or '
                f'contradict {older.title} ({older.date_published.year}), '
                f'{gap_years} years apart.'
            ),
            'shared_content': _shared_content_slugs(older, newer),
            'shared_tags': shared,
        })

    return tensions


def _tag_divergence_tensions(topic_tag=None):
    """
    Sources that share most tags but differ on one or two.
    The differing tags hint at the axis of disagreement.
    """
    tensions = []

    sources = Source.objects.public()
    source_list = list(sources)
    if topic_tag:
        source_list = [s for s in source_list if topic_tag in (s.tags or [])]
    source_list = [s for s in source_list if s.tags and len(s.tags) >= 2]

    for a, b in combinations(source_list, 2):
        a_tags = set(a.tags)
        b_tags = set(b.tags)
        shared = a_tags & b_tags
        union = a_tags | b_tags

        if not union or len(shared) < 2:
            continue

        # Require high overlap with some divergence
        overlap_ratio = len(shared) / len(union)
        if overlap_ratio < 0.5 or overlap_ratio >= 1.0:
            continue

        diff_a = sorted(a_tags - b_tags)
        diff_b = sorted(b_tags - a_tags)
        if not diff_a and not diff_b:
            continue

        score = round(0.3 + overlap_ratio * 0.4, 4)
        diff_desc = ', '.join(diff_a + diff_b)

        tensions.append({
            'source_a': _source_summary(a),
            'source_b': _source_summary(b),
            'score': score,
            'tension_type': 'tag_divergence',
            'explanation': (
                f'Share {len(shared)} tags but diverge on: {diff_desc}.'
            ),
            'shared_content': _shared_content_slugs(a, b),
            'shared_tags': sorted(shared),
        })

    return tensions


# ── Public API ───────────────────────────────────────────────────────


def detect_tensions(topic_tag=None, content_slug=None, min_score=0.3):
    """
    Compute all tension types and merge results.

    Args:
        topic_tag: Filter to sources tagged with this value.
        content_slug: Scope role-based tensions to this content piece.
        min_score: Minimum tension score to include (0.0 to 1.0).

    Returns list of tension dicts, sorted by score descending.
    """
    all_tensions = []

    all_tensions.extend(_role_based_tensions(content_slug))
    all_tensions.extend(_publisher_divergence_tensions(topic_tag))
    all_tensions.extend(_temporal_tensions(topic_tag))
    all_tensions.extend(_tag_divergence_tensions(topic_tag))

    # Deduplicate: same pair may appear from multiple detectors.
    # Keep the highest-scoring entry per pair.
    seen = {}
    for t in all_tensions:
        pair_key = tuple(sorted([t['source_a']['slug'], t['source_b']['slug']]))
        if pair_key not in seen or t['score'] > seen[pair_key]['score']:
            seen[pair_key] = t

    filtered = [t for t in seen.values() if t['score'] >= min_score]
    filtered.sort(key=lambda t: t['score'], reverse=True)

    return filtered

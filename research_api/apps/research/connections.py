"""
Connection computation service.

This module ports and extends the TypeScript connectionEngine.ts that
runs at build time in the Next.js frontend. The TypeScript version
computes connections from frontmatter metadata (related slugs,
connectedTo fields). This Django version computes richer connections
from the research database, including:

1. SOURCE-BASED connections (two essays share research sources)
2. TAG-BASED connections (sources linked to content share tags)
3. THREAD-BASED connections (content appears in the same research thread)
4. SEMANTIC connections (source annotations are about similar topics)

The first three are STRUCTURAL: they use explicit relationships already
in the database. The fourth is COMPUTED: it derives relationships from
the meaning of the text. Together they produce a multi-signal similarity
score that's more robust than any single signal alone.

WHY MULTIPLE SIGNALS MATTER
============================
Imagine two essays:
  - Essay A cites Source 1, Source 2, Source 3
  - Essay B cites Source 2, Source 3, Source 4

Source-based connection: they share 2 sources (strong signal).

Now imagine:
  - Essay C has tags ["housing", "zoning"] on its sources
  - Essay D has tags ["housing", "land-use"] on its sources

Tag-based connection: they share the tag "housing" (moderate signal).

And imagine:
  - Essay E's sources discuss "redlining and mortgage discrimination"
  - Essay F's sources discuss "racial covenants in housing deeds"

Semantic connection: the text is about related topics even though
the exact words differ (detected by embedding similarity).

Each signal catches connections the others miss. Combining them
produces a score that better reflects how a human researcher would
perceive relatedness.
"""

import logging
from collections import Counter, defaultdict

from django.db.models import Count, Prefetch, Q

from apps.research.models import (
    ResearchThread,
    Source,
    SourceLink,
    ThreadEntry,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Weight configuration
# ---------------------------------------------------------------------------

# These weights control how much each signal contributes to the
# final connection score. They're tunable. The current values
# reflect a belief that shared sources are the strongest signal
# (you deliberately cited the same material), followed by thread
# co-membership (you investigated them together), then tags
# (topical overlap), then semantic similarity (implied overlap).

WEIGHTS = {
    'shared_sources': 0.40,
    'shared_tags': 0.15,
    'shared_threads': 0.20,
    'semantic': 0.25,
}

# Minimum combined score to include a connection in results.
# Connections below this threshold are noise.
CONNECTION_THRESHOLD = 0.1


# ---------------------------------------------------------------------------
# Individual signal computations
# ---------------------------------------------------------------------------


def compute_source_overlap(content_slug: str, content_type: str) -> dict:
    """
    Find all content pieces that share sources with the given content.

    This is the same computation as get_backlinks() in services.py,
    but returns a normalized score (0.0 to 1.0) instead of raw data.

    The score is: shared_count / max(my_source_count, their_source_count)

    This normalization (called the Jaccard-like coefficient) prevents
    an essay with 50 sources from dominating. An essay sharing 2 out
    of 3 sources is more strongly connected than one sharing 2 out of 50.
    """
    # Get source IDs for the target content
    my_source_ids = set(
        SourceLink.objects.filter(
            content_type=content_type,
            content_slug=content_slug,
        ).values_list('source_id', flat=True)
    )

    if not my_source_ids:
        return {}

    my_count = len(my_source_ids)

    # Find all other content pieces that reference any of these sources
    shared_links = (
        SourceLink.objects
        .filter(source_id__in=my_source_ids)
        .exclude(content_type=content_type, content_slug=content_slug)
        .values('content_type', 'content_slug', 'content_title')
        .annotate(shared_count=Count('source_id', distinct=True))
    )

    # For normalization, get total source count per other content piece
    other_content_counts = {}
    for row in shared_links:
        key = f"{row['content_type']}:{row['content_slug']}"
        total = SourceLink.objects.filter(
            content_type=row['content_type'],
            content_slug=row['content_slug'],
        ).values('source_id').distinct().count()
        other_content_counts[key] = total

    scores = {}
    for row in shared_links:
        key = f"{row['content_type']}:{row['content_slug']}"
        their_count = other_content_counts.get(key, 1)
        # Normalize by the larger set (this is the overlap coefficient)
        score = row['shared_count'] / max(my_count, their_count)
        scores[key] = {
            'score': score,
            'content_type': row['content_type'],
            'content_slug': row['content_slug'],
            'content_title': row['content_title'],
            'shared_count': row['shared_count'],
            'detail': f"shares {row['shared_count']} source(s)",
        }

    return scores


def compute_tag_overlap(content_slug: str, content_type: str) -> dict:
    """
    Find content that shares source tags with the given content.

    Tags live on Source objects (the JSONField 'tags'). Two content
    pieces are tag-connected if the sources they cite use similar tags.

    The score is: shared_tag_count / total_unique_tags_across_both

    This is the Jaccard Index, a classic set-similarity measure:
        J(A, B) = |A intersection B| / |A union B|

    The Jaccard Index has a nice property: it's 1.0 when the sets are
    identical and 0.0 when they share nothing, regardless of set size.
    """
    # Collect all tags from sources linked to this content
    my_links = SourceLink.objects.filter(
        content_type=content_type,
        content_slug=content_slug,
    ).select_related('source')

    my_tags = set()
    for link in my_links:
        my_tags.update(link.source.tags or [])

    if not my_tags:
        return {}

    # Find all other content pieces and their source tags
    all_links = (
        SourceLink.objects
        .exclude(content_type=content_type, content_slug=content_slug)
        .select_related('source')
    )

    # Group tags by content piece
    content_tags = defaultdict(set)
    content_info = {}
    for link in all_links:
        key = f"{link.content_type}:{link.content_slug}"
        content_tags[key].update(link.source.tags or [])
        content_info[key] = {
            'content_type': link.content_type,
            'content_slug': link.content_slug,
            'content_title': link.content_title,
        }

    # Compute Jaccard index for each
    scores = {}
    for key, their_tags in content_tags.items():
        if not their_tags:
            continue

        intersection = my_tags & their_tags
        if not intersection:
            continue

        union = my_tags | their_tags
        jaccard = len(intersection) / len(union)

        scores[key] = {
            'score': jaccard,
            **content_info[key],
            'shared_tags': sorted(intersection),
            'detail': f"shares tags: {', '.join(sorted(intersection))}",
        }

    return scores


def compute_thread_overlap(content_slug: str, content_type: str) -> dict:
    """
    Find content that shares research threads with the given content.

    Research threads represent deliberate lines of investigation.
    If two essays emerged from the same thread, or if sources cited
    by both appear in the same thread, that's a strong connection signal.

    We check two paths:
    1. The thread's resulting_essay_slug matches the target content
    2. Sources linked to the content appear in the thread's entries
    """
    # Path 1: Threads that produced this content
    my_threads = set(
        ResearchThread.objects.public()
        .filter(resulting_essay_slug=content_slug)
        .values_list('id', flat=True)
    )

    # Path 2: Threads containing sources that this content cites
    my_source_ids = set(
        SourceLink.objects.filter(
            content_type=content_type,
            content_slug=content_slug,
        ).values_list('source_id', flat=True)
    )

    source_threads = set(
        ThreadEntry.objects.filter(
            source_id__in=my_source_ids,
            thread__public=True,
        ).values_list('thread_id', flat=True)
    )

    all_my_threads = my_threads | source_threads

    if not all_my_threads:
        return {}

    # Find other content associated with these threads
    # (either as resulting essays or via shared source entries)
    scores = {}

    # Other resulting essays from the same threads
    sibling_essays = (
        ResearchThread.objects.public()
        .filter(id__in=all_my_threads)
        .exclude(resulting_essay_slug='')
        .exclude(resulting_essay_slug=content_slug)
        .values_list('resulting_essay_slug', flat=True)
    )

    for slug in sibling_essays:
        key = f"essay:{slug}"
        scores[key] = {
            'score': 0.8,  # Strong signal: same thread produced both
            'content_type': 'essay',
            'content_slug': slug,
            'content_title': slug,  # We don't have title here; caller enriches
            'detail': 'emerged from the same research thread',
        }

    # Other content citing sources that appear in the same threads
    thread_source_ids = set(
        ThreadEntry.objects.filter(
            thread_id__in=all_my_threads,
            source__isnull=False,
        ).values_list('source_id', flat=True)
    )
    # Exclude sources we already cite (those are captured by source_overlap)
    thread_source_ids -= my_source_ids

    if thread_source_ids:
        related_links = (
            SourceLink.objects.filter(source_id__in=thread_source_ids)
            .exclude(content_type=content_type, content_slug=content_slug)
            .values('content_type', 'content_slug', 'content_title')
            .annotate(count=Count('id'))
        )
        for row in related_links:
            key = f"{row['content_type']}:{row['content_slug']}"
            if key not in scores:
                scores[key] = {
                    'score': 0.4,  # Moderate: connected through thread sources
                    'content_type': row['content_type'],
                    'content_slug': row['content_slug'],
                    'content_title': row['content_title'],
                    'detail': 'shares sources from the same research thread',
                }

    return scores


def compute_semantic_similarity(
    content_slug: str,
    content_type: str,
) -> dict:
    """
    Find content with semantically similar source material.

    This is the embedding-based similarity from embeddings.py.
    It answers the question: "Even if two essays cite completely
    different sources, are those sources *about* the same topics?"

    We build a text representation for each content piece by combining
    the titles, annotations, and tags of all its linked sources, then
    compute cosine similarity between these representations.
    """
    # Import here to avoid circular imports and to allow the module
    # to work even if spaCy isn't configured (graceful degradation)
    try:
        from apps.research.embeddings import (
            build_content_text,
            cosine_similarity,
            get_document_vector,
        )
    except Exception as e:
        logger.warning('Semantic similarity unavailable: %s', e)
        return {}

    # Build text representation for the target content
    my_links = (
        SourceLink.objects.filter(
            content_type=content_type,
            content_slug=content_slug,
        )
        .select_related('source')
    )

    if not my_links.exists():
        return {}

    my_texts = []
    for link in my_links:
        src = link.source
        my_texts.append(build_content_text(
            title=src.title,
            annotation=src.public_annotation,
            tags=src.tags,
            creator=src.creator,
        ))
    my_combined_text = ' '.join(my_texts)

    try:
        my_vector = get_document_vector(my_combined_text)
    except Exception as e:
        logger.warning('Failed to compute vector: %s', e)
        return {}

    import numpy as np
    if np.linalg.norm(my_vector) == 0.0:
        return {}

    # Build text representations for all other content pieces
    all_links = (
        SourceLink.objects
        .exclude(content_type=content_type, content_slug=content_slug)
        .select_related('source')
    )

    content_texts = defaultdict(list)
    content_info = {}
    for link in all_links:
        key = f"{link.content_type}:{link.content_slug}"
        content_texts[key].append(build_content_text(
            title=link.source.title,
            annotation=link.source.public_annotation,
            tags=link.source.tags,
            creator=link.source.creator,
        ))
        content_info[key] = {
            'content_type': link.content_type,
            'content_slug': link.content_slug,
            'content_title': link.content_title,
        }

    # Compute similarity for each content piece
    scores = {}
    for key, texts in content_texts.items():
        combined = ' '.join(texts)
        try:
            their_vector = get_document_vector(combined)
            sim = cosine_similarity(my_vector, their_vector)
        except Exception:
            continue

        if sim > 0.5:  # Only include meaningful similarities
            scores[key] = {
                'score': sim,
                **content_info[key],
                'detail': f'semantic similarity: {sim:.2f}',
            }

    return scores


# ---------------------------------------------------------------------------
# Combined connection score
# ---------------------------------------------------------------------------


def compute_connections(
    content_slug: str,
    content_type: str = 'essay',
    include_semantic: bool = True,
    top_n: int = 20,
) -> list[dict]:
    """
    Compute weighted connections for a piece of content.

    This is the main entry point. It runs all four signal computations,
    combines them with weighted averaging, and returns a ranked list
    of connected content.

    The combination formula:
        total_score = (source_weight * source_score)
                    + (tag_weight * tag_score)
                    + (thread_weight * thread_score)
                    + (semantic_weight * semantic_score)

    Each individual score is 0.0 to 1.0, so the combined score is
    also 0.0 to 1.0.

    Returns a list of:
        {
            'content_type': 'essay',
            'content_slug': 'housing-crisis',
            'content_title': 'The Housing Crisis',
            'score': 0.73,
            'signals': {
                'shared_sources': {'score': 0.8, 'detail': 'shares 3 sources'},
                'shared_tags': {'score': 0.5, 'detail': 'shares tags: housing, zoning'},
                'shared_threads': None,
                'semantic': {'score': 0.72, 'detail': 'semantic similarity: 0.72'},
            },
            'explanation': 'shares 3 sources, shares tags: housing, zoning, ...'
        }
    """
    # Compute each signal
    source_scores = compute_source_overlap(content_slug, content_type)
    tag_scores = compute_tag_overlap(content_slug, content_type)
    thread_scores = compute_thread_overlap(content_slug, content_type)

    semantic_scores = {}
    if include_semantic:
        semantic_scores = compute_semantic_similarity(content_slug, content_type)

    # Collect all unique content keys across all signals
    all_keys = (
        set(source_scores.keys())
        | set(tag_scores.keys())
        | set(thread_scores.keys())
        | set(semantic_scores.keys())
    )

    # Combine scores
    results = []
    for key in all_keys:
        src = source_scores.get(key)
        tag = tag_scores.get(key)
        thr = thread_scores.get(key)
        sem = semantic_scores.get(key)

        # Weighted sum
        total = 0.0
        total += WEIGHTS['shared_sources'] * (src['score'] if src else 0.0)
        total += WEIGHTS['shared_tags'] * (tag['score'] if tag else 0.0)
        total += WEIGHTS['shared_threads'] * (thr['score'] if thr else 0.0)
        total += WEIGHTS['semantic'] * (sem['score'] if sem else 0.0)

        if total < CONNECTION_THRESHOLD:
            continue

        # Get content info from whichever signal found this content
        info = src or tag or thr or sem

        # Build human-readable explanation from active signals
        details = []
        if src:
            details.append(src['detail'])
        if tag:
            details.append(tag['detail'])
        if thr:
            details.append(thr['detail'])
        if sem:
            details.append(sem['detail'])

        results.append({
            'content_type': info['content_type'],
            'content_slug': info['content_slug'],
            'content_title': info.get('content_title', ''),
            'score': round(total, 4),
            'signals': {
                'shared_sources': {
                    'score': round(src['score'], 4),
                    'detail': src['detail'],
                } if src else None,
                'shared_tags': {
                    'score': round(tag['score'], 4),
                    'detail': tag['detail'],
                    'tags': tag.get('shared_tags', []),
                } if tag else None,
                'shared_threads': {
                    'score': round(thr['score'], 4),
                    'detail': thr['detail'],
                } if thr else None,
                'semantic': {
                    'score': round(sem['score'], 4),
                    'detail': sem['detail'],
                } if sem else None,
            },
            'explanation': '; '.join(details),
        })

    # Sort by combined score, strongest connections first
    results.sort(key=lambda r: r['score'], reverse=True)
    return results[:top_n]


# ---------------------------------------------------------------------------
# Full connection graph (for D3.js visualization)
# ---------------------------------------------------------------------------


def compute_connection_graph(
    include_semantic: bool = False,
    min_score: float = 0.15,
) -> dict:
    """
    Compute the full connection graph across all content.

    Returns a D3.js-ready structure:
        {
            'nodes': [
                {'id': 'essay:housing-crisis', 'type': 'essay', ...},
                ...
            ],
            'edges': [
                {'source': 'essay:A', 'target': 'essay:B', 'weight': 0.73, ...},
                ...
            ],
        }

    Unlike the source_graph() in views.py (which shows source-to-content
    relationships), this graph shows CONTENT-to-CONTENT relationships,
    weighted by how strongly they're connected.

    Note: include_semantic=False by default for the full graph because
    computing embeddings for every content pair is expensive. Enable it
    for small datasets or background computation.
    """
    # Get all unique content pieces from SourceLinks
    content_pieces = (
        SourceLink.objects
        .values('content_type', 'content_slug', 'content_title')
        .distinct()
    )

    nodes = []
    seen_keys = set()
    for piece in content_pieces:
        key = f"{piece['content_type']}:{piece['content_slug']}"
        if key in seen_keys:
            continue
        seen_keys.add(key)
        nodes.append({
            'id': key,
            'type': piece['content_type'],
            'slug': piece['content_slug'],
            'label': piece['content_title'] or piece['content_slug'],
        })

    # Compute connections for each content piece
    edges = []
    edge_keys = set()

    for node in nodes:
        connections = compute_connections(
            content_slug=node['slug'],
            content_type=node['type'],
            include_semantic=include_semantic,
            top_n=50,
        )

        for conn in connections:
            target_key = f"{conn['content_type']}:{conn['content_slug']}"

            # Deduplicate bidirectional edges (A->B and B->A)
            pair = tuple(sorted([node['id'], target_key]))
            if pair in edge_keys:
                continue
            edge_keys.add(pair)

            if conn['score'] >= min_score:
                edges.append({
                    'source': node['id'],
                    'target': target_key,
                    'weight': conn['score'],
                    'explanation': conn['explanation'],
                    'signals': conn['signals'],
                })

    return {
        'nodes': nodes,
        'edges': edges,
    }

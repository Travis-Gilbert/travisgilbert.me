"""
Backlink computation service.

Backlinks are computed, not stored. Two content pieces are backlinked
when they share at least one Source via ContentReference. This avoids
synchronization overhead for a small-scale personal site.
"""

from collections import defaultdict

from .models import ContentReference


def get_backlinks(content_type, content_slug):
    """
    Find all content pieces that share sources with the given content.

    Returns a list of dicts:
        [
            {
                "content_type": "field-note",
                "content_slug": "walkability-audit",
                "content_title": "Walkability Audit",
                "shared_sources": [
                    {"source_id": 1, "source_title": "The Death and Life..."}
                ],
            },
            ...
        ]
    """
    # Step 1: Find all source IDs referenced by this content
    my_source_ids = set(
        ContentReference.objects.filter(
            content_type=content_type,
            content_slug=content_slug,
        ).values_list('source_id', flat=True)
    )

    if not my_source_ids:
        return []

    # Step 2: Find other ContentReferences that share those sources,
    # excluding the content piece itself
    shared_refs = (
        ContentReference.objects
        .filter(source_id__in=my_source_ids)
        .exclude(content_type=content_type, content_slug=content_slug)
        .select_related('source')
    )

    # Step 3: Group by target content piece, collecting shared sources
    backlinks = defaultdict(lambda: {
        'content_type': '',
        'content_slug': '',
        'content_title': '',
        'shared_sources': [],
    })

    for ref in shared_refs:
        key = (ref.content_type, ref.content_slug)
        entry = backlinks[key]
        entry['content_type'] = ref.content_type
        entry['content_slug'] = ref.content_slug
        entry['content_title'] = ref.content_title
        entry['shared_sources'].append({
            'source_id': ref.source_id,
            'source_title': ref.source.title,
        })

    return list(backlinks.values())


def get_all_backlinks():
    """
    Compute the full backlink graph for publishing to static JSON.

    Returns a dict keyed by "content_type:content_slug":
        {
            "essay:housing-crisis": [
                {"content_type": "field-note", "content_slug": "walkability", ...}
            ],
            ...
        }
    """
    # Get all content references with their sources in two queries
    all_refs = list(
        ContentReference.objects
        .select_related('source')
        .order_by('content_type', 'content_slug')
    )

    # Build a mapping: source_id -> list of content pieces referencing it
    source_to_content = defaultdict(list)
    for ref in all_refs:
        source_to_content[ref.source_id].append(ref)

    # For each content piece, find all other content pieces sharing sources
    graph = defaultdict(lambda: defaultdict(list))

    for source_id, refs in source_to_content.items():
        if len(refs) < 2:
            continue
        # Every pair of refs sharing this source creates a bidirectional backlink
        for i, ref_a in enumerate(refs):
            for ref_b in refs[i + 1:]:
                key_a = f'{ref_a.content_type}:{ref_a.content_slug}'
                key_b = f'{ref_b.content_type}:{ref_b.content_slug}'
                source_info = {
                    'source_id': source_id,
                    'source_title': ref_a.source.title,
                }
                graph[key_a][(ref_b.content_type, ref_b.content_slug)].append(source_info)
                graph[key_b][(ref_a.content_type, ref_a.content_slug)].append(source_info)

    # Flatten into the output format
    result = {}
    for content_key, linked in graph.items():
        result[content_key] = [
            {
                'content_type': ct,
                'content_slug': cs,
                'shared_sources': sources,
            }
            for (ct, cs), sources in linked.items()
        ]

    return result

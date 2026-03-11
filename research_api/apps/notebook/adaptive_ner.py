"""
Adaptive NER: graph-learned entity recognition.

Tier 1: spaCy NER (PERSON, ORG, GPE, LOC, EVENT, WORK_OF_ART, DATE)
Tier 2: PhraseMatcher trained on existing Object titles per ObjectType.

The PhraseMatcher is rebuilt when the Object corpus changes (signal-driven
invalidation). Each ObjectType's Objects become phrase patterns. When new
text mentions "Jane Jacobs", it matches against Person objects even if
spaCy's built-in NER missed it.

Aho-Corasick complexity: O(n + m + z) where n = text length,
m = total pattern length, z = number of matches. Practically O(n)
for typical knowledge bases.
"""

import logging
import time

from django.db.models import Q

logger = logging.getLogger(__name__)

# Cache for the graph-learned matchers
_GRAPH_MATCHER_CACHE = {
    'matchers': {},        # slug -> PhraseMatcher
    'pattern_counts': {},  # slug -> int (number of patterns)
    'built_at': None,
    'corpus_size': 0,
}
_CACHE_MAX_AGE = 1800  # 30 minutes

# Minimum title length to include as a pattern (avoid noise)
MIN_PATTERN_LENGTH = 4


def invalidate_graph_matcher_cache():
    """Signal-driven invalidation. Called from signals.py on Object create/delete."""
    _GRAPH_MATCHER_CACHE['built_at'] = None


def _build_graph_matchers(nlp):
    """
    Build PhraseMatcher instances for each ObjectType from existing Objects.

    Each ObjectType gets its own matcher. A Person matcher contains all
    Person object titles as patterns. A Concept matcher contains all
    Concept object titles. Etc.

    Returns dict of {object_type_slug: PhraseMatcher}.
    """
    from spacy.matcher import PhraseMatcher
    from .models import Object, ObjectType

    now = time.time()
    cache = _GRAPH_MATCHER_CACHE
    current_count = Object.objects.filter(is_deleted=False).count()

    needs_rebuild = (
        not cache['matchers']
        or cache['built_at'] is None
        or (now - cache['built_at']) > _CACHE_MAX_AGE
        or abs(current_count - cache['corpus_size']) > 20
    )

    if not needs_rebuild:
        return cache['matchers']

    logger.info('Building graph-learned NER matchers...')

    matchers = {}
    pattern_counts = {}

    # Only build matchers for types that have enough objects
    type_slugs_with_objects = (
        ObjectType.objects
        .filter(typed_objects__is_deleted=False)
        .values_list('slug', flat=True)
        .distinct()
    )

    for slug in type_slugs_with_objects:
        titles = list(
            Object.objects
            .filter(object_type__slug=slug, is_deleted=False)
            .exclude(title='')
            .values_list('title', flat=True)
        )

        # Filter: min length, deduplicate normalized forms
        seen = set()
        patterns = []
        for title in titles:
            normalized = title.lower().strip()
            if len(normalized) >= MIN_PATTERN_LENGTH and normalized not in seen:
                seen.add(normalized)
                patterns.append(nlp.make_doc(normalized))

        if patterns:
            matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
            matcher.add(slug, patterns)
            matchers[slug] = matcher
            pattern_counts[slug] = len(patterns)

    cache['matchers'] = matchers
    cache['pattern_counts'] = pattern_counts
    cache['built_at'] = now
    cache['corpus_size'] = current_count

    total = sum(pattern_counts.values())
    logger.info(
        'Graph-learned NER matchers built: %d types, %d total patterns',
        len(matchers), total,
    )

    return matchers


def extract_graph_entities(obj, nlp, config=None):
    """
    Run graph-learned entity extraction on an Object.

    Returns list of (text, entity_type_slug, span_start, span_end) tuples.
    These are entities recognized because they match existing Object titles,
    not because spaCy's NER model identified them.

    The caller (engine.py extract_entities) merges these with spaCy NER
    results, deduplicating by normalized text.
    """
    from .engine import _build_full_text

    text = _build_full_text(obj)
    if not text:
        return []

    matchers = _build_graph_matchers(nlp)
    if not matchers:
        return []

    doc = nlp.make_doc(text.lower())
    results = []

    for slug, matcher in matchers.items():
        matches = matcher(doc)
        for match_id, start, end in matches:
            span_text = doc[start:end].text
            # Skip if this span overlaps with the Object's own title
            if obj.title and span_text.lower().strip() == obj.title.lower().strip():
                continue
            results.append((span_text, slug, start, end))

    return results

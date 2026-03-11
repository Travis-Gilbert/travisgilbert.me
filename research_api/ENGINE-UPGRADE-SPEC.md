# Research API: Engine Upgrade Specification

> **For Claude Code. One batch per session. Read entire spec before writing code.**
> **Read every file listed under "Read first" before writing a single line.**
> **Test after every batch. Do not proceed if tests fail.**

---

## Architecture Overview

The connection engine currently runs a seven-pass pipeline in
`apps/notebook/engine.py`. This spec upgrades individual passes
and adds post-pass intelligence layers. All changes are additive:
existing passes continue to work. New passes fail silently when
dependencies are unavailable (two-mode deployment contract).

```
CURRENT STATE                         TARGET STATE
=============                         ============
Pass 1: spaCy NER (fixed vocab)  ->  Pass 1: Adaptive NER (graph-learned + spaCy)
Pass 2: Shared entity edges       ->  Pass 2: Shared entity edges (unchanged)
Pass 3: Jaccard keyword overlap   ->  Pass 3: BM25 unified lexical (replaces 3+4)
Pass 4: TF-IDF corpus            ->  (merged into Pass 3)
Pass 5: SBERT semantic           ->  Pass 4: Instruction-tuned SBERT (E5/Nomic)
Pass 6: NLI stance               ->  Pass 5: Claim-level NLI stance detection
Pass 7: KGE structural           ->  Pass 6: Temporal KGE (DE-SimplE)
(none)                            ->  Pass 7: Causal inference (DAG construction)

POST-PASS INTELLIGENCE (new)
  Community detection (Louvain/Leiden on notebook graph)
  Gap analysis (structural holes between clusters)
  Temporal evolution (sliding-window graph dynamics)
  Synthesis engine (LLM cluster summaries)
```

Two-mode deployment contract (NEVER BREAK THIS):
- PRODUCTION (Railway): spaCy + BM25 + TF-IDF. No PyTorch.
- LOCAL/DEV: All passes active. PyTorch + FAISS + sentence-transformers.
- MODAL (GPU): Heavy NLP jobs dispatched via Modal serverless functions.

---

## File Map

All engine code lives in `research_api/apps/notebook/`.
NLP infrastructure lives in `research_api/apps/research/`.

| File | Role | Modified by |
|------|------|------------|
| `engine.py` | Main orchestrator, all passes | Batches 1-7 |
| `bm25.py` (NEW) | BM25 index with caching | Batch 2 |
| `adaptive_ner.py` (NEW) | Graph-learned PhraseMatcher + spaCy NER | Batch 1 |
| `claim_decomposition.py` (NEW) | LLM claim extraction + claim-pair NLI | Batch 5 |
| `causal_engine.py` (NEW) | Temporal entailment chains, DAG builder | Batch 7 |
| `community.py` (NEW) | Louvain/Leiden community detection | Batch 8 |
| `gap_analysis.py` (NEW) | Structural hole detection | Batch 9 |
| `temporal_evolution.py` (NEW) | Sliding-window graph dynamics | Batch 10 |
| `synthesis.py` (NEW) | LLM cluster summarization | Batch 11 |
| `vector_store.py` | FAISS ANN index | Batch 4 |
| `models.py` | Edge types, Cluster model, ClaimStore | Batches 5, 7, 8 |
| `signals.py` | Cache invalidation hooks | Batches 2, 8 |
| `tasks.py` | RQ task wrappers | All batches |
| `apps/research/advanced_nlp.py` | SBERT + NLI models | Batch 4 |
| `apps/research/clustering.py` | Research-side clustering (existing) | Batch 8 (bridge) |

---

## Batch 1: Adaptive NER (Graph-Learned Entity Recognition)

### Read first
- `apps/notebook/engine.py` (Pass 1: extract_entities)
- `apps/notebook/models.py` (Object, ObjectType, ResolvedEntity)
- `apps/research/advanced_nlp.py` (spaCy model loading)

### Concept

Standard spaCy NER recognizes fixed entity types (PERSON, ORG, GPE).
Adaptive NER adds a second tier: a spaCy PhraseMatcher trained on
the graph's own Objects. Every existing Object title becomes a
recognition pattern for its ObjectType. The more you use CommonPlace,
the better it recognizes your vocabulary.

PhraseMatcher uses the Aho-Corasick algorithm internally: O(n) in
text length regardless of pattern count. This is fast enough to run
on every Object save.

### New file: `apps/notebook/adaptive_ner.py`

```python
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
```

### Changes to `engine.py`

In `extract_entities()`, after the spaCy NER loop, add:

```python
# Tier 2: Graph-learned entity recognition
try:
    from .adaptive_ner import extract_graph_entities
    graph_entities = extract_graph_entities(obj, nlp, config)

    for ent_text, type_slug, start, end in graph_entities:
        normalized = ent_text.lower().strip()

        # Skip if spaCy already found this entity
        if ResolvedEntity.objects.filter(
            source_object=obj,
            normalized_text=normalized,
        ).exists():
            continue

        # Find the matching Object
        from .models import ObjectType
        resolved_object = (
            Object.objects
            .filter(
                object_type__slug=type_slug,
                is_deleted=False,
            )
            .filter(
                Q(title__iexact=ent_text)
                | Q(search_text__icontains=normalized)
            )
            .first()
        )

        if not resolved_object or resolved_object.id == obj.id:
            continue

        # Map ObjectType slug to spaCy entity type label
        SLUG_TO_ENTITY_TYPE = {
            'person': 'PERSON', 'organization': 'ORG',
            'place': 'GPE', 'event': 'EVENT',
            'source': 'WORK_OF_ART', 'concept': 'CONCEPT',
        }
        entity_type = SLUG_TO_ENTITY_TYPE.get(type_slug, type_slug.upper())

        entity = ResolvedEntity.objects.create(
            source_object=obj,
            text=ent_text,
            entity_type=entity_type,
            normalized_text=normalized,
            resolved_object=resolved_object,
        )
        entities.append(entity)

        # Create edge
        Edge.objects.get_or_create(
            from_object=obj,
            to_object=resolved_object,
            edge_type='mentions',
            defaults={
                'reason': f'Mentions {ent_text} (recognized from knowledge graph).',
                'strength': 0.75,
                'is_auto': True,
                'engine': 'graph_ner',
            },
        )

except Exception as exc:
    logger.debug('Graph-learned NER failed: %s', exc)
```

### Changes to `signals.py`

Add invalidation hook:

```python
from .adaptive_ner import invalidate_graph_matcher_cache

@receiver(post_save, sender=Object)
def invalidate_ner_cache_on_save(sender, instance, created, **kwargs):
    if created:
        invalidate_graph_matcher_cache()

@receiver(post_delete, sender=Object)
def invalidate_ner_cache_on_delete(sender, instance, **kwargs):
    invalidate_graph_matcher_cache()
```

### Tests

```python
# tests.py additions
def test_adaptive_ner_builds_matchers(self):
    """Graph matcher should include titles from existing Objects."""
    from .adaptive_ner import _build_graph_matchers, invalidate_graph_matcher_cache
    invalidate_graph_matcher_cache()
    # Create a Person object
    person_type = ObjectType.objects.get(slug='person')
    Object.objects.create(
        title='Richard Hamming',
        object_type=person_type,
        sha_hash=_generate_sha('hamming'),
    )
    matchers = _build_graph_matchers(nlp)
    self.assertIn('person', matchers)

def test_adaptive_ner_finds_graph_entities(self):
    """Graph NER should recognize Object titles in new text."""
    from .adaptive_ner import extract_graph_entities, invalidate_graph_matcher_cache
    invalidate_graph_matcher_cache()
    person_type = ObjectType.objects.get(slug='person')
    Object.objects.create(
        title='Richard Hamming',
        object_type=person_type,
        sha_hash=_generate_sha('hamming'),
    )
    note = Object.objects.create(
        title='Test note',
        body='I was reading about Richard Hamming and error correction.',
        sha_hash=_generate_sha('test'),
    )
    results = extract_graph_entities(note, nlp)
    texts = [r[0] for r in results]
    self.assertTrue(any('hamming' in t for t in texts))
```

### Verification

- [ ] Graph matchers build from existing Objects
- [ ] PhraseMatcher recognizes Object titles in new text
- [ ] Entities from graph NER create ResolvedEntity + Edge records
- [ ] Engine label is `graph_ner` (distinguishable from `spacy`)
- [ ] Cache invalidates on Object create/delete
- [ ] `python manage.py test apps.notebook` passes

---

## Batch 2: BM25 Unified Lexical Pass (Replaces Jaccard + TF-IDF)

### Read first
- `apps/notebook/engine.py` (Pass 3: find_topic_connections, Pass 4: _run_tfidf_engine)
- `apps/notebook/engine.py` (_extract_keywords, _TFIDF_CACHE)

### Concept

BM25 subsumes both Jaccard and TF-IDF with a single, more principled
ranking function. It adds term frequency saturation (k1 parameter) and
document length normalization (b parameter) that neither Jaccard nor
raw TF-IDF provide.

Formula:
  score(D, Q) = sum over terms t in Q of:
    IDF(t) * (tf(t,D) * (k1 + 1)) / (tf(t,D) + k1 * (1 - b + b * |D|/avgdl))

Where:
  k1 = 1.5 (term frequency saturation)
  b = 0.75 (length normalization, tunable via Novelty Dial)
  IDF(t) = log((N - n(t) + 0.5) / (n(t) + 0.5) + 1)

### New file: `apps/notebook/bm25.py`

```python
"""
BM25 ranking index for the Object corpus.

Replaces both Jaccard (Pass 3) and TF-IDF (Pass 4) with a unified
lexical similarity signal. One pass, better ranking, better explanations.

BM25 is the algorithm behind Elasticsearch and Lucene. It improves on
raw TF-IDF by adding:
1. Term frequency saturation: 10 occurrences != 10x importance
2. Document length normalization: long docs don't dominate short ones
3. Better IDF formula: handles edge cases (terms in all docs, rare terms)

The index is cached and invalidated on Object create/delete (signal-driven).
Rebuilds lazily on first engine call after invalidation.

No PyTorch required. Production-safe.
"""

import logging
import math
import re
import time
from collections import Counter

logger = logging.getLogger(__name__)

STOP_WORDS = {
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
    'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this',
    'that', 'these', 'those', 'it', 'its', 'not', 'no', 'so', 'if',
    'about', 'up', 'out', 'then', 'than', 'also', 'just', 'more',
    'some', 'very', 'how', 'what', 'when', 'where', 'which', 'who',
    'all', 'each', 'every', 'both', 'few', 'most', 'other', 'into',
    'over', 'such', 'only', 'own', 'same', 'here', 'there', 'they',
    'them', 'their', 'my', 'your', 'our',
}


def _tokenize(text):
    """Extract lowercase tokens, 3+ chars, not stop words."""
    words = re.findall(r'\b[a-z]{3,}\b', text.lower())
    return [w for w in words if w not in STOP_WORDS]


class BM25Index:
    """
    BM25 ranking over the Object corpus.

    Build once, query many times. Cached at module level.
    Invalidated by signal on Object create/delete.
    """

    def __init__(self, k1=1.5, b=0.75):
        self.k1 = k1
        self.b = b
        self.corpus_size = 0
        self.avgdl = 0
        self.doc_freqs = Counter()
        self.doc_lens = {}
        self.term_freqs = {}
        self.object_pks = []
        self.built_at = None

    def build(self, objects, text_fn):
        """Build the index from a list of objects."""
        self.object_pks = []
        self.term_freqs = {}
        self.doc_lens = {}
        self.doc_freqs = Counter()

        total_len = 0
        for obj in objects:
            text = text_fn(obj)
            terms = _tokenize(text)
            tf = Counter(terms)

            self.object_pks.append(obj.pk)
            self.term_freqs[obj.pk] = tf
            self.doc_lens[obj.pk] = len(terms)
            total_len += len(terms)

            for term in set(terms):
                self.doc_freqs[term] += 1

        self.corpus_size = len(objects)
        self.avgdl = total_len / max(self.corpus_size, 1)
        self.built_at = time.time()

        logger.info(
            'BM25 index built: %d docs, %d unique terms, avgdl=%.1f',
            self.corpus_size, len(self.doc_freqs), self.avgdl,
        )

    def score_pair(self, query_pk, candidate_pk):
        """BM25 score of candidate relative to query."""
        query_terms = self.term_freqs.get(query_pk, Counter())
        cand_terms = self.term_freqs.get(candidate_pk, Counter())
        cand_len = self.doc_lens.get(candidate_pk, 0)

        if not query_terms or not cand_terms:
            return 0.0

        total = 0.0
        for term in query_terms:
            if term not in cand_terms:
                continue

            n = self.doc_freqs.get(term, 0)
            idf = math.log((self.corpus_size - n + 0.5) / (n + 0.5) + 1)

            tf = cand_terms[term]
            numerator = tf * (self.k1 + 1)
            denominator = tf + self.k1 * (
                1 - self.b + self.b * cand_len / max(self.avgdl, 1)
            )

            total += idf * numerator / denominator

        return total

    def find_similar(self, query_pk, top_n=20, min_score=0.5):
        """Find the top_n most BM25-similar objects to the query."""
        results = []
        for pk in self.object_pks:
            if pk == query_pk:
                continue
            s = self.score_pair(query_pk, pk)
            if s >= min_score:
                results.append((pk, s))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_n]

    def explain_match(self, query_pk, candidate_pk, top_terms=4):
        """
        Return the highest-IDF overlapping terms between query and candidate.
        Used for human-readable edge explanations.
        """
        query_terms = self.term_freqs.get(query_pk, Counter())
        cand_terms = self.term_freqs.get(candidate_pk, Counter())

        overlap = set(query_terms.keys()) & set(cand_terms.keys())
        if not overlap:
            return []

        scored = []
        for term in overlap:
            n = self.doc_freqs.get(term, 0)
            idf = math.log((self.corpus_size - n + 0.5) / (n + 0.5) + 1)
            scored.append((term, idf))

        scored.sort(key=lambda x: x[1], reverse=True)
        return [term for term, _ in scored[:top_terms]]


# Module-level cache
_BM25_CACHE = {
    'index': None,
    'built_at': None,
    'corpus_size': 0,
}
_BM25_MAX_AGE = 3600  # 1 hour


def invalidate_bm25_cache():
    """Signal-driven invalidation."""
    _BM25_CACHE['built_at'] = None


def get_or_build_bm25(text_fn, b_override=None, max_objects=2000):
    """
    Get the cached BM25 index, rebuilding if stale.

    Args:
        text_fn: callable(Object) -> str to extract text from Objects
        b_override: optional override for the b parameter (from Novelty Dial)
        max_objects: maximum corpus size
    """
    from .models import Object

    now = time.time()
    cache = _BM25_CACHE
    current_count = Object.objects.filter(is_deleted=False).count()

    needs_rebuild = (
        cache['index'] is None
        or cache['built_at'] is None
        or (now - cache['built_at']) > _BM25_MAX_AGE
        or abs(current_count - cache['corpus_size']) > 50
    )

    if not needs_rebuild:
        idx = cache['index']
        # Apply b override if provided (Novelty Dial tuning)
        if b_override is not None:
            idx.b = b_override
        return idx

    objects = list(
        Object.objects
        .filter(is_deleted=False)
        .exclude(search_text='')
        .select_related('object_type')
        .order_by('-captured_at')
        [:max_objects]
    )

    if len(objects) < 5:
        return None

    b = b_override if b_override is not None else 0.75
    idx = BM25Index(k1=1.5, b=b)
    idx.build(objects, text_fn)

    cache['index'] = idx
    cache['built_at'] = now
    cache['corpus_size'] = current_count

    return idx
```

### Changes to `engine.py`

Replace `find_topic_connections` and `_run_tfidf_engine` with a unified
BM25 pass:

```python
def _run_bm25_engine(obj, config):
    """
    BM25 unified lexical pass. Replaces Jaccard (Pass 3) + TF-IDF (Pass 4).
    Production-safe: no PyTorch required.
    """
    from .bm25 import get_or_build_bm25, invalidate_bm25_cache

    # Novelty Dial can tune the b parameter:
    # Lower b = less length normalization = short hunches compete with long essays
    novelty = config.get('novelty', 0.5)
    b_override = 0.75 - (novelty * 0.35)  # Range: 0.75 (conservative) to 0.40 (aggressive)

    threshold = config.get('bm25_threshold', 0.5)
    idx = get_or_build_bm25(_build_full_text, b_override=b_override)
    if idx is None:
        return []

    matches = idx.find_similar(obj.pk, top_n=20, min_score=threshold)
    new_edges = []

    for other_pk, score in matches:
        try:
            other = Object.objects.select_related('object_type').get(
                pk=other_pk, is_deleted=False,
            )
        except Object.DoesNotExist:
            continue

        # Generate explanation from highest-IDF overlapping terms
        top_terms = idx.explain_match(obj.pk, other_pk, top_terms=4)
        if top_terms:
            term_str = ', '.join(top_terms[:-1]) + f' and {top_terms[-1]}' if len(top_terms) > 1 else top_terms[0]
            reason = f'Both discuss {term_str} (rare terms in your corpus).'
        else:
            type_a = obj.object_type.name.lower() if obj.object_type else 'note'
            type_b = other.object_type.name.lower() if other.object_type else 'note'
            reason = f'This {type_a} and this {type_b} share significant vocabulary (BM25: {score:.0%}).'

        # Try LLM explanation for strong matches
        reason = _llm_explanation(obj, other, strength=score) or reason

        strength = min(score / 5.0, 1.0)  # Normalize BM25 scores to 0-1 range

        edge, created = Edge.objects.get_or_create(
            from_object=obj,
            to_object=other,
            edge_type='shared_topic',
            defaults={
                'reason': reason,
                'strength': round(strength, 4),
                'is_auto': True,
                'engine': 'bm25',
            },
        )
        if created:
            new_edges.append(edge)

    return new_edges
```

In `run_engine()`, replace the Jaccard and TF-IDF calls:

```python
# OLD:
# edges_from_topics = find_topic_connections(obj, config)
# edges_from_tfidf = _run_tfidf_engine(obj, config)

# NEW:
edges_from_bm25 = _run_bm25_engine(obj, config)
```

### Changes to `signals.py`

```python
from .bm25 import invalidate_bm25_cache

@receiver(post_save, sender=Object)
def invalidate_bm25_on_save(sender, instance, created, **kwargs):
    if created:
        invalidate_bm25_cache()

@receiver(post_delete, sender=Object)
def invalidate_bm25_on_delete(sender, instance, **kwargs):
    invalidate_bm25_cache()
```

### Changes to `interpolate_config`

Add BM25 threshold to the Novelty Dial interpolation:

```python
'bm25_threshold': (
    1.5 - (1.5 - 0.3) * novelty  # Range: 1.5 (conservative) to 0.3 (aggressive)
),
```

### Verification

- [ ] BM25 index builds from Object corpus
- [ ] `find_similar` returns ranked results
- [ ] `explain_match` returns highest-IDF overlapping terms
- [ ] Edge explanations reference specific rare terms
- [ ] Novelty Dial tunes b parameter and threshold
- [ ] Cache invalidates on Object create/delete
- [ ] Old Jaccard and TF-IDF passes still exist (deprecation, not deletion)
- [ ] `python manage.py test apps.notebook` passes

---

## Batch 3: Edge Type and Model Migrations

### Read first
- `apps/notebook/models.py` (Edge, edge_type choices)

### Changes to Edge model

Add new edge types for the upgraded passes:

```python
edge_type = models.CharField(
    max_length=30,
    choices=[
        # Existing
        ('mentions', 'Mentions'),
        ('shared_entity', 'Shared Entity'),
        ('shared_topic', 'Shared Topic'),
        ('similarity', 'Similarity'),
        ('sequence', 'Sequence'),
        ('supports', 'Supports'),
        ('contradicts', 'Contradicts'),
        ('inspires', 'Inspires'),
        ('related', 'Related'),
        ('manual', 'Manual'),
        # New
        ('semantic', 'Semantic'),
        ('structural', 'Structural (KGE)'),
        ('causal', 'Causal Influence'),
        ('entailment', 'Entailment'),
    ],
    default='manual',
    db_index=True,
)
```

Add engine choices expansion:

```python
engine = models.CharField(
    max_length=30,  # increased from 20
    blank=True,
    help_text=(
        'Which engine found this: spacy, graph_ner, bm25, sbert, '
        'sbert_faiss, nli, kge, kge_temporal, causal, manual.'
    ),
)
```

### New model: Cluster

```python
class Cluster(TimeStampedModel):
    """A detected community in the knowledge graph.

    Produced by community detection (Louvain/Leiden). Each Object
    can belong to at most one Cluster at a time. Clusters are
    recomputed periodically and on significant graph changes.
    """
    name = models.CharField(max_length=200, blank=True)
    slug = models.SlugField(max_length=200, blank=True)
    notebook = models.ForeignKey(
        'Notebook', on_delete=models.CASCADE,
        null=True, blank=True, related_name='clusters',
    )
    label_tags = models.JSONField(
        default=list, blank=True,
        help_text='Auto-generated label from top entity/topic tags.',
    )
    modularity_score = models.FloatField(
        default=0.0,
        help_text='Cluster quality metric from community detection.',
    )
    member_count = models.IntegerField(default=0)
    summary = models.TextField(
        blank=True,
        help_text='LLM-generated summary of cluster themes.',
    )
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-member_count']

    def __str__(self):
        return self.name or f'Cluster {self.pk}'
```

### New model: ClaimStore

```python
class Claim(TimeStampedModel):
    """An atomic propositional claim extracted from an Object.

    Claims are the unit of analysis for NLI stance detection and
    causal inference. Each Object decomposes into 1-20 claims.
    Claims are indexed for pairwise NLI comparison.
    """
    source_object = models.ForeignKey(
        Object, on_delete=models.CASCADE, related_name='claims',
    )
    text = models.TextField(
        help_text='A single falsifiable assertion extracted from the Object.',
    )
    claim_index = models.IntegerField(
        default=0,
        help_text='Position of this claim within the source Object.',
    )
    embedding = models.BinaryField(
        null=True, blank=True,
        help_text='SBERT embedding as bytes (for FAISS indexing).',
    )

    class Meta:
        ordering = ['source_object', 'claim_index']
        indexes = [
            models.Index(fields=['source_object'], name='idx_claim_source'),
        ]

    def __str__(self):
        return f'Claim {self.claim_index} from "{self.source_object.display_title[:30]}"'
```

Add cluster FK to Object:

```python
# In Object model, add:
cluster = models.ForeignKey(
    'Cluster', on_delete=models.SET_NULL,
    null=True, blank=True, related_name='members',
)
```

### Migration

```bash
python manage.py makemigrations notebook
python manage.py migrate
```

### Verification

- [ ] Migration applies cleanly
- [ ] New edge types are available
- [ ] Cluster model creates and queries correctly
- [ ] Claim model creates and queries correctly
- [ ] Object.cluster FK works
- [ ] `python manage.py test` passes

---

## Batch 4: Instruction-Tuned SBERT (E5/Nomic Embeddings)

### Read first
- `apps/research/advanced_nlp.py` (get_sentence_model, encode_text, find_most_similar)
- `apps/notebook/vector_store.py` (SBERTIndex, faiss_find_similar_objects)
- `apps/notebook/engine.py` (_run_semantic_engine)

### Concept

Replace all-MiniLM-L6-v2 with an instruction-tuned model (Nomic-embed-text
or intfloat/e5-base-v2). Instruction-tuned models accept a task prefix
that changes the embedding space:

  "search_query: find documents on the same topic as..."
  "search_query: find documents that contradict..."

This enables two-stage retrieval: fast FAISS screening with task-specific
embeddings, then precise NLI cross-encoder on top candidates only.

### Changes to `apps/research/advanced_nlp.py`

```python
# New model options (configurable via env var)
SBERT_MODEL = os.environ.get(
    'SBERT_MODEL',
    'nomic-ai/nomic-embed-text-v1.5',  # instruction-tuned, 768-dim
)
SBERT_FALLBACK = 'all-MiniLM-L6-v2'  # original model as fallback

# Instruction prefixes for different retrieval tasks
INSTRUCTION_PREFIXES = {
    'similarity': 'search_query: ',
    'contradiction': 'search_query: find claims that contradict: ',
    'influence': 'search_query: find documents influenced by: ',
    'topic': 'search_document: ',
}


def get_sentence_model():
    global _sentence_model
    if _sentence_model is not None:
        return _sentence_model
    if not HAS_PYTORCH:
        return None
    try:
        _sentence_model = SentenceTransformer(SBERT_MODEL, trust_remote_code=True)
        logger.info('Loaded sentence-transformer: %s', SBERT_MODEL)
        return _sentence_model
    except Exception:
        try:
            _sentence_model = SentenceTransformer(SBERT_FALLBACK)
            logger.info('Loaded fallback sentence-transformer: %s', SBERT_FALLBACK)
            return _sentence_model
        except Exception as e:
            logger.error('Failed to load any sentence-transformer: %s', e)
            return None


def encode_with_instruction(text, task='similarity'):
    """Encode text with a task-specific instruction prefix."""
    model = get_sentence_model()
    if model is None:
        return None
    prefix = INSTRUCTION_PREFIXES.get(task, '')
    try:
        return model.encode(prefix + text, convert_to_numpy=True)
    except Exception as e:
        logger.error('Instruction-tuned encoding failed: %s', e)
        return None
```

### Changes to `engine.py` `_run_semantic_engine`

Use instruction-tuned encoding for the query:

```python
# In _run_semantic_engine, replace:
#   my_text = _build_full_text(obj)
#   matches = find_most_similar(target_text=my_text, ...)
# With:
my_text = _build_full_text(obj)
try:
    from apps.research.advanced_nlp import encode_with_instruction
    # Encode with similarity instruction
    my_vec = encode_with_instruction(my_text, task='similarity')
    if my_vec is not None:
        # Use FAISS with the instruction-tuned vector
        # ... (rest of FAISS search logic unchanged)
        pass
except ImportError:
    pass  # Fall back to existing behavior
```

### Modal integration for GPU encoding

For batch re-encoding the entire corpus (e.g., when switching models),
create a Modal function:

```python
# scripts/modal_encode.py
import modal

app = modal.App("commonplace-encode")
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "sentence-transformers", "torch", "numpy", "faiss-cpu",
)

@app.function(image=image, gpu="T4", timeout=600)
def batch_encode_corpus(texts: list[str], model_name: str) -> list[list[float]]:
    """Encode a batch of texts on a GPU via Modal."""
    from sentence_transformers import SentenceTransformer
    import numpy as np

    model = SentenceTransformer(model_name, trust_remote_code=True)
    embeddings = model.encode(
        texts,
        convert_to_numpy=True,
        show_progress_bar=True,
        batch_size=64,
    )
    return embeddings.tolist()
```

### Verification

- [ ] Instruction-tuned model loads (local dev with PyTorch)
- [ ] Fallback to all-MiniLM-L6-v2 if primary model unavailable
- [ ] `encode_with_instruction` produces different vectors for different tasks
- [ ] Semantic engine uses new model when available
- [ ] Production mode gracefully skips (no PyTorch)
- [ ] Modal batch encode function works (if Modal configured)
- [ ] `python manage.py test` passes

---

## Batch 5: Claim-Level NLI Stance Detection

### Read first
- `apps/research/advanced_nlp.py` (classify_relationship, NLI_LABELS)
- `apps/notebook/engine.py` (_run_nli_contradiction_pass)
- `apps/research/tensions.py`

### Concept

Current NLI compares entire document pairs. This produces coarse results:
"these two documents contradict." Claim-level NLI decomposes each Object
into atomic claims, then runs NLI on claim pairs. This tells you exactly
WHICH claims disagree and how strongly.

Step 1: Claim decomposition (LLM or rule-based)
Step 2: Claim-pair NLI (cross-encoder on specific claim pairs)
Step 3: Aggregate to object-level stance with claim-level provenance

### New file: `apps/notebook/claim_decomposition.py`

```python
"""
Claim decomposition: break Objects into atomic propositional claims.

An atomic claim is a single statement that can be true or false.
"Jane Jacobs argued that mixed-use neighborhoods are safer" is one claim.
"She also believed that highways destroy communities" is another.

Two decomposition strategies:
1. LLM-based (requires ANTHROPIC_API_KEY): most accurate, handles nuance
2. Rule-based (spaCy sentence splitting): fast, no API needed, coarser

The LLM strategy uses Claude's API with structured JSON output.
The rule-based strategy splits on sentence boundaries and filters
for sentences containing assertion verbs or propositional structure.
"""

import json
import logging
import os

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
LLM_DECOMPOSITION_ENABLED = bool(ANTHROPIC_API_KEY) and os.environ.get(
    'CLAIM_DECOMPOSITION_LLM', 'false'
).lower() == 'true'


def decompose_claims_llm(text, max_claims=20):
    """
    Decompose text into atomic claims using Claude API.

    Returns list of claim strings. Each claim is a single sentence
    making one falsifiable assertion.
    """
    if not ANTHROPIC_API_KEY:
        return []

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        response = client.messages.create(
            model='claude-sonnet-4-20250514',
            max_tokens=1000,
            messages=[{
                'role': 'user',
                'content': (
                    'Break the following text into atomic propositional claims. '
                    'Each claim should be ONE sentence that makes a single '
                    'falsifiable assertion. Return ONLY a JSON array of strings. '
                    'No preamble, no markdown backticks.\n\n'
                    f'Text: {text[:3000]}'
                ),
            }],
        )

        raw = response.content[0].text.strip()
        # Strip markdown fences if present
        if raw.startswith('```'):
            raw = raw.split('\n', 1)[1].rsplit('```', 1)[0]
        claims = json.loads(raw)

        if isinstance(claims, list):
            return [str(c) for c in claims[:max_claims]]
        return []

    except Exception as exc:
        logger.warning('LLM claim decomposition failed: %s', exc)
        return []


def decompose_claims_rule_based(text, nlp=None):
    """
    Decompose text into claims using spaCy sentence splitting.

    Simpler than LLM but catches most propositional sentences.
    Filters for sentences with assertion structure (subject + verb + object).
    """
    if nlp is None:
        try:
            import spacy
            nlp = spacy.load('en_core_web_md')
        except Exception:
            return []

    doc = nlp(text)
    claims = []

    for sent in doc.sents:
        sent_text = sent.text.strip()
        # Filter: minimum length, must have a verb
        if len(sent_text) < 20:
            continue
        has_verb = any(token.pos_ == 'VERB' for token in sent)
        if has_verb:
            claims.append(sent_text)

    return claims[:20]


def decompose_claims(text, nlp=None):
    """
    Decompose text into claims using the best available strategy.
    LLM if enabled and available, rule-based otherwise.
    """
    if LLM_DECOMPOSITION_ENABLED:
        claims = decompose_claims_llm(text)
        if claims:
            return claims

    return decompose_claims_rule_based(text, nlp=nlp)
```

### Changes to `engine.py` `_run_nli_contradiction_pass`

Replace document-level NLI with claim-level:

```python
def _run_nli_contradiction_pass(obj, config):
    """
    Claim-level NLI stance detection.

    1. Decompose the Object into claims
    2. For each claim, find semantically similar claims in other Objects
       (two-stage: FAISS screening, then NLI cross-encoder)
    3. Run NLI on claim pairs
    4. Create edges with claim-level provenance
    """
    if not _SBERT_AVAILABLE:
        return []

    from .claim_decomposition import decompose_claims
    from .models import Claim

    # Step 1: Decompose this Object's claims
    text = _build_full_text(obj)
    claim_texts = decompose_claims(text, nlp=nlp)
    if not claim_texts:
        return []

    # Store claims
    Claim.objects.filter(source_object=obj).delete()  # Replace old claims
    for i, claim_text in enumerate(claim_texts):
        Claim.objects.create(
            source_object=obj,
            text=claim_text,
            claim_index=i,
        )

    # Step 2: Find candidate Objects with semantically similar claims
    # (use existing SBERT infrastructure)
    from apps.research.advanced_nlp import (
        classify_relationship, sentence_similarity,
    )

    max_candidates = config.get('max_candidates', 500)
    candidates = list(
        Object.objects
        .filter(is_deleted=False, claims__isnull=False)
        .exclude(pk=obj.pk)
        .distinct()
        .order_by('-captured_at')
        [:max_candidates]
    )

    new_edges = []

    for other in candidates:
        other_claims = list(other.claims.values_list('text', flat=True))
        if not other_claims:
            continue

        # Step 3: Check each claim pair
        best_contradiction = None
        best_entailment = None

        for my_claim in claim_texts:
            for their_claim in other_claims:
                # Quick similarity screen
                sim = sentence_similarity(my_claim, their_claim)
                if sim is None or sim < 0.3:
                    continue

                # Full NLI classification
                result = classify_relationship(my_claim, their_claim)
                if result is None:
                    continue

                contra_prob = result['probabilities']['contradiction']
                entail_prob = result['probabilities']['entailment']

                if contra_prob > 0.6 and (
                    best_contradiction is None
                    or contra_prob > best_contradiction['score']
                ):
                    best_contradiction = {
                        'score': contra_prob,
                        'my_claim': my_claim,
                        'their_claim': their_claim,
                        'similarity': sim,
                    }

                if entail_prob > 0.6 and (
                    best_entailment is None
                    or entail_prob > best_entailment['score']
                ):
                    best_entailment = {
                        'score': entail_prob,
                        'my_claim': my_claim,
                        'their_claim': their_claim,
                        'similarity': sim,
                    }

        # Step 4: Create edges with claim-level provenance
        if best_contradiction and best_contradiction['score'] > 0.6:
            c = best_contradiction
            reason = (
                f'Claim conflict detected. '
                f'This object states: "{c["my_claim"][:80]}..." '
                f'which contradicts: "{c["their_claim"][:80]}..." '
                f'(confidence: {c["score"]:.0%})'
            )
            edge, created = Edge.objects.get_or_create(
                from_object=obj,
                to_object=other,
                edge_type='contradicts',
                defaults={
                    'reason': reason,
                    'strength': round(c['score'], 4),
                    'is_auto': True,
                    'engine': 'nli',
                },
            )
            if created:
                new_edges.append(edge)

        if best_entailment and best_entailment['score'] > 0.7:
            e = best_entailment
            reason = (
                f'These share a supporting claim. '
                f'"{e["my_claim"][:80]}..." aligns with '
                f'"{e["their_claim"][:80]}..." '
                f'(confidence: {e["score"]:.0%})'
            )
            edge, created = Edge.objects.get_or_create(
                from_object=obj,
                to_object=other,
                edge_type='entailment',
                defaults={
                    'reason': reason,
                    'strength': round(e['score'], 4),
                    'is_auto': True,
                    'engine': 'nli',
                },
            )
            if created:
                new_edges.append(edge)

    return new_edges
```

### Verification

- [ ] Claim decomposition works (LLM and rule-based)
- [ ] Claims stored in Claim model
- [ ] Claim-level NLI finds specific conflicting claims
- [ ] Edge reasons cite the specific claims that conflict
- [ ] Entailment edges created for strongly supporting claim pairs
- [ ] Graceful degradation without PyTorch
- [ ] `python manage.py test` passes

---

## Batch 6: Temporal KGE (DE-SimplE)

### Read first
- `apps/notebook/vector_store.py` (KGEStore)
- `scripts/train_kge.py`
- ENGINE-CLAUDE.md (Phase 6 KGE section)

### Concept

RotatE embeds (head, relation, tail) triples. DE-SimplE extends this
with temporal encoding: (head, relation, tail, time). Entity embeddings
become time-dependent via learned temporal modulation functions.

The key addition: predict connections that SHOULD exist based on how
the graph has evolved over time.

### Changes to `scripts/train_kge.py`

Add DE-SimplE training alongside RotatE:

```python
# After RotatE training, add:
from pykeen.models import TTransE  # or implement DE-SimplE manually

# Export temporal triples: (head, relation, tail, timestamp_bucket)
# Bucket timestamps into weekly intervals for training stability
```

### Changes to `vector_store.py` KGEStore

```python
class TemporalKGEStore(KGEStore):
    """
    Extension of KGEStore that supports temporal embeddings.

    Loads DE-SimplE or TTransE embeddings that encode time-dependent
    entity representations. find_similar_entities gains a `time_point`
    parameter that returns entities similar at a specific point in time.
    """

    def __init__(self, embeddings_dir=None):
        super().__init__(embeddings_dir)
        self.temporal_embeddings = None
        self.time_buckets = None

    def find_emerging_connections(self, sha_hash, lookback_weeks=4, top_n=10):
        """
        Find entities whose similarity to sha_hash is INCREASING over time.

        Compares similarity at time T (now) vs time T-lookback.
        Returns entities where similarity(T) > similarity(T-lookback)
        by at least a threshold, suggesting an emerging connection.
        """
        if not self.is_loaded or self.temporal_embeddings is None:
            return []
        # ... implementation using temporal embedding interpolation
        pass
```

### Verification

- [ ] Temporal triples exported with time buckets
- [ ] DE-SimplE/TTransE model trains via PyKEEN
- [ ] TemporalKGEStore loads temporal embeddings
- [ ] `find_emerging_connections` returns entities with increasing similarity
- [ ] Engine creates edges with engine='kge_temporal'
- [ ] `python manage.py test` passes

---

## Batch 7: Causal Inference Engine

### Read first
- Batch 5 output (Claim model, decompose_claims)
- `apps/notebook/engine.py` (all passes for context)
- `apps/notebook/models.py` (Node, Timeline for temporal ordering)

### New file: `apps/notebook/causal_engine.py`

```python
"""
Causal inference engine: detect influence chains between Objects.

Given a graph of Objects with:
- Temporal ordering (captured_at timestamps)
- Claim-level decomposition (from Batch 5)
- NLI entailment relationships (from Batch 5)

This engine constructs a Directed Acyclic Graph (DAG) of causal
influence. An edge from A to B means "A's claims influenced B's claims."

Three conditions for a causal edge:
1. A was created before B (temporal precedence)
2. A and B share at least one entailing claim pair (content transfer)
3. There is no C such that C created before A, and C entails B
   more strongly (no confounding intermediary, simplified)

This is NOT true causal inference in the Pearl/Rubin sense.
It is influence detection using temporal ordering + entailment as proxies.
The DAG represents "intellectual lineage" not formal causation.
"""

import logging
from collections import defaultdict

from django.db.models import Q

logger = logging.getLogger(__name__)


def build_influence_dag(notebook=None, min_entailment=0.6):
    """
    Construct a DAG of causal influence between Objects.

    Returns:
        {
            'nodes': [{'pk': int, 'title': str, 'captured_at': str}],
            'edges': [
                {
                    'from_pk': int,
                    'to_pk': int,
                    'strength': float,
                    'claim_pair': {'from_claim': str, 'to_claim': str},
                }
            ],
            'roots': [int],  # PKs of Objects with no incoming influence
            'leaves': [int],  # PKs of Objects with no outgoing influence
        }
    """
    from .models import Object, Edge

    # Get all entailment edges
    entailment_edges = Edge.objects.filter(
        edge_type='entailment',
        strength__gte=min_entailment,
    ).select_related('from_object', 'to_object')

    if not entailment_edges.exists():
        return {'nodes': [], 'edges': [], 'roots': [], 'leaves': []}

    # Filter to temporal precedence (from created before to)
    causal_edges = []
    node_pks = set()

    for edge in entailment_edges:
        if edge.from_object.captured_at < edge.to_object.captured_at:
            causal_edges.append({
                'from_pk': edge.from_object.pk,
                'to_pk': edge.to_object.pk,
                'strength': edge.strength,
                'reason': edge.reason,
            })
            node_pks.add(edge.from_object.pk)
            node_pks.add(edge.to_object.pk)

    # Build node list
    objects = Object.objects.filter(pk__in=node_pks).order_by('captured_at')
    nodes = [
        {
            'pk': obj.pk,
            'title': obj.display_title,
            'captured_at': obj.captured_at.isoformat(),
            'type': obj.object_type.slug if obj.object_type else 'note',
        }
        for obj in objects
    ]

    # Find roots (no incoming) and leaves (no outgoing)
    incoming = {e['to_pk'] for e in causal_edges}
    outgoing = {e['from_pk'] for e in causal_edges}
    roots = list(node_pks - incoming)
    leaves = list(node_pks - outgoing)

    return {
        'nodes': nodes,
        'edges': causal_edges,
        'roots': roots,
        'leaves': leaves,
    }


def trace_lineage(object_pk, direction='ancestors', max_depth=10):
    """
    Trace the causal lineage of an Object.

    direction='ancestors': what influenced this Object?
    direction='descendants': what did this Object influence?

    Returns a list of (Object, depth, edge_reason) tuples
    in breadth-first order.
    """
    from .models import Object, Edge

    visited = set()
    queue = [(object_pk, 0)]
    lineage = []

    while queue:
        current_pk, depth = queue.pop(0)
        if current_pk in visited or depth > max_depth:
            continue
        visited.add(current_pk)

        if direction == 'ancestors':
            edges = Edge.objects.filter(
                to_object_id=current_pk,
                edge_type__in=['entailment', 'causal'],
            ).select_related('from_object')
            for edge in edges:
                if edge.from_object.captured_at < edge.to_object.captured_at:
                    lineage.append((edge.from_object, depth + 1, edge.reason))
                    queue.append((edge.from_object.pk, depth + 1))
        else:
            edges = Edge.objects.filter(
                from_object_id=current_pk,
                edge_type__in=['entailment', 'causal'],
            ).select_related('to_object')
            for edge in edges:
                if edge.from_object.captured_at < edge.to_object.captured_at:
                    lineage.append((edge.to_object, depth + 1, edge.reason))
                    queue.append((edge.to_object.pk, depth + 1))

    return lineage
```

### Verification

- [ ] `build_influence_dag` produces a valid DAG structure
- [ ] Temporal precedence enforced (no backward edges)
- [ ] `trace_lineage` returns ancestors and descendants
- [ ] Roots and leaves correctly identified
- [ ] `python manage.py test` passes

---

## Batch 8: Community Detection (Louvain/Leiden)

### Read first
- `apps/research/clustering.py` (existing Ward clustering)
- `apps/notebook/models.py` (Cluster model from Batch 3)
- `apps/notebook/engine.py` (Edge model, graph structure)

### New file: `apps/notebook/community.py`

```python
"""
Community detection for the CommonPlace knowledge graph.

Uses the Louvain algorithm (via NetworkX) to discover natural
communities (clusters of densely connected Objects). Unlike the
research-side clustering.py which uses agglomerative clustering
on feature vectors, this operates directly on the graph structure.

Modularity maximization: find the partition of nodes where
within-community edges are denser than expected by chance.
The modularity score Q ranges from -0.5 to 1.0, with higher
values indicating more pronounced community structure.

The Louvain algorithm is O(n log n) in practice, making it
fast enough to run on every significant graph change.
"""

import logging
from collections import Counter, defaultdict

import networkx as nx

logger = logging.getLogger(__name__)


def build_networkx_graph(notebook=None):
    """
    Build a NetworkX graph from the Edge table.

    Returns a weighted undirected graph where:
    - Nodes are Object PKs
    - Edges have weight = Edge.strength
    - Node attributes include object_type slug and title
    """
    from .models import Edge, Object

    G = nx.Graph()

    edges_qs = Edge.objects.filter(
        from_object__is_deleted=False,
        to_object__is_deleted=False,
    ).select_related('from_object__object_type', 'to_object__object_type')

    if notebook:
        edges_qs = edges_qs.filter(
            from_object__notebook=notebook,
        )

    for edge in edges_qs:
        from_pk = edge.from_object.pk
        to_pk = edge.to_object.pk

        if not G.has_node(from_pk):
            G.add_node(from_pk, **{
                'title': edge.from_object.display_title,
                'type': edge.from_object.object_type.slug if edge.from_object.object_type else 'note',
            })
        if not G.has_node(to_pk):
            G.add_node(to_pk, **{
                'title': edge.to_object.display_title,
                'type': edge.to_object.object_type.slug if edge.to_object.object_type else 'note',
            })

        # If edge already exists, use max weight
        if G.has_edge(from_pk, to_pk):
            G[from_pk][to_pk]['weight'] = max(
                G[from_pk][to_pk]['weight'], edge.strength,
            )
        else:
            G.add_edge(from_pk, to_pk, weight=edge.strength)

    return G


def detect_communities(notebook=None, resolution=1.0):
    """
    Run Louvain community detection on the knowledge graph.

    Args:
        notebook: optional Notebook to scope to
        resolution: Louvain resolution parameter.
            Higher = more smaller communities.
            Lower = fewer larger communities.
            Default 1.0 is standard.

    Returns:
        {
            'communities': [
                {
                    'id': int,
                    'member_pks': [int],
                    'size': int,
                    'label': str,
                    'modularity_contribution': float,
                }
            ],
            'modularity': float,
            'n_communities': int,
            'n_nodes': int,
            'n_edges': int,
        }
    """
    G = build_networkx_graph(notebook)

    if G.number_of_nodes() < 3:
        return {
            'communities': [],
            'modularity': 0.0,
            'n_communities': 0,
            'n_nodes': G.number_of_nodes(),
            'n_edges': G.number_of_edges(),
        }

    # Run Louvain
    from networkx.algorithms.community import louvain_communities

    communities = louvain_communities(G, resolution=resolution, seed=42)
    modularity = nx.algorithms.community.modularity(G, communities)

    # Build result
    result_communities = []
    for i, community_nodes in enumerate(communities):
        pks = list(community_nodes)

        # Label: most common object type + top entity in the community
        types = Counter()
        for pk in pks:
            if pk in G.nodes:
                types[G.nodes[pk].get('type', 'note')] += 1

        top_type = types.most_common(1)[0][0] if types else 'mixed'
        label = f'{top_type} cluster ({len(pks)} objects)'

        result_communities.append({
            'id': i,
            'member_pks': pks,
            'size': len(pks),
            'label': label,
            'top_types': dict(types.most_common(3)),
        })

    result_communities.sort(key=lambda c: c['size'], reverse=True)

    return {
        'communities': result_communities,
        'modularity': round(modularity, 4),
        'n_communities': len(result_communities),
        'n_nodes': G.number_of_nodes(),
        'n_edges': G.number_of_edges(),
    }


def persist_communities(communities_result, notebook=None):
    """
    Save detected communities to the Cluster model.

    Replaces existing clusters for the notebook.
    Updates Object.cluster FK for each member.
    """
    from .models import Cluster, Object

    # Clear old clusters
    Cluster.objects.filter(notebook=notebook).delete()

    for comm in communities_result.get('communities', []):
        cluster = Cluster.objects.create(
            name=comm['label'],
            notebook=notebook,
            label_tags=list(comm.get('top_types', {}).keys()),
            modularity_score=communities_result.get('modularity', 0),
            member_count=comm['size'],
        )

        Object.objects.filter(pk__in=comm['member_pks']).update(cluster=cluster)
```

### New management command

```python
# apps/notebook/management/commands/detect_communities.py
from django.core.management.base import BaseCommand
from apps.notebook.community import detect_communities, persist_communities


class Command(BaseCommand):
    help = 'Run community detection on the knowledge graph'

    def add_arguments(self, parser):
        parser.add_argument('--notebook', type=str, default=None)
        parser.add_argument('--resolution', type=float, default=1.0)
        parser.add_argument('--persist', action='store_true')

    def handle(self, *args, **options):
        from apps.notebook.models import Notebook

        notebook = None
        if options['notebook']:
            notebook = Notebook.objects.get(slug=options['notebook'])

        result = detect_communities(
            notebook=notebook,
            resolution=options['resolution'],
        )

        self.stdout.write(
            f"Found {result['n_communities']} communities "
            f"(modularity: {result['modularity']:.3f}) "
            f"across {result['n_nodes']} nodes and {result['n_edges']} edges"
        )

        for comm in result['communities']:
            self.stdout.write(f"  {comm['label']}: {comm['size']} members")

        if options['persist']:
            persist_communities(result, notebook=notebook)
            self.stdout.write(self.style.SUCCESS('Communities persisted to database.'))
```

### Verification

- [ ] NetworkX graph builds from Edge table
- [ ] Louvain finds reasonable communities
- [ ] Modularity score is positive for structured graphs
- [ ] Communities persist to Cluster model
- [ ] Object.cluster updated for each member
- [ ] Management command works
- [ ] `python manage.py test` passes

---

## Batch 9: Gap Analysis (Structural Holes)

### Read first
- Batch 8 output (community.py, build_networkx_graph)
- `apps/notebook/models.py` (Cluster)

### New file: `apps/notebook/gap_analysis.py`

```python
"""
Structural hole detection between knowledge graph communities.

A "gap" exists when two communities have:
1. Zero or very few edges between them
2. Non-trivial semantic similarity between their members

This means the communities discuss related topics but the user
hasn't made the connection yet. Gaps are the most valuable signal
for the Resurface engine: they represent unknown unknowns.

Based on Burt's structural holes theory (1992) and Granovetter's
strength of weak ties (1973).
"""

import logging

import networkx as nx

logger = logging.getLogger(__name__)


def find_structural_gaps(G, communities, min_semantic_sim=0.3):
    """
    Find gaps between communities that could represent missing connections.

    For each pair of communities with few inter-community edges,
    check if their members have semantic similarity. If yes,
    this is a structural gap worth surfacing.

    Returns:
        [
            {
                'community_a': int,
                'community_b': int,
                'inter_edges': int,
                'potential_edges': int,
                'gap_score': float,
                'bridge_candidates': [
                    {'from_pk': int, 'to_pk': int, 'similarity': float}
                ],
            }
        ]
    """
    gaps = []

    for i, comm_a in enumerate(communities):
        for j, comm_b in enumerate(communities):
            if j <= i:
                continue

            pks_a = set(comm_a['member_pks'])
            pks_b = set(comm_b['member_pks'])

            # Count inter-community edges
            inter_edges = 0
            for pk_a in pks_a:
                for pk_b in pks_b:
                    if G.has_edge(pk_a, pk_b):
                        inter_edges += 1

            # Calculate gap score: fewer edges + larger communities = bigger gap
            potential = len(pks_a) * len(pks_b)
            if potential == 0:
                continue

            density = inter_edges / potential
            gap_score = (1.0 - density) * min(len(pks_a), len(pks_b))

            if inter_edges < 3 and gap_score > 2.0:
                gaps.append({
                    'community_a': i,
                    'community_b': j,
                    'community_a_label': comm_a.get('label', ''),
                    'community_b_label': comm_b.get('label', ''),
                    'inter_edges': inter_edges,
                    'potential_edges': potential,
                    'gap_score': round(gap_score, 2),
                    'bridge_candidates': [],  # Populated by semantic check
                })

    gaps.sort(key=lambda g: g['gap_score'], reverse=True)
    return gaps
```

### Verification

- [ ] Gaps detected between disconnected communities
- [ ] Gap score reflects community size and edge sparsity
- [ ] Results sorted by gap significance
- [ ] `python manage.py test` passes

---

## Batch 10-11: Temporal Evolution + Synthesis Engine

(Specs follow same pattern. Temporal evolution uses sliding-window
graph snapshots to compute growth rates and theme trajectories.
Synthesis engine uses Claude API to generate natural language
cluster summaries.)

---

## Infrastructure Notes (Railway + Modal)

### Current Railway setup (from screenshot)

```
Research project:
  Research-Postgres (online, with volume)
  Redis (online, with volume)
  Research - Bucket (empty, S3)
  Research service (online, 4 warnings)
```

### Recommended changes

1. **Split RQ worker into its own Railway service.**
   Currently `rqworker` runs in the same container as gunicorn
   (background process in startCommand). For engine upgrades,
   the worker needs more memory and CPU. Create a second service
   in the same Railway project with:
   ```
   startCommand = "python -m spacy download en_core_web_md && python manage.py rqworker default engine ingestion --with-scheduler"
   ```
   This lets you scale web and worker independently.

2. **Redis is correctly configured.** SSE pub/sub, BM25 cache,
   and RQ queues all use Redis. No changes needed.

3. **Modal for GPU jobs.** Use Modal for:
   - Batch SBERT re-encoding (when switching models)
   - Claim decomposition at scale (Claude API calls)
   - KGE training (PyKEEN on GPU)
   Keep these as `modal.Function` calls triggered by RQ tasks.

4. **Go/Gin is NOT recommended.** The engine's value is in its
   NLP pipeline (Python ecosystem: spaCy, scikit-learn, PyTorch,
   sentence-transformers). Rewriting in Go would lose access to
   all of these. The performance bottleneck is model inference,
   not web serving. Instead:
   - Use RQ for async engine execution (already in place)
   - Use Modal for GPU-bound work
   - Use Redis caching for BM25/FAISS indices
   - If web serving becomes a bottleneck, add gunicorn workers

### Requirements additions

```
# requirements/engine.txt (NEW - for RQ worker service)
-r base.txt
rank-bm25>=0.2.2    # Optional: reference implementation
pykeen>=1.10.0      # KGE training (DE-SimplE, RotatE)
anthropic>=0.39.0   # Claim decomposition LLM
```

---

## Implementation Order

1. **Batch 3:** Model migrations (Edge types, Cluster, Claim) - unblocks everything
2. **Batch 1:** Adaptive NER - self-contained, immediate value
3. **Batch 2:** BM25 unified lexical - replaces 2 passes with 1, cleaner
4. **Batch 8:** Community detection - new capability, visible in Map module
5. **Batch 9:** Gap analysis - falls out of community detection
6. **Batch 4:** Instruction-tuned SBERT - dev/local only, better semantic
7. **Batch 5:** Claim-level NLI - requires SBERT and Claude API
8. **Batch 7:** Causal inference - requires claims from Batch 5
9. **Batch 6:** Temporal KGE - requires PyKEEN training pipeline
10. **Batch 10-11:** Temporal evolution + Synthesis - polish layer

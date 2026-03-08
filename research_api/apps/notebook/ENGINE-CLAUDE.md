# CommonPlace Connection Engine: Full Build Spec

> **One phase per session. Do not attempt multiple phases in a single session.**
> **Read every file listed under "Read first" before writing a single line of code.**
> This spec covers the full engine upgrade path from the current 3-pass spaCy
> baseline to the complete multi-signal intelligence layer described in the
> product and plugin specs.

---

## Architecture Map (Read Before Anything Else)

There are two connection engines in this codebase. They are not the same thing
and must not be conflated.

```
research_api/apps/research/connections.py
    Research-side engine. Operates on Source/SourceLink/Content relationships.
    4 signals: shared_sources, shared_tags, shared_threads, semantic.
    Powers the published site's backlinks and connection graph.
    WEIGHTS dict controls signal contribution.

research_api/apps/notebook/engine.py
    Notebook-side engine. Operates on Object/Edge/Component relationships.
    This is the CommonPlace engine. 3 passes currently, many stubs.
    Controlled by Notebook.engine_config JSON and the Novelty Dial.
```

The NLP layer that both engines draw from is here:

```
research_api/apps/research/advanced_nlp.py
    SBERT (all-MiniLM-L6-v2) + NLI (nli-distilroberta-base).
    Has HAS_PYTORCH flag. All features gracefully degrade when PyTorch
    is unavailable. Every call is wrapped in try/except.
    This is already fully built. The notebook engine just isn't using it yet.

research_api/apps/research/embeddings.py
    spaCy word vectors (en_core_web_md, 300-dim).
    Production fallback. Works without PyTorch.

research_api/apps/research/tensions.py
    Structural tension detection (4 types).
    Operates on research Sources only.
    Phase 3 of this spec bridges it to notebook Objects.
```

## Current Engine State

The notebook engine (`engine.py`) currently has:

| Component | Status | Notes |
|-----------|--------|-------|
| Pass 1: spaCy NER | Working | Extracts PERSON, ORG, GPE, etc. Creates ResolvedEntity records |
| Pass 2: Shared entity edges | Working | Finds Objects mentioning same entity, creates Edge |
| Pass 3: Topic similarity | Partial | Jaccard keyword overlap only. `_synthesize_topic_reason` generates template explanations |
| `_run_tfidf_engine()` | Stub | Logs "not implemented", returns [] |
| `_run_semantic_engine()` | Stub | Logs "not implemented", returns [] |
| `_llm_explanation()` | Stub | `LLM_EXPLANATION_ENABLED = False`, always returns None |
| `interpolate_config()` | Working | Novelty Dial config interpolation is correct |
| `auto_objectify()` | Working | Has deduplication guard, 4-char min length |
| `_create_connection_nodes()` | Working | Creates Timeline Nodes for new Edges |

The NLP infrastructure in `advanced_nlp.py` is complete and working.
The SBERT model, NLI model, and all utility functions are ready to use.
The notebook engine just has empty stubs where it should be calling them.

## Two-Mode Deployment Contract (Non-Negotiable)

Every new feature in this spec must follow this pattern:

```python
# Dev/local: PyTorch active, full NLP
# Production (Railway): No PyTorch, spaCy fallback

try:
    from apps.research.advanced_nlp import sentence_similarity, HAS_PYTORCH
    _result = sentence_similarity(text_a, text_b)  # returns float or None
except Exception:
    _result = None  # Fall back to spaCy or skip

if _result is None:
    # Use spaCy cosine similarity from embeddings.py
    # or Jaccard keyword overlap from _extract_keywords()
```

`HAS_PYTORCH` is the gatekeeper. Check it before loading any model.
Never let an ImportError or RuntimeError escape to a request handler.
The API must work in both modes. Production never sees PyTorch.

---

## Phase 1: SBERT Pass Activation

**Read first:**
- `apps/notebook/engine.py` in full (especially `_run_semantic_engine` stub and `run_engine`)
- `apps/research/advanced_nlp.py` in full (especially `find_most_similar`, `batch_encode`, `HAS_PYTORCH`)
- The scipy plugin spec section on `/nlp-pipeline` agent

**What this phase does:**
Replaces the `_run_semantic_engine` stub with a real SBERT-powered semantic
similarity pass. When PyTorch is available, this is a major quality upgrade
over Jaccard keyword overlap. When PyTorch is unavailable (production), it
falls back to nothing and Jaccard still runs.

### 1a. Import pattern at top of engine.py

Add after the existing spaCy import block:

```python
# SBERT (optional: only active when PyTorch is installed)
try:
    from apps.research.advanced_nlp import (
        HAS_PYTORCH,
        batch_encode,
        find_most_similar,
        sentence_similarity,
    )
    _SBERT_AVAILABLE = HAS_PYTORCH
except ImportError:
    _SBERT_AVAILABLE = False
    batch_encode = None
    find_most_similar = None
    sentence_similarity = None
```

### 1b. Replace _run_semantic_engine stub

```python
def _run_semantic_engine(obj: Object, config: dict) -> list[Edge]:
    """
    SBERT semantic similarity pass.

    Finds Objects whose full text is semantically similar to obj,
    even when they share no keywords. Requires PyTorch. Silently
    skips in production (Railway/no PyTorch environment).

    Uses find_most_similar() from advanced_nlp.py:
      - Encodes target + all candidates in a single batch call
      - Cosine similarity against 384-dim SBERT embeddings
      - Returns top matches above sbert_threshold

    This is qualitatively different from Jaccard (Pass 3):
      "Desire paths" and "induced demand" share no keywords but
      SBERT knows they are both about how human behavior diverges
      from designed systems.
    """
    if not _SBERT_AVAILABLE:
        logger.debug('SBERT not available. Skipping semantic engine pass.')
        return []

    threshold = config.get('sbert_threshold', 0.45)
    max_candidates = config.get('max_candidates', 500)

    my_text = _build_full_text(obj)
    if not my_text or len(my_text) < 20:
        return []

    # Gather candidates (exclude self, deleted, empty)
    candidates = list(
        Object.objects
        .filter(is_deleted=False)
        .exclude(pk=obj.pk)
        .exclude(search_text='')
        .order_by('-captured_at')
        [:max_candidates]
    )

    if not candidates:
        return []

    candidate_texts = [_build_full_text(c) for c in candidates]
    candidate_ids = [str(c.pk) for c in candidates]

    # Single batch call -- much faster than pairwise
    try:
        matches = find_most_similar(
            target_text=my_text,
            candidate_texts=candidate_texts,
            candidate_ids=candidate_ids,
            top_n=20,
            threshold=threshold,
        )
    except Exception as exc:
        logger.warning('SBERT find_most_similar failed: %s', exc)
        return []

    # Map matches back to Object PKs
    pk_map = {str(c.pk): c for c in candidates}
    new_edges = []

    for match in matches:
        other = pk_map.get(match['id'])
        if not other:
            continue

        sim = match['similarity']

        # Try LLM explanation first, fall back to synthesized template
        reason = (
            _llm_explanation(obj, other)
            or _synthesize_sbert_reason(obj, other, sim)
        )

        edge, created = Edge.objects.get_or_create(
            from_object=obj,
            to_object=other,
            edge_type='semantic',
            defaults={
                'reason': reason,
                'strength': round(sim, 4),
                'is_auto': True,
                'engine': 'sbert',
            },
        )
        if created:
            new_edges.append(edge)

    return new_edges
```

### 1c. Add _synthesize_sbert_reason helper

```python
def _synthesize_sbert_reason(obj_a: Object, obj_b: Object, similarity: float) -> str:
    """
    Template-based explanation for SBERT-discovered connections.
    Used when LLM explanation is disabled.
    Stronger than the Jaccard template because similarity score
    reflects genuine conceptual proximity, not just word overlap.
    """
    type_a = obj_a.object_type.name.lower() if obj_a.object_type else 'note'
    type_b = obj_b.object_type.name.lower() if obj_b.object_type else 'note'

    if similarity > 0.75:
        return (
            f'This {type_a} and this {type_b} are closely related '
            f'conceptually (semantic similarity: {similarity:.0%}).'
        )
    elif similarity > 0.55:
        return (
            f'This {type_a} and this {type_b} explore related themes '
            f'(semantic similarity: {similarity:.0%}).'
        )
    else:
        return (
            f'These share underlying conceptual territory '
            f'(semantic similarity: {similarity:.0%}).'
        )
```

### 1d. Register semantic in run_engine

In `run_engine()`, the `'sbert'` check already routes to `_run_semantic_engine`.
Verify this block exists and is correct:

```python
if 'sbert' in active_engines or 'semantic' in active_engines:
    semantic_edges = _run_semantic_engine(obj, config)
    results['edges_from_semantic'] = len(semantic_edges)
    all_new_edges.extend(semantic_edges)
```

Also update `DEFAULT_ENGINE_CONFIG` to include sbert at higher novelty:

```python
# In HIGH_NOVELTY_CONFIG, sbert_threshold should default to 0.45, not 0.40.
# 0.40 produces too many low-confidence connections on short texts.
HIGH_NOVELTY_CONFIG = {
    'engines': ['spacy', 'sbert'],
    'topic_threshold': 0.10,
    'max_candidates': 1000,
    'sbert_threshold': 0.45,  # was 0.40 -- raise to reduce noise
    'entity_types': [
        'PERSON', 'ORG', 'GPE', 'LOC', 'EVENT', 'WORK_OF_ART', 'DATE',
    ],
}
```

**Deliverable:**
```bash
# Set HAS_PYTORCH to True by installing sentence-transformers locally:
pip install sentence-transformers torch --extra-index-url https://download.pytorch.org/whl/cpu

# Create 5 objects with related but non-overlapping language:
#   "desire paths show how people actually move through space"
#   "induced demand proves that supply creates its own consumption"
# Run engine. Verify a semantic Edge appears between them.
python manage.py run_engine_all --limit 10
# Check in admin: Edges with engine='sbert' and edge_type='semantic'
```

---

## Phase 2: TF-IDF Pass (Production Fallback)

**Read first:**
- `apps/notebook/engine.py` (`_run_tfidf_engine` stub, `_extract_keywords`, `find_topic_connections`)
- `PATTERNS-semantic-search.md` (Level 2 signals section)
- scikit-learn TfidfVectorizer docs (refs/scikit-learn/sklearn/feature_extraction/text.py)

**What this phase does:**
Implements real TF-IDF similarity using sklearn. This is the production-safe
alternative to SBERT -- it works without PyTorch, captures term importance
better than Jaccard, and handles corpus-wide inverse-document-frequency
weighting so common words are automatically downweighted.

TF-IDF vs Jaccard:
- Jaccard treats all keywords as equal. "parking" and "the" (if not in STOP_WORDS)
  score the same.
- TF-IDF weights terms by how rare they are across the whole corpus. A word
  that appears in 1 out of 500 objects scores much higher than one in 400/500.

TF-IDF vs SBERT:
- TF-IDF is bag-of-words. Word order doesn't matter.
- SBERT is contextual. Runs in dev only.
- TF-IDF runs in production. Complements SBERT in dev, replaces it in prod.

### 2a. Import sklearn at top of engine.py

```python
# TF-IDF (sklearn -- production safe, no PyTorch)
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine
    _TFIDF_AVAILABLE = True
except ImportError:
    _TFIDF_AVAILABLE = False
    TfidfVectorizer = None
    sklearn_cosine = None
```

### 2b. Add corpus-level TF-IDF cache

TF-IDF needs to be fitted on the full corpus to compute IDF weights.
Fitting it from scratch on every engine call is too slow.
Cache the fitted vectorizer and its document matrix in a module-level dict.
Invalidate the cache when new Objects are created (signal-driven).

```python
# Module-level TF-IDF corpus cache
_TFIDF_CACHE: dict = {
    'vectorizer': None,
    'matrix': None,
    'object_pks': [],  # Ordered list of Object PKs in the matrix rows
    'built_at': None,
    'size': 0,
}
_TFIDF_CACHE_MAX_AGE_SECONDS = 3600  # Rebuild hourly or on invalidation


def _get_or_build_tfidf_corpus(max_objects: int = 2000) -> dict | None:
    """
    Return a fitted TF-IDF matrix over all active Objects.
    Builds lazily, caches in module memory, invalidates hourly.

    Returns: dict with keys 'vectorizer', 'matrix', 'object_pks'
             or None if TF-IDF is unavailable.
    """
    if not _TFIDF_AVAILABLE:
        return None

    import time
    now = time.time()
    cache = _TFIDF_CACHE
    current_count = Object.objects.filter(is_deleted=False).count()

    # Rebuild if cache is stale or corpus has changed significantly
    needs_rebuild = (
        cache['vectorizer'] is None
        or cache['built_at'] is None
        or (now - cache['built_at']) > _TFIDF_CACHE_MAX_AGE_SECONDS
        or abs(current_count - cache['size']) > 50  # Corpus shifted by 50+ objects
    )

    if not needs_rebuild:
        return cache

    logger.info('Building TF-IDF corpus matrix (%d objects)...', current_count)

    objects = list(
        Object.objects
        .filter(is_deleted=False)
        .exclude(search_text='')
        .order_by('-captured_at')
        [:max_objects]
    )

    if len(objects) < 5:
        return None  # Too small to be meaningful

    texts = [_build_full_text(obj) for obj in objects]
    pks = [obj.pk for obj in objects]

    try:
        vectorizer = TfidfVectorizer(
            max_features=10000,
            min_df=2,           # Term must appear in at least 2 documents
            max_df=0.85,        # Ignore terms appearing in >85% of docs
            ngram_range=(1, 2), # Unigrams and bigrams
            stop_words='english',
            sublinear_tf=True,  # Apply log normalization to term freq
        )
        matrix = vectorizer.fit_transform(texts)

        cache['vectorizer'] = vectorizer
        cache['matrix'] = matrix
        cache['object_pks'] = pks
        cache['built_at'] = now
        cache['size'] = current_count

        logger.info('TF-IDF corpus built: %d docs, %d features', len(objects), matrix.shape[1])
        return cache

    except Exception as exc:
        logger.error('TF-IDF corpus build failed: %s', exc)
        return None


def invalidate_tfidf_cache():
    """Call this when Objects are created/deleted to force a rebuild."""
    _TFIDF_CACHE['built_at'] = None
```

### 2c. Replace _run_tfidf_engine stub

```python
def _run_tfidf_engine(obj: Object, config: dict) -> list[Edge]:
    """
    TF-IDF topic similarity pass.

    Production-safe alternative to SBERT. Does not require PyTorch.
    Uses a corpus-level fitted TfidfVectorizer to find Objects with
    similar term distributions. Handles corpus IDF weighting
    automatically: common words across all Objects score low.

    Threshold: cosine similarity on TF-IDF vectors, default 0.25.
    This is lower than SBERT threshold because TF-IDF cosine scores
    are generally lower than SBERT cosine scores on the same pairs.
    """
    if not _TFIDF_AVAILABLE:
        return []

    threshold = config.get('tfidf_threshold', 0.25)
    corpus = _get_or_build_tfidf_corpus()
    if corpus is None:
        return []

    vectorizer = corpus['vectorizer']
    matrix = corpus['matrix']
    pks = corpus['object_pks']

    if obj.pk not in pks:
        # Object not in corpus (too new). Transform it on the fly.
        try:
            my_text = _build_full_text(obj)
            my_vec = vectorizer.transform([my_text])
        except Exception as exc:
            logger.warning('TF-IDF transform failed for new object: %s', exc)
            return []
        pk_index = None
    else:
        idx = pks.index(obj.pk)
        my_vec = matrix[idx]
        pk_index = idx

    # Cosine similarity against full corpus matrix
    try:
        sims = sklearn_cosine(my_vec, matrix).flatten()
    except Exception as exc:
        logger.warning('TF-IDF similarity failed: %s', exc)
        return []

    new_edges = []

    for i, sim in enumerate(sims):
        if pk_index is not None and i == pk_index:
            continue  # Skip self
        if sim < threshold:
            continue

        other_pk = pks[i]
        if other_pk == obj.pk:
            continue

        try:
            other = Object.objects.select_related('object_type').get(pk=other_pk, is_deleted=False)
        except Object.DoesNotExist:
            continue

        reason = (
            _llm_explanation(obj, other)
            or _synthesize_tfidf_reason(obj, other, float(sim))
        )

        edge, created = Edge.objects.get_or_create(
            from_object=obj,
            to_object=other,
            edge_type='shared_topic',
            defaults={
                'reason': reason,
                'strength': round(float(sim), 4),
                'is_auto': True,
                'engine': 'tfidf',
            },
        )
        if created:
            new_edges.append(edge)

    return new_edges


def _synthesize_tfidf_reason(obj_a: Object, obj_b: Object, similarity: float) -> str:
    """Template explanation for TF-IDF connections."""
    type_a = obj_a.object_type.name.lower() if obj_a.object_type else 'note'
    type_b = obj_b.object_type.name.lower() if obj_b.object_type else 'note'
    return (
        f'This {type_a} and this {type_b} use significantly overlapping '
        f'vocabulary and terminology (TF-IDF similarity: {similarity:.0%}).'
    )
```

### 2d. Add cache invalidation to signals.py

In `signals.py`, after the Object post_save signal handler that creates Nodes,
add:

```python
@receiver(post_save, sender='notebook.Object')
def invalidate_engine_cache(sender, instance, created, **kwargs):
    """Invalidate TF-IDF corpus cache when Objects are added."""
    if created:
        from .engine import invalidate_tfidf_cache
        invalidate_tfidf_cache()
```

### 2e. Register TF-IDF in _get_active_engines

The existing logic auto-adds `tfidf` at 500+ objects. Verify this:

```python
def _get_active_engines(config: dict, object_count: int) -> set[str]:
    engines = set(config.get('engines', ['spacy']))
    if object_count >= 500:
        engines.add('tfidf')
    # Also add tfidf explicitly if configured
    return engines
```

If the corpus is under 500 but the user has explicitly added `tfidf` to
`engine_config.engines`, it should still run. The existing logic handles this
correctly via `config.get('engines', ['spacy'])`.

**Deliverable:**
```bash
# Works without PyTorch:
python manage.py run_engine_all --limit 20
# Should log: "TF-IDF corpus built: N docs, M features"
# Admin: Edges with engine='tfidf', edge_type='shared_topic'
# These should find connections Jaccard misses (e.g., synonymous concepts)
```

---

## Phase 3: NLI Contradiction Edges

**Read first:**
- `apps/research/advanced_nlp.py` (`analyze_pair`, `detect_contradictions`, `classify_relationship`)
- `apps/research/tensions.py` (existing structural tension detection)
- `apps/notebook/models.py` (Edge model, `edge_type` choices)

**What this phase does:**
Adds a new engine pass that detects intellectual contradiction between Objects.
When two Objects are on similar topics (high SBERT similarity) but make
conflicting claims (high NLI contradiction score), they get an Edge with
`edge_type='contradicts'` and a human-readable explanation of the conflict.

This is the semantic version of what `tensions.py` does structurally.
`tensions.py` says: "these Sources are counterarguments on the same content."
This new pass says: "these two Objects, read together, make contradictory claims."

Only runs in dev/local (requires PyTorch). Production degrades gracefully.

### 3a. Add 'contradicts' to Edge edge_type choices in models.py

Find the `Edge` model's `edge_type` field choices. Add:

```python
('contradicts', 'Contradicts'),
('supports', 'Supports'),    # Add this too if missing
```

Run migrations after adding new choices if the database enforces them.

### 3b. Add NLI contradiction pass to engine.py

```python
def _run_nli_contradiction_pass(obj: Object, config: dict) -> list[Edge]:
    """
    NLI contradiction detection pass.

    Requires PyTorch + cross-encoder/nli-distilroberta-base.
    Only runs in dev/local. Gracefully skips in production.

    Strategy:
    1. Find semantically similar Objects (they must be on the same topic
       for a contradiction to be meaningful -- comparing unrelated objects
       is just noise).
    2. For each similar Object, run NLI classification.
    3. If contradiction probability > threshold, create a 'contradicts' Edge.
    4. If entailment probability > threshold, create a 'supports' Edge.

    Why topic similarity first:
    NLI is slow (cross-encoder: O(n) pairs, not precomputed).
    Gating it on SBERT similarity first limits it to plausible pairs.
    Without this gate, we'd run NLI on every Object pair, which is O(n^2).
    """
    if not _SBERT_AVAILABLE:
        return []

    try:
        from apps.research.advanced_nlp import analyze_pair, HAS_PYTORCH
        if not HAS_PYTORCH:
            return []
    except ImportError:
        return []

    contradiction_threshold = config.get('contradiction_threshold', 0.60)
    entailment_threshold = config.get('entailment_threshold', 0.65)
    similarity_gate = config.get('nli_similarity_gate', 0.40)  # Must exceed this to run NLI
    max_nli_candidates = config.get('max_nli_candidates', 30)

    my_text = _build_full_text(obj)
    if not my_text or len(my_text) < 30:
        return []

    # Step 1: Find semantically similar candidates via SBERT
    candidates = list(
        Object.objects
        .filter(is_deleted=False)
        .exclude(pk=obj.pk)
        .exclude(search_text='')
        .order_by('-captured_at')
        [:500]
    )

    if not candidates:
        return []

    try:
        candidate_texts = [_build_full_text(c) for c in candidates]
        similar_matches = find_most_similar(
            target_text=my_text,
            candidate_texts=candidate_texts,
            candidate_ids=[str(c.pk) for c in candidates],
            top_n=max_nli_candidates,
            threshold=similarity_gate,
        )
    except Exception as exc:
        logger.warning('NLI pass: SBERT screening failed: %s', exc)
        return []

    pk_map = {str(c.pk): c for c in candidates}
    new_edges = []

    # Step 2: Run NLI on similar-enough pairs
    for match in similar_matches:
        other = pk_map.get(match['id'])
        if not other:
            continue

        other_text = _build_full_text(other)
        if not other_text or len(other_text) < 30:
            continue

        try:
            analysis = analyze_pair(my_text, other_text)
        except Exception as exc:
            logger.warning('analyze_pair failed: %s', exc)
            continue

        relationship = analysis.get('relationship')
        if not relationship:
            continue

        probs = relationship.get('probabilities', {})
        contradiction_prob = probs.get('contradiction', 0.0)
        entailment_prob = probs.get('entailment', 0.0)
        similarity = analysis.get('similarity') or match['similarity']

        if contradiction_prob >= contradiction_threshold:
            reason = _synthesize_contradiction_reason(obj, other, similarity, contradiction_prob)
            edge, created = Edge.objects.get_or_create(
                from_object=obj,
                to_object=other,
                edge_type='contradicts',
                defaults={
                    'reason': reason,
                    'strength': round(contradiction_prob * similarity, 4),
                    'is_auto': True,
                    'engine': 'nli',
                },
            )
            if created:
                new_edges.append(edge)

        elif entailment_prob >= entailment_threshold:
            reason = _synthesize_entailment_reason(obj, other, similarity, entailment_prob)
            edge, created = Edge.objects.get_or_create(
                from_object=obj,
                to_object=other,
                edge_type='supports',
                defaults={
                    'reason': reason,
                    'strength': round(entailment_prob * similarity, 4),
                    'is_auto': True,
                    'engine': 'nli',
                },
            )
            if created:
                new_edges.append(edge)

    return new_edges


def _synthesize_contradiction_reason(obj_a, obj_b, similarity, contradiction_prob) -> str:
    type_a = obj_a.object_type.name.lower() if obj_a.object_type else 'note'
    type_b = obj_b.object_type.name.lower() if obj_b.object_type else 'note'
    return (
        f'This {type_a} and this {type_b} discuss related topics '
        f'(similarity: {similarity:.0%}) but appear to make conflicting '
        f'claims (contradiction: {contradiction_prob:.0%}). '
        f'This may represent a genuine intellectual tension worth examining.'
    )


def _synthesize_entailment_reason(obj_a, obj_b, similarity, entailment_prob) -> str:
    type_a = obj_a.object_type.name.lower() if obj_a.object_type else 'note'
    type_b = obj_b.object_type.name.lower() if obj_b.object_type else 'note'
    return (
        f'This {type_a} and this {type_b} discuss related topics '
        f'(similarity: {similarity:.0%}) and appear to support or '
        f'reinforce each other (agreement: {entailment_prob:.0%}).'
    )
```

### 3c. Register NLI pass in run_engine

In `run_engine()`, add after the semantic engine block:

```python
if 'nli' in active_engines or (_SBERT_AVAILABLE and config.get('nli_enabled', False)):
    nli_edges = _run_nli_contradiction_pass(obj, config)
    results['edges_from_nli'] = len(nli_edges)
    all_new_edges.extend(nli_edges)
else:
    results['edges_from_nli'] = 0
```

Add `'edges_from_nli': 0` to the initial `results` dict.

Add `'nli_enabled': True` to `HIGH_NOVELTY_CONFIG` so it activates at high novelty.

### 3d. Surface contradiction edges in the graph endpoint

In `views.py` `graph_data_view`, update edge color metadata:

```python
edges.append({
    'source': f'object:{edge.from_object_id}',
    'target': f'object:{edge.to_object_id}',
    'label': edge.reason,
    'weight': round(float(edge.strength or 0.5), 3),
    'is_manual': not edge.is_auto,
    'edge_type': edge.edge_type,
    'is_contradiction': edge.edge_type == 'contradicts',  # Frontend uses this for amber color
})
```

**Deliverable:**
Capture two Objects with opposing claims about the same topic, e.g.:
- "Building more roads reduces congestion"
- "Building more roads creates more traffic through induced demand"
Run engine. Verify an Edge with `edge_type='contradicts'` and a meaningful reason
appears in Django admin. Check that `GET /api/v1/notebook/graph/` includes
`is_contradiction: true` on that edge.

---

## Phase 4: LLM Explanation Activation

**Read first:**
- `apps/notebook/engine.py` (`_llm_explanation` stub, `LLM_EXPLANATION_ENABLED = False`)
- Anthropic API docs for `/v1/messages`
- `apps/research/advanced_nlp.py` (understand existing try/except pattern)

**What this phase does:**
Activates the `_llm_explanation` stub to call the Anthropic API and generate
a genuinely human-quality plain-English explanation for why two Objects are
connected. This is the highest-quality explanation path. It only runs on the
top edges (by strength) to avoid excessive API cost.

The call is gated by `LLM_EXPLANATION_ENABLED` which defaults to `False`.
Once the environment variable `COMMONPLACE_LLM_EXPLANATIONS=true` is set,
it activates. Production can control this via Railway env vars.

### 4a. Implement _llm_explanation

Replace the stub:

```python
import os as _os

LLM_EXPLANATION_ENABLED = _os.environ.get('COMMONPLACE_LLM_EXPLANATIONS', '').lower() == 'true'
LLM_EXPLANATION_MIN_STRENGTH = 0.55  # Only call LLM for strong enough connections
LLM_MAX_TOKENS = 80


def _llm_explanation(obj_a: Object, obj_b: Object, strength: float = 0.5) -> str | None:
    """
    Call Claude to generate a high-quality plain-English connection explanation.

    Only activates when:
      - COMMONPLACE_LLM_EXPLANATIONS=true in environment
      - Connection strength >= LLM_EXPLANATION_MIN_STRENGTH (avoid cost on weak edges)
      - Both objects have enough text to reason about (>= 20 chars)

    The prompt asks for a single sentence that explains WHY these two objects
    are conceptually connected. This is the same product requirement as the
    manual connection flow: "write a plain-English reason for the connection."

    Cost estimate: ~100-200 input tokens, ~20-30 output tokens per call.
    At claude-haiku-4 pricing this is negligible. Use haiku, not sonnet,
    for this task -- it handles single-sentence explanation well and is fast.
    """
    if not LLM_EXPLANATION_ENABLED:
        return None
    if strength < LLM_EXPLANATION_MIN_STRENGTH:
        return None

    body_a = (obj_a.body or '')[:300]
    body_b = (obj_b.body or '')[:300]
    title_a = obj_a.display_title[:100]
    title_b = obj_b.display_title[:100]

    if len(body_a) < 20 and len(title_a) < 10:
        return None
    if len(body_b) < 20 and len(title_b) < 10:
        return None

    type_a = obj_a.object_type.name if obj_a.object_type else 'note'
    type_b = obj_b.object_type.name if obj_b.object_type else 'note'

    prompt = (
        f'Two knowledge objects are connected in a personal research database.\n\n'
        f'Object A ({type_a}): "{title_a}"\n'
        f'{body_a}\n\n'
        f'Object B ({type_b}): "{title_b}"\n'
        f'{body_b}\n\n'
        f'In one sentence, explain the conceptual connection between these two objects. '
        f'Be specific about what they share, not generic. '
        f'Do not say "both" or "related" or "similar". '
        f'Name the actual idea or theme that connects them. '
        f'Start directly with the explanation, no preamble.'
    )

    try:
        import httpx
        api_key = _os.environ.get('ANTHROPIC_API_KEY', '')
        if not api_key:
            logger.warning('ANTHROPIC_API_KEY not set. LLM explanation skipped.')
            return None

        response = httpx.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            json={
                'model': 'claude-haiku-4-5-20251001',
                'max_tokens': LLM_MAX_TOKENS,
                'messages': [{'role': 'user', 'content': prompt}],
            },
            timeout=8.0,
        )
        response.raise_for_status()
        data = response.json()
        text = data['content'][0]['text'].strip()

        # Sanity check: reject if output is too short or too long
        if len(text) < 15 or len(text) > 300:
            return None

        return text

    except Exception as exc:
        logger.warning('LLM explanation failed: %s', exc)
        return None
```

### 4b. Pass strength to all _llm_explanation calls

Every call site in the engine currently calls `_llm_explanation(obj, other)`.
Update them all to pass the computed similarity/strength:

```python
# In find_topic_connections:
reason = (
    _llm_explanation(obj, other, strength=min(jaccard * 2, 1.0))
    or _synthesize_topic_reason(my_keywords, other_keywords, obj, other)
)

# In _run_semantic_engine:
reason = (
    _llm_explanation(obj, other, strength=sim)
    or _synthesize_sbert_reason(obj, other, sim)
)

# In _run_tfidf_engine:
reason = (
    _llm_explanation(obj, other, strength=float(sim))
    or _synthesize_tfidf_reason(obj, other, float(sim))
)
```

### 4c. Add httpx to requirements

Verify `httpx` is in `requirements.txt` or `requirements/base.txt`.
If not, add it: `httpx>=0.27`.

**Deliverable:**
```bash
export COMMONPLACE_LLM_EXPLANATIONS=true
export ANTHROPIC_API_KEY=sk-ant-...
python manage.py run_engine_all --limit 5
# Admin: Strong edges (strength > 0.55) should now have Claude-written reasons.
# Example: "Both examine how infrastructure shapes public behavior,
#  with parking and road design as case studies of designed systems
#  that diverge from actual human movement patterns."
```

---

## Phase 5: spacy-layout PDF Ingestion

**Read first:**
- `apps/research/services.py` (the `enrich_url` function -- understand the existing enrichment pattern)
- `apps/notebook/services.py` (`quick_capture`, `enrich_url`)
- `refs/spacy-layout/` (look at the README and main API)
- The scipy plugin spec section on `/nlp-pipeline` agent, specifically the spacy-layout addition

**What this phase does:**
PDFs are a first-class Source type in CommonPlace. When a captured URL resolves
to a PDF (Content-Type: application/pdf), the enrichment pipeline should use
spacy-layout to extract structured text (preserving headers, body, tables)
instead of Firecrawl's markdown extractor or the existing regex-based OG scraper.

spacy-layout uses the spaCy pipeline to analyze PDF layout and return a Doc
object with section-level structure. This is significantly richer than raw
PDF text extraction.

### 5a. Install spacy-layout

Add to requirements:
```
spacy-layout>=0.4.0
```

Verify the Railway build command runs `pip install -r requirements.txt`.
spacy-layout requires spaCy to already be installed (it is).

### 5b. Create apps/notebook/pdf_ingestion.py

```python
"""
PDF ingestion via spacy-layout.

Called from the capture pipeline when a URL resolves to a PDF
or when a PDF file is dropped directly onto CommonPlace.

Returns a structured dict with title, body, author (if found
in PDF metadata), and section-level text for the connection engine.

Gracefully falls back to raw text extraction if spacy-layout fails.
"""

import logging

logger = logging.getLogger(__name__)


def _has_spacy_layout() -> bool:
    try:
        import spacy_layout
        return True
    except ImportError:
        return False


def extract_pdf_text(pdf_bytes: bytes) -> dict:
    """
    Extract structured text from PDF bytes using spacy-layout.

    Returns:
        {
            'title': str,
            'body': str,           # Main readable text
            'author': str,         # If found in PDF metadata
            'sections': list[str], # Section-level text blocks (for engine)
            'char_count': int,
            'method': 'spacy_layout' | 'raw_fallback',
        }
    """
    if not _has_spacy_layout():
        return _raw_pdf_fallback(pdf_bytes)

    try:
        import io
        import spacy
        from spacy_layout import spaCyLayout

        nlp = spacy.load('en_core_web_sm')
        layout = spaCyLayout(nlp)

        # spacy-layout accepts a file-like object
        pdf_file = io.BytesIO(pdf_bytes)
        doc = layout(pdf_file)

        # Extract sections from the Doc's spans
        sections = []
        body_parts = []

        for span in doc.spans.get('layout', []):
            text = span.text.strip()
            if not text or len(text) < 10:
                continue

            label = span.label_ if hasattr(span, 'label_') else ''
            if 'head' in label.lower() or 'title' in label.lower():
                sections.append(text)
            else:
                body_parts.append(text)

        body = '\n\n'.join(body_parts)
        title = sections[0] if sections else ''

        # Try to extract author from doc metadata if spacy-layout exposes it
        author = ''
        if hasattr(doc, '_') and hasattr(doc._, 'layout'):
            meta = getattr(doc._.layout, 'metadata', {}) or {}
            author = meta.get('author', '') or meta.get('Author', '')

        return {
            'title': title,
            'body': body,
            'author': author,
            'sections': sections,
            'char_count': len(body),
            'method': 'spacy_layout',
        }

    except Exception as exc:
        logger.warning('spacy-layout extraction failed: %s', exc)
        return _raw_pdf_fallback(pdf_bytes)


def _raw_pdf_fallback(pdf_bytes: bytes) -> dict:
    """
    Minimal fallback: extract raw text from PDF without layout analysis.
    Uses pypdf if available, otherwise returns empty.
    """
    try:
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = '\n'.join(
            page.extract_text() or ''
            for page in reader.pages
        )
        return {
            'title': '',
            'body': text,
            'author': '',
            'sections': [],
            'char_count': len(text),
            'method': 'raw_fallback',
        }
    except Exception:
        return {
            'title': '',
            'body': '',
            'author': '',
            'sections': [],
            'char_count': 0,
            'method': 'raw_fallback',
        }
```

### 5c. Integrate into the capture pipeline

In `apps/notebook/services.py`, update `enrich_url`:

```python
def enrich_url(obj: Object) -> dict:
    """
    Fetch OG metadata from URL or extract PDF text if URL is a PDF.
    """
    if not obj.url:
        return {}

    try:
        resp = requests.get(
            obj.url,
            timeout=TIMEOUT,
            headers={'User-Agent': 'CommonPlace/1.0'},
            allow_redirects=True,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning('Fetch failed for %s: %s', obj.url, exc)
        return {}

    content_type = resp.headers.get('Content-Type', '').lower()

    # Route PDFs to spacy-layout extraction
    if 'application/pdf' in content_type or obj.url.lower().endswith('.pdf'):
        return _enrich_from_pdf(obj, resp.content)

    # Otherwise: existing OG metadata scraping
    return _enrich_from_html(obj, resp.text)


def _enrich_from_pdf(obj: Object, pdf_bytes: bytes) -> dict:
    """Extract title, author, and body text from a PDF Object."""
    from .pdf_ingestion import extract_pdf_text

    extracted = extract_pdf_text(pdf_bytes)

    updates = {}
    if extracted['title'] and not obj.title:
        updates['title'] = extracted['title'][:500]
    if extracted['body']:
        updates['body'] = extracted['body'][:10000]  # Cap at 10k chars
    if extracted['author']:
        updates['og_site_name'] = extracted['author']

    if updates:
        Object.objects.filter(pk=obj.pk).update(**updates)
        obj.refresh_from_db()
        logger.info(
            'PDF enriched Object %s: %s chars extracted via %s',
            obj.pk, extracted['char_count'], extracted['method'],
        )

    return updates
```

**Deliverable:**
Capture a URL that points to a PDF (e.g. an academic paper or government report).
Verify the Object body is populated with extracted text, not empty.
Run the engine on it. Verify entities and topic edges are created from the PDF content.

---

## Phase 6: KGE Triple Export and Training Pipeline

**Read first:**
- `PATTERNS-knowledge-graphs.md` in full (RotatE geometry, PyKEEN pipeline, integration architecture)
- `PATTERNS-graph-algorithms.md` (bipartite projection, PageRank)
- The scipy plugin spec `/kge-engineer` agent section
- `apps/research/connections.py` WEIGHTS dict
- `refs/pykeen/` pipeline code (especially `pykeen/pipeline/`)

**What this phase does:**
Builds the offline training pipeline that exports Object/Edge triples from the
Django ORM, trains a RotatE embedding model using PyKEEN, and stores the learned
embeddings for use as a 5th signal in the connection engine.

Why RotatE over TransE:
RotatE models relations as rotations in complex space. This means:
- "supports" and "contradicts" are ~180-degree rotations of each other
- "mentions" and "is_mentioned_by" are exact inverses
- "shared_topic" has a geometric neighborhood that clusters similar concepts

TransE models relations as translations. It cannot capture opposition or symmetry.
For a knowledge graph where "contradicts" should point *away* from "supports",
RotatE is the right model.

### 6a. Create management command: export_triples

Create `management/commands/export_kge_triples.py`:

```python
"""
Export Object/Edge data as (head, relation, tail) triples for KGE training.

Output format: TSV with columns head_id, relation, tail_id.
PyKEEN reads this format directly.

Two triple types:
  1. Edge triples: (object_a.sha_hash, edge_type, object_b.sha_hash)
  2. Entity triples: (object.sha_hash, 'object_type', type.slug)

The sha_hash is used as the entity ID so lineage is preserved
across training runs even if PKs change.
"""
import csv
import os
from django.core.management.base import BaseCommand
from apps.notebook.models import Edge, Object


class Command(BaseCommand):
    help = 'Export Object/Edge triples to TSV for PyKEEN KGE training.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output', default='kge_triples.tsv',
            help='Output TSV file path'
        )
        parser.add_argument(
            '--min-strength', type=float, default=0.4,
            help='Minimum edge strength to include'
        )

    def handle(self, *args, **options):
        output_path = options['output']
        min_strength = options['min_strength']

        triples = []

        # Edge triples
        edges = Edge.objects.filter(
            strength__gte=min_strength,
            from_object__is_deleted=False,
            to_object__is_deleted=False,
        ).select_related('from_object', 'to_object')

        for edge in edges:
            h = edge.from_object.sha_hash
            r = edge.edge_type
            t = edge.to_object.sha_hash
            if h and t:
                triples.append((h, r, t))

        # Object type triples (adds type information as relations)
        objects = Object.objects.filter(
            is_deleted=False,
            object_type__isnull=False,
        ).select_related('object_type')

        for obj in objects:
            if obj.sha_hash and obj.object_type:
                triples.append((
                    obj.sha_hash,
                    'has_type',
                    f'type:{obj.object_type.slug}',
                ))

        # SourceLink triples (research side -- bridges the two engines)
        try:
            from apps.research.models import SourceLink
            for link in SourceLink.objects.select_related('source').all():
                triples.append((
                    link.source.slug,
                    f'link:{link.role}',
                    link.content_slug,
                ))
        except Exception:
            self.stdout.write('SourceLink export skipped (import failed).')

        with open(output_path, 'w', newline='') as f:
            writer = csv.writer(f, delimiter='\t')
            for triple in triples:
                writer.writerow(triple)

        self.stdout.write(
            self.style.SUCCESS(
                f'Exported {len(triples)} triples to {output_path}'
            )
        )
```

### 6b. Create training script: scripts/train_kge.py

```python
"""
Train a RotatE model on CommonPlace Object/Edge triples.

Usage:
  python scripts/train_kge.py --triples kge_triples.tsv --output kge_embeddings/

Requires: pip install pykeen torch

This script runs OFFLINE (not in Django). It reads the TSV exported
by export_kge_triples management command, trains RotatE, and saves:
  - entity_embeddings.npy  (shape: [n_entities, embedding_dim])
  - entity_to_idx.json     (entity_id -> matrix row index)
  - relation_embeddings.npy
  - training_metadata.json (epoch, final loss, entity count)
"""
import argparse
import json
import os
import numpy as np


def train(triples_path: str, output_dir: str, epochs: int = 100, dim: int = 128):
    try:
        from pykeen.pipeline import pipeline
        from pykeen.triples import TriplesFactory
    except ImportError:
        print('PyKEEN not installed. Run: pip install pykeen')
        return

    os.makedirs(output_dir, exist_ok=True)

    print(f'Loading triples from {triples_path}...')
    tf = TriplesFactory.from_path(triples_path, delimiter='\t')

    training, testing = tf.split([0.9, 0.1], random_state=42)

    print(f'Training RotatE: {tf.num_entities} entities, '
          f'{tf.num_relations} relations, {epochs} epochs, dim={dim}')

    result = pipeline(
        training=training,
        testing=testing,
        model='RotatE',
        model_kwargs=dict(embedding_dim=dim),
        training_kwargs=dict(num_epochs=epochs, batch_size=256),
        evaluation_kwargs=dict(batch_size=128),
        random_seed=42,
        use_tqdm=True,
    )

    # Extract entity embeddings as NumPy
    entity_repr = result.model.entity_representations[0]
    embeddings = entity_repr(indices=None).detach().cpu().numpy()

    np.save(os.path.join(output_dir, 'entity_embeddings.npy'), embeddings)
    np.save(
        os.path.join(output_dir, 'relation_embeddings.npy'),
        result.model.relation_representations[0](indices=None).detach().cpu().numpy()
    )

    entity_to_idx = {eid: i for i, eid in enumerate(tf.entity_id_to_label.values())}
    with open(os.path.join(output_dir, 'entity_to_idx.json'), 'w') as f:
        json.dump(entity_to_idx, f)

    with open(os.path.join(output_dir, 'training_metadata.json'), 'w') as f:
        json.dump({
            'epochs': epochs,
            'dim': dim,
            'entity_count': tf.num_entities,
            'relation_count': tf.num_relations,
        }, f)

    print(f'Embeddings saved to {output_dir}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--triples', required=True)
    parser.add_argument('--output', default='kge_embeddings/')
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--dim', type=int, default=128)
    args = parser.parse_args()
    train(args.triples, args.output, args.epochs, args.dim)
```

**Deliverable:**
```bash
python manage.py export_kge_triples --output kge_triples.tsv
wc -l kge_triples.tsv  # Verify triples were exported

python scripts/train_kge.py --triples kge_triples.tsv --epochs 50 --dim 64
ls kge_embeddings/
# Should contain: entity_embeddings.npy, entity_to_idx.json,
# relation_embeddings.npy, training_metadata.json
```

---

## Phase 7: KGE as 5th Connection Signal

**Read first:**
- Phase 6 output (kge_embeddings/ must exist)
- `PATTERNS-knowledge-graphs.md` integration architecture section
- `apps/research/connections.py` WEIGHTS dict and `compute_connections()`
- `apps/notebook/engine.py` `run_engine()` and `_get_active_engines()`

**What this phase does:**
Loads the trained RotatE embeddings from Phase 6 and uses them as a 5th
signal in both the research-side `connections.py` and the notebook-side
`engine.py`. Objects whose SHA hashes are geometrically close in embedding
space are likely connected, even if they share no text.

### 7a. Create apps/notebook/vector_store.py

```python
"""
KGE embedding store: loads trained RotatE embeddings and provides
cosine similarity queries against the entity embedding matrix.

Loaded once at startup into module memory. Uses numpy for fast
matrix operations. Falls back gracefully if embeddings don't exist.
"""

import json
import logging
import os

import numpy as np

logger = logging.getLogger(__name__)

_EMBEDDING_DIR = os.environ.get('KGE_EMBEDDINGS_DIR', 'kge_embeddings/')

_store = {
    'embeddings': None,       # np.ndarray [n_entities, dim]
    'entity_to_idx': None,    # dict: entity_id -> matrix row
    'loaded': False,
}


def load_embeddings(embeddings_dir: str = _EMBEDDING_DIR) -> bool:
    """
    Load KGE embeddings from disk into module-level cache.
    Returns True if successful, False if embeddings don't exist.
    """
    global _store
    emb_path = os.path.join(embeddings_dir, 'entity_embeddings.npy')
    idx_path = os.path.join(embeddings_dir, 'entity_to_idx.json')

    if not os.path.exists(emb_path) or not os.path.exists(idx_path):
        logger.info('KGE embeddings not found at %s. Skipping.', embeddings_dir)
        return False

    try:
        embeddings = np.load(emb_path)
        with open(idx_path) as f:
            entity_to_idx = json.load(f)

        # L2-normalize for cosine similarity via dot product
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        _store['embeddings'] = embeddings / norms
        _store['entity_to_idx'] = entity_to_idx
        _store['loaded'] = True

        logger.info(
            'KGE embeddings loaded: %d entities, dim=%d',
            embeddings.shape[0], embeddings.shape[1],
        )
        return True

    except Exception as exc:
        logger.error('Failed to load KGE embeddings: %s', exc)
        return False


def is_loaded() -> bool:
    return _store['loaded']


def get_embedding(entity_id: str) -> np.ndarray | None:
    """Return the normalized embedding vector for an entity ID."""
    if not _store['loaded']:
        return None
    idx = _store['entity_to_idx'].get(entity_id)
    if idx is None:
        return None
    return _store['embeddings'][idx]


def find_similar_entities(
    entity_id: str,
    top_n: int = 20,
    threshold: float = 0.5,
) -> list[dict]:
    """
    Find entities geometrically close to entity_id in embedding space.

    Returns list of {entity_id, similarity} dicts sorted by similarity.
    """
    if not _store['loaded']:
        return []

    vec = get_embedding(entity_id)
    if vec is None:
        return []

    # Dot product against all entity rows (embeddings are L2-normalized)
    similarities = _store['embeddings'] @ vec  # Shape: [n_entities]

    # Build results (skip self)
    idx_map = _store['entity_to_idx']
    reverse_map = {v: k for k, v in idx_map.items()}

    results = []
    top_indices = np.argsort(similarities)[::-1]

    for i in top_indices[:top_n + 1]:
        sim = float(similarities[i])
        if sim < threshold:
            break
        eid = reverse_map.get(int(i))
        if eid and eid != entity_id:
            results.append({'entity_id': eid, 'similarity': round(sim, 4)})

    return results[:top_n]
```

### 7b. Add KGE pass to notebook engine.py

```python
def _run_kge_engine(obj: Object, config: dict) -> list[Edge]:
    """
    Knowledge Graph Embedding similarity pass.

    Uses RotatE embeddings (trained offline via scripts/train_kge.py)
    to find Objects that are geometrically close in embedding space.
    Unlike SBERT (which measures text similarity) and TF-IDF (which
    measures term overlap), KGE captures relational structure:
    Objects that play similar roles in the graph cluster together
    even if their text is very different.

    Example: A Person Object with many "mentions" edges will have an
    embedding near other highly-cited Person Objects, even if their
    text descriptions are completely different.

    Falls back to no-op if embeddings haven't been trained yet.
    """
    from .vector_store import find_similar_entities, is_loaded

    if not is_loaded():
        logger.debug('KGE embeddings not loaded. Skipping KGE pass.')
        return []

    threshold = config.get('kge_threshold', 0.55)

    # Entity ID is the Object's SHA hash (matches what we exported)
    entity_id = obj.sha_hash
    if not entity_id:
        return []

    similar = find_similar_entities(
        entity_id=entity_id,
        top_n=15,
        threshold=threshold,
    )

    if not similar:
        return []

    # Map SHA hashes back to Object PKs
    sha_list = [m['entity_id'] for m in similar]
    sha_map = {
        o.sha_hash: o
        for o in Object.objects.filter(sha_hash__in=sha_list, is_deleted=False)
    }

    new_edges = []
    sim_map = {m['entity_id']: m['similarity'] for m in similar}

    for sha, other in sha_map.items():
        if other.pk == obj.pk:
            continue

        sim = sim_map.get(sha, 0.5)
        reason = (
            _llm_explanation(obj, other, strength=sim)
            or (
                f'Structurally similar in the knowledge graph '
                f'(relational embedding proximity: {sim:.0%}). '
                f'These objects play similar roles in the network.'
            )
        )

        edge, created = Edge.objects.get_or_create(
            from_object=obj,
            to_object=other,
            edge_type='shared_topic',
            defaults={
                'reason': reason,
                'strength': round(sim, 4),
                'is_auto': True,
                'engine': 'kge',
            },
        )
        if created:
            new_edges.append(edge)

    return new_edges
```

### 7c. Register KGE in run_engine

```python
if 'kge' in active_engines:
    kge_edges = _run_kge_engine(obj, config)
    results['edges_from_kge'] = len(kge_edges)
    all_new_edges.extend(kge_edges)
else:
    results['edges_from_kge'] = 0
```

Add `'kge'` to `HIGH_NOVELTY_CONFIG['engines']`.
Load embeddings at Django startup by calling `vector_store.load_embeddings()`
from `apps/notebook/apps.py` `ready()` method.

### 7d. Add KGE as 5th signal to connections.py WEIGHTS

Update the research-side engine WEIGHTS:

```python
WEIGHTS = {
    'shared_sources': 0.35,   # Was 0.40
    'shared_tags':    0.10,   # Was 0.15
    'shared_threads': 0.15,   # Was 0.20
    'semantic':       0.20,   # Unchanged
    'graph_embedding': 0.20,  # NEW: KGE structural similarity
}
```

Add a `compute_kge_similarity()` function to `connections.py` that calls
`vector_store.find_similar_entities()` using Source slugs as entity IDs
(they were exported as part of the SourceLink triples in Phase 6).

**Deliverable:**
```bash
python manage.py run_engine_all --limit 20
# Edges with engine='kge' appear in admin
# Verify they connect Objects that share structural roles (e.g.,
# two heavily-cited Source objects cluster together in embedding space)
```

---

## Phase 8: FAISS ANN for SBERT Pass

**Read first:**
- `PATTERNS-semantic-search.md` FAISS integration section
- Phase 1 (SBERT pass implementation)
- `refs/faiss/` (IndexFlatIP, add, search API)

**What this phase does:**
The SBERT pass in Phase 1 calls `find_most_similar()` which encodes all
candidate texts in a batch and does pairwise cosine similarity. At 500 objects
this is fine. At 5,000 objects it is 5,000 SBERT encode calls per engine run.
FAISS ANN replaces the linear scan with approximate nearest-neighbor search
in O(sqrt(n)) time.

Only relevant once the corpus exceeds ~1,000 objects. Build it now so the
architecture is correct from the start.

### 8a. Add FAISS-backed index to vector_store.py

```python
_FAISS_INDEX = {
    'index': None,
    'object_pks': [],   # Ordered list: FAISS row i -> Object PK
    'built_at': None,
    'size': 0,
}
_FAISS_CACHE_MAX_AGE = 7200  # 2 hours


def _faiss_available() -> bool:
    try:
        import faiss
        return True
    except ImportError:
        return False


def get_or_build_faiss_index(embedding_dim: int = 384, max_objects: int = 5000):
    """
    Build or return a cached FAISS IndexFlatIP over all Object SBERT embeddings.

    IndexFlatIP = exact inner product search on L2-normalized vectors.
    This gives cosine similarity via dot product, with no approximation error.
    For >10,000 objects, upgrade to IndexIVFFlat with nlist=256.
    """
    if not _faiss_available():
        return None

    import faiss
    import time

    cache = _FAISS_INDEX
    current_count = Object.objects.filter(is_deleted=False).count()
    now = time.time()

    needs_rebuild = (
        cache['index'] is None
        or cache['built_at'] is None
        or (now - cache['built_at']) > _FAISS_CACHE_MAX_AGE
        or abs(current_count - cache['size']) > 100
    )

    if not needs_rebuild:
        return cache

    if not _SBERT_AVAILABLE:
        return None

    logger.info('Building FAISS index over %d Objects...', current_count)

    objects = list(
        Object.objects.filter(is_deleted=False)
        .exclude(search_text='')
        .order_by('-captured_at')
        [:max_objects]
    )

    if len(objects) < 10:
        return None

    texts = [_build_full_text(obj) for obj in objects]
    pks = [obj.pk for obj in objects]

    try:
        embeddings = batch_encode(texts)
        if embeddings is None:
            return None

        # L2-normalize for cosine similarity
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        embeddings = embeddings / norms

        index = faiss.IndexFlatIP(embedding_dim)
        index.add(embeddings.astype('float32'))

        cache['index'] = index
        cache['object_pks'] = pks
        cache['built_at'] = now
        cache['size'] = current_count

        logger.info('FAISS index built: %d vectors, dim=%d', len(objects), embedding_dim)
        return cache

    except Exception as exc:
        logger.error('FAISS index build failed: %s', exc)
        return None
```

### 8b. Update _run_semantic_engine to use FAISS when available

```python
def _run_semantic_engine(obj: Object, config: dict) -> list[Edge]:
    # ... existing code ...

    # Try FAISS first (faster at scale)
    from .vector_store import get_or_build_faiss_index
    faiss_cache = get_or_build_faiss_index()

    if faiss_cache and faiss_cache['index'] is not None:
        return _run_semantic_via_faiss(obj, config, faiss_cache)
    else:
        return _run_semantic_via_batch(obj, config)  # Original Phase 1 path


def _run_semantic_via_faiss(obj, config, faiss_cache) -> list[Edge]:
    """FAISS-accelerated SBERT similarity search."""
    import faiss
    import numpy as np

    threshold = config.get('sbert_threshold', 0.45)
    top_k = 30

    my_text = _build_full_text(obj)
    if not my_text:
        return []

    try:
        my_vec = batch_encode([my_text])
        if my_vec is None:
            return []

        my_vec = my_vec / (np.linalg.norm(my_vec) + 1e-8)
        D, I = faiss_cache['index'].search(my_vec.astype('float32'), top_k + 1)
    except Exception as exc:
        logger.warning('FAISS search failed: %s', exc)
        return []

    pks = faiss_cache['object_pks']
    pk_set = set(pks)
    pk_map = {p: i for i, p in enumerate(pks)}
    new_edges = []

    for sim, idx in zip(D[0], I[0]):
        if idx < 0 or sim < threshold:
            continue
        other_pk = pks[idx]
        if other_pk == obj.pk:
            continue

        try:
            other = Object.objects.select_related('object_type').get(
                pk=other_pk, is_deleted=False
            )
        except Object.DoesNotExist:
            continue

        reason = (
            _llm_explanation(obj, other, strength=float(sim))
            or _synthesize_sbert_reason(obj, other, float(sim))
        )

        edge, created = Edge.objects.get_or_create(
            from_object=obj,
            to_object=other,
            edge_type='semantic',
            defaults={
                'reason': reason,
                'strength': round(float(sim), 4),
                'is_auto': True,
                'engine': 'sbert_faiss',
            },
        )
        if created:
            new_edges.append(edge)

    return new_edges
```

**Deliverable:**
With 100+ Objects in the database, run the engine. Engine logs should show
`sbert_faiss` engine name on semantic edges, confirming FAISS path is taken.
Compare timing: should be significantly faster than batch encode path at scale.

---

## Phase 9: Louvain Community Detection and Cluster Proximity Resurface Signal

**Read first:**
- `PATTERNS-graph-algorithms.md` community detection section
- `apps/notebook/resurface.py` (built in Phase 8 of CLAUDE.md)
- NetworkX Louvain docs (`networkx.algorithms.community.louvain_communities`)

**What this phase does:**
Adds the 4th Resurfacer signal: Cluster Proximity. An Object that is
semantically near a recently-active cluster deserves resurfacing because
the cluster is "hot" -- lots of new connections forming -- and this Object
might belong in the conversation even though it was never explicitly linked.

Uses NetworkX Louvain community detection to identify clusters in the
Object graph, then SBERT (or spaCy fallback) to measure how close a
candidate Object is to the centroid of the most recently active cluster.

### 9a. Add Louvain import to resurface.py

```python
try:
    import networkx as nx
    _NX_AVAILABLE = True
except ImportError:
    _NX_AVAILABLE = False
    nx = None
```

### 9b. Add community detection helper

```python
def _detect_communities(edge_qs) -> dict[int, int]:
    """
    Run Louvain community detection on the Object graph.

    Returns: dict mapping Object PK -> community ID.
    Community ID is an arbitrary integer; same ID = same cluster.
    """
    if not _NX_AVAILABLE:
        return {}

    G = nx.Graph()

    for edge in edge_qs:
        G.add_edge(
            edge.from_object_id,
            edge.to_object_id,
            weight=float(edge.strength or 0.5),
        )

    if len(G.nodes) < 5:
        return {}

    try:
        communities = nx.community.louvain_communities(G, resolution=1.0, seed=42)
        pk_to_community = {}
        for cid, community in enumerate(communities):
            for pk in community:
                pk_to_community[pk] = cid
        return pk_to_community
    except Exception as exc:
        logger.warning('Louvain detection failed: %s', exc)
        return {}
```

### 9c. Implement cluster_proximity signal

```python
def cluster_proximity(qs, now, **kwargs):
    """
    Boost Objects semantically near a recently-active cluster.

    A cluster is "active" if it has gained new Edges in the last 7 days.
    Proximity is measured by SBERT cosine similarity to cluster centroid
    (or spaCy word vector fallback in production).

    This catches the "you haven't connected these but they belong together"
    case: an Object that is conceptually in a cluster's territory but
    was captured before the cluster formed.

    Weight: 0.25 for high-proximity objects (sim > 0.6),
            0.10 for medium-proximity (sim 0.4-0.6).
    """
    from .models import Edge

    results = []

    # Find which community has been most recently active
    recent_edges = Edge.objects.filter(
        created_at__gte=now - timedelta(days=7),
        from_object__is_deleted=False,
        to_object__is_deleted=False,
    ).select_related('from_object', 'to_object')

    all_edges = Edge.objects.filter(
        from_object__is_deleted=False,
        to_object__is_deleted=False,
    )

    pk_to_community = _detect_communities(all_edges)
    if not pk_to_community:
        return results

    # Count recent edge activity per community
    community_activity = Counter()
    for edge in recent_edges:
        c = pk_to_community.get(edge.from_object_id)
        if c is not None:
            community_activity[c] += 1

    if not community_activity:
        return results

    hottest_community = community_activity.most_common(1)[0][0]

    # Get all Object PKs in the hot community
    hot_pks = {pk for pk, cid in pk_to_community.items() if cid == hottest_community}

    if not hot_pks:
        return results

    # Candidate Objects: NOT in the hot community
    candidates = [obj for obj in qs if obj.pk not in hot_pks]
    if not candidates:
        return results

    # Build centroid text of the hot community (average of Object bodies)
    hot_objects = list(
        Object.objects.filter(pk__in=hot_pks, is_deleted=False)[:50]
    )
    centroid_text = ' '.join(_build_full_text(o) for o in hot_objects)[:3000]

    if not centroid_text:
        return results

    # Measure proximity via SBERT or spaCy fallback
    try:
        if _SBERT_AVAILABLE:
            from apps.research.advanced_nlp import find_most_similar
            from apps.notebook.engine import _build_full_text
            candidate_texts = [_build_full_text(c) for c in candidates]
            candidate_ids = [str(c.pk) for c in candidates]
            matches = find_most_similar(
                target_text=centroid_text,
                candidate_texts=candidate_texts,
                candidate_ids=candidate_ids,
                top_n=10,
                threshold=0.40,
            )
        else:
            # spaCy fallback: word vector cosine
            matches = _spacy_proximity_fallback(centroid_text, candidates)
    except Exception as exc:
        logger.warning('Cluster proximity scoring failed: %s', exc)
        return results

    pk_map = {str(c.pk): c for c in candidates}

    for match in matches:
        sim = match['similarity']
        obj = pk_map.get(match['id'])
        if not obj:
            continue

        score = 0.25 if sim > 0.6 else 0.10
        activity = community_activity[hottest_community]

        results.append((
            obj.pk,
            score,
            'cluster_proximity',
            f'Conceptually close to an active cluster that gained '
            f'{activity} new connection(s) this week.',
        ))

    return results


def _spacy_proximity_fallback(centroid_text: str, candidates) -> list[dict]:
    """spaCy word vector cosine similarity as cluster proximity fallback."""
    try:
        from apps.notebook.engine import nlp, _build_full_text
        if nlp is None:
            return []

        centroid_doc = nlp(centroid_text[:10000])
        if not centroid_doc.has_vector:
            return []

        results = []
        for obj in candidates:
            obj_doc = nlp(_build_full_text(obj)[:5000])
            if obj_doc.has_vector:
                sim = centroid_doc.similarity(obj_doc)
                if sim > 0.40:
                    results.append({'id': str(obj.pk), 'similarity': round(sim, 4)})

        results.sort(key=lambda r: r['similarity'], reverse=True)
        return results[:10]

    except Exception as exc:
        logger.warning('spaCy proximity fallback failed: %s', exc)
        return []
```

### 9d. Register cluster_proximity in score_candidates

In `resurface.py`, update `SIGNAL_LABELS` and add to `score_candidates`:

```python
SIGNAL_LABELS = {
    'connection_recency': 'Connection Recency',
    'orphan': 'Waiting for Connections',
    'engagement_decay': 'Fading From View',
    'temporal_resonance': 'This Day in History',
    'contextual_fit': 'In Your Current Context',
    'cluster_proximity': 'Near an Active Cluster',  # NEW
}

# In score_candidates(), add cluster_proximity to the signal list:
for signal_fn in [connection_recency, orphan_score, engagement_decay,
                  temporal_resonance, contextual_fit, cluster_proximity]:  # Added
    ...
```

**Deliverable:**
Create 10+ Objects with related content. Run engine to form edges.
Call `GET /api/v1/notebook/resurface/`. At least one card should
have `signal: "cluster_proximity"` with explanation about the active cluster.

---

## Phase 10: Engine Bridge (Notebook Objects <-> Research Sources)

**Read first:**
- `apps/research/models.py` (Source, SourceLink models)
- `apps/notebook/models.py` (Object, ResolvedEntity)
- `apps/research/connections.py` (how research-side connections are computed)

**What this phase does:**
When a CommonPlace Object (type: Source) references the same real-world source
as a `research.Source` record, the connections discovered on the research side
should propagate to the notebook side. This bridges the two engines.

The mapping key: a notebook `Object` with `url` matching `Source.url`, or
a `ResolvedEntity` whose `text` matches `Source.title`.

### 10a. Create apps/notebook/research_bridge.py

```python
"""
Bridge between notebook Objects and research Sources.

When an Object has the same URL or title as a research Source,
research-side connections (backlinks, tensions, source graph)
propagate to the Object as additional Edges.

This runs as a separate step after the main engine passes,
not as part of the per-Object engine run (it would be too slow).
Run it via: python manage.py sync_research_bridge --limit 50
"""
import logging
from django.db.models import Q
from .models import Edge, Object

logger = logging.getLogger(__name__)


def find_research_match(obj: Object):
    """
    Find the research.Source that corresponds to a notebook Object.
    Returns a Source instance or None.
    """
    try:
        from apps.research.models import Source
    except ImportError:
        return None

    # Match by URL (exact)
    if obj.url:
        match = Source.objects.filter(url=obj.url).first()
        if match:
            return match

    # Match by title (case-insensitive)
    if obj.title:
        match = Source.objects.filter(title__iexact=obj.title).first()
        if match:
            return match

    return None


def propagate_research_connections(obj: Object) -> int:
    """
    If obj has a matching research Source, find other notebook Objects
    that match Sources connected to it, and create Edges between them.

    Returns the number of new Edges created.
    """
    source = find_research_match(obj)
    if not source:
        return 0

    try:
        from apps.research.connections import compute_connections
    except ImportError:
        return 0

    # Get research-side connections for this Source
    connections = compute_connections(
        content_slug=source.slug,
        content_type='source',
        include_semantic=False,  # Fast structural signals only in bridge
        top_n=10,
    )

    new_edge_count = 0

    for conn in connections:
        # Find the notebook Object that matches the connected research content
        connected_slug = conn.get('content_slug', '')
        connected_title = conn.get('content_title', '')
        connected_score = conn.get('score', 0.3)

        # Try to find a matching Object
        other_obj = None
        if connected_slug:
            other_obj = Object.objects.filter(
                Q(slug=connected_slug) | Q(url__icontains=connected_slug),
                is_deleted=False,
            ).exclude(pk=obj.pk).first()

        if not other_obj and connected_title:
            other_obj = Object.objects.filter(
                title__iexact=connected_title,
                is_deleted=False,
            ).exclude(pk=obj.pk).first()

        if not other_obj:
            continue

        explanation = conn.get('explanation', 'Connected via research source graph.')

        edge, created = Edge.objects.get_or_create(
            from_object=obj,
            to_object=other_obj,
            edge_type='shared_topic',
            defaults={
                'reason': f'Research connection: {explanation}',
                'strength': round(connected_score, 4),
                'is_auto': True,
                'engine': 'research_bridge',
            },
        )
        if created:
            new_edge_count += 1

    return new_edge_count
```

### 10b. Create management command: sync_research_bridge

```python
# management/commands/sync_research_bridge.py
from django.core.management.base import BaseCommand
from apps.notebook.models import Object
from apps.notebook.research_bridge import propagate_research_connections


class Command(BaseCommand):
    help = 'Sync research-side connections to notebook Objects.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)

    def handle(self, *args, **options):
        objects = Object.objects.filter(
            is_deleted=False,
            object_type__slug='source',
        )[:options['limit']]

        total = 0
        for obj in objects:
            n = propagate_research_connections(obj)
            if n:
                self.stdout.write(f'{obj.display_title[:40]}: +{n} edges')
            total += n

        self.stdout.write(self.style.SUCCESS(f'Bridge sync complete. {total} new edges.'))
```

**Deliverable:**
```bash
python manage.py sync_research_bridge --limit 20
# Edges with engine='research_bridge' appear in admin
# These should connect notebook Objects to other Objects via research-side knowledge
```

---

## Engine Run Order Summary

When `run_engine(obj)` is called, the full pipeline runs in this order:

```
Pass 1: spaCy NER
  -- Extract PERSON, ORG, GPE, etc. into ResolvedEntity records
  -- Auto-objectify high-confidence PERSON/ORG entities
  -- Always runs. No config gate.

Pass 2: Shared entity edges
  -- Find other Objects mentioning same entity
  -- Edge type: 'shared_entity', engine: 'spacy'
  -- Always runs.

Pass 3: Topic similarity (Jaccard)
  -- Keyword overlap with threshold from engine_config
  -- Edge type: 'shared_topic', engine: 'spacy'
  -- Always runs. Fast.

Pass 4: TF-IDF (Phase 2)
  -- Corpus-fitted term frequency similarity
  -- Edge type: 'shared_topic', engine: 'tfidf'
  -- Runs when: 'tfidf' in active_engines (auto at 500+ objects)

Pass 5: SBERT semantic (Phase 1)
  -- 384-dim contextual embeddings, cosine similarity
  -- Edge type: 'semantic', engine: 'sbert' or 'sbert_faiss'
  -- Runs when: HAS_PYTORCH and 'sbert' in config.engines
  -- Uses FAISS when index is built (Phase 8)

Pass 6: NLI contradiction (Phase 3)
  -- Cross-encoder contradiction/entailment classification
  -- Edge types: 'contradicts', 'supports', engine: 'nli'
  -- Runs when: HAS_PYTORCH and config.get('nli_enabled', False)

Pass 7: KGE structural (Phase 7)
  -- RotatE embedding proximity
  -- Edge type: 'shared_topic', engine: 'kge'
  -- Runs when: 'kge' in active_engines and embeddings loaded

Connection Nodes created for all new Edges found above.
```

---

## Deliverable Verification Commands

After all phases are complete:

```bash
# Full engine run with all passes
python manage.py run_engine_all --limit 20

# Verify edge distribution by engine
python manage.py shell -c "
from apps.notebook.models import Edge
from django.db.models import Count
print(Edge.objects.values('engine', 'edge_type').annotate(n=Count('id')).order_by('-n'))
"
# Expected output:
# [
#   {'engine': 'spacy', 'edge_type': 'shared_entity', 'n': ...},
#   {'engine': 'spacy', 'edge_type': 'shared_topic', 'n': ...},
#   {'engine': 'tfidf', 'edge_type': 'shared_topic', 'n': ...},
#   {'engine': 'sbert', 'edge_type': 'semantic', 'n': ...},      # dev only
#   {'engine': 'nli', 'edge_type': 'contradicts', 'n': ...},     # dev only
#   {'engine': 'kge', 'edge_type': 'shared_topic', 'n': ...},    # after training
#   {'engine': 'research_bridge', 'edge_type': 'shared_topic', 'n': ...},
# ]

# NLP mode check
python manage.py shell -c "
from apps.research.advanced_nlp import get_nlp_status
import json
print(json.dumps(get_nlp_status(), indent=2))
"

# KGE embedding check
python manage.py shell -c "
from apps.notebook.vector_store import load_embeddings, is_loaded
load_embeddings()
print('KGE loaded:', is_loaded())
"

# Resurface signal check (all 4 signals firing)
# GET /api/v1/notebook/resurface/?count=5
# Verify: connection_recency, engagement_decay, temporal_resonance,
#         cluster_proximity all appear in returned cards
```

---

## Key Files to Read Before Any Engine Work

| File | Why |
|------|-----|
| `apps/notebook/engine.py` | Current engine state. Understand all stubs before replacing them. |
| `apps/research/advanced_nlp.py` | Full SBERT + NLI API. Already built. Just needs to be called. |
| `apps/research/connections.py` | Research-side WEIGHTS. Phase 7 modifies this. |
| `apps/research/tensions.py` | Structural tension detection. Phase 3 adds semantic equivalent. |
| `PATTERNS-knowledge-graphs.md` | KGE theory, RotatE geometry, PyKEEN pipeline. Read before Phase 6. |
| `PATTERNS-semantic-search.md` | FAISS architecture, sentence-transformer patterns. Read before Phase 8. |
| `PATTERNS-graph-algorithms.md` | NetworkX community detection, Louvain. Read before Phase 9. |
| `scipy-pro-plugin-spec-v2.md` | Full agent registry and build priority order from product owner. |

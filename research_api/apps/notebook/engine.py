"""
Connection Engine: finds relationships between Objects.

Seven-pass pipeline with per-Notebook configuration.

Pass 1: Named entity extraction (spaCy NER) -- always runs
Pass 2: Shared entity edge discovery -- always runs
Pass 3: Topic similarity via Jaccard keyword overlap -- always runs (fast)
Pass 4: TF-IDF corpus similarity -- production-safe, auto-activates at 500+ objects
Pass 5: SBERT semantic similarity -- dev/local only (requires PyTorch)
        Uses FAISS ANN index when available (vector_store.py)
Pass 6: NLI contradiction/support detection -- dev/local only, config-gated
Pass 7: KGE structural similarity -- dev/local only, requires trained embeddings

Also: auto-objectification of PERSON/ORG entities,
LLM explanation generation for strong connections (ANTHROPIC_API_KEY + env flag),
connection Node creation for every new Edge,
TF-IDF corpus caching with signal-driven invalidation.

Two-mode deployment contract:
  LOCAL/DEV: PyTorch installed, all passes active.
  PRODUCTION (Railway): No PyTorch. Passes 5, 6, 7 silently skip.
  The API is identical in both modes. Never let an ImportError escape.
"""

import logging
import os
import re
import time

from django.db.models import Q

from .models import Edge, Node, Object, ObjectType, ResolvedEntity, Timeline

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# spaCy model
# ---------------------------------------------------------------------------

try:
    import spacy
    nlp = spacy.load('en_core_web_sm')
except (OSError, ImportError):
    nlp = None
    logger.warning(
        'spaCy model not found. Run: python3 -m spacy download en_core_web_sm'
    )

# ---------------------------------------------------------------------------
# SBERT (optional -- dev/local only, requires PyTorch)
# ---------------------------------------------------------------------------

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
    HAS_PYTORCH = False
    batch_encode = None
    find_most_similar = None
    sentence_similarity = None

# ---------------------------------------------------------------------------
# TF-IDF (sklearn -- production safe, no PyTorch required)
# ---------------------------------------------------------------------------

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine
    _TFIDF_AVAILABLE = True
except ImportError:
    _TFIDF_AVAILABLE = False
    TfidfVectorizer = None
    sklearn_cosine = None

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ENTITY_TYPES_OF_INTEREST = {
    'PERSON', 'ORG', 'GPE', 'LOC', 'EVENT', 'WORK_OF_ART', 'DATE',
}

ENTITY_TO_OBJECT_TYPE = {
    'PERSON': 'person',
    'ORG': 'organization',
    'GPE': 'place',
    'LOC': 'place',
    'EVENT': 'event',
    'WORK_OF_ART': 'source',
}

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

DEFAULT_ENGINE_CONFIG = {
    'engines': ['spacy'],
    'topic_threshold': 0.3,
    'max_candidates': 500,
}

HIGH_NOVELTY_CONFIG = {
    'engines': ['spacy', 'sbert', 'tfidf', 'kge'],
    'topic_threshold': 0.10,
    'max_candidates': 1000,
    'sbert_threshold': 0.45,
    'tfidf_threshold': 0.20,
    'kge_threshold': 0.60,
    'nli_enabled': True,
    'entity_types': [
        'PERSON', 'ORG', 'GPE', 'LOC', 'EVENT', 'WORK_OF_ART', 'DATE',
    ],
}


def interpolate_config(novelty: float) -> dict:
    """
    Interpolate between conservative and aggressive engine configs.
    novelty: float 0.0 (conservative) to 1.0 (aggressive)
    """
    conservative = DEFAULT_ENGINE_CONFIG
    aggressive = HIGH_NOVELTY_CONFIG
    return {
        'engines': aggressive['engines'] if novelty > 0.5 else conservative['engines'],
        'topic_threshold': (
            conservative['topic_threshold']
            - (conservative['topic_threshold'] - aggressive['topic_threshold']) * novelty
        ),
        'max_candidates': int(
            conservative['max_candidates']
            + (aggressive['max_candidates'] - conservative['max_candidates']) * novelty
        ),
        'sbert_threshold': aggressive.get('sbert_threshold', 0.45),
        'tfidf_threshold': aggressive.get('tfidf_threshold', 0.20),
        'kge_threshold': aggressive.get('kge_threshold', 0.60),
        'nli_enabled': novelty > 0.7,
        'entity_types': (
            aggressive['entity_types']
            if novelty > 0.3
            else conservative.get('entity_types', aggressive['entity_types'])
        ),
    }


# ---------------------------------------------------------------------------
# Engine configuration
# ---------------------------------------------------------------------------

def get_engine_config(notebook=None) -> dict:
    """Return engine config, optionally merged with Notebook overrides."""
    config = dict(DEFAULT_ENGINE_CONFIG)
    if notebook and notebook.engine_config:
        config.update(notebook.engine_config)
    return config


def _get_active_engines(config: dict, object_count: int) -> set[str]:
    """
    Determine active engines based on config and corpus size.
    TF-IDF auto-activates at 500+ objects regardless of config.
    """
    engines = set(config.get('engines', ['spacy']))
    if object_count >= 500:
        engines.add('tfidf')
    return engines


def _get_master_timeline() -> Timeline | None:
    return Timeline.objects.filter(is_master=True).first()


# ---------------------------------------------------------------------------
# Text extraction helpers
# ---------------------------------------------------------------------------

def _extract_keywords(text: str) -> set[str]:
    """Extract significant words (3+ chars, not stop words)."""
    words = re.findall(r'\b[a-z]{3,}\b', text.lower())
    return {w for w in words if w not in STOP_WORDS}


def _build_full_text(obj: Object) -> str:
    """
    Build the full text for an Object by combining title, body,
    and all text-bearing Component values.
    """
    parts = [obj.title or '', obj.body or '']

    for comp in obj.components.select_related('component_type').all():
        val = comp.value
        if isinstance(val, str):
            parts.append(val)
        elif isinstance(val, dict) and 'text' in val:
            parts.append(str(val['text']))
        elif isinstance(val, (int, float)):
            pass
        else:
            parts.append(str(val))

    return ' '.join(p for p in parts if p)


# ---------------------------------------------------------------------------
# Pass 1: Entity extraction
# ---------------------------------------------------------------------------

def extract_entities(obj: Object, config: dict | None = None) -> list[ResolvedEntity]:
    """Extract named entities from an Object using spaCy NER."""
    if nlp is None:
        return []

    text = _build_full_text(obj)
    if not text:
        return []

    doc = nlp(text)
    entities = []

    for ent in doc.ents:
        if ent.label_ not in ENTITY_TYPES_OF_INTEREST:
            continue
        if len(ent.text.strip()) < 2:
            continue

        normalized = ent.text.lower().strip()

        existing = ResolvedEntity.objects.filter(
            source_object=obj,
            normalized_text=normalized,
            entity_type=ent.label_,
        ).first()

        if existing:
            entities.append(existing)
            continue

        resolved_object = None
        target_type_slug = ENTITY_TO_OBJECT_TYPE.get(ent.label_)

        if target_type_slug:
            resolved_object = (
                Object.objects
                .filter(object_type__slug=target_type_slug)
                .filter(
                    Q(title__icontains=ent.text)
                    | Q(search_text__icontains=normalized)
                )
                .first()
            )

        entity = ResolvedEntity.objects.create(
            source_object=obj,
            text=ent.text,
            entity_type=ent.label_,
            normalized_text=normalized,
            resolved_object=resolved_object,
        )
        entities.append(entity)

        if resolved_object and resolved_object.id != obj.id:
            Edge.objects.get_or_create(
                from_object=obj,
                to_object=resolved_object,
                edge_type='mentions',
                defaults={
                    'reason': f'This note mentions {ent.text} ({ent.label_.lower()}).',
                    'strength': 0.7,
                    'is_auto': True,
                    'engine': 'spacy',
                },
            )

    return entities


# ---------------------------------------------------------------------------
# Pass 2: Shared entity connections
# ---------------------------------------------------------------------------

def find_shared_entity_connections(obj: Object, config: dict | None = None) -> list[Edge]:
    """Find other Objects that share entities with this one."""
    my_entities = ResolvedEntity.objects.filter(source_object=obj)
    new_edges = []

    for entity in my_entities:
        siblings = (
            ResolvedEntity.objects
            .filter(
                normalized_text=entity.normalized_text,
                entity_type=entity.entity_type,
                source_object__is_deleted=False,
            )
            .exclude(source_object=obj)
            .select_related('source_object')
        )

        for sibling in siblings:
            other_obj = sibling.source_object
            type_label = {
                'PERSON': 'person', 'ORG': 'organization', 'GPE': 'place',
                'LOC': 'location', 'EVENT': 'event', 'WORK_OF_ART': 'work',
            }.get(entity.entity_type, entity.entity_type.lower())

            edge, created = Edge.objects.get_or_create(
                from_object=obj,
                to_object=other_obj,
                edge_type='shared_entity',
                defaults={
                    'reason': f'Both mention {entity.text}, the same {type_label}.',
                    'strength': 0.6,
                    'is_auto': True,
                    'engine': 'spacy',
                },
            )
            if created:
                new_edges.append(edge)

    return new_edges


# ---------------------------------------------------------------------------
# Pass 3: Topic similarity (Jaccard)
# ---------------------------------------------------------------------------

def _synthesize_topic_reason(my_keywords: set, other_keywords: set, obj_a, obj_b) -> str:
    overlap = my_keywords & other_keywords
    top = sorted(overlap, key=len, reverse=True)[:4]
    type_a = obj_a.object_type.name if obj_a.object_type else 'note'

    if not top:
        return f'These two {type_a.lower()}s share thematic content.'
    if len(top) == 1:
        return f'Both discuss {top[0]}.'

    concept_str = ', '.join(top[:-1]) + f' and {top[-1]}'
    return f'Both explore {concept_str}.'


def find_topic_connections(obj: Object, config: dict | None = None) -> list[Edge]:
    """Find Objects with overlapping content via Jaccard keyword analysis."""
    if config is None:
        config = DEFAULT_ENGINE_CONFIG

    threshold = config.get('topic_threshold', 0.3)
    max_candidates = config.get('max_candidates', 500)

    my_text = _build_full_text(obj)
    my_keywords = _extract_keywords(my_text)
    if len(my_keywords) < 3:
        return []

    candidates = (
        Object.objects
        .filter(is_deleted=False)
        .exclude(pk=obj.pk)
        .exclude(search_text='')
        .order_by('-captured_at')
        [:max_candidates]
    )

    new_edges = []

    for other in candidates:
        other_keywords = _extract_keywords(_build_full_text(other))
        if len(other_keywords) < 3:
            continue

        overlap = my_keywords & other_keywords
        union = my_keywords | other_keywords
        if not union:
            continue

        jaccard = len(overlap) / len(union)
        strength = min(jaccard * 2, 1.0)

        if jaccard >= threshold and len(overlap) >= 3:
            reason = (
                _llm_explanation(obj, other, strength=strength)
                or _synthesize_topic_reason(my_keywords, other_keywords, obj, other)
            )
            edge, created = Edge.objects.get_or_create(
                from_object=obj,
                to_object=other,
                edge_type='shared_topic',
                defaults={
                    'reason': reason,
                    'strength': strength,
                    'is_auto': True,
                    'engine': 'spacy',
                },
            )
            if created:
                new_edges.append(edge)

    return new_edges


# ---------------------------------------------------------------------------
# Pass 4: TF-IDF (production-safe, no PyTorch)
# ---------------------------------------------------------------------------

_TFIDF_CACHE: dict = {
    'vectorizer': None,
    'matrix': None,
    'object_pks': [],
    'built_at': None,
    'size': 0,
}
_TFIDF_CACHE_MAX_AGE_SECONDS = 3600


def invalidate_tfidf_cache() -> None:
    """Signal-driven invalidation. Called from signals.py on Object create/delete."""
    _TFIDF_CACHE['built_at'] = None


def _get_or_build_tfidf_corpus(max_objects: int = 2000) -> dict | None:
    """
    Return a fitted TF-IDF matrix over all active Objects.
    Builds lazily, caches, invalidates hourly or on 50-object corpus drift.
    """
    if not _TFIDF_AVAILABLE:
        return None

    now = time.time()
    cache = _TFIDF_CACHE
    current_count = Object.objects.filter(is_deleted=False).count()

    needs_rebuild = (
        cache['vectorizer'] is None
        or cache['built_at'] is None
        or (now - cache['built_at']) > _TFIDF_CACHE_MAX_AGE_SECONDS
        or abs(current_count - cache['size']) > 50
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
        return None

    texts = [_build_full_text(obj) for obj in objects]
    pks = [obj.pk for obj in objects]

    try:
        vectorizer = TfidfVectorizer(
            max_features=10000,
            min_df=2,
            max_df=0.85,
            ngram_range=(1, 2),
            stop_words='english',
            sublinear_tf=True,
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


def _synthesize_tfidf_reason(obj_a: Object, obj_b: Object, similarity: float) -> str:
    type_a = obj_a.object_type.name.lower() if obj_a.object_type else 'note'
    type_b = obj_b.object_type.name.lower() if obj_b.object_type else 'note'
    return (
        f'This {type_a} and this {type_b} share significant vocabulary '
        f'and terminology (TF-IDF similarity: {similarity:.0%}).'
    )


def _run_tfidf_engine(obj: Object, config: dict) -> list[Edge]:
    """
    TF-IDF topic similarity pass. Production-safe: no PyTorch required.
    Catches connections that Jaccard misses via IDF-weighted rare terms.
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

    pk_index = pks.index(obj.pk) if obj.pk in pks else None

    if pk_index is not None:
        my_vec = matrix[pk_index]
    else:
        try:
            my_vec = vectorizer.transform([_build_full_text(obj)])
        except Exception as exc:
            logger.warning('TF-IDF transform failed for new object: %s', exc)
            return []

    try:
        sims = sklearn_cosine(my_vec, matrix).flatten()
    except Exception as exc:
        logger.warning('TF-IDF similarity computation failed: %s', exc)
        return []

    new_edges = []

    for i, sim in enumerate(sims):
        if pk_index is not None and i == pk_index:
            continue
        if float(sim) < threshold:
            continue

        other_pk = pks[i]
        if other_pk == obj.pk:
            continue

        try:
            other = Object.objects.select_related('object_type').get(pk=other_pk, is_deleted=False)
        except Object.DoesNotExist:
            continue

        strength = round(float(sim), 4)
        reason = (
            _llm_explanation(obj, other, strength=strength)
            or _synthesize_tfidf_reason(obj, other, strength)
        )

        edge, created = Edge.objects.get_or_create(
            from_object=obj,
            to_object=other,
            edge_type='shared_topic',
            defaults={
                'reason': reason,
                'strength': strength,
                'is_auto': True,
                'engine': 'tfidf',
            },
        )
        if created:
            new_edges.append(edge)

    return new_edges


# ---------------------------------------------------------------------------
# Pass 5: SBERT semantic similarity (dev/local only)
# Uses FAISS ANN index when available, falls back to brute-force batch encode
# ---------------------------------------------------------------------------

def _synthesize_sbert_reason(obj_a: Object, obj_b: Object, similarity: float) -> str:
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
    return f'These share underlying conceptual territory (semantic similarity: {similarity:.0%}).'


def _run_semantic_engine(obj: Object, config: dict) -> list[Edge]:
    """
    SBERT semantic similarity pass. Dev/local only, requires PyTorch.

    Prefers the FAISS ANN index (from vector_store.py) for O(log n) search.
    Falls back to brute-force batch encoding if FAISS index is not built.
    Finds Objects semantically related even when no keywords overlap.
    """
    if not _SBERT_AVAILABLE:
        logger.debug('SBERT unavailable. Skipping semantic engine pass.')
        return []

    threshold = config.get('sbert_threshold', 0.45)
    max_candidates = config.get('max_candidates', 500)
    new_edges = []

    # Try FAISS ANN first (fast)
    try:
        from apps.notebook.vector_store import faiss_find_similar_objects
        faiss_matches = faiss_find_similar_objects(obj, top_n=20, threshold=threshold)

        if faiss_matches:
            pk_map = {
                o.pk: o
                for o in Object.objects.filter(
                    pk__in=[m['pk'] for m in faiss_matches],
                    is_deleted=False,
                ).select_related('object_type')
            }
            for match in faiss_matches:
                other = pk_map.get(match['pk'])
                if not other:
                    continue
                sim = match['score']
                reason = (
                    _llm_explanation(obj, other, strength=sim)
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
                        'engine': 'sbert_faiss',
                    },
                )
                if created:
                    new_edges.append(edge)
            return new_edges
    except Exception as exc:
        logger.debug('FAISS SBERT path failed, falling back to batch encode: %s', exc)

    # Fallback: brute-force batch encode
    my_text = _build_full_text(obj)
    if not my_text or len(my_text) < 20:
        return []

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

    try:
        matches = find_most_similar(
            target_text=my_text,
            candidate_texts=[_build_full_text(c) for c in candidates],
            candidate_ids=[str(c.pk) for c in candidates],
            top_n=20,
            threshold=threshold,
        )
    except Exception as exc:
        logger.warning('SBERT find_most_similar failed: %s', exc)
        return []

    pk_map = {str(c.pk): c for c in candidates}

    for match in matches:
        other = pk_map.get(match['id'])
        if not other:
            continue
        sim = match['similarity']
        reason = (
            _llm_explanation(obj, other, strength=sim)
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


# ---------------------------------------------------------------------------
# Pass 6: NLI contradiction/support detection (dev/local only)
# ---------------------------------------------------------------------------

def _synthesize_contradiction_reason(obj_a, obj_b, similarity, prob) -> str:
    type_a = obj_a.object_type.name.lower() if obj_a.object_type else 'note'
    type_b = obj_b.object_type.name.lower() if obj_b.object_type else 'note'
    return (
        f'This {type_a} and this {type_b} discuss related topics '
        f'(similarity: {similarity:.0%}) but appear to make conflicting '
        f'claims (contradiction probability: {prob:.0%}). '
        f'This may represent a genuine intellectual tension worth examining.'
    )


def _synthesize_entailment_reason(obj_a, obj_b, similarity, prob) -> str:
    type_a = obj_a.object_type.name.lower() if obj_a.object_type else 'note'
    type_b = obj_b.object_type.name.lower() if obj_b.object_type else 'note'
    return (
        f'This {type_a} and this {type_b} discuss related topics '
        f'(similarity: {similarity:.0%}) and appear to reinforce each other '
        f'(agreement probability: {prob:.0%}).'
    )


def _run_nli_contradiction_pass(obj: Object, config: dict) -> list[Edge]:
    """
    NLI contradiction/support detection. Dev/local only.
    SBERT pre-screens candidates before NLI to avoid O(n^2) inference cost.
    """
    if not _SBERT_AVAILABLE:
        return []

    try:
        from apps.research.advanced_nlp import analyze_pair
        if not HAS_PYTORCH:
            return []
    except ImportError:
        return []

    contradiction_threshold = config.get('contradiction_threshold', 0.60)
    entailment_threshold = config.get('entailment_threshold', 0.65)
    similarity_gate = config.get('nli_similarity_gate', 0.40)
    max_nli_candidates = config.get('max_nli_candidates', 30)

    my_text = _build_full_text(obj)
    if not my_text or len(my_text) < 30:
        return []

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
        similar_matches = find_most_similar(
            target_text=my_text,
            candidate_texts=[_build_full_text(c) for c in candidates],
            candidate_ids=[str(c.pk) for c in candidates],
            top_n=max_nli_candidates,
            threshold=similarity_gate,
        )
    except Exception as exc:
        logger.warning('NLI pass: SBERT screening failed: %s', exc)
        return []

    pk_map = {str(c.pk): c for c in candidates}
    new_edges = []

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
            strength = round(contradiction_prob * float(similarity), 4)
            reason = (
                _llm_explanation(obj, other, strength=strength)
                or _synthesize_contradiction_reason(obj, other, float(similarity), contradiction_prob)
            )
            edge, created = Edge.objects.get_or_create(
                from_object=obj,
                to_object=other,
                edge_type='contradicts',
                defaults={
                    'reason': reason,
                    'strength': strength,
                    'is_auto': True,
                    'engine': 'nli',
                },
            )
            if created:
                new_edges.append(edge)

        elif entailment_prob >= entailment_threshold:
            strength = round(entailment_prob * float(similarity), 4)
            reason = (
                _llm_explanation(obj, other, strength=strength)
                or _synthesize_entailment_reason(obj, other, float(similarity), entailment_prob)
            )
            edge, created = Edge.objects.get_or_create(
                from_object=obj,
                to_object=other,
                edge_type='supports',
                defaults={
                    'reason': reason,
                    'strength': strength,
                    'is_auto': True,
                    'engine': 'nli',
                },
            )
            if created:
                new_edges.append(edge)

    return new_edges


# ---------------------------------------------------------------------------
# Pass 7: KGE structural similarity (dev/local only)
# Requires trained embeddings from scripts/train_kge.py
# ---------------------------------------------------------------------------

def _synthesize_kge_reason(obj_a: Object, obj_b: Object, score: float) -> str:
    """
    KGE connections are structural -- they reflect graph position, not text.
    The reason should make that clear so the user understands why they're seeing it.
    """
    type_a = obj_a.object_type.name.lower() if obj_a.object_type else 'note'
    type_b = obj_b.object_type.name.lower() if obj_b.object_type else 'note'
    return (
        f'This {type_a} and this {type_b} occupy structurally similar positions '
        f'in the knowledge graph -- they are cited by, or cite, similar things '
        f'(graph similarity: {score:.0%}). '
        f'They may play the same conceptual role in different contexts.'
    )


def _run_kge_engine(obj: Object, config: dict) -> list[Edge]:
    """
    KGE structural similarity pass. Dev/local only, requires trained embeddings.

    Loads RotatE (or TransE) entity embeddings trained on the Edge graph
    and finds Objects that occupy structurally similar positions, even if
    their text content is completely different.

    This is the fifth signal -- it captures relationships that no text-based
    engine can see: two Source Objects that are consistently co-cited by the
    same Notes, or two Person Objects that appear in the same organizational
    contexts. The graph structure reveals roles and functions that the text alone
    does not express.

    KGE engine is gated by: embeddings loaded in vector_store.kge_store AND
    'kge' in active engines. Auto-skips if embeddings haven't been trained.
    """
    try:
        from apps.notebook.vector_store import kge_store
    except ImportError:
        return []

    if not kge_store.is_loaded:
        return []

    sha = obj.sha_hash
    if not sha:
        return []

    threshold = config.get('kge_threshold', 0.60)

    try:
        matches = kge_store.find_similar_entities(
            sha_hash=sha,
            top_n=15,
            threshold=threshold,
        )
    except Exception as exc:
        logger.warning('KGE find_similar_entities failed: %s', exc)
        return []

    if not matches:
        return []

    sha_map = {
        o.sha_hash: o
        for o in Object.objects.filter(
            sha_hash__in=[m['sha_hash'] for m in matches],
            is_deleted=False,
        ).select_related('object_type')
    }

    new_edges = []

    for match in matches:
        other = sha_map.get(match['sha_hash'])
        if not other or other.pk == obj.pk:
            continue

        score = match['score']
        reason = (
            _llm_explanation(obj, other, strength=score)
            or _synthesize_kge_reason(obj, other, score)
        )

        edge, created = Edge.objects.get_or_create(
            from_object=obj,
            to_object=other,
            edge_type='shared_topic',
            defaults={
                'reason': reason,
                'strength': round(score, 4),
                'is_auto': True,
                'engine': 'kge',
            },
        )
        if created:
            new_edges.append(edge)

    return new_edges


# ---------------------------------------------------------------------------
# LLM explanation (optional -- gated by env var)
# ---------------------------------------------------------------------------

LLM_EXPLANATION_ENABLED = os.environ.get('COMMONPLACE_LLM_EXPLANATIONS', '').lower() == 'true'
LLM_EXPLANATION_MIN_STRENGTH = 0.55
LLM_MAX_TOKENS = 80


def _llm_explanation(obj_a: Object, obj_b: Object, strength: float = 0.5) -> str | None:
    """
    Call Claude Haiku to generate a high-quality plain-English explanation.

    Gated by: COMMONPLACE_LLM_EXPLANATIONS=true and strength >= 0.55.
    Uses Haiku for latency and cost. 80-token cap enforces single-sentence output.
    Falls back to None on any failure -- caller uses template reason instead.
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
        f'Object A ({type_a}): "{title_a}"\n{body_a}\n\n'
        f'Object B ({type_b}): "{title_b}"\n{body_b}\n\n'
        f'In one sentence, explain the conceptual connection between these two objects. '
        f'Be specific about what they share, not generic. '
        f'Do not say "both" or "related" or "similar". '
        f'Name the actual idea or theme that connects them. '
        f'Start directly with the explanation, no preamble.'
    )

    try:
        import httpx

        api_key = os.environ.get('ANTHROPIC_API_KEY', '')
        if not api_key:
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
        text = response.json()['content'][0]['text'].strip()

        if len(text) < 15 or len(text) > 300:
            return None

        return text

    except Exception as exc:
        logger.warning('LLM explanation failed: %s', exc)
        return None


# ---------------------------------------------------------------------------
# Auto-objectification
# ---------------------------------------------------------------------------

AUTO_OBJECTIFY_MIN_LENGTH = 4


def auto_objectify(obj: Object) -> list[Object]:
    """
    Auto-create Objects for high-confidence PERSON/ORG entities.
    Guards: 4-char minimum, not a stop word, case-insensitive dedup.
    PERSON and ORG only -- GPE/LOC are too noisy for auto-creation.
    """
    entities = ResolvedEntity.objects.filter(
        source_object=obj,
        resolved_object__isnull=True,
        entity_type__in=['PERSON', 'ORG'],
    )

    created_objects = []

    for entity in entities:
        text = entity.text.strip()

        if len(text) < AUTO_OBJECTIFY_MIN_LENGTH:
            continue
        if text.lower() in STOP_WORDS:
            continue

        target_type_slug = ENTITY_TO_OBJECT_TYPE.get(entity.entity_type)
        if not target_type_slug:
            continue

        existing = Object.objects.filter(
            object_type__slug=target_type_slug,
            is_deleted=False,
        ).filter(
            Q(title__iexact=text) | Q(title__icontains=entity.normalized_text)
        ).first()

        if existing:
            entity.resolved_object = existing
            entity.save(update_fields=['resolved_object'])
            continue

        object_type = ObjectType.objects.filter(slug=target_type_slug).first()
        if not object_type:
            continue

        new_obj = Object.objects.create(
            title=text,
            object_type=object_type,
            body=f'Auto-created from mention in: {obj.display_title}',
            status='active',
            capture_method='auto',
            notebook=obj.notebook,
        )

        entity.resolved_object = new_obj
        entity.save(update_fields=['resolved_object'])

        Edge.objects.get_or_create(
            from_object=obj,
            to_object=new_obj,
            edge_type='mentions',
            defaults={
                'reason': f'{obj.display_title[:40]} mentions {text}.',
                'strength': 0.7,
                'is_auto': True,
                'engine': 'spacy',
            },
        )

        created_objects.append(new_obj)

    return created_objects


# ---------------------------------------------------------------------------
# Connection Node creation
# ---------------------------------------------------------------------------

def _create_connection_nodes(edges: list[Edge], engine_name: str) -> int:
    """Create Timeline Nodes for newly discovered Edges."""
    timeline = _get_master_timeline()
    if not timeline:
        logger.warning('No master Timeline found. Skipping connection Nodes.')
        return 0

    count = 0
    for edge in edges:
        Node.objects.create(
            node_type='connection',
            title=(
                f'{edge.from_object.display_title[:30]} '
                f'<> {edge.to_object.display_title[:30]}'
            ),
            body=edge.reason,
            object_ref=edge.from_object,
            timeline=timeline,
            tags=[engine_name, edge.edge_type],
        )
        count += 1

    return count


# ---------------------------------------------------------------------------
# Main engine runner
# ---------------------------------------------------------------------------

def run_engine(obj: Object, notebook=None) -> dict:
    """
    Run the full connection engine on a single Object.

    Pass order:
      1. spaCy NER + auto-objectification (always)
      2. Shared entity edges (always)
      3. Jaccard topic similarity (always, fast)
      4. TF-IDF (production-safe, auto at 500+ objects)
      5. SBERT semantic via FAISS or batch encode (dev only)
      6. NLI contradiction/support (dev only, config-gated)
      7. KGE structural similarity (dev only, requires trained embeddings)
    """
    config = get_engine_config(notebook or obj.notebook)
    object_count = Object.objects.count()
    active_engines = _get_active_engines(config, object_count)

    results = {
        'engines_active': sorted(active_engines),
        'entities_extracted': 0,
        'edges_from_entities': 0,
        'edges_from_shared': 0,
        'edges_from_topics': 0,
        'edges_from_tfidf': 0,
        'edges_from_semantic': 0,
        'edges_from_nli': 0,
        'edges_from_kge': 0,
        'objects_auto_created': 0,
        'connection_nodes_created': 0,
    }

    all_new_edges = []

    # Pass 1 + auto-objectification
    if 'spacy' in active_engines:
        entities = extract_entities(obj, config)
        results['entities_extracted'] = len(entities)
        created = auto_objectify(obj)
        results['objects_auto_created'] = len(created)

    # Pass 2
    if 'spacy' in active_engines:
        shared_edges = find_shared_entity_connections(obj, config)
        results['edges_from_shared'] = len(shared_edges)
        all_new_edges.extend(shared_edges)

    # Pass 3
    if 'spacy' in active_engines:
        topic_edges = find_topic_connections(obj, config)
        results['edges_from_topics'] = len(topic_edges)
        all_new_edges.extend(topic_edges)

    # Pass 4
    if 'tfidf' in active_engines:
        tfidf_edges = _run_tfidf_engine(obj, config)
        results['edges_from_tfidf'] = len(tfidf_edges)
        all_new_edges.extend(tfidf_edges)

    # Pass 5
    if 'sbert' in active_engines or 'semantic' in active_engines:
        semantic_edges = _run_semantic_engine(obj, config)
        results['edges_from_semantic'] = len(semantic_edges)
        all_new_edges.extend(semantic_edges)

    # Pass 6
    if config.get('nli_enabled', False) and _SBERT_AVAILABLE:
        nli_edges = _run_nli_contradiction_pass(obj, config)
        results['edges_from_nli'] = len(nli_edges)
        all_new_edges.extend(nli_edges)

    # Pass 7
    if 'kge' in active_engines:
        kge_edges = _run_kge_engine(obj, config)
        results['edges_from_kge'] = len(kge_edges)
        all_new_edges.extend(kge_edges)

    # Entity mention edge count (includes edges from Pass 1)
    results['edges_from_entities'] = (
        Edge.objects.filter(from_object=obj, edge_type='mentions', is_auto=True).count()
    )

    nodes_created = _create_connection_nodes(all_new_edges, engine_name='engine')
    results['connection_nodes_created'] = nodes_created

    logger.info('Connection engine results for "%s": %s', obj.display_title[:40], results)

    return results

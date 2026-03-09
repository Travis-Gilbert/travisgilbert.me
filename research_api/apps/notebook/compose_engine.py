"""
Compose engine: lightweight 3-pass query for real-time write-time discovery.

Designed for sub-200ms response. Runs NER, Jaccard, and TF-IDF (if warm).
Does NOT run SBERT, NLI, or KGE: those are post-save full-engine passes.

Called by compose_related_view. Never called from signals or post_save.
"""

import logging
import re

from .models import Object, ResolvedEntity

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Text-only NER helper (no DB writes)
# ---------------------------------------------------------------------------

def extract_entities_from_text(text: str) -> list[tuple[str, str]]:
    """
    Run spaCy NER on raw text, return (normalized_text, entity_type) pairs.
    Does NOT write to the database. Safe to call from any context.
    """
    from .engine import nlp, ENTITY_TYPES_OF_INTEREST

    if nlp is None:
        return []

    doc = nlp(text)
    return [
        (ent.text.lower().strip(), ent.label_)
        for ent in doc.ents
        if ent.label_ in ENTITY_TYPES_OF_INTEREST and len(ent.text.strip()) >= 2
    ]


# ---------------------------------------------------------------------------
# Core compose query
# ---------------------------------------------------------------------------

def run_compose_query(
    text: str,
    notebook_slug: str | None = None,
    limit: int = 8,
    min_score: float = 0.25,
) -> dict:
    """
    Lightweight 3-pass query for the Compose Mode Live Graph.

    Returns:
    {
        "passes_run": ["ner", "keyword", "tfidf"],
        "objects": [
            {
                "id": "object:42",
                "type": "concept",
                "type_color": "#2D5F6B",
                "title": "Desire Paths",
                "body_preview": "Informal trails worn...",
                "score": 0.67,
                "signal": "keyword",
                "explanation": "Both discuss how latent behavior bypasses designed systems."
            }
        ]
    }
    """
    passes_run = []
    results_map: dict[int, dict] = {}  # object_pk -> result dict

    base_qs = Object.objects.filter(is_deleted=False, status='active')
    if notebook_slug:
        base_qs = base_qs.filter(notebook__slug=notebook_slug)

    # ------------------------------------------------------------------
    # Pass 1: NER entity matching
    # ------------------------------------------------------------------
    entities = extract_entities_from_text(text)
    if entities:
        passes_run.append('ner')
        normalized_texts = [e[0] for e in entities]

        # Find existing ResolvedEntity records that match extracted entities
        matches = (
            ResolvedEntity.objects
            .filter(normalized_text__in=normalized_texts)
            .filter(source_object__is_deleted=False)
            .select_related('source_object__object_type')
        )
        if notebook_slug:
            matches = matches.filter(
                source_object__notebook__slug=notebook_slug
            )

        for match in matches:
            pk = match.source_object_id
            if pk not in results_map:
                obj = match.source_object
                results_map[pk] = {
                    'pk': pk,
                    'score': 0.70,
                    'signal': 'ner',
                    'explanation': (
                        f'Both mention {match.text} ({match.entity_type}).'
                    ),
                }

    # ------------------------------------------------------------------
    # Pass 2: Jaccard keyword similarity
    # ------------------------------------------------------------------
    from .engine import _extract_keywords

    input_keywords = _extract_keywords(text)
    if input_keywords:
        passes_run.append('keyword')

        candidates = base_qs.exclude(pk__in=results_map.keys())
        for obj in candidates.select_related('object_type').iterator():
            obj_text = ' '.join(
                filter(None, [obj.title or '', obj.body or ''])
            )
            obj_keywords = _extract_keywords(obj_text)
            if not obj_keywords:
                continue

            intersection = input_keywords & obj_keywords
            union = input_keywords | obj_keywords
            jaccard = len(intersection) / len(union) if union else 0.0
            score = min(jaccard * 2, 1.0)

            if score >= min_score:
                shared = sorted(intersection)[:3]
                results_map[obj.pk] = {
                    'pk': obj.pk,
                    'score': score,
                    'signal': 'keyword',
                    'explanation': (
                        f'Shared vocabulary: {", ".join(shared)}.'
                    ),
                }

    # ------------------------------------------------------------------
    # Pass 3: TF-IDF (conditional, only if cache is warm)
    # ------------------------------------------------------------------
    from .engine import _get_or_build_tfidf_corpus

    corpus = _get_or_build_tfidf_corpus()
    if corpus is not None and corpus.get('vectorizer') is not None:
        passes_run.append('tfidf')

        try:
            vectorizer = corpus['vectorizer']
            matrix = corpus['matrix']
            object_pks = corpus['object_pks']

            input_vec = vectorizer.transform([text])

            # Compute cosine similarity (TF-IDF vectors are already L2-normed
            # by TfidfVectorizer, so dot product = cosine similarity)
            from sklearn.metrics.pairwise import cosine_similarity
            similarities = cosine_similarity(input_vec, matrix).flatten()

            for idx, sim in enumerate(similarities):
                if sim < min_score:
                    continue
                pk = object_pks[idx]
                if pk in results_map:
                    continue

                results_map[pk] = {
                    'pk': pk,
                    'score': float(sim),
                    'signal': 'tfidf',
                    'explanation': 'Statistical topic similarity via TF-IDF.',
                }
        except Exception as exc:
            logger.debug('TF-IDF pass skipped in compose query: %s', exc)

    # ------------------------------------------------------------------
    # Merge, sort, limit, and serialize
    # ------------------------------------------------------------------
    sorted_results = sorted(
        results_map.values(), key=lambda r: r['score'], reverse=True
    )[:limit]

    if not sorted_results:
        return {'passes_run': passes_run, 'objects': []}

    # Fetch full Object records for serialization
    pks = [r['pk'] for r in sorted_results]
    obj_map = {
        o.pk: o
        for o in Object.objects.filter(pk__in=pks).select_related('object_type')
    }

    objects = []
    for r in sorted_results:
        obj = obj_map.get(r['pk'])
        if not obj:
            continue

        body_preview = (obj.body or '')[:120]
        if len(obj.body or '') > 120:
            body_preview += '...'

        objects.append({
            'id': f'object:{obj.pk}',
            'type': obj.object_type.slug if obj.object_type else 'note',
            'type_color': obj.object_type.color if obj.object_type else '#2D5F6B',
            'title': obj.display_title,
            'body_preview': body_preview,
            'score': round(r['score'], 3),
            'signal': r['signal'],
            'explanation': r['explanation'],
        })

    return {'passes_run': passes_run, 'objects': objects}

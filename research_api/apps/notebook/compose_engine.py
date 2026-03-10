"""
Compose engine: strict-priority live query for write-time discovery.

Priority order (spec): TF-IDF -> SBERT (FAISS) -> KGE -> NER -> NLI (optional)

Design goals:
- Real-time responses with graceful degradation when advanced models are absent.
- Merge duplicates by maximum score, keeping dominant signal/explanation.
- Preserve a stable response contract for the Compose live graph.
"""

import logging
from dataclasses import dataclass

from .models import Object, ResolvedEntity

logger = logging.getLogger(__name__)

PASS_PRIORITY = ('tfidf', 'sbert', 'kge', 'ner', 'nli')

DEFAULT_PASS_SET = {'tfidf', 'sbert', 'kge', 'ner'}
NLI_PASS_ALIASES = {'nli', 'supports', 'contradicts'}


@dataclass
class Candidate:
    pk: int
    score: float
    signal: str
    explanation: str


# ---------------------------------------------------------------------------
# Text-only NER helper (no DB writes)
# ---------------------------------------------------------------------------

def extract_entities_from_text(text: str) -> list[tuple[str, str]]:
    """
    Run spaCy NER on raw text, return (normalized_text, entity_type) pairs.
    Does NOT write to the database. Safe to call from any context.
    """
    from .engine import ENTITY_TYPES_OF_INTEREST, nlp

    if nlp is None:
        return []

    doc = nlp(text)
    return [
        (ent.text.lower().strip(), ent.label_)
        for ent in doc.ents
        if ent.label_ in ENTITY_TYPES_OF_INTEREST and len(ent.text.strip()) >= 2
    ]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_passes(
    requested_passes: list[str] | None,
    enable_nli: bool,
) -> list[str]:
    if not requested_passes:
        enabled = set(DEFAULT_PASS_SET)
        if enable_nli:
            enabled.add('nli')
        return [p for p in PASS_PRIORITY if p in enabled]

    lowered = {str(p).strip().lower() for p in requested_passes if str(p).strip()}
    enabled = {
        'tfidf' if p == 'keyword' else p
        for p in lowered
        if p in set(PASS_PRIORITY) | NLI_PASS_ALIASES | {'keyword'}
    }
    if enabled & NLI_PASS_ALIASES:
        enabled.add('nli')
    enabled.discard('supports')
    enabled.discard('contradicts')

    if enable_nli:
        enabled.add('nli')

    # If the caller provided an empty/invalid set, keep sensible defaults.
    if not enabled:
        enabled = set(DEFAULT_PASS_SET)

    return [p for p in PASS_PRIORITY if p in enabled]


def _merge_candidate(
    results_map: dict[int, Candidate],
    pk: int,
    score: float,
    signal: str,
    explanation: str,
) -> None:
    current = results_map.get(pk)
    if current is None:
        results_map[pk] = Candidate(
            pk=pk,
            score=float(score),
            signal=signal,
            explanation=explanation,
        )
        return

    # Dominant signal/explanation is kept from the max score contributor.
    if float(score) > current.score:
        current.score = float(score)
        current.signal = signal
        current.explanation = explanation


def _build_degraded(
    sbert_requested: bool,
    sbert_available: bool,
    kge_requested: bool,
    kge_available: bool,
) -> dict:
    reasons: list[str] = []

    if sbert_requested and not sbert_available:
        reasons.append('sbert_unavailable')
    if kge_requested and not kge_available:
        reasons.append('kge_unavailable')

    return {
        'degraded': bool(reasons),
        'sbert_unavailable': sbert_requested and not sbert_available,
        'kge_unavailable': kge_requested and not kge_available,
        'reasons': reasons,
    }


# ---------------------------------------------------------------------------
# Core compose query
# ---------------------------------------------------------------------------

def run_compose_query(
    text: str,
    notebook_slug: str | None = None,
    limit: int = 8,
    min_score: float = 0.25,
    enable_nli: bool = False,
    requested_passes: list[str] | None = None,
) -> dict:
    """
    Strict-priority compose query for the Compose Mode Live Graph.

    Returns:
    {
      "passes_run": ["tfidf", "sbert", ...],
      "objects": [
        {
          "id": "object:42",
          "slug": "desire-paths",
          "type": "concept",
          "type_color": "#2D5F6B",
          "title": "Desire Paths",
          "body_preview": "Informal trails worn...",
          "score": 0.67,
          "signal": "tfidf",
          "explanation": "...",
          "dominant_signal": "tfidf",
          "dominant_explanation": "...",
        }
      ],
      "degraded": {
          "degraded": true,
          "sbert_unavailable": true,
          "kge_unavailable": false,
          "reasons": ["sbert_unavailable"]
      }
    }
    """
    pass_order = _resolve_passes(requested_passes, enable_nli)
    passes_run: list[str] = []

    results_map: dict[int, Candidate] = {}

    base_qs = Object.objects.filter(is_deleted=False, status='active')
    if notebook_slug:
        base_qs = base_qs.filter(notebook__slug=notebook_slug)

    scoped_ids: set[int] | None = None
    if notebook_slug:
        scoped_ids = set(base_qs.values_list('pk', flat=True))

    # Resolve engine availability once for degraded metadata.
    try:
        from .engine import HAS_PYTORCH as _HAS_PYTORCH
    except Exception:
        _HAS_PYTORCH = False

    try:
        from .vector_store import _SBERT_AVAILABLE as _SBERT_AVAILABLE_RAW, kge_store

        sbert_available = bool(_SBERT_AVAILABLE_RAW)
        kge_available = bool(getattr(kge_store, 'is_loaded', False))
    except Exception:
        sbert_available = False
        kge_available = False

    # Precompute entities once so NER and KGE can share them.
    extracted_entities = extract_entities_from_text(text)

    # ------------------------------------------------------------------
    # Pass 1: TF-IDF
    # ------------------------------------------------------------------
    if 'tfidf' in pass_order:
        try:
            from .engine import _get_or_build_tfidf_corpus
            from sklearn.metrics.pairwise import cosine_similarity

            corpus = _get_or_build_tfidf_corpus()
            if corpus is not None and corpus.get('vectorizer') is not None:
                vectorizer = corpus['vectorizer']
                matrix = corpus['matrix']
                object_pks = corpus['object_pks']

                input_vec = vectorizer.transform([text])
                similarities = cosine_similarity(input_vec, matrix).flatten()

                for idx, sim in enumerate(similarities):
                    pk = object_pks[idx]
                    if scoped_ids is not None and pk not in scoped_ids:
                        continue
                    if float(sim) < min_score:
                        continue

                    _merge_candidate(
                        results_map,
                        pk=pk,
                        score=float(sim),
                        signal='tfidf',
                        explanation='Statistical topic similarity via TF-IDF.',
                    )
        except Exception as exc:
            logger.debug('Compose TF-IDF pass skipped: %s', exc)

        passes_run.append('tfidf')

    # ------------------------------------------------------------------
    # Pass 2: SBERT semantic similarity via FAISS
    # ------------------------------------------------------------------
    if 'sbert' in pass_order:
        if sbert_available:
            try:
                from .vector_store import faiss_find_similar_text

                sbert_matches = faiss_find_similar_text(
                    text=text,
                    top_n=max(limit * 2, 12),
                    threshold=max(min_score, 0.35),
                    notebook_slug=notebook_slug,
                )
                for match in sbert_matches:
                    _merge_candidate(
                        results_map,
                        pk=match['pk'],
                        score=float(match['score']),
                        signal='sbert',
                        explanation='Semantic similarity via SBERT embeddings (FAISS).',
                    )
            except Exception as exc:
                logger.debug('Compose SBERT pass skipped: %s', exc)

            passes_run.append('sbert')

    # ------------------------------------------------------------------
    # Pass 3: KGE structural similarity
    # ------------------------------------------------------------------
    if 'kge' in pass_order:
        if kge_available:
            try:
                seed_shas: set[str] = set()

                if extracted_entities:
                    normalized_texts = [e[0] for e in extracted_entities]
                    entity_matches = (
                        ResolvedEntity.objects
                        .filter(normalized_text__in=normalized_texts)
                        .filter(source_object__is_deleted=False)
                        .select_related('source_object')
                    )
                    if notebook_slug:
                        entity_matches = entity_matches.filter(
                            source_object__notebook__slug=notebook_slug,
                        )

                    for match in entity_matches:
                        if match.source_object and match.source_object.sha_hash:
                            seed_shas.add(match.source_object.sha_hash)

                # If there are no direct entity seeds, use top scored objects so far.
                if not seed_shas and results_map:
                    top_seed_pks = [
                        c.pk for c in sorted(
                            results_map.values(),
                            key=lambda r: r.score,
                            reverse=True,
                        )[:3]
                    ]
                    for obj in Object.objects.filter(pk__in=top_seed_pks):
                        if obj.sha_hash:
                            seed_shas.add(obj.sha_hash)

                if seed_shas:
                    sha_to_pk = {
                        o.sha_hash: o.pk
                        for o in Object.objects.filter(
                            sha_hash__isnull=False,
                            is_deleted=False,
                        ).exclude(sha_hash='')
                    }

                    for seed_sha in seed_shas:
                        matches = kge_store.find_similar_entities(
                            sha_hash=seed_sha,
                            top_n=max(limit, 8),
                            threshold=max(min_score, 0.45),
                        )
                        for match in matches:
                            pk = sha_to_pk.get(match['sha_hash'])
                            if not pk:
                                continue
                            if scoped_ids is not None and pk not in scoped_ids:
                                continue
                            _merge_candidate(
                                results_map,
                                pk=pk,
                                score=float(match['score']),
                                signal='kge',
                                explanation='Structural similarity in the knowledge graph (KGE).',
                            )
            except Exception as exc:
                logger.debug('Compose KGE pass skipped: %s', exc)

            passes_run.append('kge')

    # ------------------------------------------------------------------
    # Pass 4: NER entity overlap (supplementary)
    # ------------------------------------------------------------------
    if 'ner' in pass_order:
        if extracted_entities:
            normalized_texts = [e[0] for e in extracted_entities]

            matches = (
                ResolvedEntity.objects
                .filter(normalized_text__in=normalized_texts)
                .filter(source_object__is_deleted=False)
                .filter(source_object__status='active')
                .select_related('source_object__object_type')
            )
            if notebook_slug:
                matches = matches.filter(source_object__notebook__slug=notebook_slug)

            for match in matches:
                if not match.source_object_id:
                    continue
                _merge_candidate(
                    results_map,
                    pk=match.source_object_id,
                    score=0.58,
                    signal='ner',
                    explanation=f'Both mention {match.text} ({match.entity_type}).',
                )

        passes_run.append('ner')

    # ------------------------------------------------------------------
    # Pass 5: Optional NLI signal (support/contradiction)
    # ------------------------------------------------------------------
    if 'nli' in pass_order and enable_nli:
        if _HAS_PYTORCH:
            try:
                from apps.research.advanced_nlp import analyze_pair
                from .engine import _build_full_text

                # NLI only refines existing top candidates.
                ranked = sorted(
                    results_map.values(),
                    key=lambda r: r.score,
                    reverse=True,
                )[: max(limit * 2, 10)]

                candidate_map = {
                    o.pk: o
                    for o in Object.objects.filter(
                        pk__in=[r.pk for r in ranked],
                        is_deleted=False,
                    ).select_related('object_type')
                }

                for item in ranked:
                    obj = candidate_map.get(item.pk)
                    if obj is None:
                        continue

                    other_text = _build_full_text(obj)
                    if len(other_text or '') < 30:
                        continue

                    analysis = analyze_pair(text, other_text)
                    relationship = (analysis or {}).get('relationship') or {}
                    probs = relationship.get('probabilities') or {}
                    contradiction_prob = float(probs.get('contradiction', 0.0) or 0.0)
                    entailment_prob = float(probs.get('entailment', 0.0) or 0.0)
                    similarity = float((analysis or {}).get('similarity') or item.score or 0.0)

                    if contradiction_prob >= 0.60 and contradiction_prob >= entailment_prob:
                        score = contradiction_prob * max(similarity, item.score)
                        _merge_candidate(
                            results_map,
                            pk=obj.pk,
                            score=score,
                            signal='contradicts',
                            explanation=(
                                'NLI detected claim-level contradiction '
                                f'({contradiction_prob:.0%} contradiction).'
                            ),
                        )
                    elif entailment_prob >= 0.60 and entailment_prob >= contradiction_prob:
                        score = entailment_prob * max(similarity, item.score)
                        _merge_candidate(
                            results_map,
                            pk=obj.pk,
                            score=score,
                            signal='supports',
                            explanation=(
                                'NLI detected claim-level support '
                                f'({entailment_prob:.0%} entailment).'
                            ),
                        )
            except Exception as exc:
                logger.debug('Compose NLI pass skipped: %s', exc)

            passes_run.append('nli')

    # ------------------------------------------------------------------
    # Merge, sort, limit, and serialize
    # ------------------------------------------------------------------
    ranked_results = sorted(
        results_map.values(),
        key=lambda r: (r.score, -r.pk),
        reverse=True,
    )[:limit]

    degraded = _build_degraded(
        sbert_requested='sbert' in pass_order,
        sbert_available=sbert_available,
        kge_requested='kge' in pass_order,
        kge_available=kge_available,
    )

    if not ranked_results:
        return {
            'passes_run': passes_run,
            'objects': [],
            'degraded': degraded,
        }

    pks = [r.pk for r in ranked_results]
    obj_map = {
        o.pk: o
        for o in Object.objects.filter(pk__in=pks).select_related('object_type')
    }

    objects = []
    for result in ranked_results:
        obj = obj_map.get(result.pk)
        if not obj:
            continue

        body_preview = (obj.body or '')[:120]
        if len(obj.body or '') > 120:
            body_preview += '...'

        score = max(min(float(result.score), 1.0), 0.0)

        objects.append({
            'id': f'object:{obj.pk}',
            'slug': obj.slug,
            'type': obj.object_type.slug if obj.object_type else 'note',
            'type_color': obj.object_type.color if obj.object_type else '#2D5F6B',
            'title': obj.display_title,
            'body_preview': body_preview,
            'score': round(score, 3),
            'signal': result.signal,
            'explanation': result.explanation,
            'dominant_signal': result.signal,
            'dominant_explanation': result.explanation,
        })

    return {
        'passes_run': passes_run,
        'objects': objects,
        'degraded': degraded,
    }

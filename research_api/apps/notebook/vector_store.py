"""
Vector store: KGE embeddings and FAISS ANN index for CommonPlace.

Two components:

1. KGEStore: loads RotatE embeddings trained by scripts/train_kge.py.
   Exposes find_similar_entities(sha_hash, top_n, threshold) via
   dot-product nearest-neighbor over L2-normalized embeddings.
   Used by engine.py _run_kge_engine() as the 5th connection signal.

2. SBERTIndex: FAISS ANN index over SBERT embeddings of all Objects.
   Built lazily from the current corpus, cached via Django cache
   (Redis when configured, safe in-memory fallback otherwise),
   and mirrored in-process for fast reuse.
   Used by engine.py _run_semantic_via_faiss() to replace brute-force
   batch encode with O(log n) approximate nearest-neighbor search.

Both stores are loaded once in apps.py AppConfig.ready(). If embeddings are
not available, both gracefully return empty results -- the engine falls back
to Jaccard/TF-IDF automatically.

Deployment:
  LOCAL: Both stores fully active if PyTorch + FAISS are installed.
  PRODUCTION: Neither store is active (no PyTorch). Engine uses spaCy + TF-IDF.
"""

import json
import logging
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Numpy (required for KGE, optional for FAISS path)
# ---------------------------------------------------------------------------

try:
    import numpy as np
    _NUMPY_AVAILABLE = True
except ImportError:
    np = None
    _NUMPY_AVAILABLE = False

# ---------------------------------------------------------------------------
# FAISS (optional, dev only)
# ---------------------------------------------------------------------------

try:
    import faiss
    _FAISS_AVAILABLE = True
except ImportError:
    faiss = None
    _FAISS_AVAILABLE = False

# ---------------------------------------------------------------------------
# SBERT (optional, dev only)
# ---------------------------------------------------------------------------

try:
    from apps.research.advanced_nlp import (
        HAS_PYTORCH,
        batch_encode,
        get_active_sentence_model_name,
    )
    _SBERT_AVAILABLE = HAS_PYTORCH
except ImportError:
    _SBERT_AVAILABLE = False
    batch_encode = None
    get_active_sentence_model_name = None

# ---------------------------------------------------------------------------
# Default embeddings directory
# ---------------------------------------------------------------------------

_DEFAULT_KGE_DIR = Path('kge_embeddings')


# ---------------------------------------------------------------------------
# KGE Store
# ---------------------------------------------------------------------------

class KGEStore:
    """
    Loads pre-trained KGE entity embeddings and exposes similarity search.

    Embeddings are L2-normalized on load so that dot product equals cosine
    similarity. find_similar_entities() returns (sha_hash, score) pairs.

    Usage:
      store = KGEStore()
      store.load()  # called once in AppConfig.ready()
      matches = store.find_similar_entities(sha_hash, top_n=10, threshold=0.6)
    """

    def __init__(self, embeddings_dir: Path | None = None):
        self.embeddings_dir = embeddings_dir or _DEFAULT_KGE_DIR
        self.entity_embeddings = None   # float32 numpy array (n, dim)
        self.entity_to_idx: dict[str, int] = {}
        self.idx_to_entity: dict[int, str] = {}
        self.is_loaded = False
        self.metadata: dict[str, Any] = {}

    def load(self) -> bool:
        """
        Load embeddings from disk. Returns True on success, False if files missing.
        Called once from AppConfig.ready(). Safe to call multiple times.
        """
        if self.is_loaded:
            return True
        if not _NUMPY_AVAILABLE:
            logger.info('KGEStore: numpy not available. KGE engine disabled.')
            return False

        emb_path = self.embeddings_dir / 'entity_embeddings.npy'
        idx_path = self.embeddings_dir / 'entity_to_idx.json'
        meta_path = self.embeddings_dir / 'training_metadata.json'

        if not emb_path.exists() or not idx_path.exists():
            logger.info(
                'KGEStore: embeddings not found at %s. '
                'Run: python manage.py export_kge_triples && python scripts/train_kge.py',
                self.embeddings_dir,
            )
            return False

        try:
            raw = np.load(emb_path).astype('float32')

            # L2-normalize so dot product = cosine similarity
            norms = np.linalg.norm(raw, axis=1, keepdims=True)
            norms = np.where(norms == 0, 1.0, norms)
            self.entity_embeddings = raw / norms

            with open(idx_path) as f:
                self.entity_to_idx = json.load(f)

            self.idx_to_entity = {v: k for k, v in self.entity_to_idx.items()}

            if meta_path.exists():
                with open(meta_path) as f:
                    self.metadata = json.load(f)

            self.is_loaded = True
            logger.info(
                'KGEStore loaded: %d entities, dim=%d (model=%s)',
                len(self.entity_to_idx),
                self.entity_embeddings.shape[1],
                self.metadata.get('model', 'unknown'),
            )
            return True

        except Exception as exc:
            logger.warning('KGEStore load failed: %s', exc)
            return False

    def find_similar_entities(
        self,
        sha_hash: str,
        top_n: int = 10,
        threshold: float = 0.6,
    ) -> list[dict]:
        """
        Find the top_n most similar entities to the given sha_hash.

        Returns list of {'sha_hash': str, 'score': float} dicts,
        ordered by descending similarity. Empty list if not found or
        embeddings not loaded.
        """
        if not self.is_loaded or self.entity_embeddings is None:
            return []

        idx = self.entity_to_idx.get(sha_hash)
        if idx is None:
            return []

        query_vec = self.entity_embeddings[idx]
        scores = self.entity_embeddings @ query_vec  # Dot product = cosine (normalized)
        scores[idx] = -1.0  # Exclude self

        top_indices = np.argsort(scores)[::-1][:top_n * 2]

        results = []
        for i in top_indices:
            score = float(scores[i])
            if score < threshold:
                break
            entity_sha = self.idx_to_entity.get(int(i))
            if entity_sha and not entity_sha.startswith('TYPE:'):
                results.append({'sha_hash': entity_sha, 'score': score})
            if len(results) >= top_n:
                break

        return results


class TemporalKGEStore(KGEStore):
    """
    KGE store with optional time-bucketed neighborhood profiles.

    Static embeddings still drive the base structural similarity. Temporal
    profiles add a second signal that measures whether two entities are
    becoming more structurally aligned in recent graph history.
    """

    def __init__(self, embeddings_dir: Path | None = None):
        super().__init__(embeddings_dir=embeddings_dir)
        self.temporal_profiles: dict[str, dict[str, dict[str, float]]] = {}
        self.time_buckets: list[str] = []

    def load(self) -> bool:
        loaded = super().load()

        profiles_path = self.embeddings_dir / 'temporal_profiles.json'
        if profiles_path.exists():
            try:
                with open(profiles_path) as f:
                    payload = json.load(f)
                self.temporal_profiles = payload.get('entity_profiles', {}) or {}
                self.time_buckets = sorted(payload.get('bucket_order', []) or [])
                logger.info(
                    'Temporal KGE profiles loaded: %d entities across %d buckets',
                    len(self.temporal_profiles),
                    len(self.time_buckets),
                )
            except Exception as exc:
                logger.warning('Temporal KGE profile load failed: %s', exc)

        return loaded

    def _bucket_windows(self, lookback_weeks: int) -> tuple[list[str], list[str]]:
        if not self.time_buckets:
            return [], []
        window = max(int(lookback_weeks), 1)
        recent = self.time_buckets[-window:]
        past = self.time_buckets[-(window * 2):-window]
        return past, recent

    def _aggregate_neighbors(self, sha_hash: str, buckets: list[str]) -> dict[str, float]:
        profiles = self.temporal_profiles.get(sha_hash, {})
        totals: dict[str, float] = {}

        for bucket in buckets:
            for neighbor_sha, weight in profiles.get(bucket, {}).items():
                totals[neighbor_sha] = totals.get(neighbor_sha, 0.0) + float(weight)

        return totals

    def _direct_strength(
        self,
        source_sha: str,
        target_sha: str,
        buckets: list[str],
    ) -> float:
        profile = self.temporal_profiles.get(source_sha, {})
        if not profile or not buckets:
            return 0.0
        return max(float(profile.get(bucket, {}).get(target_sha, 0.0)) for bucket in buckets)

    def _weighted_overlap(
        self,
        left: dict[str, float],
        right: dict[str, float],
    ) -> float:
        if not left or not right:
            return 0.0

        keys = set(left) | set(right)
        dot = sum(left.get(key, 0.0) * right.get(key, 0.0) for key in keys)
        left_norm = sum(value * value for value in left.values()) ** 0.5
        right_norm = sum(value * value for value in right.values()) ** 0.5

        if left_norm == 0.0 or right_norm == 0.0:
            return 0.0
        return float(dot / (left_norm * right_norm))

    def find_emerging_connections(
        self,
        sha_hash: str,
        lookback_weeks: int = 4,
        top_n: int = 10,
        threshold: float = 0.05,
    ) -> list[dict]:
        """
        Find structurally similar entities whose overlap is increasing.

        This compares neighborhood overlap in the recent window against the
        preceding window and combines that trend with the static KGE score.
        """
        if not self.is_loaded or self.entity_embeddings is None or not self.temporal_profiles:
            return []

        past_buckets, recent_buckets = self._bucket_windows(lookback_weeks)
        if not recent_buckets:
            return []

        recent_profile = self._aggregate_neighbors(sha_hash, recent_buckets)
        past_profile = self._aggregate_neighbors(sha_hash, past_buckets)

        candidates = self.find_similar_entities(
            sha_hash=sha_hash,
            top_n=max(top_n * 4, top_n),
            threshold=0.0,
        )
        if not candidates:
            return []

        results = []
        for candidate in candidates:
            candidate_sha = candidate['sha_hash']
            candidate_recent = self._aggregate_neighbors(candidate_sha, recent_buckets)
            candidate_past = self._aggregate_neighbors(candidate_sha, past_buckets)

            recent_overlap = self._weighted_overlap(recent_profile, candidate_recent)
            past_overlap = self._weighted_overlap(past_profile, candidate_past)
            overlap_delta = max(recent_overlap - past_overlap, 0.0)

            direct_recent = self._direct_strength(sha_hash, candidate_sha, recent_buckets)
            direct_past = self._direct_strength(sha_hash, candidate_sha, past_buckets)
            direct_delta = max(direct_recent - direct_past, 0.0)

            trend_delta = max(overlap_delta, direct_delta)
            if trend_delta < threshold:
                continue

            score = round(
                (float(candidate['score']) * 0.6)
                + (overlap_delta * 0.25)
                + (direct_delta * 0.15),
                4,
            )
            results.append(
                {
                    'sha_hash': candidate_sha,
                    'score': score,
                    'static_score': round(float(candidate['score']), 4),
                    'trend_delta': round(trend_delta, 4),
                    'recent_overlap': round(recent_overlap, 4),
                    'past_overlap': round(past_overlap, 4),
                    'recent_direct': round(direct_recent, 4),
                    'past_direct': round(direct_past, 4),
                },
            )

        results.sort(
            key=lambda item: (item['trend_delta'], item['score']),
            reverse=True,
        )
        return results[:top_n]


# ---------------------------------------------------------------------------
# SBERT FAISS Index
# ---------------------------------------------------------------------------

_SBERT_RUNTIME_CACHE: dict[str, Any] = {
    'index': None,
    'object_pks': [],
    'built_at': None,
    'size': 0,
    'model_name': '',
}
_SBERT_CACHE_KEY = 'notebook:sbert_faiss_index:v1'
_SBERT_INDEX_MAX_AGE_SECONDS = 7200  # 2 hours
_SBERT_INDEX_DRIFT_THRESHOLD = 100   # Objects


def _get_django_cache():
    try:
        from django.core.cache import cache
        return cache
    except Exception:
        return None


def _is_cache_fresh(
    built_at: float | None,
    cached_size: int,
    current_count: int,
) -> bool:
    if built_at is None:
        return False
    age = time.time() - float(built_at)
    if age > _SBERT_INDEX_MAX_AGE_SECONDS:
        return False
    return abs(int(current_count) - int(cached_size)) <= _SBERT_INDEX_DRIFT_THRESHOLD


def _serialize_faiss_index(index) -> bytes:
    if not _FAISS_AVAILABLE:
        return b''
    blob = faiss.serialize_index(index)
    return blob.tobytes() if hasattr(blob, 'tobytes') else bytes(blob)


def _deserialize_faiss_index(payload: bytes):
    if not _FAISS_AVAILABLE or not _NUMPY_AVAILABLE:
        return None
    arr = np.frombuffer(payload, dtype='uint8')
    return faiss.deserialize_index(arr)


def _set_shared_index_cache(
    index,
    object_pks: list[int],
    size: int,
    built_at: float,
    model_name: str,
) -> None:
    cache = _get_django_cache()
    if cache is None or index is None:
        return

    try:
        cache.set(
            _SBERT_CACHE_KEY,
            {
                'index_bytes': _serialize_faiss_index(index),
                'object_pks': object_pks,
                'size': int(size),
                'built_at': float(built_at),
                'model_name': model_name,
            },
            timeout=_SBERT_INDEX_MAX_AGE_SECONDS,
        )
    except Exception as exc:
        logger.debug('Could not store SBERT index in Django cache: %s', exc)


def _load_shared_index_cache() -> dict | None:
    cache = _get_django_cache()
    if cache is None:
        return None

    try:
        payload = cache.get(_SBERT_CACHE_KEY)
    except Exception as exc:
        logger.debug('Could not read SBERT index from Django cache: %s', exc)
        return None

    if not payload:
        return None
    if not isinstance(payload, dict):
        return None
    if not payload.get('index_bytes'):
        return None
    return payload


def _hydrate_runtime_cache(payload: dict) -> dict | None:
    try:
        index = _deserialize_faiss_index(payload['index_bytes'])
        if index is None:
            return None

        _SBERT_RUNTIME_CACHE['index'] = index
        _SBERT_RUNTIME_CACHE['object_pks'] = payload.get('object_pks', [])
        _SBERT_RUNTIME_CACHE['built_at'] = payload.get('built_at')
        _SBERT_RUNTIME_CACHE['size'] = payload.get('size', 0)
        _SBERT_RUNTIME_CACHE['model_name'] = payload.get('model_name', '')
        return _SBERT_RUNTIME_CACHE
    except Exception as exc:
        logger.debug('Failed hydrating runtime SBERT cache: %s', exc)
        return None


def invalidate_sbert_index() -> None:
    """Force FAISS index rebuild on next engine/compose call."""
    _SBERT_RUNTIME_CACHE['index'] = None
    _SBERT_RUNTIME_CACHE['built_at'] = None
    _SBERT_RUNTIME_CACHE['size'] = 0
    _SBERT_RUNTIME_CACHE['object_pks'] = []
    _SBERT_RUNTIME_CACHE['model_name'] = ''

    cache = _get_django_cache()
    if cache is not None:
        try:
            cache.delete(_SBERT_CACHE_KEY)
        except Exception:
            pass


def _build_sbert_faiss_index(max_objects: int = 5000) -> dict | None:
    """
    Build or load a FAISS IndexFlatIP over SBERT embeddings.

    Source of truth is Django cache (Redis when configured). Runtime cache is a
    fast mirror so repeated requests in one process avoid deserialize overhead.
    """
    if not _FAISS_AVAILABLE or not _SBERT_AVAILABLE:
        return None

    from apps.notebook.engine import _build_full_text
    from apps.notebook.models import Object

    current_count = Object.objects.filter(is_deleted=False).count()
    runtime = _SBERT_RUNTIME_CACHE
    expected_model_name = (
        get_active_sentence_model_name()
        if callable(get_active_sentence_model_name)
        else ''
    )

    if (
        runtime['index'] is not None
        and runtime.get('model_name', '') == expected_model_name
        and _is_cache_fresh(runtime['built_at'], runtime['size'], current_count)
    ):
        return runtime

    shared_payload = _load_shared_index_cache()
    if (
        shared_payload
        and shared_payload.get('model_name', '') == expected_model_name
        and _is_cache_fresh(shared_payload.get('built_at'), shared_payload.get('size', 0), current_count)
    ):
        hydrated = _hydrate_runtime_cache(shared_payload)
        if hydrated is not None:
            return hydrated

    logger.info('Building SBERT FAISS index (%d objects)...', current_count)

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
        embeddings = batch_encode(texts, task='similarity', role='document')
        if embeddings is None or len(embeddings) == 0:
            return None

        vecs = np.array(embeddings).astype('float32')

        # L2-normalize for cosine similarity via inner product.
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1.0, norms)
        vecs = vecs / norms

        dim = vecs.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(vecs)

        built_at = time.time()
        runtime['index'] = index
        runtime['object_pks'] = pks
        runtime['built_at'] = built_at
        runtime['size'] = current_count
        runtime['model_name'] = expected_model_name

        _set_shared_index_cache(index, pks, current_count, built_at, expected_model_name)

        logger.info('SBERT FAISS index built: %d vectors, dim=%d', len(objects), dim)
        return runtime

    except Exception as exc:
        logger.warning('SBERT FAISS index build failed: %s', exc)
        return None


def _encode_query_text(text: str):
    my_emb = batch_encode([text], task='similarity', role='query')
    if my_emb is None or len(my_emb) == 0:
        return None

    vec = np.array(my_emb[:1]).astype('float32')
    norm = np.linalg.norm(vec, axis=1, keepdims=True)
    if norm[0][0] > 0:
        vec = vec / norm
    return vec


def faiss_find_similar_objects(
    obj,
    top_n: int = 20,
    threshold: float = 0.45,
) -> list[dict]:
    """
    Find the top_n most semantically similar Objects using FAISS search.
    """
    if not _FAISS_AVAILABLE or not _SBERT_AVAILABLE or not _NUMPY_AVAILABLE:
        return []

    from apps.notebook.engine import _build_full_text

    cache = _build_sbert_faiss_index()
    if cache is None or cache['index'] is None:
        return []

    my_text = _build_full_text(obj)
    if not my_text or len(my_text) < 20:
        return []

    try:
        vec = _encode_query_text(my_text)
        if vec is None:
            return []

        k = min(max(top_n * 3, top_n), cache['index'].ntotal)
        scores, indices = cache['index'].search(vec, k)

        pks = cache['object_pks']
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(pks):
                continue
            pk = pks[idx]
            if pk == obj.pk:
                continue
            if float(score) < threshold:
                continue
            results.append({'pk': pk, 'score': float(score)})
            if len(results) >= top_n:
                break

        return results
    except Exception as exc:
        logger.warning('FAISS similarity search failed: %s', exc)
        return []


def faiss_find_similar_text(
    text: str,
    top_n: int = 20,
    threshold: float = 0.35,
    notebook_slug: str | None = None,
) -> list[dict]:
    """
    Find Objects semantically similar to raw text (used by compose live query).
    """
    if not _FAISS_AVAILABLE or not _SBERT_AVAILABLE or not _NUMPY_AVAILABLE:
        return []

    if not text or len(text.strip()) < 20:
        return []

    cache = _build_sbert_faiss_index()
    if cache is None or cache['index'] is None:
        return []

    try:
        vec = _encode_query_text(text)
        if vec is None:
            return []

        allowed_pks: set[int] | None = None
        if notebook_slug:
            from apps.notebook.models import Object
            allowed_pks = set(
                Object.objects.filter(
                    notebook__slug=notebook_slug,
                    is_deleted=False,
                ).values_list('pk', flat=True),
            )

        k = min(max(top_n * 4, top_n), cache['index'].ntotal)
        scores, indices = cache['index'].search(vec, k)

        pks = cache['object_pks']
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(pks):
                continue
            pk = pks[idx]
            if allowed_pks is not None and pk not in allowed_pks:
                continue
            if float(score) < threshold:
                continue
            results.append({'pk': pk, 'score': float(score)})
            if len(results) >= top_n:
                break

        return results
    except Exception as exc:
        logger.warning('FAISS text similarity search failed: %s', exc)
        return []


# ---------------------------------------------------------------------------
# Module-level singletons (populated in AppConfig.ready())
# ---------------------------------------------------------------------------

kge_store = TemporalKGEStore()

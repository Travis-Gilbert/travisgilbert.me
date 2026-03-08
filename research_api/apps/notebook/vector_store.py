"""
Vector store: KGE embeddings and FAISS ANN index for CommonPlace.

Two components:

1. KGEStore: loads RotatE embeddings trained by scripts/train_kge.py.
   Exposes find_similar_entities(sha_hash, top_n, threshold) via
   dot-product nearest-neighbor over L2-normalized embeddings.
   Used by engine.py _run_kge_engine() as the 5th connection signal.

2. SBERTIndex: FAISS ANN index over SBERT embeddings of all Objects.
   Built lazily from the current corpus, cached in module memory,
   invalidated every 2 hours or when corpus drifts by 100+ objects.
   Used by engine.py _run_semantic_via_faiss() to replace brute-force
   batch encode with O(log n) approximate nearest-neighbor search.

Both stores are loaded once in apps.py AppConfig.ready() and held in
module memory. If embeddings are not available, both gracefully return
empty results -- the engine falls back to Jaccard/TF-IDF automatically.

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
    from apps.research.advanced_nlp import HAS_PYTORCH, batch_encode
    _SBERT_AVAILABLE = HAS_PYTORCH
except ImportError:
    _SBERT_AVAILABLE = False
    batch_encode = None

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


# ---------------------------------------------------------------------------
# SBERT FAISS Index
# ---------------------------------------------------------------------------

_SBERT_INDEX_CACHE: dict = {
    'index': None,
    'object_pks': [],
    'built_at': None,
    'size': 0,
}
_SBERT_INDEX_MAX_AGE_SECONDS = 7200  # 2 hours
_SBERT_INDEX_DRIFT_THRESHOLD = 100   # Objects


def invalidate_sbert_index() -> None:
    """Force FAISS index rebuild on next engine call."""
    _SBERT_INDEX_CACHE['built_at'] = None


def _build_sbert_faiss_index(max_objects: int = 5000) -> dict | None:
    """
    Build a FAISS IndexFlatIP over SBERT embeddings of all active Objects.

    IndexFlatIP (inner product) on L2-normalized vectors gives cosine similarity.
    This is an exact index -- no approximation error -- at the cost of O(n) search.
    For the expected corpus size (<5000 objects per user), exact search is fine.
    Switch to IndexIVFFlat if search latency becomes a bottleneck at 10k+ objects.

    Returns the cache dict on success, None on failure or unavailability.
    """
    if not _FAISS_AVAILABLE or not _SBERT_AVAILABLE:
        return None

    from apps.notebook.models import Object
    from apps.notebook.engine import _build_full_text

    now = time.time()
    cache = _SBERT_INDEX_CACHE
    current_count = Object.objects.filter(is_deleted=False).count()

    needs_rebuild = (
        cache['index'] is None
        or cache['built_at'] is None
        or (now - cache['built_at']) > _SBERT_INDEX_MAX_AGE_SECONDS
        or abs(current_count - cache['size']) > _SBERT_INDEX_DRIFT_THRESHOLD
    )

    if not needs_rebuild:
        return cache

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
        embeddings = batch_encode(texts)
        if embeddings is None or len(embeddings) == 0:
            return None

        import numpy as _np
        vecs = _np.array(embeddings).astype('float32')

        # L2-normalize for cosine similarity via inner product
        norms = _np.linalg.norm(vecs, axis=1, keepdims=True)
        norms = _np.where(norms == 0, 1.0, norms)
        vecs = vecs / norms

        dim = vecs.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(vecs)

        cache['index'] = index
        cache['object_pks'] = pks
        cache['built_at'] = now
        cache['size'] = current_count

        logger.info('SBERT FAISS index built: %d vectors, dim=%d', len(objects), dim)
        return cache

    except Exception as exc:
        logger.warning('SBERT FAISS index build failed: %s', exc)
        return None


def faiss_find_similar_objects(
    obj,
    top_n: int = 20,
    threshold: float = 0.45,
) -> list[dict]:
    """
    Find the top_n most semantically similar Objects using FAISS ANN search.

    Returns list of {'pk': int, 'score': float} dicts.
    Falls back to empty list if FAISS or SBERT unavailable.

    Called by engine.py _run_semantic_engine() when the FAISS index is available.
    """
    if not _FAISS_AVAILABLE or not _SBERT_AVAILABLE:
        return []

    from apps.notebook.engine import _build_full_text

    cache = _build_sbert_faiss_index()
    if cache is None or cache['index'] is None:
        return []

    my_text = _build_full_text(obj)
    if not my_text or len(my_text) < 20:
        return []

    try:
        import numpy as _np
        my_emb = batch_encode([my_text])
        if my_emb is None or len(my_emb) == 0:
            return []

        vec = _np.array(my_emb[:1]).astype('float32')
        norm = _np.linalg.norm(vec, axis=1, keepdims=True)
        if norm[0][0] > 0:
            vec = vec / norm

        k = min(top_n * 3, cache['index'].ntotal)
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


# ---------------------------------------------------------------------------
# Module-level singletons (populated in AppConfig.ready())
# ---------------------------------------------------------------------------

kge_store = KGEStore()

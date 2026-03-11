"""
BM25 Unified Lexical Index.

Replaces both Jaccard (Pass 3) and TF-IDF (Pass 4) with a single
production-safe ranking pass. No PyTorch required.

BM25 formula:
  score(q, d) = sum over terms t in q of:
    IDF(t) * (tf(t,d) * (k1+1)) / (tf(t,d) + k1 * (1 - b + b * |d|/avgdl))

  IDF(t) = log((N - df(t) + 0.5) / (df(t) + 0.5) + 1)

Parameters:
  k1 = 1.5  (term saturation)
  b  = 0.75 (length normalization; tunable via Novelty Dial)

Cache is module-level with signal-driven invalidation. Rebuilds when:
  - corpus size drifts by > 50 objects
  - b parameter changes by > 0.05 (Novelty Dial)
  - cache age exceeds 30 minutes
"""

import logging
import math
import re
import time

logger = logging.getLogger(__name__)

STOP_WORDS = frozenset({
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
    'for', 'of', 'with', 'by', 'from', 'up', 'out', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
    'might', 'can', 'this', 'that', 'these', 'those', 'it', 'its',
    'as', 'if', 'not', 'no', 'so', 'then', 'than', 'also', 'just',
    'more', 'some', 'any', 'all', 'one', 'two', 'new', 'use', 'used',
    'using', 'make', 'made', 'way', 'get', 'got', 'about', 'into',
    'what', 'when', 'where', 'who', 'how', 'which', 'they', 'their',
    'there', 'we', 'our', 'you', 'your', 'he', 'she', 'him', 'her',
    'his', 'hers', 'i', 'me', 'my', 'mine', 'us', 'them', 'very',
    'much', 'many', 'such', 'each', 'both', 'other', 'only', 'own',
    'over', 'same', 'even', 'most', 'well', 'back', 'come', 'here',
    'like', 'time', 'see', 'need', 'take', 'know', 'think', 'look',
    'want', 'give', 'find', 'tell', 'work', 'call', 'keep', 'let',
    'put', 'set', 'run', 'go', 'say', 'said', 'says', 'still',
})


def _tokenize(text: str) -> list[str]:
    """Lowercase, strip stop words, require min length 3."""
    words = re.findall(r'\b[a-z]{3,}\b', text.lower())
    return [w for w in words if w not in STOP_WORDS]


class BM25Index:
    """
    In-memory BM25 index over a corpus of (pk, text) pairs.

    Build once, query many times. Not thread-safe for concurrent builds
    (the module-level cache handles that via a simple mutex-free pattern).
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self._doc_ids: list[int] = []
        self._doc_terms: dict[int, dict[str, int]] = {}
        self._doc_lengths: dict[int, int] = {}
        self._df: dict[str, int] = {}
        self._idf: dict[str, float] = {}
        self._avgdl: float = 0.0
        self._n: int = 0

    def build(self, docs: list[tuple[int, str]]) -> None:
        """
        Build the index from a list of (pk, full_text) pairs.
        Called once per cache cycle; O(total_tokens) time.
        """
        self._doc_ids = []
        self._doc_terms = {}
        self._doc_lengths = {}
        self._df = {}

        total_len = 0
        for pk, text in docs:
            tokens = _tokenize(text)
            tf: dict[str, int] = {}
            for t in tokens:
                tf[t] = tf.get(t, 0) + 1
            self._doc_ids.append(pk)
            self._doc_terms[pk] = tf
            self._doc_lengths[pk] = len(tokens)
            total_len += len(tokens)
            for term in tf:
                self._df[term] = self._df.get(term, 0) + 1

        self._n = len(docs)
        self._avgdl = total_len / self._n if self._n else 0.0
        self._idf = self._compute_idf()
        logger.debug('BM25 index built: %d docs, %d unique terms', self._n, len(self._df))

    def _compute_idf(self) -> dict[str, float]:
        """IDF = log((N - df + 0.5) / (df + 0.5) + 1). Always positive."""
        idf = {}
        n = self._n
        for term, df in self._df.items():
            idf[term] = math.log((n - df + 0.5) / (df + 0.5) + 1)
        return idf

    def _score_document(self, query_terms: dict[str, int], doc_pk: int) -> float:
        """BM25 score for a single (query, document) pair."""
        tf_map = self._doc_terms.get(doc_pk, {})
        dl = self._doc_lengths.get(doc_pk, 0)
        k1 = self.k1
        b = self.b
        avgdl = self._avgdl if self._avgdl > 0 else 1.0

        score = 0.0
        for term, qf in query_terms.items():
            tf = tf_map.get(term, 0)
            if tf == 0:
                continue
            idf = self._idf.get(term, 0.0)
            numerator = tf * (k1 + 1)
            denominator = tf + k1 * (1 - b + b * dl / avgdl)
            score += idf * (numerator / denominator)
        return score

    def find_similar(
        self, object_id: int, top_n: int = 20, min_score: float = 0.5,
    ) -> list[tuple[int, float]]:
        """
        Return (pk, score) pairs for the top_n documents most similar to object_id.
        Uses object_id's term vector as the query. Excludes object_id itself.
        """
        query_terms = self._doc_terms.get(object_id)
        if not query_terms:
            return []

        scores = []
        for pk in self._doc_ids:
            if pk == object_id:
                continue
            score = self._score_document(query_terms, pk)
            if score >= min_score:
                scores.append((pk, score))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_n]

    def explain_match(self, pk_a: int, pk_b: int, top_terms: int = 4) -> list[str]:
        """
        Return the top shared terms between two documents, sorted by IDF
        (highest-IDF terms first: rare terms in the corpus are most meaningful).
        """
        terms_a = set(self._doc_terms.get(pk_a, {}).keys())
        terms_b = set(self._doc_terms.get(pk_b, {}).keys())
        shared = terms_a & terms_b
        if not shared:
            return []
        ranked = sorted(shared, key=lambda t: self._idf.get(t, 0.0), reverse=True)
        return ranked[:top_terms]


# ---------------------------------------------------------------------------
# Module-level cache
# ---------------------------------------------------------------------------

_BM25_CACHE: dict = {
    'index': None,
    'built_at': None,
    'corpus_size': 0,
    'b': 0.75,
}

_CACHE_MAX_AGE = 1800        # 30 minutes
_CORPUS_DRIFT_THRESHOLD = 50  # rebuild if corpus changes by this many objects


def invalidate_bm25_cache() -> None:
    """
    Signal-driven invalidation. Called from signals.py on Object create/delete.
    Sets built_at=None so the next get_or_build_bm25() triggers a rebuild.
    """
    _BM25_CACHE['built_at'] = None
    _BM25_CACHE['index'] = None


def get_or_build_bm25(
    text_fn=None,
    b_override: float | None = None,
) -> 'BM25Index | None':
    """
    Return the cached BM25Index, rebuilding if stale.

    text_fn: callable(Object) -> str  -- passed from engine.py to avoid
             circular imports. engine.py passes _build_full_text.

    b_override: if provided (Novelty Dial), rebuilds the index when the b
                value drifts by more than 0.05 from the cached value.

    Returns None if the corpus has fewer than 2 objects (BM25 is meaningless).
    """
    from .models import Object

    now = time.time()
    cache = _BM25_CACHE
    b = b_override if b_override is not None else 0.75
    current_count = Object.objects.filter(is_deleted=False).count()

    b_drift = abs(b - cache.get('b', 0.75))

    needs_rebuild = (
        cache['index'] is None
        or cache['built_at'] is None
        or (now - cache['built_at']) > _CACHE_MAX_AGE
        or abs(current_count - cache['corpus_size']) > _CORPUS_DRIFT_THRESHOLD
        or b_drift > 0.05
    )

    if not needs_rebuild:
        return cache['index']

    if current_count < 2:
        logger.debug('BM25: corpus too small (%d objects), skipping build', current_count)
        return None

    logger.info('Building BM25 index (n=%d, b=%.2f)...', current_count, b)

    objects = (
        Object.objects
        .filter(is_deleted=False)
        .only('pk', 'title', 'body', 'search_text')
    )

    if text_fn is None:
        def text_fn(obj):  # type: ignore[misc]
            parts = [obj.title or '', obj.body or '', obj.search_text or '']
            return ' '.join(filter(None, parts))

    docs = []
    for obj in objects:
        text = text_fn(obj)
        if text.strip():
            docs.append((obj.pk, text))

    if len(docs) < 2:
        logger.debug('BM25: fewer than 2 non-empty documents, skipping')
        return None

    idx = BM25Index(k1=1.5, b=b)
    idx.build(docs)

    cache['index'] = idx
    cache['built_at'] = now
    cache['corpus_size'] = current_count
    cache['b'] = b

    logger.info('BM25 index built: %d documents indexed', len(docs))
    return idx

"""
Embedding-based semantic similarity service.

THE GENERATIVE PRINCIPLE
========================
"Meaning is context." A word's meaning is defined by the words that
surround it across millions of sentences. "Urban sprawl" and "suburban
expansion" appear in similar contexts (near words like "housing",
"development", "density"), so they end up as similar vectors even
though they share zero words.

HOW IT WORKS (the math, simply)
===============================
1. Every word in spaCy's vocabulary is a vector of 300 numbers.
   These numbers were learned by a neural network (Word2Vec or GloVe)
   that read billions of words and noticed which words appear near
   each other.

2. To get a vector for an entire document (a title, annotation, or
   collection of tags), we average the vectors of all its words.
   This is crude but effective for short texts.

3. To compare two documents, we compute the COSINE SIMILARITY of
   their vectors. Cosine similarity measures the angle between two
   vectors, ignoring their length. Two vectors pointing in the same
   direction have cosine similarity = 1.0. Perpendicular vectors = 0.0.
   Opposite directions = -1.0.

   The formula:
       similarity(A, B) = (A . B) / (|A| * |B|)

   where A . B is the dot product and |A| is the magnitude (length).

WHY THIS IS IN PYTHON AND NOT GO
=================================
spaCy's word vectors are pre-trained matrices stored as NumPy arrays.
Python's scientific computing ecosystem (NumPy, SciPy) is built for
this. Go has no equivalent at this level of maturity. The Go NLP
libraries either wrap Python (defeating the purpose) or implement
a subset of what spaCy provides out of the box.

IMPORTANT: This module requires en_core_web_md (medium model, ~40MB)
or en_core_web_lg (large model, ~560MB) for word vectors. The small
model (en_core_web_sm) does NOT include word vectors and will produce
zero vectors for everything.

Install with: python -m spacy download en_core_web_md
"""

import logging
from functools import lru_cache

import numpy as np
import spacy

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

# We cache the loaded model so it's only loaded once per process.
# On Railway, each gunicorn worker loads its own copy. The medium
# model uses ~40MB of RAM per worker, which is fine for small
# worker counts (2-4).

_nlp = None


def get_nlp():
    """
    Load the spaCy model lazily on first use.

    Tries en_core_web_md first (has word vectors).
    Falls back to en_core_web_sm (no vectors, similarity will be zero).

    The lazy loading pattern avoids slowing down Django startup for
    endpoints that don't need NLP.
    """
    global _nlp
    if _nlp is not None:
        return _nlp

    for model_name in ('en_core_web_md', 'en_core_web_sm'):
        try:
            _nlp = spacy.load(model_name, disable=['parser', 'ner'])
            # We disable parser and NER because we only need word vectors.
            # This makes processing ~3x faster since we skip dependency
            # parsing and named entity recognition.
            logger.info('Loaded spaCy model: %s', model_name)
            if not _nlp.vocab.vectors.shape[0]:
                logger.warning(
                    'Model %s has no word vectors. Semantic similarity '
                    'will return 0.0 for all comparisons. Install '
                    'en_core_web_md for real vectors.',
                    model_name,
                )
            return _nlp
        except OSError:
            continue

    raise RuntimeError(
        'No spaCy model found. Run: python -m spacy download en_core_web_md'
    )


# ---------------------------------------------------------------------------
# Core embedding functions
# ---------------------------------------------------------------------------


def get_document_vector(text: str) -> np.ndarray:
    """
    Convert text into a 300-dimensional vector.

    Under the hood, spaCy:
    1. Tokenizes the text into words
    2. Looks up each word's pre-trained vector (300 floats)
    3. Averages all word vectors into one document vector

    The averaging is naive (it treats every word equally, including
    "the" and "a"), but spaCy's pipeline already filters stop words
    from the average when computing Doc.vector. For our use case
    (short titles and annotations), this works well.

    Returns a zero vector if the text is empty or contains only
    out-of-vocabulary words.
    """
    nlp = get_nlp()
    doc = nlp(text)
    return doc.vector


def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """
    Compute the cosine similarity between two vectors.

    This is the fundamental operation in embedding-based similarity.
    Every recommendation engine, every semantic search system, and
    every retrieval-augmented generation (RAG) pipeline uses this
    exact computation at its core.

    The formula:
        cos(theta) = (A . B) / (|A| * |B|)

    Returns 0.0 if either vector is zero (no meaningful content).

    WHY COSINE AND NOT EUCLIDEAN DISTANCE?
    Cosine measures direction, not magnitude. A long essay and a
    short annotation about the same topic will have vectors pointing
    in the same direction but with different lengths. Cosine similarity
    treats them as equally similar. Euclidean distance would penalize
    the length difference.
    """
    # np.dot computes the dot product: sum of element-wise multiplication
    # np.linalg.norm computes the magnitude (Euclidean length) of a vector
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))


# ---------------------------------------------------------------------------
# Source and content similarity
# ---------------------------------------------------------------------------


def build_content_text(
    title: str,
    annotation: str = '',
    tags: list[str] | None = None,
    creator: str = '',
) -> str:
    """
    Combine a content item's metadata into a single text for embedding.

    We concatenate title, annotation, tags, and creator because the
    embedding captures the overall "topic" of the combined text. Tags
    are particularly valuable because they're curated, high-signal words
    that directly express the subject matter.

    Example:
        title="The Color of Law", annotation="Documents how government
        policy created residential segregation", tags=["housing",
        "segregation", "policy"], creator="Richard Rothstein"
        ->
        "The Color of Law Documents how government policy created
         residential segregation housing segregation policy
         Richard Rothstein"
    """
    parts = [title]
    if annotation:
        parts.append(annotation)
    if tags:
        parts.append(' '.join(tags))
    if creator:
        parts.append(creator)
    return ' '.join(parts)


def compute_pairwise_similarity(items: list[dict]) -> list[dict]:
    """
    Compute cosine similarity between all pairs of items.

    Each item should have:
        {
            'id': str,
            'text': str,  # combined text for embedding
            ... any other fields (passed through)
        }

    Returns a list of:
        {
            'from_id': str,
            'to_id': str,
            'similarity': float,  # 0.0 to 1.0
        }

    Sorted by similarity descending. Only includes pairs above a
    minimum threshold (default 0.5) to filter noise.

    PERFORMANCE NOTE:
    For N items, this computes N*(N-1)/2 comparisons. With 100
    sources, that's 4,950 comparisons. With 1,000 sources, it's
    499,500. Each comparison is a single dot product (fast), but
    the quadratic growth means this approach stops scaling around
    10,000 items. At that point you'd switch to approximate nearest
    neighbors (ANN) using libraries like FAISS or Annoy. For your
    current scale (hundreds of sources), brute force is fine.
    """
    # Step 1: Compute all vectors in batch
    nlp = get_nlp()
    vectors = {}
    for item in items:
        doc = nlp(item['text'])
        vectors[item['id']] = doc.vector

    # Step 2: Compare all pairs
    pairs = []
    item_ids = list(vectors.keys())

    for i in range(len(item_ids)):
        for j in range(i + 1, len(item_ids)):
            id_a = item_ids[i]
            id_b = item_ids[j]
            sim = cosine_similarity(vectors[id_a], vectors[id_b])

            if sim > 0.5:  # threshold: ignore weak similarities
                pairs.append({
                    'from_id': id_a,
                    'to_id': id_b,
                    'similarity': round(sim, 4),
                })

    # Sort by similarity, strongest first
    pairs.sort(key=lambda p: p['similarity'], reverse=True)
    return pairs


def find_similar_to(
    target_text: str,
    candidates: list[dict],
    top_n: int = 10,
    threshold: float = 0.5,
) -> list[dict]:
    """
    Find the most semantically similar items to a target text.

    This is the function that powers the "similar content" API endpoint.
    Given one piece of content, it ranks all other content by how
    similar their meaning is.

    candidates should be a list of:
        {'id': str, 'text': str, ...extra fields passed through}

    Returns top_n results above the threshold, with similarity scores.
    """
    nlp = get_nlp()
    target_vec = nlp(target_text).vector

    if np.linalg.norm(target_vec) == 0.0:
        return []

    scored = []
    for candidate in candidates:
        candidate_vec = nlp(candidate['text']).vector
        sim = cosine_similarity(target_vec, candidate_vec)
        if sim > threshold:
            scored.append({
                **{k: v for k, v in candidate.items() if k != 'text'},
                'similarity': round(sim, 4),
            })

    scored.sort(key=lambda s: s['similarity'], reverse=True)
    return scored[:top_n]

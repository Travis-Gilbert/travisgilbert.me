"""
Advanced NLP service (PyTorch-powered).

This module provides sentence-level embeddings and Natural Language
Inference (NLI) using PyTorch and sentence-transformers. It gracefully
degrades to no-ops when PyTorch is not installed, allowing the same
codebase to run in two modes:

  - FULL MODE (Travis's local/dev instance): PyTorch installed, all
    features active. Used for experimentation and R&D.
  - PRODUCT MODE (Railway production): No PyTorch, functions return
    empty results. The API still works; it just uses the structural
    signals from connections.py and the spaCy vectors from embeddings.py.

WHAT THIS MODULE ADDS OVER embeddings.py
=========================================
embeddings.py uses spaCy word vectors (Level 3 similarity):
  - Averages individual word vectors into a document vector
  - Fast, lightweight (~40MB model)
  - Misses word order and context ("bank of the river" vs "bank account")

This module uses sentence-transformers (Level 4 similarity):
  - Encodes the entire sentence through a neural network
  - Captures word order, context, and compositional meaning
  - More accurate but heavier (~80MB model + ~150MB PyTorch CPU)

And adds NLI (contradiction/entailment/neutral classification):
  - Takes two texts and classifies their logical relationship
  - "Upzoning increases supply" vs "Upzoning causes displacement"
    -> contradiction (with confidence score)
  - This is what powers the semantic signal in tension detection

CS CONCEPTS
===========
- Bi-encoder vs Cross-encoder: bi-encoders encode texts independently
  (fast, good for search/similarity). Cross-encoders encode the pair
  together (slow, good for classification like NLI). Both use the
  same underlying transformer architecture but with different heads.
- Transfer learning: these models were pre-trained on billions of
  words, then fine-tuned on specific tasks (similarity or NLI).
  You benefit from that training without needing your own data.
- Graceful degradation: the try/except pattern at the top lets the
  same code deploy to environments with different capabilities.
  This is a real-world architectural pattern used in production systems.
"""

import logging
from functools import lru_cache

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# PyTorch availability detection
# ---------------------------------------------------------------------------

try:
    from sentence_transformers import SentenceTransformer, CrossEncoder
    HAS_PYTORCH = True
    logger.info('PyTorch and sentence-transformers available. Full NLP mode active.')
except ImportError:
    HAS_PYTORCH = False
    logger.info(
        'PyTorch not installed. Advanced NLP features disabled. '
        'Install with: pip install sentence-transformers torch --extra-index-url '
        'https://download.pytorch.org/whl/cpu'
    )


# ---------------------------------------------------------------------------
# Model loading (lazy, cached)
# ---------------------------------------------------------------------------

_sentence_model = None
_nli_model = None


def get_sentence_model():
    """
    Load the sentence-transformer model for semantic similarity.

    all-MiniLM-L6-v2 is a good balance of speed and quality:
    - 80MB model size
    - 384-dimensional embeddings (vs spaCy's 300)
    - Trained on 1 billion sentence pairs
    - Encodes ~2800 sentences/sec on CPU

    The model is loaded once and cached for the process lifetime.
    On Railway with gunicorn, each worker loads its own copy.
    """
    global _sentence_model
    if _sentence_model is not None:
        return _sentence_model

    if not HAS_PYTORCH:
        return None

    try:
        _sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info('Loaded sentence-transformer: all-MiniLM-L6-v2')
        return _sentence_model
    except Exception as e:
        logger.error('Failed to load sentence-transformer: %s', e)
        return None


def get_nli_model():
    """
    Load the NLI cross-encoder for contradiction detection.

    cross-encoder/nli-distilroberta-base:
    - ~80MB model size
    - Outputs 3 scores: [contradiction, entailment, neutral]
    - Trained on SNLI + MultiNLI (~940K sentence pairs)
    - Processes ~200 pairs/sec on CPU

    WHY DISTILROBERTA AND NOT DEBERTA:
    DeBERTa-v3 is more accurate but 2x the size (~160MB) and slower.
    For experimentation, DistilRoBERTa gives you 95% of the quality
    at half the resource cost. If you find the results compelling,
    upgrade to cross-encoder/nli-deberta-v3-base later.
    """
    global _nli_model
    if _nli_model is not None:
        return _nli_model

    if not HAS_PYTORCH:
        return None

    try:
        _nli_model = CrossEncoder('cross-encoder/nli-distilroberta-base')
        logger.info('Loaded NLI cross-encoder: nli-distilroberta-base')
        return _nli_model
    except Exception as e:
        logger.error('Failed to load NLI model: %s', e)
        return None


# ---------------------------------------------------------------------------
# Sentence-level similarity (upgrade from spaCy word vectors)
# ---------------------------------------------------------------------------


def encode_text(text: str) -> np.ndarray | None:
    """
    Encode text into a 384-dimensional sentence embedding.

    Unlike spaCy's word vector averaging, this captures:
    - Word order: "dog bites man" != "man bites dog"
    - Context: "bank" near "river" vs "bank" near "money"
    - Compositional meaning: negation, comparison, qualification

    Returns None if PyTorch is not available.
    """
    model = get_sentence_model()
    if model is None:
        return None

    try:
        return model.encode(text, convert_to_numpy=True)
    except Exception as e:
        logger.error('Sentence encoding failed: %s', e)
        return None


def sentence_similarity(text_a: str, text_b: str) -> float | None:
    """
    Compute sentence-level cosine similarity between two texts.

    Returns a float from -1.0 to 1.0, or None if PyTorch unavailable.

    This is the Level 4 upgrade to the cosine_similarity function
    in embeddings.py. Same math (cosine of the angle between vectors),
    but the vectors encode richer meaning.
    """
    model = get_sentence_model()
    if model is None:
        return None

    try:
        embeddings = model.encode([text_a, text_b], convert_to_numpy=True)
        # Cosine similarity via dot product of normalized vectors
        norm_a = np.linalg.norm(embeddings[0])
        norm_b = np.linalg.norm(embeddings[1])
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(embeddings[0], embeddings[1]) / (norm_a * norm_b))
    except Exception as e:
        logger.error('Sentence similarity failed: %s', e)
        return None


def batch_encode(texts: list[str]) -> np.ndarray | None:
    """
    Encode multiple texts into embeddings in a single batch.

    Batching is significantly faster than encoding one at a time
    because the GPU (or CPU SIMD instructions) can process multiple
    inputs in parallel. For 100 texts, batching is ~5x faster than
    a loop.

    Returns a numpy array of shape (len(texts), 384), or None.
    """
    model = get_sentence_model()
    if model is None:
        return None

    try:
        return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    except Exception as e:
        logger.error('Batch encoding failed: %s', e)
        return None


def find_most_similar(
    target_text: str,
    candidate_texts: list[str],
    candidate_ids: list[str],
    top_n: int = 10,
    threshold: float = 0.4,
) -> list[dict]:
    """
    Find the most semantically similar candidates to a target text.

    This is the sentence-transformer upgrade to find_similar_to()
    in embeddings.py. Same interface, better vectors.

    Returns a list of {id, similarity} dicts sorted by score.
    """
    model = get_sentence_model()
    if model is None:
        return []

    try:
        all_texts = [target_text] + candidate_texts
        embeddings = model.encode(all_texts, convert_to_numpy=True, show_progress_bar=False)

        target_vec = embeddings[0]
        candidate_vecs = embeddings[1:]

        # Compute cosine similarity in batch
        target_norm = target_vec / (np.linalg.norm(target_vec) + 1e-8)
        candidate_norms = candidate_vecs / (
            np.linalg.norm(candidate_vecs, axis=1, keepdims=True) + 1e-8
        )
        similarities = candidate_norms @ target_norm

        results = []
        for i, sim in enumerate(similarities):
            if sim >= threshold:
                results.append({
                    'id': candidate_ids[i],
                    'similarity': round(float(sim), 4),
                })

        results.sort(key=lambda r: r['similarity'], reverse=True)
        return results[:top_n]

    except Exception as e:
        logger.error('find_most_similar failed: %s', e)
        return []


# ---------------------------------------------------------------------------
# Natural Language Inference (contradiction/entailment detection)
# ---------------------------------------------------------------------------


NLI_LABELS = ['contradiction', 'entailment', 'neutral']


def classify_relationship(text_a: str, text_b: str) -> dict | None:
    """
    Classify the logical relationship between two texts.

    Returns:
        {
            'label': 'contradiction' | 'entailment' | 'neutral',
            'scores': {
                'contradiction': float,
                'entailment': float,
                'neutral': float,
            },
            'confidence': float,  # highest score
        }

    Or None if PyTorch is not available.

    THE THREE LABELS:
    - Entailment: text_b logically follows from text_a. They agree.
    - Contradiction: text_b conflicts with text_a. They disagree.
    - Neutral: no inferential relationship. Different topics or
      same topic without friction.

    WHY THIS MATTERS FOR TENSION DETECTION:
    The structural signals in tensions.py catch cases where
    contradiction is LIKELY (different publishers, different eras,
    counterargument roles). This function catches cases where
    contradiction actually EXISTS in the text, regardless of metadata.
    """
    model = get_nli_model()
    if model is None:
        return None

    try:
        scores = model.predict([(text_a, text_b)])[0]

        # scores is [contradiction_score, entailment_score, neutral_score]
        label_idx = int(np.argmax(scores))
        label = NLI_LABELS[label_idx]

        return {
            'label': label,
            'scores': {
                'contradiction': round(float(scores[0]), 4),
                'entailment': round(float(scores[1]), 4),
                'neutral': round(float(scores[2]), 4),
            },
            'confidence': round(float(scores[label_idx]), 4),
        }
    except Exception as e:
        logger.error('NLI classification failed: %s', e)
        return None


def batch_classify_relationships(
    pairs: list[tuple[str, str]],
) -> list[dict]:
    """
    Classify relationships for multiple text pairs in a batch.

    Significantly faster than calling classify_relationship() in a loop
    because the model processes all pairs in one forward pass.

    Returns a list of dicts (same format as classify_relationship).
    """
    model = get_nli_model()
    if model is None:
        return []

    try:
        all_scores = model.predict(pairs)

        results = []
        for scores in all_scores:
            label_idx = int(np.argmax(scores))
            results.append({
                'label': NLI_LABELS[label_idx],
                'scores': {
                    'contradiction': round(float(scores[0]), 4),
                    'entailment': round(float(scores[1]), 4),
                    'neutral': round(float(scores[2]), 4),
                },
                'confidence': round(float(scores[label_idx]), 4),
            })

        return results
    except Exception as e:
        logger.error('Batch NLI classification failed: %s', e)
        return []


def detect_contradictions(
    pairs: list[tuple[str, str]],
    threshold: float = 0.6,
) -> list[dict]:
    """
    Filter text pairs to only those that contradict each other.

    A convenience wrapper around batch_classify_relationships that
    returns only the contradictions above a confidence threshold.
    """
    if not pairs:
        return []

    results = batch_classify_relationships(pairs)

    contradictions = []
    for pair, result in zip(pairs, results):
        if result['scores']['contradiction'] >= threshold:
            contradictions.append({
                'text_a': pair[0],
                'text_b': pair[1],
                'contradiction_score': result['scores']['contradiction'],
                'entailment_score': result['scores']['entailment'],
                'confidence': result['confidence'],
            })

    contradictions.sort(key=lambda c: c['contradiction_score'], reverse=True)
    return contradictions


# ---------------------------------------------------------------------------
# Combined analysis (similarity + NLI in one pass)
# ---------------------------------------------------------------------------


def analyze_pair(text_a: str, text_b: str) -> dict:
    """
    Full analysis of two texts: similarity AND logical relationship.

    Two sources can be highly similar AND contradictory. That's the
    most interesting finding: they discuss the same topic but reach
    opposite conclusions.

    Returns:
        {
            'similarity': float | None,
            'relationship': {...} | None,
            'tension_signal': float,  # 0 to 1, combines both
            'interpretation': str,
        }
    """
    sim = sentence_similarity(text_a, text_b)
    nli = classify_relationship(text_a, text_b)

    tension = 0.0
    interpretation = 'Analysis unavailable (PyTorch not installed).'

    if sim is not None and nli is not None:
        contradiction = nli['scores']['contradiction']
        entailment = nli['scores']['entailment']

        if sim > 0.5 and contradiction > 0.5:
            tension = sim * contradiction
            interpretation = (
                f'These texts discuss similar topics (similarity: {sim:.2f}) '
                f'but make conflicting claims (contradiction: {contradiction:.2f}). '
                f'This is a genuine intellectual tension.'
            )
        elif sim > 0.5 and entailment > 0.5:
            tension = 0.0
            interpretation = (
                f'These texts discuss similar topics (similarity: {sim:.2f}) '
                f'and their claims align (entailment: {entailment:.2f}). '
                f'They reinforce each other.'
            )
        elif sim > 0.5:
            tension = contradiction * 0.3
            interpretation = (
                f'These texts discuss similar topics (similarity: {sim:.2f}) '
                f'without clear agreement or disagreement.'
            )
        else:
            tension = 0.0
            interpretation = (
                f'These texts discuss different topics (similarity: {sim:.2f}). '
                f'No meaningful tension.'
            )

    return {
        'similarity': sim,
        'relationship': nli,
        'tension_signal': round(tension, 4),
        'interpretation': interpretation,
    }


# ---------------------------------------------------------------------------
# Status check
# ---------------------------------------------------------------------------


def get_nlp_status() -> dict:
    """
    Report which NLP capabilities are available.

    Useful for the /api/v1/stats/ or a /api/v1/capabilities/ endpoint
    so API consumers know what features are active.
    """
    status = {
        'pytorch_available': HAS_PYTORCH,
        'sentence_model': None,
        'nli_model': None,
        'spacy_model': None,
    }

    if HAS_PYTORCH:
        model = get_sentence_model()
        if model:
            status['sentence_model'] = 'all-MiniLM-L6-v2 (384-dim)'

        nli = get_nli_model()
        if nli:
            status['nli_model'] = 'nli-distilroberta-base (3-class)'

    # Also check spaCy (from embeddings.py)
    try:
        from apps.research.embeddings import get_nlp
        nlp = get_nlp()
        status['spacy_model'] = nlp.meta.get('name', 'unknown')
    except Exception:
        pass

    return status

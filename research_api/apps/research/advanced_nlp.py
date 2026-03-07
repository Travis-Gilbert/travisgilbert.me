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
- Softmax: converts raw logits (unbounded numbers like 3.49, -2.77)
  into probabilities (0 to 1, summing to 1). The formula is:
  softmax(x_i) = e^x_i / sum(e^x_j for all j). This is how neural
  networks turn raw outputs into interpretable confidence scores.
- Graceful degradation: the try/except pattern at the top lets the
  same code deploy to environments with different capabilities.
"""

import logging

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
# Utilities
# ---------------------------------------------------------------------------


def softmax(logits: np.ndarray) -> np.ndarray:
    """
    Convert raw logits to probabilities using the softmax function.

    Neural network outputs (logits) are unbounded numbers. A logit of
    3.49 doesn't mean "3.49 out of 1.0"; it's a raw score. Softmax
    normalizes these into a probability distribution that sums to 1.0.

    The formula: softmax(x_i) = e^x_i / sum(e^x_j for all j)

    The subtraction of max(logits) is a numerical stability trick.
    e^(large number) overflows. Subtracting the max doesn't change
    the result (it cancels out in the division) but prevents overflow.

    Example:
        logits = [3.49, -2.77, -0.84]
        softmax -> [0.986, 0.002, 0.013]
        Interpretation: 98.6% contradiction, 0.2% entailment, 1.3% neutral
    """
    exp_logits = np.exp(logits - np.max(logits))
    return exp_logits / exp_logits.sum()


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
    - Outputs 3 raw logits: [contradiction, entailment, neutral]
    - Must apply softmax to get probabilities
    - Trained on SNLI + MultiNLI (~940K sentence pairs)
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
# Sentence-level similarity
# ---------------------------------------------------------------------------


def encode_text(text: str) -> np.ndarray | None:
    """Encode text into a 384-dimensional sentence embedding."""
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
    """
    model = get_sentence_model()
    if model is None:
        return None
    try:
        embeddings = model.encode([text_a, text_b], convert_to_numpy=True)
        norm_a = np.linalg.norm(embeddings[0])
        norm_b = np.linalg.norm(embeddings[1])
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(embeddings[0], embeddings[1]) / (norm_a * norm_b))
    except Exception as e:
        logger.error('Sentence similarity failed: %s', e)
        return None


def batch_encode(texts: list[str]) -> np.ndarray | None:
    """Encode multiple texts into embeddings in a single batch."""
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
    """Find the most semantically similar candidates to a target text."""
    model = get_sentence_model()
    if model is None:
        return []
    try:
        all_texts = [target_text] + candidate_texts
        embeddings = model.encode(all_texts, convert_to_numpy=True, show_progress_bar=False)
        target_vec = embeddings[0]
        candidate_vecs = embeddings[1:]
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

    The CrossEncoder returns RAW LOGITS (unbounded numbers like 3.49,
    -2.77, -0.84). We apply softmax to convert these to probabilities
    (0.986, 0.002, 0.013) that sum to 1.0.

    Returns:
        {
            'label': 'contradiction' | 'entailment' | 'neutral',
            'probabilities': {
                'contradiction': float,  # 0.0 to 1.0
                'entailment': float,
                'neutral': float,
            },
            'raw_logits': {
                'contradiction': float,  # unbounded
                'entailment': float,
                'neutral': float,
            },
            'confidence': float,  # highest probability
        }
    """
    model = get_nli_model()
    if model is None:
        return None

    try:
        raw_scores = model.predict([(text_a, text_b)])[0]

        # Convert raw logits to probabilities via softmax
        probs = softmax(np.array(raw_scores))

        label_idx = int(np.argmax(probs))
        label = NLI_LABELS[label_idx]

        return {
            'label': label,
            'probabilities': {
                'contradiction': round(float(probs[0]), 4),
                'entailment': round(float(probs[1]), 4),
                'neutral': round(float(probs[2]), 4),
            },
            'raw_logits': {
                'contradiction': round(float(raw_scores[0]), 4),
                'entailment': round(float(raw_scores[1]), 4),
                'neutral': round(float(raw_scores[2]), 4),
            },
            'confidence': round(float(probs[label_idx]), 4),
        }
    except Exception as e:
        logger.error('NLI classification failed: %s', e)
        return None


def batch_classify_relationships(
    pairs: list[tuple[str, str]],
) -> list[dict]:
    """Classify relationships for multiple text pairs in a batch."""
    model = get_nli_model()
    if model is None:
        return []

    try:
        all_raw_scores = model.predict(pairs)

        results = []
        for raw_scores in all_raw_scores:
            probs = softmax(np.array(raw_scores))
            label_idx = int(np.argmax(probs))
            results.append({
                'label': NLI_LABELS[label_idx],
                'probabilities': {
                    'contradiction': round(float(probs[0]), 4),
                    'entailment': round(float(probs[1]), 4),
                    'neutral': round(float(probs[2]), 4),
                },
                'raw_logits': {
                    'contradiction': round(float(raw_scores[0]), 4),
                    'entailment': round(float(raw_scores[1]), 4),
                    'neutral': round(float(raw_scores[2]), 4),
                },
                'confidence': round(float(probs[label_idx]), 4),
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
    Threshold is a probability (0 to 1), not a raw logit.
    """
    if not pairs:
        return []

    results = batch_classify_relationships(pairs)

    contradictions = []
    for pair, result in zip(pairs, results):
        prob = result['probabilities']['contradiction']
        if prob >= threshold:
            contradictions.append({
                'text_a': pair[0],
                'text_b': pair[1],
                'contradiction_score': prob,
                'entailment_score': result['probabilities']['entailment'],
                'confidence': result['confidence'],
            })

    contradictions.sort(key=lambda c: c['contradiction_score'], reverse=True)
    return contradictions


# ---------------------------------------------------------------------------
# Combined analysis (similarity + NLI in one pass)
# ---------------------------------------------------------------------------


# Similarity threshold for "same topic" detection.
# 0.3 is appropriate for sentence-transformers; the model produces
# lower absolute scores than you might expect. 0.3+ usually means
# genuinely related topics. 0.5+ means very closely related.
SAME_TOPIC_THRESHOLD = 0.3

# NLI probability thresholds (these are true probabilities, 0 to 1)
CONTRADICTION_THRESHOLD = 0.6
ENTAILMENT_THRESHOLD = 0.6


def analyze_pair(text_a: str, text_b: str) -> dict:
    """
    Full analysis of two texts: similarity AND logical relationship.

    Two sources can be highly similar AND contradictory. That's the
    most interesting finding: they discuss the same topic but reach
    opposite conclusions.
    """
    sim = sentence_similarity(text_a, text_b)
    nli = classify_relationship(text_a, text_b)

    tension = 0.0
    interpretation = 'Analysis unavailable (PyTorch not installed).'

    if sim is not None and nli is not None:
        contradiction = nli['probabilities']['contradiction']
        entailment = nli['probabilities']['entailment']

        if sim > SAME_TOPIC_THRESHOLD and contradiction > CONTRADICTION_THRESHOLD:
            # Similar topic + conflicting claims = genuine tension
            tension = sim * contradiction
            interpretation = (
                f'These texts discuss related topics (similarity: {sim:.2f}) '
                f'and make conflicting claims (contradiction: {contradiction:.0%}). '
                f'This is a genuine intellectual tension.'
            )
        elif sim > SAME_TOPIC_THRESHOLD and entailment > ENTAILMENT_THRESHOLD:
            # Similar topic + agreeing claims = reinforcement
            tension = 0.0
            interpretation = (
                f'These texts discuss related topics (similarity: {sim:.2f}) '
                f'and their claims align (entailment: {entailment:.0%}). '
                f'They reinforce each other.'
            )
        elif sim > SAME_TOPIC_THRESHOLD:
            # Similar topic, neutral relationship
            tension = contradiction * 0.3
            interpretation = (
                f'These texts discuss related topics (similarity: {sim:.2f}) '
                f'without clear agreement or disagreement. '
                f'Contradiction probability: {contradiction:.0%}.'
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
    """Report which NLP capabilities are available."""
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

    try:
        from apps.research.embeddings import get_nlp
        nlp = get_nlp()
        status['spacy_model'] = nlp.meta.get('name', 'unknown')
    except Exception:
        pass

    return status

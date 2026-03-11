"""
Claim decomposition for notebook Objects.

This module breaks notebook text into atomic, sentence-sized claims that can
be compared with NLI. It prefers an optional LLM path when explicitly enabled
and falls back to deterministic rule-based sentence filtering.
"""

from __future__ import annotations

import json
import logging
import os
import re

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
CLAIM_DECOMPOSITION_MODEL = os.environ.get(
    'CLAIM_DECOMPOSITION_MODEL',
    'claude-haiku-4-5-20251001',
)
LLM_DECOMPOSITION_ENABLED = bool(ANTHROPIC_API_KEY) and os.environ.get(
    'CLAIM_DECOMPOSITION_LLM',
    'false',
).lower() == 'true'

_ASSERTION_HINTS = re.compile(
    r'\b('
    r'is|are|was|were|be|been|being|have|has|had|do|does|did|'
    r'will|would|can|could|should|may|might|must|'
    r'make|makes|made|'
    r'argues?|claims?|believes?|shows?|suggests?|finds?|'
    r'causes?|drives?|increases?|reduces?|improves?|harms?|'
    r'supports?|contradicts?|means?|indicates?|demonstrates?'
    r')\b',
    re.IGNORECASE,
)


def _dedupe_claims(claims: list[str], max_claims: int = 20) -> list[str]:
    cleaned_claims: list[str] = []
    seen: set[str] = set()

    for claim in claims:
        cleaned = ' '.join((claim or '').split()).strip()
        normalized = cleaned.lower()
        if len(cleaned) < 20 or normalized in seen:
            continue
        seen.add(normalized)
        cleaned_claims.append(cleaned)
        if len(cleaned_claims) >= max_claims:
            break

    return cleaned_claims


def decompose_claims_llm(text: str, max_claims: int = 20) -> list[str]:
    """Decompose text into claims via Anthropic's Messages API."""
    if not LLM_DECOMPOSITION_ENABLED or not text.strip():
        return []

    prompt = (
        'Break the following text into atomic propositional claims. '
        'Return only a JSON array of strings. Each string must be one sentence '
        'that makes one falsifiable assertion. No markdown, no preamble.\n\n'
        f'Text:\n{text[:3000]}'
    )

    try:
        import httpx

        response = httpx.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            json={
                'model': CLAIM_DECOMPOSITION_MODEL,
                'max_tokens': 800,
                'messages': [{'role': 'user', 'content': prompt}],
            },
            timeout=15.0,
        )
        response.raise_for_status()
        raw = response.json()['content'][0]['text'].strip()

        if raw.startswith('```'):
            raw = raw.split('\n', 1)[1].rsplit('```', 1)[0].strip()

        claims = json.loads(raw)
        if not isinstance(claims, list):
            return []
        return _dedupe_claims([str(item) for item in claims], max_claims=max_claims)
    except Exception as exc:
        logger.warning('LLM claim decomposition failed: %s', exc)
        return []


def _fallback_sentence_split(text: str) -> list[str]:
    return [
        segment.strip()
        for segment in re.split(r'(?<=[.!?])\s+', text)
        if segment.strip()
    ]


def decompose_claims_rule_based(
    text: str,
    nlp=None,
    max_claims: int = 20,
) -> list[str]:
    """Split text into sentence-sized claims with lightweight assertion checks."""
    if not text or not text.strip():
        return []

    candidates: list[str] = []

    if nlp is not None:
        try:
            doc = nlp(text)
            for sent in doc.sents:
                sent_text = sent.text.strip()
                if not sent_text:
                    continue
                if any(token.pos_ in {'VERB', 'AUX'} for token in sent):
                    candidates.append(sent_text)
        except Exception as exc:
            logger.debug('spaCy claim decomposition fallback triggered: %s', exc)

    if not candidates:
        for sentence in _fallback_sentence_split(text):
            word_count = len(re.findall(r'\b\w+\b', sentence))
            if word_count < 4:
                continue
            if _ASSERTION_HINTS.search(sentence):
                candidates.append(sentence)

    return _dedupe_claims(candidates, max_claims=max_claims)


def decompose_claims(text: str, nlp=None, max_claims: int = 20) -> list[str]:
    """Use the best available claim decomposition path for this environment."""
    claims = decompose_claims_llm(text, max_claims=max_claims)
    if claims:
        return claims
    return decompose_claims_rule_based(text, nlp=nlp, max_claims=max_claims)

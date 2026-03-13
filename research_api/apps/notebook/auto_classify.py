"""
Rule-based object type inference for notebook ingestion.

The goal is safe, deterministic typing without requiring model training.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

_URL_RE = re.compile(r'https?://\S+')
_CITATION_RE = re.compile(r'\([\w\-\s]+,?\s*\d{4}\)|\[\d+\]')
_ISO_DATE_RE = re.compile(r'\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b')
_LONG_DATE_RE = re.compile(
    r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}\b',
    re.IGNORECASE,
)
_BIBLIO_RE = re.compile(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2},\s*(?:19|20)\d{2}\b')
_TENTATIVE_MARKERS = (
    'i think',
    'what if',
    'maybe',
    'perhaps',
    'could be',
    'i wonder',
    'hypothesis',
    'it seems',
)
_QUOTE_ATTRIBUTION_MARKERS = ('said', 'wrote', 'argued', 'according to')
_CODE_PREFIXES = (
    'def ',
    'class ',
    'import ',
    'from ',
    '#!',
    'function ',
    'const ',
    'let ',
    'var ',
)
_CODE_SUFFIXES = ('{', '}', ');', '};', '</script>')
_ORG_MARKERS = (
    ' university',
    ' institute',
    ' center',
    ' centre',
    ' school',
    ' labs',
    ' lab',
    ' agency',
    ' corporation',
    ' corp',
    ' company',
    ' llc',
    ' ltd',
)
_CONCEPT_MARKERS = (
    'thesis',
    'framework',
    'principle',
    'theory',
    'defined as',
    'qualities of',
    'model of',
)
_TASK_PREFIXES = (
    'set up',
    'write',
    'build',
    'implement',
    'fix',
    'add',
    'create',
    'update',
    'test',
    'refactor',
)

DEFAULT_RULES = {
    'code_density_threshold': 0.20,
    'question_density_threshold': 0.30,
    'date_short_word_limit': 100,
    'citation_min_words': 200,
    'quote_max_words': 50,
}


def _has_url(text: str) -> bool:
    return bool(_URL_RE.search(text))


def _has_citation_pattern(text: str) -> bool:
    return bool(_CITATION_RE.search(text))


def _has_bibliographic_pattern(text: str) -> bool:
    return bool(_BIBLIO_RE.search(text))


def _question_density(text: str) -> float:
    stripped = text.strip()
    if not stripped:
        return 0.0
    sentence_count = max(len(re.findall(r'[.!?]+', stripped)), 1)
    question_count = stripped.count('?')
    return question_count / sentence_count


def _code_block_density(text: str) -> float:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return 0.0
    code_like = 0
    for line in lines:
        if line.startswith(_CODE_PREFIXES) or line.endswith(_CODE_SUFFIXES):
            code_like += 1
            continue
        if line.count('(') and line.count(')') and line.endswith(':'):
            code_like += 1
    return code_like / len(lines)


def _has_date_prominence(text: str) -> bool:
    head = text[:120]
    return bool(_ISO_DATE_RE.search(head) or _LONG_DATE_RE.search(head))


def _word_count(text: str) -> int:
    return len(text.split())


def _person_like_title(title: str) -> bool:
    words = [w for w in title.split() if w]
    if not (2 <= len(words) <= 4):
        return False
    return all(w[0].isupper() for w in words if w[0].isalpha())


def _looks_like_task(title: str, text: str) -> bool:
    lowered_title = title.lower().strip()
    lowered_text = text.lower()
    if any(lowered_title.startswith(prefix) for prefix in _TASK_PREFIXES):
        return True
    if 'todo' in lowered_title or 'to do' in lowered_title:
        return True
    return any(marker in lowered_text for marker in ('unit tests for', 'acceptance criteria', 'next steps'))


def score_object_types(obj, rules: dict | None = None) -> dict[str, int]:
    """
    Score candidate object-type slugs for an object.
    """
    effective_rules = dict(DEFAULT_RULES)
    if rules:
        effective_rules.update(rules)

    title = (obj.title or '').strip()
    text = (obj.body or '').strip()
    full = f'{title} {text}'.strip()
    if not full:
        return {}

    votes: dict[str, int] = {}

    if obj.url or _has_url(full):
        votes['source'] = votes.get('source', 0) + 3

    if _code_block_density(text) > float(effective_rules['code_density_threshold']):
        votes['script'] = votes.get('script', 0) + 3

    if _has_date_prominence(full) and _word_count(text) < int(effective_rules['date_short_word_limit']):
        votes['event'] = votes.get('event', 0) + 2

    if _question_density(full) > float(effective_rules['question_density_threshold']):
        votes['hunch'] = votes.get('hunch', 0) + 2

    if _has_citation_pattern(full) and _word_count(text) > int(effective_rules['citation_min_words']):
        votes['source'] = votes.get('source', 0) + 2

    lowered_full = full.lower()
    lowered_text = text.lower()
    lowered_title = title.lower()

    if any(marker in lowered_full for marker in _TENTATIVE_MARKERS):
        votes['hunch'] = votes.get('hunch', 0) + 2

    if _word_count(text) < int(effective_rules['quote_max_words']) and any(
        marker in lowered_text for marker in _QUOTE_ATTRIBUTION_MARKERS
    ):
        votes['quote'] = votes.get('quote', 0) + 2

    if _person_like_title(title) and not obj.url:
        votes['person'] = votes.get('person', 0) + 1

    if any(marker in lowered_title for marker in _ORG_MARKERS):
        votes['organization'] = votes.get('organization', 0) + 2

    if any(marker in lowered_text for marker in _CONCEPT_MARKERS):
        votes['concept'] = votes.get('concept', 0) + 2

    if _looks_like_task(title, text):
        votes['task'] = votes.get('task', 0) + 2

    if _has_bibliographic_pattern(full):
        votes['source'] = votes.get('source', 0) + 2

    return votes


def classify_object(obj, nlp=None, rules: dict | None = None) -> str:  # noqa: ARG001 - nlp reserved for future tuning
    """
    Infer the best object type slug from object content.
    """
    votes = score_object_types(obj, rules=rules)
    if not votes:
        return 'note'
    return max(votes, key=votes.get)


def auto_classify_batch(objects, nlp=None) -> int:
    """
    Classify a batch of objects and update object_type when confidence is clear.
    """
    from .models import ObjectType

    type_cache = {obj_type.slug: obj_type for obj_type in ObjectType.objects.all()}
    note_type = type_cache.get('note')
    updated = 0

    for obj in objects:
        if obj.object_type and note_type and obj.object_type_id != note_type.id:
            continue

        inferred_slug = classify_object(obj, nlp=nlp)
        inferred_type = type_cache.get(inferred_slug) or note_type
        if inferred_type is None or obj.object_type_id == inferred_type.id:
            continue

        obj.object_type = inferred_type
        obj.save(update_fields=['object_type', 'updated_at'])
        updated += 1

    logger.info('Auto-classified %d objects', updated)
    return updated

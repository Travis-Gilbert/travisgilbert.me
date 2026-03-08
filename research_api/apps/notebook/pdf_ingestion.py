"""
PDF text extraction for CommonPlace Object ingestion.

Two-layer fallback:
  1. spacy-layout (structure-aware: extracts title, sections, author from layout)
  2. pypdf (plain text extraction, no layout awareness)

Called by services.py enrich_url() when a captured URL resolves to a PDF
(Content-Type: application/pdf or URL ending .pdf).

Never raises. Returns a dict -- caller decides what to do with partial results.
Empty strings are valid: a scanned-image PDF will return no extractable text
from either method. The Object is still created; the user can add notes manually.
"""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Library availability flags
# ---------------------------------------------------------------------------

try:
    from spacy_layout import spaCyLayout
    import spacy as _spacy
    _nlp_layout = _spacy.load('en_core_web_sm')
    _SPACYLAYOUT_AVAILABLE = True
except (ImportError, OSError):
    _SPACYLAYOUT_AVAILABLE = False
    spaCyLayout = None
    _nlp_layout = None

try:
    from pypdf import PdfReader
    import io as _io
    _PYPDF_AVAILABLE = True
except ImportError:
    _PYPDF_AVAILABLE = False
    PdfReader = None
    _io = None


# ---------------------------------------------------------------------------
# Text cleaning helpers
# ---------------------------------------------------------------------------

def _clean_text(raw: str) -> str:
    """Remove control characters, collapse whitespace, normalize hyphens."""
    raw = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', raw)
    raw = re.sub(r'-\n(\w)', r'\1', raw)   # Rejoin hyphenated line breaks
    raw = re.sub(r'\n{3,}', '\n\n', raw)   # Max two consecutive newlines
    raw = re.sub(r'[ \t]+', ' ', raw)
    return raw.strip()


def _guess_title_from_text(body: str) -> str:
    """
    Heuristic: first non-empty line of substantial length is probably the title.
    Falls back to empty string if nothing useful is found.
    """
    for line in body.split('\n'):
        line = line.strip()
        if 10 <= len(line) <= 200 and not line.endswith(':'):
            return line
    return ''


def _extract_author_heuristic(body: str) -> str:
    """
    Look for common author attribution patterns in the first 800 chars.
    Patterns: "By Name", "Author: Name", "Name, Institution"
    """
    snippet = body[:800]
    patterns = [
        r'(?i)^by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',
        r'(?i)author[s]?\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',
        r'(?i)written by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',
    ]
    for pattern in patterns:
        match = re.search(pattern, snippet, re.MULTILINE)
        if match:
            return match.group(1).strip()
    return ''


# ---------------------------------------------------------------------------
# spacy-layout extraction (primary)
# ---------------------------------------------------------------------------

def _extract_via_spacy_layout(pdf_bytes: bytes) -> dict[str, Any]:
    """
    Use spacy-layout to extract structured content from a PDF.

    spacy-layout parses the PDF layout (headings, body, tables) and
    returns a structured spaCy Doc. We pull:
      - Title: from the first heading or layout title block
      - Body: all text spans joined in reading order
      - Sections: list of {heading, body} dicts for each section
      - Author: heuristic from first-page text

    Returns an empty-string dict if parsing fails -- never raises.
    """
    if not _SPACYLAYOUT_AVAILABLE:
        return {}

    try:
        import io
        layout = spaCyLayout(_nlp_layout)
        doc = layout(io.BytesIO(pdf_bytes))

        title = ''
        sections = []
        full_text_parts = []

        current_heading = ''
        current_body_parts = []

        for span in doc.spans.get('layout', []):
            label = span.label_
            text = span.text.strip()
            if not text:
                continue

            if label in ('title', 'section_header', 'heading'):
                if current_heading or current_body_parts:
                    sections.append({
                        'heading': current_heading,
                        'body': _clean_text(' '.join(current_body_parts)),
                    })
                    current_body_parts = []

                if not title and label == 'title':
                    title = text
                current_heading = text
                full_text_parts.append(text)

            else:
                current_body_parts.append(text)
                full_text_parts.append(text)

        if current_heading or current_body_parts:
            sections.append({
                'heading': current_heading,
                'body': _clean_text(' '.join(current_body_parts)),
            })

        body = _clean_text('\n\n'.join(full_text_parts))

        if not title:
            title = _guess_title_from_text(body)

        author = _extract_author_heuristic(body)

        return {
            'title': title,
            'body': body,
            'author': author,
            'sections': sections,
            'char_count': len(body),
            'method': 'spacy_layout',
        }

    except Exception as exc:
        logger.warning('spacy-layout PDF extraction failed: %s', exc)
        return {}


# ---------------------------------------------------------------------------
# pypdf extraction (fallback)
# ---------------------------------------------------------------------------

def _extract_via_pypdf(pdf_bytes: bytes) -> dict[str, Any]:
    """
    Plain text extraction via pypdf. No layout awareness.

    pypdf reads each page and extracts raw text. No structure is inferred.
    Title is guessed from text heuristics or PDF metadata if available.
    This is the fallback when spacy-layout is not installed or fails.

    Returns an empty-string dict if extraction fails -- never raises.
    """
    if not _PYPDF_AVAILABLE:
        logger.warning('pypdf not installed. Cannot extract PDF text.')
        return {}

    try:
        import io
        reader = PdfReader(io.BytesIO(pdf_bytes))

        # Try PDF metadata first
        metadata = reader.metadata or {}
        meta_title = (metadata.get('/Title') or '').strip()
        meta_author = (metadata.get('/Author') or '').strip()

        page_texts = []
        for page in reader.pages:
            try:
                page_text = page.extract_text() or ''
                page_texts.append(page_text)
            except Exception:
                continue

        body = _clean_text('\n\n'.join(page_texts))

        title = meta_title or _guess_title_from_text(body)
        author = meta_author or _extract_author_heuristic(body)

        return {
            'title': title,
            'body': body,
            'author': author,
            'sections': [],
            'char_count': len(body),
            'method': 'pypdf',
        }

    except Exception as exc:
        logger.warning('pypdf PDF extraction failed: %s', exc)
        return {}


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def extract_pdf_text(pdf_bytes: bytes) -> dict[str, Any]:
    """
    Extract structured text from a PDF.

    Tries spacy-layout first (structure-aware), falls back to pypdf
    (plain text), falls back to empty strings if both fail.

    Return shape:
      {
        'title': str,          # Extracted or inferred title
        'body': str,           # Full cleaned text body
        'author': str,         # Author name if found, else ''
        'sections': [          # Only populated by spacy-layout
          {'heading': str, 'body': str},
          ...
        ],
        'char_count': int,     # Length of body text
        'method': str,         # 'spacy_layout' | 'pypdf' | 'none'
      }

    Never raises. The caller should check char_count == 0 to detect
    scanned-image PDFs that yielded no extractable text.
    """
    if not pdf_bytes:
        return {
            'title': '', 'body': '', 'author': '',
            'sections': [], 'char_count': 0, 'method': 'none',
        }

    # Primary: spacy-layout
    if _SPACYLAYOUT_AVAILABLE:
        result = _extract_via_spacy_layout(pdf_bytes)
        if result and result.get('char_count', 0) > 50:
            return result

    # Fallback: pypdf
    if _PYPDF_AVAILABLE:
        result = _extract_via_pypdf(pdf_bytes)
        if result:
            return result

    logger.warning(
        'PDF extraction: no viable parser available or all parsers failed. '
        'Object will be created with empty body.'
    )
    return {
        'title': '', 'body': '', 'author': '',
        'sections': [], 'char_count': 0, 'method': 'none',
    }

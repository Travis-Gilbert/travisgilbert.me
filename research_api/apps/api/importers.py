"""
Import parsers for research sources.

Each parser function takes file content (str or bytes) and returns
a list of dicts with source field values, plus a list of errors.

Supported formats: bibtex, ris, csv, opml, json.
"""

import csv
import io
import json
import logging
from xml.etree.ElementTree import fromstring, ParseError

from django.utils.text import slugify

from apps.research.models import Source, SourceType

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────

_VALID_SOURCE_TYPES = {c[0] for c in SourceType.choices}


def _normalize_source_type(raw_type):
    """Map various type strings to valid SourceType values."""
    if not raw_type:
        return SourceType.ARTICLE
    lower = raw_type.lower().strip()
    # Direct match
    if lower in _VALID_SOURCE_TYPES:
        return lower
    # BibTeX type mapping
    bibtex_map = {
        'inproceedings': 'paper',
        'proceedings': 'paper',
        'techreport': 'report',
        'phdthesis': 'paper',
        'mastersthesis': 'paper',
        'incollection': 'article',
        'inbook': 'book',
        'manual': 'document',
        'unpublished': 'document',
        'booklet': 'book',
        'conference': 'paper',
    }
    if lower in bibtex_map:
        return bibtex_map[lower]
    # RIS type mapping
    ris_map = {
        'jour': 'article',
        'book': 'book',
        'rprt': 'report',
        'gen': 'other',
        'elec': 'website',
        'data': 'dataset',
        'sound': 'podcast',
        'video': 'video',
        'map': 'map',
    }
    if lower in ris_map:
        return ris_map[lower]
    return SourceType.ARTICLE


def _parse_tags(raw):
    """Parse tags from various formats."""
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        if ';' in raw:
            return [t.strip() for t in raw.split(';') if t.strip()]
        if ',' in raw:
            return [t.strip() for t in raw.split(',') if t.strip()]
        return [raw.strip()] if raw.strip() else []
    return []


def _parse_date(raw):
    """Parse a date string, returning None on failure."""
    if not raw:
        return None
    from django.utils.dateparse import parse_date
    raw = str(raw).strip().rstrip('/')
    # Handle year-only (e.g., "2024")
    if raw.isdigit() and len(raw) == 4:
        raw = f'{raw}-01-01'
    return parse_date(raw)


# ── Import functions ─────────────────────────────────────────────

def import_bibtex(content):
    """Parse BibTeX content into source dicts."""
    import bibtexparser

    if isinstance(content, bytes):
        content = content.decode('utf-8', errors='replace')

    parser = bibtexparser.bparser.BibTexParser(common_strings=True)
    bib_db = bibtexparser.loads(content, parser=parser)

    records = []
    errors = []
    for i, entry in enumerate(bib_db.entries, 1):
        title = entry.get('title', '').strip()
        if not title:
            errors.append({'line': i, 'field': 'title', 'message': 'Missing title.'})
            continue

        records.append({
            'title': title,
            'creator': entry.get('author', ''),
            'source_type': _normalize_source_type(entry.get('ENTRYTYPE', 'misc')),
            'url': entry.get('url', ''),
            'publication': entry.get('journal', '') or entry.get('booktitle', ''),
            'date_published': _parse_date(entry.get('year', '')),
            'public_annotation': entry.get('note', '') or entry.get('abstract', ''),
            'tags': _parse_tags(entry.get('keywords', '')),
        })

    return records, errors


def import_ris(content):
    """Parse RIS tagged format into source dicts."""
    if isinstance(content, bytes):
        content = content.decode('utf-8', errors='replace')

    records = []
    errors = []
    current = {}
    line_num = 0

    for line in content.splitlines():
        line_num += 1
        line = line.strip()
        if not line:
            continue

        if line.startswith('ER  -'):
            if current.get('title'):
                records.append(current)
            elif current:
                errors.append({'line': line_num, 'field': 'title', 'message': 'Missing title.'})
            current = {}
            continue

        if len(line) < 6 or line[2:4] != '  ':
            continue

        tag = line[:2].strip()
        value = line[6:].strip()

        if tag == 'TY':
            current['source_type'] = _normalize_source_type(value)
        elif tag == 'TI' or tag == 'T1':
            current['title'] = value
        elif tag == 'AU' or tag == 'A1':
            current['creator'] = value
        elif tag == 'JO' or tag == 'JF' or tag == 'T2':
            current.setdefault('publication', value)
        elif tag == 'PY' or tag == 'Y1':
            current['date_published'] = _parse_date(value)
        elif tag == 'UR':
            current['url'] = value
        elif tag == 'N1' or tag == 'AB':
            current['public_annotation'] = value
        elif tag == 'KW':
            current.setdefault('tags', []).append(value)

    # Handle missing final ER
    if current.get('title'):
        records.append(current)

    return records, errors


def import_csv_file(content):
    """Parse CSV with header row into source dicts."""
    if isinstance(content, bytes):
        content = content.decode('utf-8', errors='replace')

    reader = csv.DictReader(io.StringIO(content))
    records = []
    errors = []

    for i, row in enumerate(reader, 2):  # 2 because row 1 is header
        title = (row.get('title') or '').strip()
        if not title:
            errors.append({'line': i, 'field': 'title', 'message': 'Missing title.'})
            continue

        records.append({
            'title': title,
            'creator': (row.get('creator') or row.get('author') or '').strip(),
            'source_type': _normalize_source_type(row.get('source_type') or row.get('type', '')),
            'url': (row.get('url') or '').strip(),
            'publication': (row.get('publication') or row.get('journal') or '').strip(),
            'date_published': _parse_date(row.get('date_published') or row.get('year', '')),
            'date_encountered': _parse_date(row.get('date_encountered', '')),
            'public_annotation': (row.get('public_annotation') or row.get('note') or '').strip(),
            'tags': _parse_tags(row.get('tags', '')),
        })

    return records, errors


def import_opml(content):
    """Parse OPML XML into source dicts."""
    if isinstance(content, bytes):
        content = content.decode('utf-8', errors='replace')

    try:
        root = fromstring(content)
    except ParseError as e:
        return [], [{'line': 1, 'field': 'file', 'message': f'Invalid XML: {e}'}]

    records = []
    errors = []
    line_num = 0

    body = root.find('body')
    if body is None:
        return [], [{'line': 1, 'field': 'file', 'message': 'No <body> element found.'}]

    for outline in body.iter('outline'):
        line_num += 1
        title = outline.get('text') or outline.get('title', '')
        if not title:
            continue
        # Skip group outlines (ones that only have children, no URL)
        url = outline.get('htmlUrl') or outline.get('xmlUrl', '')
        if not url and list(outline):
            continue

        records.append({
            'title': title.strip(),
            'url': url,
            'source_type': _normalize_source_type(outline.get('type', '')),
            'creator': '',
            'publication': '',
            'public_annotation': outline.get('description', ''),
            'tags': [],
        })

    return records, errors


def import_json_file(content):
    """Parse JSON array of source objects."""
    if isinstance(content, bytes):
        content = content.decode('utf-8', errors='replace')

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        return [], [{'line': 1, 'field': 'file', 'message': f'Invalid JSON: {e}'}]

    if not isinstance(data, list):
        data = [data]

    records = []
    errors = []

    for i, item in enumerate(data, 1):
        if not isinstance(item, dict):
            errors.append({'line': i, 'field': 'item', 'message': 'Expected object.'})
            continue

        title = (item.get('title') or '').strip()
        if not title:
            errors.append({'line': i, 'field': 'title', 'message': 'Missing title.'})
            continue

        records.append({
            'title': title,
            'creator': item.get('creator', '') or item.get('author', ''),
            'source_type': _normalize_source_type(item.get('source_type') or item.get('type', '')),
            'url': item.get('url', ''),
            'publication': item.get('publication', '') or item.get('publisher', ''),
            'date_published': _parse_date(item.get('date_published') or item.get('year', '')),
            'date_encountered': _parse_date(item.get('date_encountered', '')),
            'public_annotation': item.get('public_annotation', '') or item.get('annotation', ''),
            'tags': _parse_tags(item.get('tags', [])),
        })

    return records, errors


def create_sources_from_records(records, dry_run=False):
    """
    Create Source objects from parsed records.

    Skips duplicates (matching by slug). Returns (created, skipped, errors, preview).
    """
    created = 0
    skipped = 0
    errors = []
    preview = []

    for i, rec in enumerate(records, 1):
        slug = slugify(rec['title'])[:500]
        if not slug:
            errors.append({'line': i, 'field': 'title', 'message': 'Cannot generate slug.'})
            continue

        if dry_run:
            rec_preview = dict(rec)
            rec_preview['slug'] = slug
            if rec_preview.get('date_published'):
                rec_preview['date_published'] = rec_preview['date_published'].isoformat()
            if rec_preview.get('date_encountered'):
                rec_preview['date_encountered'] = rec_preview['date_encountered'].isoformat()
            preview.append(rec_preview)
            created += 1
            continue

        if Source.objects.filter(slug=slug).exists():
            skipped += 1
            continue

        try:
            Source.objects.create(
                title=rec['title'],
                slug=slug,
                creator=rec.get('creator', ''),
                source_type=rec.get('source_type', SourceType.ARTICLE),
                url=rec.get('url', ''),
                publication=rec.get('publication', ''),
                date_published=rec.get('date_published'),
                date_encountered=rec.get('date_encountered'),
                public_annotation=rec.get('public_annotation', ''),
                tags=rec.get('tags', []),
            )
            created += 1
        except Exception as e:
            errors.append({'line': i, 'field': 'source', 'message': str(e)})

    return created, skipped, errors, preview


# ── Format registry ──────────────────────────────────────────────

IMPORT_FORMATS = {
    'bibtex': import_bibtex,
    'ris': import_ris,
    'csv': import_csv_file,
    'opml': import_opml,
    'json': import_json_file,
}

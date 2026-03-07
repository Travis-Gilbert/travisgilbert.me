"""
Export serializers for research sources.

Each function takes a queryset of Source objects and returns
a string in the target format. The export view sets the
correct Content-Type and Content-Disposition headers.

Supported formats: json, bibtex, ris, opml, csv, json-ld.
"""

import csv
import io
import json
from xml.etree.ElementTree import Element, SubElement, tostring

from apps.api.serializers import SourceListSerializer


# ── Helpers ──────────────────────────────────────────────────────

def _date_str(d):
    """Format a date object to ISO string or empty."""
    return d.isoformat() if d else ''


def _tags_str(tags):
    """Join tags list with semicolons for CSV export."""
    if isinstance(tags, list):
        return '; '.join(tags)
    return ''


# ── BibTeX type mapping ─────────────────────────────────────────

_BIBTEX_TYPE_MAP = {
    'book': 'book',
    'article': 'article',
    'paper': 'article',
    'report': 'techreport',
    'video': 'misc',
    'podcast': 'misc',
    'dataset': 'misc',
    'document': 'misc',
    'map': 'misc',
    'archive': 'misc',
    'interview': 'misc',
    'website': 'misc',
    'other': 'misc',
}


# ── RIS type mapping ────────────────────────────────────────────

_RIS_TYPE_MAP = {
    'book': 'BOOK',
    'article': 'JOUR',
    'paper': 'JOUR',
    'report': 'RPRT',
    'video': 'VIDEO',
    'podcast': 'SOUND',
    'dataset': 'DATA',
    'document': 'GEN',
    'map': 'MAP',
    'archive': 'GEN',
    'interview': 'GEN',
    'website': 'ELEC',
    'other': 'GEN',
}


# ── JSON-LD type mapping ────────────────────────────────────────

_JSONLD_TYPE_MAP = {
    'paper': 'ScholarlyArticle',
    'article': 'Article',
    'book': 'Book',
    'report': 'Report',
    'dataset': 'Dataset',
    'video': 'VideoObject',
    'podcast': 'PodcastEpisode',
    'map': 'Map',
    'website': 'WebPage',
}


# ── Export functions ─────────────────────────────────────────────

def export_json(qs):
    """Standard JSON array matching SourceListSerializer schema."""
    serializer = SourceListSerializer(qs, many=True)
    return json.dumps(serializer.data, indent=2, default=str)


def export_bibtex(qs):
    """BibTeX format. Maps source_type to entry types."""
    lines = []
    for source in qs:
        entry_type = _BIBTEX_TYPE_MAP.get(source.source_type, 'misc')
        cite_key = source.slug.replace('-', '_')
        lines.append(f'@{entry_type}{{{cite_key},')
        lines.append(f'  title = {{{source.title}}},')
        if source.creator:
            lines.append(f'  author = {{{source.creator}}},')
        if source.publication:
            lines.append(f'  journal = {{{source.publication}}},')
        if source.date_published:
            lines.append(f'  year = {{{source.date_published.year}}},')
        if source.url:
            lines.append(f'  url = {{{source.url}}},')
        if source.public_annotation:
            annotation = source.public_annotation.replace('{', '\\{').replace('}', '\\}')
            lines.append(f'  note = {{{annotation}}},')
        lines.append('}')
        lines.append('')
    return '\n'.join(lines)


def export_ris(qs):
    """RIS tagged format."""
    lines = []
    for source in qs:
        ris_type = _RIS_TYPE_MAP.get(source.source_type, 'GEN')
        lines.append(f'TY  - {ris_type}')
        lines.append(f'TI  - {source.title}')
        if source.creator:
            lines.append(f'AU  - {source.creator}')
        if source.publication:
            lines.append(f'JO  - {source.publication}')
        if source.date_published:
            lines.append(f'PY  - {source.date_published.year}///')
        if source.url:
            lines.append(f'UR  - {source.url}')
        if source.public_annotation:
            lines.append(f'N1  - {source.public_annotation}')
        if isinstance(source.tags, list):
            for tag in source.tags:
                lines.append(f'KW  - {tag}')
        lines.append('ER  - ')
        lines.append('')
    return '\n'.join(lines)


def export_opml(qs):
    """OPML 2.0 XML. Sources grouped by source_type."""
    opml = Element('opml', version='2.0')
    head = SubElement(opml, 'head')
    title_el = SubElement(head, 'title')
    title_el.text = 'Research Sources'
    body = SubElement(opml, 'body')

    # Group by source_type
    groups = {}
    for source in qs:
        groups.setdefault(source.source_type, []).append(source)

    for stype, sources in sorted(groups.items()):
        group_el = SubElement(body, 'outline', text=stype, title=stype)
        for source in sources:
            attrs = {
                'text': source.title,
                'title': source.title,
                'type': 'link',
            }
            if source.url:
                attrs['htmlUrl'] = source.url
            if source.creator:
                attrs['description'] = f'by {source.creator}'
            SubElement(group_el, 'outline', **attrs)

    return tostring(opml, encoding='unicode', xml_declaration=True)


def export_csv(qs):
    """CSV with standard columns."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'title', 'creator', 'source_type', 'url', 'publication',
        'date_published', 'date_encountered', 'tags', 'public_annotation',
    ])
    for source in qs:
        writer.writerow([
            source.title,
            source.creator,
            source.source_type,
            source.url,
            source.publication,
            _date_str(source.date_published),
            _date_str(source.date_encountered),
            _tags_str(source.tags),
            source.public_annotation,
        ])
    return output.getvalue()


def export_jsonld(qs):
    """Schema.org JSON-LD with CreativeWork types."""
    items = []
    for source in qs:
        schema_type = _JSONLD_TYPE_MAP.get(source.source_type, 'CreativeWork')
        item = {
            '@context': 'https://schema.org',
            '@type': schema_type,
            'name': source.title,
            'identifier': source.slug,
        }
        if source.creator:
            item['author'] = {'@type': 'Person', 'name': source.creator}
        if source.url:
            item['url'] = source.url
        if source.publication:
            item['publisher'] = {'@type': 'Organization', 'name': source.publication}
        if source.date_published:
            item['datePublished'] = source.date_published.isoformat()
        if source.public_annotation:
            item['description'] = source.public_annotation
        if isinstance(source.tags, list) and source.tags:
            item['keywords'] = source.tags
        items.append(item)
    return json.dumps(items, indent=2, default=str)


# ── Format registry ──────────────────────────────────────────────

EXPORT_FORMATS = {
    'json': {
        'fn': export_json,
        'content_type': 'application/json',
        'extension': 'json',
    },
    'bibtex': {
        'fn': export_bibtex,
        'content_type': 'application/x-bibtex',
        'extension': 'bib',
    },
    'ris': {
        'fn': export_ris,
        'content_type': 'application/x-research-info-systems',
        'extension': 'ris',
    },
    'opml': {
        'fn': export_opml,
        'content_type': 'text/x-opml',
        'extension': 'opml',
    },
    'csv': {
        'fn': export_csv,
        'content_type': 'text/csv',
        'extension': 'csv',
    },
    'json-ld': {
        'fn': export_jsonld,
        'content_type': 'application/ld+json',
        'extension': 'jsonld',
    },
}

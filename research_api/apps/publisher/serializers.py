"""
JSON serializers for publishing research data to the Next.js repo.

These produce the JSON structures consumed by the Next.js site.
Field names use camelCase to match JavaScript conventions.
"""

import json


def serialize_source(source):
    """Serialize a Source instance for static JSON."""
    return {
        'id': source.id,
        'title': source.title,
        'slug': source.slug,
        'sourceType': source.source_type,
        'authors': source.authors or [],
        'publisher': source.publisher,
        'publicationDate': (
            source.publication_date.isoformat()
            if source.publication_date else None
        ),
        'url': source.url,
        'isbn': source.isbn,
        'doi': source.doi,
        'notes': source.notes,
        'tags': source.tags or [],
        'coverImageUrl': source.cover_image_url,
        'contentCount': source.content_count if hasattr(source, 'content_count') else 0,
    }


def serialize_reference(ref):
    """Serialize a ContentReference for static JSON."""
    return {
        'sourceId': ref.source_id,
        'sourceTitle': ref.source.title if ref.source_id else '',
        'sourceSlug': ref.source.slug if ref.source_id else '',
        'contentType': ref.content_type,
        'contentSlug': ref.content_slug,
        'contentTitle': ref.content_title,
        'context': ref.context,
        'paragraphIndex': ref.paragraph_index,
    }


def serialize_thread(thread, include_entries=True):
    """Serialize a ResearchThread for static JSON."""
    data = {
        'id': thread.id,
        'title': thread.title,
        'slug': thread.slug,
        'description': thread.description,
        'status': thread.status,
        'startedDate': (
            thread.started_date.isoformat()
            if thread.started_date else None
        ),
        'tags': thread.tags or [],
    }
    if include_entries:
        data['entries'] = [
            {
                'date': entry.date.isoformat(),
                'title': entry.title,
                'body': entry.body,
                'sourceIds': list(entry.sources.values_list('id', flat=True)),
                'contentType': entry.content_type,
                'contentSlug': entry.content_slug,
            }
            for entry in thread.entries.all()
        ]
    return data


def serialize_backlinks(backlink_graph):
    """
    Serialize the backlink graph for static JSON.

    Input is the output of get_all_backlinks().
    """
    return {
        key: [
            {
                'contentType': link['content_type'],
                'contentSlug': link['content_slug'],
                'sharedSources': [
                    {
                        'sourceId': s['source_id'],
                        'sourceTitle': s['source_title'],
                    }
                    for s in link['shared_sources']
                ],
            }
            for link in links
        ]
        for key, links in backlink_graph.items()
    }


def to_json(data):
    """Serialize to formatted JSON string."""
    return json.dumps(data, indent=2, ensure_ascii=False) + '\n'

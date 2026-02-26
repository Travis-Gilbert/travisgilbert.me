"""
Publish orchestrator for research data.

Collects all research data, serializes it, and commits the JSON files
to the Next.js repo. Designed to be called from a management command
or admin action.

Supports three modes:
  publish_all()        : Full publish (sources, threads, mentions, graph, backlinks)
  publish_only(kind)   : Single data type (sources, threads, mentions)
  publish_trail(slug)  : Per-slug research trail JSON
"""

import logging
from collections import defaultdict

from django.db.models import Count, Prefetch

from apps.mentions.models import Mention
from apps.research.models import ResearchThread, Source, SourceLink, ThreadEntry
from apps.research.services import detect_content_type, get_all_backlinks, get_backlinks

from . import serializers
from .github import publish_files
from .models import PublishLog

logger = logging.getLogger(__name__)

# Paths in the Next.js repo where research data lives
DATA_PREFIX = 'src/data/research'


def publish_all():
    """
    Publish all research data as static JSON to the Next.js repo.

    Creates/updates these files:
        src/data/research/sources.json
        src/data/research/threads.json
        src/data/research/mentions.json
        src/data/research/backlinks.json
        src/data/research/graph.json

    Returns:
        dict with keys: success, commit_sha, commit_url, error
    """
    logger.info('Starting full research data publish...')

    # Gather data (only public records)
    sources = list(
        Source.objects.public()
        .annotate(link_count=Count('links'))
        .order_by('title')
    )
    links = list(
        SourceLink.objects.select_related('source')
        .filter(source__public=True)
        .order_by('content_type', 'content_slug')
    )
    threads = list(
        ResearchThread.objects.public()
        .prefetch_related('entries', 'entries__source')
        .order_by('-started_date')
    )
    backlink_graph = get_all_backlinks()
    mentions = list(
        Mention.objects.public()
        .select_related('mention_source')
        .order_by('-created_at')
    )

    # Serialize
    sources_json = serializers.to_json([
        serializers.serialize_source(s) for s in sources
    ])
    threads_json = serializers.to_json([
        serializers.serialize_thread(t) for t in threads
    ])
    mentions_json = serializers.to_json([
        serializers.serialize_mention(m) for m in mentions
    ])
    backlinks_json = serializers.to_json(
        serializers.serialize_backlinks(backlink_graph)
    )
    graph_json = serializers.to_json(
        serializers.serialize_graph(links)
    )

    # Build file operations
    file_ops = [
        {'path': f'{DATA_PREFIX}/sources.json', 'content': sources_json},
        {'path': f'{DATA_PREFIX}/threads.json', 'content': threads_json},
        {'path': f'{DATA_PREFIX}/mentions.json', 'content': mentions_json},
        {'path': f'{DATA_PREFIX}/backlinks.json', 'content': backlinks_json},
        {'path': f'{DATA_PREFIX}/graph.json', 'content': graph_json},
    ]

    # Commit atomically
    result = publish_files(
        file_ops,
        commit_message=(
            f'data(research): publish {len(sources)} sources, '
            f'{len(threads)} threads, {len(mentions)} mentions'
        ),
    )

    # Write audit log
    total_records = len(sources) + len(links) + len(threads) + len(mentions)
    PublishLog.objects.create(
        data_type='full',
        record_count=total_records,
        commit_sha=result.get('commit_sha', ''),
        commit_url=result.get('commit_url', ''),
        success=result['success'],
        error_message=result.get('error', ''),
    )

    if result['success']:
        logger.info(
            'Full publish: %s sources, %s threads, %s mentions. Commit: %s',
            len(sources), len(threads), len(mentions),
            result['commit_sha'][:8],
        )
    else:
        logger.error('Full publish failed: %s', result['error'])

    return result


def publish_only(kind):
    """
    Publish a single data type to the Next.js repo.

    Args:
        kind: one of 'sources', 'threads', 'mentions'

    Returns:
        dict with keys: success, commit_sha, commit_url, error
    """
    logger.info('Publishing %s only...', kind)

    if kind == 'sources':
        sources = list(
            Source.objects.public()
            .annotate(link_count=Count('links'))
            .order_by('title')
        )
        content = serializers.to_json([
            serializers.serialize_source(s) for s in sources
        ])
        file_ops = [{'path': f'{DATA_PREFIX}/sources.json', 'content': content}]
        data_type = 'sources'
        record_count = len(sources)
        commit_msg = f'data(research): publish {len(sources)} sources'

    elif kind == 'threads':
        threads = list(
            ResearchThread.objects.public()
            .prefetch_related('entries', 'entries__source')
            .order_by('-started_date')
        )
        content = serializers.to_json([
            serializers.serialize_thread(t) for t in threads
        ])
        file_ops = [{'path': f'{DATA_PREFIX}/threads.json', 'content': content}]
        data_type = 'threads'
        record_count = len(threads)
        commit_msg = f'data(research): publish {len(threads)} threads'

    elif kind == 'mentions':
        mentions = list(
            Mention.objects.public()
            .select_related('mention_source')
            .order_by('-created_at')
        )
        content = serializers.to_json([
            serializers.serialize_mention(m) for m in mentions
        ])
        file_ops = [{'path': f'{DATA_PREFIX}/mentions.json', 'content': content}]
        data_type = 'mentions'
        record_count = len(mentions)
        commit_msg = f'data(research): publish {len(mentions)} mentions'

    else:
        return {'success': False, 'error': f'Unknown data type: {kind}'}

    result = publish_files(file_ops, commit_message=commit_msg)

    PublishLog.objects.create(
        data_type=data_type,
        record_count=record_count,
        commit_sha=result.get('commit_sha', ''),
        commit_url=result.get('commit_url', ''),
        success=result['success'],
        error_message=result.get('error', ''),
    )

    if result['success']:
        logger.info('%s published: %s records. Commit: %s',
                    kind, record_count, result['commit_sha'][:8])
    else:
        logger.error('%s publish failed: %s', kind, result['error'])

    return result


def publish_trail(slug):
    """
    Publish a per-slug research trail to the Next.js repo.

    Creates/updates src/data/research/trails/<slug>.json with sources,
    backlinks, thread, and mentions aggregated for that content piece.
    This is the static equivalent of GET /api/v1/trail/<slug>/.

    Args:
        slug: content slug (essay or field note)

    Returns:
        dict with keys: success, commit_sha, commit_url, error
    """
    logger.info('Publishing trail for %s...', slug)

    content_type = detect_content_type(slug)

    # Sources linked to this content (public only at DB level)
    links = (
        SourceLink.objects
        .filter(
            content_type=content_type,
            content_slug=slug,
            source__public=True,
        )
        .select_related('source')
        .order_by('role', 'source__title')
    )
    sources_data = [
        {
            'id': lnk.source.id,
            'title': lnk.source.title,
            'slug': lnk.source.slug,
            'creator': lnk.source.creator,
            'sourceType': lnk.source.source_type,
            'url': lnk.source.url,
            'publication': lnk.source.publication,
            'publicAnnotation': lnk.source.public_annotation,
            'role': lnk.role,
            'keyQuote': lnk.key_quote,
        }
        for lnk in links
    ]

    # Backlinks
    backlinks_raw = get_backlinks(content_type, slug)
    backlinks_data = [
        {
            'contentType': bl['content_type'],
            'contentSlug': bl['content_slug'],
            'contentTitle': bl.get('content_title', ''),
            'sharedSources': [
                {'sourceId': s['source_id'], 'sourceTitle': s['source_title']}
                for s in bl['shared_sources']
            ],
        }
        for bl in backlinks_raw
    ]

    # Research thread (if this slug is the resulting essay)
    thread_data = None
    thread = (
        ResearchThread.objects.public()
        .filter(resulting_essay_slug=slug)
        .prefetch_related(
            Prefetch(
                'entries',
                queryset=(
                    ThreadEntry.objects
                    .select_related('source')
                    .order_by('order', '-date')
                ),
            )
        )
        .first()
    )
    if thread:
        thread_data = {
            'title': thread.title,
            'slug': thread.slug,
            'description': thread.description,
            'status': thread.status,
            'startedDate': (
                thread.started_date.isoformat()
                if thread.started_date else None
            ),
            'entries': [
                {
                    'entryType': e.entry_type,
                    'date': e.date.isoformat(),
                    'title': e.title,
                    'description': e.description,
                    'sourceTitle': e.source.title if e.source else '',
                }
                for e in thread.entries.all()
            ],
        }

    # Verified, public mentions
    mentions = list(
        Mention.objects.public()
        .filter(target_slug=slug)
        .select_related('mention_source')
        .order_by('-created_at')[:20]
    )
    mentions_data = [
        {
            'sourceUrl': m.source_url,
            'sourceTitle': m.source_title,
            'sourceExcerpt': m.source_excerpt,
            'sourceAuthor': m.source_author,
            'mentionType': m.mention_type,
            'featured': m.featured,
            'mentionSourceName': (
                m.mention_source.name if m.mention_source else ''
            ),
            'mentionSourceAvatar': (
                m.mention_source.avatar_url if m.mention_source else ''
            ),
            'createdAt': m.created_at.isoformat(),
        }
        for m in mentions
    ]

    # Build trail JSON
    trail = serializers.serialize_trail(
        slug, content_type, sources_data, backlinks_data,
        thread_data, mentions_data,
    )
    trail_json = serializers.to_json(trail)

    file_ops = [{
        'path': f'{DATA_PREFIX}/trails/{slug}.json',
        'content': trail_json,
    }]

    result = publish_files(
        file_ops,
        commit_message=f'data(research): publish trail for {slug}',
    )

    if result['success']:
        logger.info('Trail published for %s. Commit: %s',
                    slug, result['commit_sha'][:8])
    else:
        logger.error('Trail publish failed for %s: %s', slug, result['error'])

    return result

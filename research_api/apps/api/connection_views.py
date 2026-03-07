"""
API views for connection engine and semantic similarity.

These endpoints expose the computed connections and similarity data.
They complement the existing views.py (which handles sources, trails,
threads, and the source graph) with content-to-content intelligence.

NEW ENDPOINTS:
    GET /api/v1/connections/<slug>/     - Connections for one content piece
    GET /api/v1/connections/graph/      - Full content connection graph (D3-ready)
    GET /api/v1/similar/<slug>/         - Semantically similar content
    GET /api/v1/similar/sources/        - Semantically similar sources
"""

import logging

from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.research.connections import (
    compute_connection_graph,
    compute_connections,
)
from apps.research.embeddings import build_content_text, find_similar_to
from apps.research.models import Source, SourceLink
from apps.research.services import detect_content_type

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Content connections
# ---------------------------------------------------------------------------


@api_view(['GET'])
def content_connections(request, slug):
    """
    GET /api/v1/connections/<slug>/

    Compute and return weighted connections for a piece of content.

    Uses four signals:
    - shared_sources: other content citing the same research sources
    - shared_tags: overlap in source tags
    - shared_threads: co-membership in research threads
    - semantic: embedding-based similarity of source annotations

    Query parameters:
        ?semantic=false    Disable semantic similarity (faster)
        ?top=10            Max results (default 20)

    Example response:
    {
        "slug": "housing-crisis",
        "content_type": "essay",
        "connections": [
            {
                "content_type": "field_note",
                "content_slug": "zoning-observation",
                "content_title": "Zoning Board Meeting Notes",
                "score": 0.73,
                "signals": {
                    "shared_sources": {"score": 0.8, "detail": "shares 3 sources"},
                    "shared_tags": {"score": 0.5, "detail": "shares tags: housing, zoning"},
                    "shared_threads": null,
                    "semantic": {"score": 0.72, "detail": "semantic similarity: 0.72"}
                },
                "explanation": "shares 3 sources; shares tags: housing, zoning; ..."
            }
        ]
    }
    """
    content_type = detect_content_type(slug)

    include_semantic = request.query_params.get('semantic', 'true').lower() != 'false'

    try:
        top_n = int(request.query_params.get('top', 20))
        top_n = min(max(top_n, 1), 50)
    except (ValueError, TypeError):
        top_n = 20

    connections = compute_connections(
        content_slug=slug,
        content_type=content_type,
        include_semantic=include_semantic,
        top_n=top_n,
    )

    return Response({
        'slug': slug,
        'contentType': content_type,
        'connections': connections,
    })


@api_view(['GET'])
def connection_graph(request):
    """
    GET /api/v1/connections/graph/

    Full content-to-content connection graph for D3.js visualization.

    Unlike /api/v1/graph/ (which shows source-to-content relationships),
    this endpoint shows how content pieces relate to EACH OTHER based
    on shared sources, tags, threads, and semantic similarity.

    Query parameters:
        ?semantic=false     Disable semantic similarity (much faster)
        ?min_score=0.15     Minimum connection score to include

    The response is D3-force-layout ready:
    {
        "nodes": [
            {"id": "essay:housing-crisis", "type": "essay", "slug": "...", "label": "..."}
        ],
        "edges": [
            {
                "source": "essay:housing-crisis",
                "target": "field_note:zoning-observation",
                "weight": 0.73,
                "explanation": "shares 3 sources; shares tags: housing",
                "signals": {...}
            }
        ]
    }
    """
    include_semantic = request.query_params.get('semantic', 'false').lower() == 'true'

    try:
        min_score = float(request.query_params.get('min_score', 0.15))
    except (ValueError, TypeError):
        min_score = 0.15

    graph = compute_connection_graph(
        include_semantic=include_semantic,
        min_score=min_score,
    )

    return Response(graph)


# ---------------------------------------------------------------------------
# Semantic similarity
# ---------------------------------------------------------------------------


@api_view(['GET'])
def similar_content(request, slug):
    """
    GET /api/v1/similar/<slug>/

    Find content that is semantically similar to the given content.

    This endpoint uses ONLY the semantic signal (embedding-based
    cosine similarity). For a multi-signal view, use /connections/.

    The difference:
    - /connections/<slug>/ combines 4 signals and tells you HOW
      content is connected (shared sources, tags, threads, meaning)
    - /similar/<slug>/ uses ONLY meaning and tells you what content
      TALKS ABOUT the same topics, regardless of shared sources

    This is useful for discovering unexpected connections: content that
    covers similar ground but was never explicitly linked.

    Query parameters:
        ?top=10             Max results (default 10)
        ?threshold=0.5      Minimum similarity score (default 0.5)
    """
    content_type = detect_content_type(slug)

    try:
        top_n = int(request.query_params.get('top', 10))
        top_n = min(max(top_n, 1), 50)
    except (ValueError, TypeError):
        top_n = 10

    try:
        threshold = float(request.query_params.get('threshold', 0.5))
    except (ValueError, TypeError):
        threshold = 0.5

    # Build text for the target content from its sources
    my_links = (
        SourceLink.objects.filter(
            content_type=content_type,
            content_slug=slug,
        )
        .select_related('source')
    )

    if not my_links.exists():
        return Response({
            'slug': slug,
            'contentType': content_type,
            'similar': [],
            'note': 'No sources linked to this content.',
        })

    target_parts = []
    for link in my_links:
        src = link.source
        target_parts.append(build_content_text(
            title=src.title,
            annotation=src.public_annotation,
            tags=src.tags,
            creator=src.creator,
        ))
    target_text = ' '.join(target_parts)

    # Build candidates from all other content
    all_links = (
        SourceLink.objects
        .exclude(content_type=content_type, content_slug=slug)
        .select_related('source')
    )

    # Group by content piece
    from collections import defaultdict
    content_texts = defaultdict(list)
    content_info = {}
    for link in all_links:
        key = f"{link.content_type}:{link.content_slug}"
        content_texts[key].append(build_content_text(
            title=link.source.title,
            annotation=link.source.public_annotation,
            tags=link.source.tags,
            creator=link.source.creator,
        ))
        content_info[key] = {
            'content_type': link.content_type,
            'content_slug': link.content_slug,
            'content_title': link.content_title,
        }

    candidates = [
        {
            'id': key,
            'text': ' '.join(texts),
            **content_info[key],
        }
        for key, texts in content_texts.items()
    ]

    try:
        similar = find_similar_to(
            target_text=target_text,
            candidates=candidates,
            top_n=top_n,
            threshold=threshold,
        )
    except Exception as e:
        logger.error('Semantic similarity failed: %s', e)
        return Response({
            'slug': slug,
            'contentType': content_type,
            'similar': [],
            'error': 'Semantic similarity computation failed. '
                     'Ensure en_core_web_md is installed.',
        })

    return Response({
        'slug': slug,
        'contentType': content_type,
        'similar': similar,
    })


@api_view(['GET'])
def similar_sources(request):
    """
    GET /api/v1/similar/sources/?source=<slug>

    Find sources that are semantically similar to a given source.

    While /similar/<slug>/ compares content pieces (essays, field notes),
    this endpoint compares individual sources. Useful for discovering
    sources that discuss related topics.

    Query parameters:
        ?source=<slug>      Source slug to find similar sources for (required)
        ?top=10             Max results (default 10)
        ?threshold=0.5      Minimum similarity score
    """
    source_slug = request.query_params.get('source', '')
    if not source_slug:
        return Response(
            {'error': 'source query parameter is required'},
            status=400,
        )

    try:
        target_source = Source.objects.public().get(slug=source_slug)
    except Source.DoesNotExist:
        return Response({'error': 'Source not found'}, status=404)

    try:
        top_n = int(request.query_params.get('top', 10))
    except (ValueError, TypeError):
        top_n = 10

    try:
        threshold = float(request.query_params.get('threshold', 0.5))
    except (ValueError, TypeError):
        threshold = 0.5

    target_text = build_content_text(
        title=target_source.title,
        annotation=target_source.public_annotation,
        tags=target_source.tags,
        creator=target_source.creator,
    )

    # Build candidates from all other public sources
    other_sources = Source.objects.public().exclude(pk=target_source.pk)
    candidates = [
        {
            'id': f'source:{src.slug}',
            'text': build_content_text(
                title=src.title,
                annotation=src.public_annotation,
                tags=src.tags,
                creator=src.creator,
            ),
            'slug': src.slug,
            'title': src.title,
            'sourceType': src.source_type,
            'creator': src.creator,
        }
        for src in other_sources
    ]

    try:
        similar = find_similar_to(
            target_text=target_text,
            candidates=candidates,
            top_n=top_n,
            threshold=threshold,
        )
    except Exception as e:
        logger.error('Source similarity failed: %s', e)
        return Response({
            'source': source_slug,
            'similar': [],
            'error': 'Similarity computation failed.',
        })

    return Response({
        'source': source_slug,
        'sourceTitle': target_source.title,
        'similar': similar,
    })

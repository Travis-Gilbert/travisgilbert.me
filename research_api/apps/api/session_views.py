"""
Research session endpoints: saved subgraph snapshots.

POST   /api/v1/sessions/              Create session with nodes
GET    /api/v1/sessions/              List sessions (key-scoped)
GET    /api/v1/sessions/<slug>/       Detail with nodes and computed edges
PATCH  /api/v1/sessions/<slug>/       Update session metadata or nodes
DELETE /api/v1/sessions/<slug>/       Delete session

All endpoints require can_sessions flag on the API key.
"""

from collections import defaultdict

from django.utils.text import slugify
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.api.models import ResearchSession, SessionNode
from apps.research.models import SourceLink


def _require_sessions(request):
    """Return (api_key, error_response). error_response is None on success."""
    api_key = getattr(request, 'api_key', None)
    if not api_key or not api_key.can_sessions:
        return None, Response(
            {'error': 'Sessions require an API key with can_sessions permission.'},
            status=403,
        )
    return api_key, None


def _node_dict(node):
    """Serialize a SessionNode to a dict."""
    return {
        'node_type': node.node_type,
        'node_slug': node.node_slug,
        'notes': node.notes,
        'position_x': node.position_x,
        'position_y': node.position_y,
        'added_at': node.added_at.isoformat() if node.added_at else None,
    }


def _session_summary(session):
    """Compact serialization for list view."""
    return {
        'slug': session.slug,
        'title': session.title,
        'description': session.description,
        'is_active': session.is_active,
        'tags': session.tags,
        'node_count': session.nodes.count(),
        'created_at': session.created_at.isoformat(),
        'updated_at': session.updated_at.isoformat(),
    }


def _compute_session_edges(nodes):
    """
    Compute edges between session nodes using SourceLink relationships.

    Two nodes share an edge if they are both linked to the same source
    (for content nodes) or if a source node is directly linked to a
    content node.
    """
    edges = []

    source_slugs = [n.node_slug for n in nodes if n.node_type == 'source']
    content_nodes = [n for n in nodes if n.node_type != 'source']

    # Build a map: content_slug -> set of source slugs linked to it
    content_slugs = [(n.node_type, n.node_slug) for n in content_nodes]
    if not content_slugs:
        return edges

    # Get all source links for content in this session
    links = SourceLink.objects.filter(
        content_slug__in=[cs for _, cs in content_slugs],
    ).select_related('source')

    # Map content_slug -> set of source slugs
    content_sources = defaultdict(set)
    for link in links:
        content_sources[link.content_slug].add(link.source.slug)

    # Edge type 1: source node <-> content node (direct link)
    for s_slug in source_slugs:
        for c_type, c_slug in content_slugs:
            if s_slug in content_sources.get(c_slug, set()):
                edges.append({
                    'source': f'source:{s_slug}',
                    'target': f'{c_type}:{c_slug}',
                    'relationship': 'cited_by',
                })

    # Edge type 2: content <-> content (shared sources)
    for i, (t1, s1) in enumerate(content_slugs):
        for t2, s2 in content_slugs[i + 1:]:
            shared = content_sources.get(s1, set()) & content_sources.get(s2, set())
            if shared:
                edges.append({
                    'source': f'{t1}:{s1}',
                    'target': f'{t2}:{s2}',
                    'relationship': 'shared_sources',
                    'shared_count': len(shared),
                })

    return edges


@api_view(['GET', 'POST'])
def session_list(request):
    """List or create research sessions."""
    api_key, err = _require_sessions(request)
    if err:
        return err

    if request.method == 'GET':
        sessions = ResearchSession.objects.filter(api_key=api_key)

        active_param = request.query_params.get('active', '').strip().lower()
        if active_param == 'true':
            sessions = sessions.filter(is_active=True)
        elif active_param == 'false':
            sessions = sessions.filter(is_active=False)

        return Response({
            'sessions': [_session_summary(s) for s in sessions],
        })

    # POST: create
    title = (request.data.get('title') or '').strip()
    if not title:
        return Response({'error': 'title is required.'}, status=400)

    slug = slugify(request.data.get('slug', '') or title)[:300]
    if ResearchSession.objects.filter(api_key=api_key, slug=slug).exists():
        return Response(
            {'error': f'Session with slug "{slug}" already exists.'},
            status=409,
        )

    session = ResearchSession.objects.create(
        api_key=api_key,
        title=title,
        slug=slug,
        description=(request.data.get('description') or '').strip(),
        tags=request.data.get('tags', []),
    )

    # Create initial nodes if provided
    nodes_data = request.data.get('nodes', [])
    for nd in nodes_data:
        node_type = (nd.get('node_type') or '').strip()
        node_slug = (nd.get('node_slug') or '').strip()
        if node_type and node_slug:
            SessionNode.objects.create(
                session=session,
                node_type=node_type,
                node_slug=node_slug,
                notes=(nd.get('notes') or '').strip(),
                position_x=nd.get('position_x'),
                position_y=nd.get('position_y'),
            )

    return Response({
        'slug': session.slug,
        'title': session.title,
        'node_count': session.nodes.count(),
        'created_at': session.created_at.isoformat(),
    }, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
def session_detail(request, slug):
    """Retrieve, update, or delete a research session."""
    api_key, err = _require_sessions(request)
    if err:
        return err

    try:
        session = ResearchSession.objects.get(api_key=api_key, slug=slug)
    except ResearchSession.DoesNotExist:
        return Response({'error': 'Session not found.'}, status=404)

    if request.method == 'DELETE':
        session.delete()
        return Response(status=204)

    if request.method == 'PATCH':
        if 'title' in request.data:
            session.title = request.data['title']
        if 'description' in request.data:
            session.description = request.data['description']
        if 'is_active' in request.data:
            session.is_active = request.data['is_active']
        if 'tags' in request.data:
            session.tags = request.data['tags']
        session.save()

        # Add nodes
        add_nodes = request.data.get('add_nodes', [])
        for nd in add_nodes:
            node_type = (nd.get('node_type') or '').strip()
            node_slug = (nd.get('node_slug') or '').strip()
            if node_type and node_slug:
                SessionNode.objects.get_or_create(
                    session=session,
                    node_type=node_type,
                    node_slug=node_slug,
                    defaults={
                        'notes': (nd.get('notes') or '').strip(),
                        'position_x': nd.get('position_x'),
                        'position_y': nd.get('position_y'),
                    },
                )

        # Remove nodes
        remove_nodes = request.data.get('remove_nodes', [])
        for nd in remove_nodes:
            node_type = (nd.get('node_type') or '').strip()
            node_slug = (nd.get('node_slug') or '').strip()
            if node_type and node_slug:
                SessionNode.objects.filter(
                    session=session,
                    node_type=node_type,
                    node_slug=node_slug,
                ).delete()

    # GET or PATCH response: full detail with nodes and edges
    nodes = list(session.nodes.all().order_by('added_at'))
    edges = _compute_session_edges(nodes)

    return Response({
        'slug': session.slug,
        'title': session.title,
        'description': session.description,
        'is_active': session.is_active,
        'tags': session.tags,
        'created_at': session.created_at.isoformat(),
        'updated_at': session.updated_at.isoformat(),
        'nodes': [_node_dict(n) for n in nodes],
        'edges': edges,
    })

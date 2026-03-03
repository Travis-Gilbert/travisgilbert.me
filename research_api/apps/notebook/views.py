"""
DRF views for the Notebook knowledge graph API.

Endpoints:
    KnowledgeNode CRUD   /nodes/, /nodes/<slug>/
    QuickCapture         /capture/
    Edges                /edges/
    Resurface            /resurface/
    Calendar (DailyLog)  /calendar/
    Stats                /stats/
    Graph (D3)           /graph/
    Node Types           /types/
    Notebooks            /notebooks/, /notebooks/<slug>/
"""

import random
from datetime import timedelta

from django.db.models import Count, F, Prefetch, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .engine import run_engine
from .models import (
    DailyLog,
    Edge,
    KnowledgeNode,
    NodeType,
    Notebook,
)
from .serializers import (
    DailyLogSerializer,
    EdgeSerializer,
    KnowledgeNodeDetailSerializer,
    KnowledgeNodeListSerializer,
    KnowledgeNodeWriteSerializer,
    NodeTypeSerializer,
    NotebookDetailSerializer,
    NotebookListSerializer,
    QuickCaptureSerializer,
)


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class NotebookPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


# ---------------------------------------------------------------------------
# Node Types (read-only)
# ---------------------------------------------------------------------------

class NodeTypeListView(generics.ListAPIView):
    """GET /types/  All available node types."""
    queryset = NodeType.objects.all()
    serializer_class = NodeTypeSerializer
    pagination_class = None  # Small static list, no pagination


# ---------------------------------------------------------------------------
# KnowledgeNode CRUD
# ---------------------------------------------------------------------------

def _node_base_queryset():
    """Shared queryset with select_related and annotation."""
    return (
        KnowledgeNode.objects
        .select_related('node_type')
        .annotate(
            edge_count=Count('edges_out', distinct=True)
            + Count('edges_in', distinct=True),
        )
    )


class KnowledgeNodeListView(generics.ListAPIView):
    """GET /nodes/  List nodes with filters.

    Query params:
        ?type=<slug>       Filter by node type slug
        ?status=<status>   Filter by status (inbox, active, archive)
        ?q=<text>          Full text search on search_text
        ?notebook=<slug>   Filter by notebook slug (JSON field match)
        ?pinned=true       Only pinned nodes
        ?starred=true      Only starred nodes
    """
    serializer_class = KnowledgeNodeListSerializer
    pagination_class = NotebookPagination

    def get_queryset(self):
        qs = _node_base_queryset()
        params = self.request.query_params

        type_slug = params.get('type')
        if type_slug:
            qs = qs.filter(node_type__slug=type_slug)

        node_status = params.get('status')
        if node_status in ('inbox', 'active', 'archive'):
            qs = qs.filter(status=node_status)

        query = params.get('q')
        if query:
            qs = qs.filter(search_text__icontains=query)

        notebook_slug = params.get('notebook')
        if notebook_slug:
            qs = qs.filter(notebooks__contains=[notebook_slug])

        if params.get('pinned') == 'true':
            qs = qs.filter(is_pinned=True)

        if params.get('starred') == 'true':
            qs = qs.filter(is_starred=True)

        return qs.order_by('-is_pinned', '-captured_at')


class KnowledgeNodeDetailView(generics.RetrieveAPIView):
    """GET /nodes/<slug>/  Full node detail with edges and entities."""
    serializer_class = KnowledgeNodeDetailSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        return _node_base_queryset()


class KnowledgeNodeCreateView(generics.CreateAPIView):
    """POST /nodes/  Create a new node.

    Runs the connection engine after creation to discover
    relationships with existing nodes.
    """
    serializer_class = KnowledgeNodeWriteSerializer

    def perform_create(self, serializer):
        node = serializer.save()
        # Run connection engine asynchronously in the future;
        # for now, synchronous is fine for single-node creation
        self._engine_results = run_engine(node)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        # Return the full detail view of the created node
        node = serializer.instance
        detail = KnowledgeNodeDetailSerializer(
            _node_base_queryset().get(pk=node.pk)
        )
        response_data = detail.data
        response_data['engine_results'] = getattr(
            self, '_engine_results', {},
        )
        return Response(response_data, status=status.HTTP_201_CREATED)


class KnowledgeNodeUpdateView(generics.UpdateAPIView):
    """PATCH /nodes/<slug>/  Update an existing node.

    Re-runs the connection engine after update to discover
    any new relationships from changed content.
    """
    serializer_class = KnowledgeNodeWriteSerializer
    lookup_field = 'slug'
    queryset = KnowledgeNode.objects.all()

    def perform_update(self, serializer):
        node = serializer.save()
        self._engine_results = run_engine(node)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)  # Default to PATCH behavior
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        node = serializer.instance
        detail = KnowledgeNodeDetailSerializer(
            _node_base_queryset().get(pk=node.pk)
        )
        response_data = detail.data
        response_data['engine_results'] = getattr(
            self, '_engine_results', {},
        )
        return Response(response_data)


# ---------------------------------------------------------------------------
# QuickCapture
# ---------------------------------------------------------------------------

@api_view(['POST'])
def quick_capture(request):
    """POST /capture/  Minimal capture: URL or body, nothing else required.

    Accepts:
        url:       Optional URL (OG metadata is NOT auto-fetched here;
                   that is a future enhancement)
        body:      Optional text body
        title:     Optional title
        node_type: Optional node type slug (defaults to 'note')

    Returns the created node with engine results.
    """
    serializer = QuickCaptureSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    # Default to 'note' type if not specified
    node_type = data.get('node_type')
    if not node_type:
        node_type = NodeType.objects.filter(slug='note').first()

    node = KnowledgeNode.objects.create(
        title=data.get('title', ''),
        body=data.get('body', ''),
        url=data.get('url', ''),
        node_type=node_type,
        status='inbox',
        capture_method='api',
    )

    engine_results = run_engine(node)

    detail = KnowledgeNodeDetailSerializer(
        _node_base_queryset().get(pk=node.pk)
    )
    response_data = detail.data
    response_data['engine_results'] = engine_results
    return Response(response_data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Edges
# ---------------------------------------------------------------------------

class EdgeListView(generics.ListAPIView):
    """GET /edges/  List edges with filters.

    Query params:
        ?node=<id>         Edges connected to this node (either direction)
        ?type=<edge_type>  Filter by edge type
        ?auto=true|false   Filter by auto-created status
        ?min_strength=0.5  Minimum strength threshold
    """
    serializer_class = EdgeSerializer
    pagination_class = NotebookPagination

    def get_queryset(self):
        qs = (
            Edge.objects
            .select_related(
                'from_node', 'from_node__node_type',
                'to_node', 'to_node__node_type',
            )
        )
        params = self.request.query_params

        node_id = params.get('node')
        if node_id:
            qs = qs.filter(Q(from_node_id=node_id) | Q(to_node_id=node_id))

        edge_type = params.get('type')
        if edge_type:
            qs = qs.filter(edge_type=edge_type)

        auto = params.get('auto')
        if auto == 'true':
            qs = qs.filter(is_auto=True)
        elif auto == 'false':
            qs = qs.filter(is_auto=False)

        min_strength = params.get('min_strength')
        if min_strength:
            try:
                qs = qs.filter(strength__gte=float(min_strength))
            except (ValueError, TypeError):
                pass

        return qs.order_by('-strength', '-created_at')


# ---------------------------------------------------------------------------
# Resurface
# ---------------------------------------------------------------------------

@api_view(['GET'])
def resurface(request):
    """GET /resurface/  Serendipity endpoint: surface forgotten nodes.

    Returns a small set of nodes weighted toward:
    1. Nodes with many connections (rich context)
    2. Older nodes (forgotten knowledge)
    3. Starred nodes (user-flagged importance)

    Query params:
        ?count=5  Number of nodes to return (default 5, max 20)
    """
    count = min(int(request.query_params.get('count', 5)), 20)

    # Candidates: active or inbox nodes (not archived)
    candidates = list(
        _node_base_queryset()
        .exclude(status='archive')
        .order_by('?')  # Initial random shuffle
        [:100]  # Cap candidates for performance
    )

    if not candidates:
        return Response([])

    # Weight each candidate
    now = timezone.now()
    weighted = []
    for node in candidates:
        weight = 1.0

        # Boost for connections (more connected = more interesting)
        edge_count = getattr(node, 'edge_count', 0)
        weight += min(edge_count * 0.3, 3.0)

        # Boost for age (older = more forgotten, more serendipitous)
        age_days = (now - node.captured_at).days
        if age_days > 30:
            weight += min(age_days / 60, 2.0)

        # Boost for starred
        if node.is_starred:
            weight += 1.5

        # Boost for pinned
        if node.is_pinned:
            weight += 0.5

        weighted.append((node, weight))

    # Weighted random selection without replacement
    selected = []
    remaining = weighted[:]
    for _ in range(min(count, len(remaining))):
        total = sum(w for _, w in remaining)
        if total <= 0:
            break
        r = random.uniform(0, total)
        cumulative = 0
        for i, (node, w) in enumerate(remaining):
            cumulative += w
            if cumulative >= r:
                selected.append(node)
                remaining.pop(i)
                break

    serializer = KnowledgeNodeListSerializer(selected, many=True)
    return Response(serializer.data)


# ---------------------------------------------------------------------------
# Calendar (DailyLog)
# ---------------------------------------------------------------------------

@api_view(['GET'])
def notebook_calendar(request):
    """GET /calendar/  DailyLog entries for date range.

    Query params:
        ?from=2026-01-01   Start date (default: 30 days ago)
        ?to=2026-02-01     End date (default: today)
    """
    today = timezone.now().date()
    date_from = request.query_params.get('from')
    date_to = request.query_params.get('to')

    try:
        from datetime import date as dt_date
        start = (
            dt_date.fromisoformat(date_from)
            if date_from
            else today - timedelta(days=30)
        )
        end = dt_date.fromisoformat(date_to) if date_to else today
    except ValueError:
        return Response(
            {'error': 'Invalid date format. Use YYYY-MM-DD.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    logs = DailyLog.objects.filter(date__gte=start, date__lte=end)
    serializer = DailyLogSerializer(logs, many=True)
    return Response(serializer.data)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@api_view(['GET'])
def notebook_stats(request):
    """GET /stats/  Aggregate knowledge graph statistics."""
    nodes = KnowledgeNode.objects
    edges = Edge.objects

    # Counts by node type
    type_counts = list(
        nodes
        .values(type_name=F('node_type__name'), type_slug=F('node_type__slug'))
        .annotate(count=Count('id'))
        .order_by('-count')
    )

    # Counts by status
    status_counts = dict(
        nodes.values_list('status')
        .annotate(count=Count('id'))
        .values_list('status', 'count')
    )

    # Edge stats
    edge_type_counts = dict(
        edges.values_list('edge_type')
        .annotate(count=Count('id'))
        .values_list('edge_type', 'count')
    )

    # Activity: recent captures
    week_ago = timezone.now() - timedelta(days=7)
    month_ago = timezone.now() - timedelta(days=30)

    return Response({
        'total_nodes': nodes.count(),
        'total_edges': edges.count(),
        'total_notebooks': Notebook.objects.filter(is_active=True).count(),
        'nodes_by_type': type_counts,
        'nodes_by_status': status_counts,
        'edges_by_type': edge_type_counts,
        'auto_edges': edges.filter(is_auto=True).count(),
        'manual_edges': edges.filter(is_auto=False).count(),
        'captured_this_week': nodes.filter(captured_at__gte=week_ago).count(),
        'captured_this_month': nodes.filter(captured_at__gte=month_ago).count(),
        'starred_count': nodes.filter(is_starred=True).count(),
        'pinned_count': nodes.filter(is_pinned=True).count(),
    })


# ---------------------------------------------------------------------------
# Graph (D3)
# ---------------------------------------------------------------------------

@api_view(['GET'])
def notebook_graph(request):
    """GET /graph/  Full knowledge graph for D3 force layout.

    Returns {nodes: [...], edges: [...]} formatted for D3.

    Query params:
        ?status=active     Filter nodes by status
        ?type=<slug>       Filter nodes by type
        ?notebook=<slug>   Filter nodes by notebook
        ?min_strength=0.3  Minimum edge strength to include
    """
    params = request.query_params

    # Build node queryset
    node_qs = (
        KnowledgeNode.objects
        .select_related('node_type')
        .annotate(
            edge_count=Count('edges_out', distinct=True)
            + Count('edges_in', distinct=True),
        )
    )

    node_status = params.get('status')
    if node_status:
        node_qs = node_qs.filter(status=node_status)

    type_slug = params.get('type')
    if type_slug:
        node_qs = node_qs.filter(node_type__slug=type_slug)

    notebook_slug = params.get('notebook')
    if notebook_slug:
        node_qs = node_qs.filter(notebooks__contains=[notebook_slug])

    nodes = list(node_qs)
    node_ids = {n.pk for n in nodes}

    # Build edge queryset (only edges between included nodes)
    edge_qs = (
        Edge.objects
        .filter(from_node_id__in=node_ids, to_node_id__in=node_ids)
        .select_related(
            'from_node', 'from_node__node_type',
            'to_node', 'to_node__node_type',
        )
    )

    min_strength = params.get('min_strength')
    if min_strength:
        try:
            edge_qs = edge_qs.filter(strength__gte=float(min_strength))
        except (ValueError, TypeError):
            pass

    edges = list(edge_qs)

    # Format for D3
    graph_nodes = [
        {
            'id': str(n.pk),
            'title': n.display_title,
            'slug': n.slug,
            'type': n.node_type.slug if n.node_type else 'unknown',
            'typeName': n.node_type.name if n.node_type else 'Unknown',
            'color': n.node_type.color if n.node_type else '#3A3632',
            'icon': n.node_type.icon if n.node_type else 'note-pencil',
            'status': n.status,
            'isPinned': n.is_pinned,
            'isStarred': n.is_starred,
            'edgeCount': getattr(n, 'edge_count', 0),
        }
        for n in nodes
    ]

    graph_edges = [
        {
            'id': str(e.pk),
            'source': str(e.from_node_id),
            'target': str(e.to_node_id),
            'type': e.edge_type,
            'reason': e.reason,
            'strength': e.strength,
            'isAuto': e.is_auto,
        }
        for e in edges
    ]

    return Response({
        'nodes': graph_nodes,
        'edges': graph_edges,
        'meta': {
            'nodeCount': len(graph_nodes),
            'edgeCount': len(graph_edges),
        },
    })


# ---------------------------------------------------------------------------
# Notebooks
# ---------------------------------------------------------------------------

class NotebookListView(generics.ListAPIView):
    """GET /notebooks/  List all notebooks."""
    serializer_class = NotebookListSerializer
    pagination_class = None  # Notebooks are few, no pagination needed

    def get_queryset(self):
        return (
            Notebook.objects
            .filter(is_active=True)
            .annotate(node_count=Count('nodes'))
            .order_by('sort_order', 'name')
        )


class NotebookDetailView(generics.RetrieveAPIView):
    """GET /notebooks/<slug>/  Notebook with all its nodes."""
    serializer_class = NotebookDetailSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        return (
            Notebook.objects
            .annotate(node_count=Count('nodes'))
            .prefetch_related(
                Prefetch(
                    'nodes',
                    queryset=_node_base_queryset()
                    .order_by('-is_pinned', '-captured_at'),
                ),
            )
        )

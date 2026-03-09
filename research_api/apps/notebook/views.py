"""
DRF ViewSets and custom endpoints for the CommonPlace knowledge graph API.

ViewSet hierarchy:
  Read-only: ObjectType, ComponentType, Timeline, DailyLog
  Full CRUD: Object, Component, Edge, Notebook, Project, Layout
  Immutable + action: Node (list/retrieve + add_retrospective)

Custom endpoints:
  POST /capture/            QuickCapture (Task 17)
  GET  /feed/               Timeline feed (Task 19)
  GET  /graph/              Graph data for D3 (Task 20)
  GET  /resurface/          Serendipitous resurface (Task 21)
  GET  /export/object/<slug>/    Markdown export (Task 22)
  GET  /export/notebook/<slug>/  JSON archive export (Task 22)
"""

from collections import OrderedDict
from datetime import timedelta

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    Component,
    ComponentType,
    DailyLog,
    Edge,
    Layout,
    Node,
    Notebook,
    Object,
    ObjectType,
    Project,
    Timeline,
)
from .serializers import (
    ComponentSerializer,
    ComponentTypeSerializer,
    ComponentWriteSerializer,
    DailyLogSerializer,
    EdgeSerializer,
    LayoutSerializer,
    NodeDetailSerializer,
    NodeListSerializer,
    NotebookDetailSerializer,
    NotebookListSerializer,
    NotebookWriteSerializer,
    ObjectDetailSerializer,
    ObjectListSerializer,
    ObjectTypeSerializer,
    ObjectWriteSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectWriteSerializer,
    RetrospectiveNoteSerializer,
    TimelineSerializer,
)


# ---------------------------------------------------------------------------
# Node icon mapping (Phase 6)
# ---------------------------------------------------------------------------

NODE_ICONS = {
    'creation': 'plus',
    'deletion': 'trash',
    'modification': 'edit',
    'connection': 'link',
    'project_created': 'folder',
    'project_completed': 'check-circle',
    'reminder_set': 'bell',
    'reminder_fired': 'bell-ring',
    'reminder_dismissed': 'bell-off',
    'recurring_date': 'repeat',
    'capture': 'download',
    'retrospective': 'message-circle',
    'status_change': 'toggle-right',
    'component_trigger': 'zap',
}


# ---------------------------------------------------------------------------
# ObjectType (read-only catalog)
# ---------------------------------------------------------------------------

class ObjectTypeViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Built-in Object types. Read-only."""
    queryset = ObjectType.objects.order_by('sort_order')
    serializer_class = ObjectTypeSerializer
    lookup_field = 'slug'


# ---------------------------------------------------------------------------
# ComponentType (read-only catalog)
# ---------------------------------------------------------------------------

class ComponentTypeViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Built-in Component types. Read-only."""
    queryset = ComponentType.objects.order_by('sort_order')
    serializer_class = ComponentTypeSerializer
    lookup_field = 'slug'


# ---------------------------------------------------------------------------
# Object (full CRUD)
# ---------------------------------------------------------------------------

class ObjectViewSet(viewsets.ModelViewSet):
    """
    Objects are the core entities of the knowledge graph.

    list:   Compact cards with type info, edge/component counts.
    detail: Full record with nested components, edges, entities, nodes.
    create/update: Mutable fields only (title, body, status, etc.).

    Lookup accepts both slug strings and numeric PKs so the frontend
    can navigate by either identifier (e.g. /objects/42/ or /objects/my-slug/).
    """
    lookup_field = 'slug'

    def get_object(self):
        """Resolve by PK when the lookup value is numeric, otherwise by slug."""
        queryset = self.filter_queryset(self.get_queryset())
        lookup_value = self.kwargs.get(self.lookup_field, '')

        if lookup_value.isdigit():
            obj = get_object_or_404(queryset, pk=int(lookup_value))
        else:
            obj = get_object_or_404(queryset, slug=lookup_value)

        self.check_object_permissions(self.request, obj)
        return obj

    def get_serializer_class(self):
        if self.action == 'list':
            return ObjectListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return ObjectWriteSerializer
        return ObjectDetailSerializer

    def get_queryset(self):
        qs = Object.objects.select_related('object_type', 'notebook', 'project')

        # Soft-delete filter: exclude deleted Objects unless admin override
        include_deleted = self.request.query_params.get('include_deleted') == 'true'
        if not include_deleted:
            qs = qs.filter(is_deleted=False)

        if self.action == 'list':
            qs = qs.annotate(
                edge_count=Count('edges_out', distinct=True) + Count('edges_in', distinct=True),
                component_count=Count('components', distinct=True),
            )

        # Filters
        notebook_slug = self.request.query_params.get('notebook')
        if notebook_slug:
            qs = qs.filter(notebook__slug=notebook_slug)

        project_slug = self.request.query_params.get('project')
        if project_slug:
            qs = qs.filter(project__slug=project_slug)

        object_type = self.request.query_params.get('type')
        if object_type:
            qs = qs.filter(object_type__slug=object_type)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        pinned = self.request.query_params.get('pinned')
        if pinned == 'true':
            qs = qs.filter(is_pinned=True)

        starred = self.request.query_params.get('starred')
        if starred == 'true':
            qs = qs.filter(is_starred=True)

        search = self.request.query_params.get('q')
        if search:
            qs = qs.filter(search_text__icontains=search)

        return qs.order_by('-is_pinned', '-captured_at')

    def perform_update(self, serializer):
        """Save the Object and create an explicit modification Node."""
        from .models import Node
        from .signals import _get_master_timeline

        old_obj = self.get_object()
        instance = serializer.save()

        # Determine which fields actually changed
        changed = []
        for field in ('title', 'body', 'status', 'is_pinned', 'is_starred'):
            if getattr(old_obj, field) != getattr(instance, field):
                changed.append(field)

        if changed:
            timeline = _get_master_timeline()
            Node.objects.create(
                node_type='modification',
                title=f'Updated: {instance.display_title[:80]}',
                body=f'Changed fields: {", ".join(changed)}',
                object_ref=instance,
                timeline=timeline,
            )

    @action(detail=True, methods=['post'], url_path='delete')
    def soft_delete(self, request, slug=None):
        """Soft-delete an Object: sets is_deleted=True and creates a deletion Node."""
        from .models import Node
        from .signals import _get_master_timeline

        obj = self.get_object()
        obj.is_deleted = True
        obj.save(update_fields=['is_deleted', 'updated_at'])

        timeline = _get_master_timeline()
        Node.objects.create(
            node_type='deletion',
            title=f'Deleted: {obj.display_title[:80]}',
            body=f'Object "{obj.title}" (type: {getattr(obj.object_type, "name", "unknown")}) was soft-deleted.',
            object_ref=obj,
            timeline=timeline,
        )

        return Response({'detail': 'Object soft-deleted.'}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Component (CRUD, usually nested under Object)
# ---------------------------------------------------------------------------

class ComponentViewSet(viewsets.ModelViewSet):
    """
    Components are typed properties on Objects.

    Filter by ?object=<id> to list components for a specific Object.
    """

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ComponentWriteSerializer
        return ComponentSerializer

    def get_queryset(self):
        qs = Component.objects.select_related('component_type', 'object')

        object_id = self.request.query_params.get('object')
        if object_id:
            qs = qs.filter(object_id=object_id)

        return qs.order_by('sort_order')


# ---------------------------------------------------------------------------
# Node (immutable timeline events)
# ---------------------------------------------------------------------------

class NodeViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Nodes are immutable timeline events.

    list:     Compact event feed.
    retrieve: Full event details.
    add_retrospective: Append a retrospective note (only mutable field).
    """

    def get_serializer_class(self):
        if self.action == 'list':
            return NodeListSerializer
        return NodeDetailSerializer

    def get_queryset(self):
        qs = Node.objects.select_related(
            'object_ref', 'object_ref__object_type', 'timeline',
            'project_ref',
        )

        node_type = self.request.query_params.get('type')
        if node_type:
            qs = qs.filter(node_type=node_type)

        timeline_slug = self.request.query_params.get('timeline')
        if timeline_slug:
            qs = qs.filter(timeline__slug=timeline_slug)

        object_id = self.request.query_params.get('object')
        if object_id:
            qs = qs.filter(object_ref_id=object_id)

        return qs.order_by('-occurred_at')

    @action(detail=True, methods=['post'], url_path='retrospective')
    def add_retrospective(self, request, pk=None):
        """Append a retrospective note to a Node."""
        node = self.get_object()
        serializer = RetrospectiveNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from django.utils import timezone
        from .models import _generate_sha

        note = {
            'text': serializer.validated_data['text'],
            'sha': _generate_sha(serializer.validated_data['text']),
            'created_at': timezone.now().isoformat(),
        }

        notes = node.retrospective_notes or []
        notes.append(note)

        # Bypass Node immutability by updating this specific field
        Node.objects.filter(pk=node.pk).update(retrospective_notes=notes)
        node.refresh_from_db()

        return Response(
            NodeDetailSerializer(node).data,
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Edge (create, list, destroy)
# ---------------------------------------------------------------------------

class EdgeViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Edges connect two Objects.

    list:    All edges with denormalized Object info.
    create:  Manual edge creation.
    destroy: Remove an edge.

    Filter by ?object=<id> for all edges involving an Object.
    """
    serializer_class = EdgeSerializer

    def get_queryset(self):
        qs = Edge.objects.select_related(
            'from_object', 'from_object__object_type',
            'to_object', 'to_object__object_type',
        )

        object_id = self.request.query_params.get('object')
        if object_id:
            from django.db.models import Q
            qs = qs.filter(Q(from_object_id=object_id) | Q(to_object_id=object_id))

        edge_type = self.request.query_params.get('type')
        if edge_type:
            qs = qs.filter(edge_type=edge_type)

        engine = self.request.query_params.get('engine')
        if engine:
            qs = qs.filter(engine=engine)

        return qs.order_by('-created_at')


# ---------------------------------------------------------------------------
# Notebook
# ---------------------------------------------------------------------------

class NotebookViewSet(viewsets.ModelViewSet):
    """
    Notebooks organize Objects into research contexts.

    list:    Compact with object count.
    detail:  Full config + nested objects.
    """
    lookup_field = 'slug'

    def get_serializer_class(self):
        if self.action == 'list':
            return NotebookListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return NotebookWriteSerializer
        return NotebookDetailSerializer

    def get_queryset(self):
        qs = Notebook.objects.all()

        if self.action == 'list':
            qs = qs.annotate(
                object_count=Count('notebook_objects', distinct=True),
            )

        active_only = self.request.query_params.get('active')
        if active_only == 'true':
            qs = qs.filter(is_active=True)

        return qs.order_by('sort_order')


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

class ProjectViewSet(viewsets.ModelViewSet):
    """
    Projects scope work within a Notebook.

    list:    Compact with notebook name.
    detail:  Full with nested objects.
    """
    lookup_field = 'slug'

    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return ProjectWriteSerializer
        return ProjectDetailSerializer

    def get_queryset(self):
        qs = Project.objects.select_related('notebook')

        notebook_slug = self.request.query_params.get('notebook')
        if notebook_slug:
            qs = qs.filter(notebook__slug=notebook_slug)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        mode = self.request.query_params.get('mode')
        if mode:
            qs = qs.filter(mode=mode)

        return qs.order_by('-pk')

    @action(detail=True, methods=['post'], url_path='fork')
    def fork(self, request, slug=None):
        """Deep-copy a project and all its objects.

        Records parent_sha for lineage tracking and creates
        a PROJECT_CREATED Node on the master Timeline.
        """
        source = self.get_object()
        new_name = request.data.get('name', f'{source.name} (fork)')

        forked = Project.objects.create(
            name=new_name,
            notebook=source.notebook,
            description=source.description,
            status='active',
            parent_sha=source.sha_hash,
            mode=source.mode,
            settings_override=source.settings_override or {},
        )

        # Deep-copy all objects in the source project
        source_objects = Object.objects.filter(
            project=source, is_deleted=False,
        )
        for obj in source_objects:
            obj.pk = None
            obj.sha_hash = ''
            obj.slug = ''
            obj.project = forked
            obj.save()

        # Record the fork on the master Timeline
        timeline = Timeline.objects.filter(is_master=True).first()
        if timeline:
            Node.objects.create(
                node_type='project_created',
                title=f'Project forked: {forked.name}',
                body=f'Forked from "{source.name}" (SHA: {source.sha_hash[:12]})',
                project_ref=forked,
                timeline=timeline,
            )

        return Response(
            ProjectDetailSerializer(forked).data,
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Timeline (read-only)
# ---------------------------------------------------------------------------

class TimelineViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Timelines are read-only views into Node history."""
    serializer_class = TimelineSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        qs = Timeline.objects.all()

        if self.action == 'list':
            qs = qs.annotate(
                node_count=Count('nodes', distinct=True),
            )

        return qs.order_by('-is_master', 'name')


# ---------------------------------------------------------------------------
# Layout (full CRUD)
# ---------------------------------------------------------------------------

class LayoutViewSet(viewsets.ModelViewSet):
    """Layout presets for the frontend pane system."""
    queryset = Layout.objects.order_by('name')
    serializer_class = LayoutSerializer
    lookup_field = 'slug'


# ---------------------------------------------------------------------------
# DailyLog (read-only)
# ---------------------------------------------------------------------------

class DailyLogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Auto-generated daily activity logs. Read-only."""
    queryset = DailyLog.objects.order_by('-date')
    serializer_class = DailyLogSerializer
    lookup_field = 'date'


# ===========================================================================
# Custom endpoints (Tasks 17-22)
# ===========================================================================

# ---------------------------------------------------------------------------
# Task 17-18: QuickCapture + URL auto-parse
# ---------------------------------------------------------------------------

class CaptureInputSerializer(serializers.Serializer):
    """Input for the capture endpoint (replaces QuickCaptureSerializer).

    Accepts either text content OR a file upload (for PDF extraction).
    When a file is provided, content becomes optional.
    """
    content = serializers.CharField(
        required=False, default='', allow_blank=True,
        help_text='Text body or URL (optional when file is provided)',
    )
    hint_type = serializers.SlugField(
        required=False, default='', allow_blank=True,
        help_text='Optional object type slug hint (e.g. "hunch", "source")',
    )
    notebook_slug = serializers.SlugField(required=False, default='', allow_blank=True)
    project_slug = serializers.SlugField(required=False, default='', allow_blank=True)
    title = serializers.CharField(required=False, default='', allow_blank=True)
    file = serializers.FileField(
        required=False,
        help_text='Binary file (PDF) for server-side text extraction',
    )

    def validate(self, attrs):
        if not attrs.get('content') and not attrs.get('file'):
            raise serializers.ValidationError(
                'Either content or file must be provided.'
            )
        return attrs


# Keep legacy serializer for backward compatibility
class QuickCaptureSerializer(serializers.Serializer):
    """Legacy input format (mounted at /capture/legacy/)."""
    body = serializers.CharField(required=False, default='', allow_blank=True)
    url = serializers.URLField(required=False, default='', allow_blank=True)
    title = serializers.CharField(required=False, default='', allow_blank=True)
    object_type = serializers.SlugField(required=False, default='', allow_blank=True)
    notebook = serializers.SlugField(required=False, default='', allow_blank=True)
    project = serializers.SlugField(required=False, default='', allow_blank=True)

    def validate(self, attrs):
        if not attrs.get('body') and not attrs.get('url'):
            raise serializers.ValidationError(
                'At least one of "body" or "url" is required.'
            )
        return attrs


def _infer_type(content: str, hint_type: str) -> str:
    """Determine object type slug from content and optional hint."""
    if hint_type:
        return hint_type
    # URL detection
    content_stripped = content.strip()
    if content_stripped.startswith(('http://', 'https://', 'www.')):
        return 'source'
    return 'note'


@api_view(['POST'])
def quick_capture_view(request):
    """
    POST /api/v1/notebook/capture/

    Create an Object from raw input with type inference.
    Accepts JSON or multipart/form-data (for file uploads).

    Input: {content?, hint_type?, notebook_slug?, project_slug?, title?, file?}
    Returns: {object, inferred_type, creation_node}
    """
    serializer = CaptureInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    uploaded = data.get('file')

    if uploaded:
        # File upload path: extract text from PDF using spacy-layout/pypdf
        from .pdf_ingestion import extract_pdf_text

        pdf_bytes = uploaded.read()
        extracted = extract_pdf_text(pdf_bytes)

        body = extracted.get('body', '') or ''
        title = data['title'] or extracted.get('title', '') or uploaded.name
        inferred_type = data['hint_type'] or 'source'
        url = ''
    else:
        content = data['content']
        inferred_type = _infer_type(content, data['hint_type'])

        # Determine body vs URL based on inferred type
        is_url = inferred_type == 'source' or content.strip().startswith(('http://', 'https://'))
        body = '' if is_url else content
        url = content.strip() if is_url else ''
        title = data['title']

    from .services import quick_capture

    obj = quick_capture(
        body=body,
        url=url,
        title=title,
        object_type_slug=inferred_type,
        notebook_slug=data['notebook_slug'],
        project_slug=data['project_slug'],
    )

    # Return created Object with detail serializer
    detail = ObjectDetailSerializer(obj).data

    # Include the creation Node if one exists
    creation_node = obj.timeline_nodes.filter(node_type='creation').first()
    node_data = NodeListSerializer(creation_node).data if creation_node else None

    return Response({
        'object': detail,
        'inferred_type': inferred_type,
        'creation_node': node_data,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def quick_capture_legacy_view(request):
    """Legacy capture endpoint at /api/v1/notebook/capture/legacy/."""
    serializer = QuickCaptureSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    from .services import quick_capture

    obj = quick_capture(
        body=data['body'],
        url=data['url'],
        title=data['title'],
        object_type_slug=data['object_type'],
        notebook_slug=data['notebook'],
        project_slug=data['project'],
    )

    detail = ObjectDetailSerializer(obj).data
    creation_node = obj.timeline_nodes.filter(node_type='creation').first()
    node_data = NodeListSerializer(creation_node).data if creation_node else None

    return Response({
        'object': detail,
        'creation_node': node_data,
    }, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Task 19: Timeline feed (paginated, filterable)
# ---------------------------------------------------------------------------

@api_view(['GET'])
def timeline_feed_view(request):
    """
    GET /api/v1/notebook/feed/

    Day-grouped paginated timeline feed.

    Response: {days: [{date, nodes}], total, page, per_page, has_next}

    Filters:
      ?timeline=<slug>    Filter by Timeline
      ?type=<node_type>   Filter by node_type
      ?object_type=<slug> Filter by object_ref's ObjectType
      ?date_from=<iso>    Nodes after this date
      ?date_to=<iso>      Nodes before this date
      ?notebook=<slug>    Nodes whose object_ref belongs to this Notebook
      ?project=<slug>     Nodes whose object_ref belongs to this Project

    Pagination:
      ?page=1&per_page=50 (max 200)
    """
    qs = Node.objects.select_related(
        'object_ref', 'object_ref__object_type', 'timeline',
    ).filter(
        object_ref__is_deleted=False,
    ).order_by('-occurred_at')

    # Filters
    timeline_slug = request.query_params.get('timeline')
    if timeline_slug:
        qs = qs.filter(timeline__slug=timeline_slug)

    node_type = request.query_params.get('type')
    if node_type:
        qs = qs.filter(node_type=node_type)

    object_type_slug = request.query_params.get('object_type')
    if object_type_slug:
        qs = qs.filter(object_ref__object_type__slug=object_type_slug)

    date_from = request.query_params.get('date_from')
    if date_from:
        qs = qs.filter(occurred_at__gte=date_from)

    date_to = request.query_params.get('date_to')
    if date_to:
        qs = qs.filter(occurred_at__lte=date_to)

    notebook_slug = request.query_params.get('notebook')
    if notebook_slug:
        qs = qs.filter(object_ref__notebook__slug=notebook_slug)

    project_slug = request.query_params.get('project')
    if project_slug:
        qs = qs.filter(object_ref__project__slug=project_slug)

    # Pagination
    per_page = min(int(request.query_params.get('per_page', 50)), 200)
    page = max(int(request.query_params.get('page', 1)), 1)
    total = qs.count()
    offset = (page - 1) * per_page
    page_nodes = list(qs[offset:offset + per_page])

    # Group by date
    days = OrderedDict()

    for node in page_nodes:
        date_str = node.occurred_at.strftime('%Y-%m-%d')
        if date_str not in days:
            days[date_str] = []

        obj = node.object_ref
        obj_type = obj.object_type if obj else None

        retro = node.retrospective_notes or []
        latest_retro = retro[-1] if retro else None

        days[date_str].append({
            'id': f'node:{node.pk}',
            'node_type': node.node_type,
            'icon': NODE_ICONS.get(node.node_type, 'circle'),
            'object_type': obj_type.slug if obj_type else None,
            'object_type_color': obj_type.color if obj_type else '#9A8E82',
            'title': node.title,
            'body': node.body,
            'timestamp': node.occurred_at.isoformat(),
            'has_retrospective': bool(retro),
            'retrospective': {
                'text': latest_retro['text'],
                'written_at': latest_retro['created_at'],
            } if latest_retro else None,
            'object_id': f'object:{obj.pk}' if obj else None,
        })

    return Response({
        'days': [{'date': d, 'nodes': n} for d, n in days.items()],
        'total': total,
        'page': page,
        'per_page': per_page,
        'has_next': (offset + per_page) < total,
    })


# ---------------------------------------------------------------------------
# Task 20: Graph data (Objects + Edges for D3)
# ---------------------------------------------------------------------------

BASE_NODE_SIZE = 12
MAX_NODE_SIZE = 48


@api_view(['GET'])
def graph_data_view(request):
    """
    GET /api/v1/notebook/graph/

    Returns {nodes, edges, meta} for a D3 force-directed graph.

    Node IDs are prefixed strings: "object:<pk>".
    Node size is computed from body length and edge count.

    Filters:
      ?notebook=<slug>
      ?project=<slug>
      ?type=<object_type_slug>
    """
    obj_qs = Object.objects.select_related('object_type').filter(
        is_deleted=False,
    ).annotate(
        edge_count=Count('edges_out', distinct=True) + Count('edges_in', distinct=True),
    )

    # Filters
    notebook_slug = request.query_params.get('notebook')
    if notebook_slug:
        obj_qs = obj_qs.filter(notebook__slug=notebook_slug)

    project_slug = request.query_params.get('project')
    if project_slug:
        obj_qs = obj_qs.filter(project__slug=project_slug)

    object_type = request.query_params.get('type')
    if object_type:
        obj_qs = obj_qs.filter(object_type__slug=object_type)

    nodes = []
    obj_ids = set()
    type_counts = {}

    for obj in obj_qs:
        obj_ids.add(obj.id)
        type_slug = obj.object_type.slug if obj.object_type else 'unknown'
        type_counts[type_slug] = type_counts.get(type_slug, 0) + 1

        body_len = len(obj.body or '')
        ec = obj.edge_count or 0
        size = min(MAX_NODE_SIZE, BASE_NODE_SIZE + body_len / 200 + ec * 2)

        nodes.append({
            'id': f'object:{obj.id}',
            'title': obj.display_title,
            'slug': obj.slug,
            'body_preview': (obj.body or '')[:80],
            'object_type': type_slug,
            'object_type_color': obj.object_type.color if obj.object_type else '',
            'object_type_icon': obj.object_type.icon if obj.object_type else '',
            'edge_count': ec,
            'size': round(size, 1),
            'status': obj.status,
        })

    # Edges: only include edges where both endpoints are in the filtered set
    edge_qs = Edge.objects.filter(
        from_object_id__in=obj_ids,
        to_object_id__in=obj_ids,
    )

    edges = []
    for edge in edge_qs:
        edges.append({
            'id': f'edge:{edge.id}',
            'source': f'object:{edge.from_object_id}',
            'target': f'object:{edge.to_object_id}',
            'edge_type': edge.edge_type,
            'strength': float(edge.strength) if edge.strength else 0.0,
            'reason': edge.reason,
        })

    return Response({
        'nodes': nodes,
        'edges': edges,
        'meta': {
            'node_count': len(nodes),
            'edge_count': len(edges),
            'type_distribution': type_counts,
        },
    })


# ---------------------------------------------------------------------------
# Task 21: Resurface endpoint (weighted scoring)
# ---------------------------------------------------------------------------

@api_view(['GET'])
def resurface_view(request):
    """
    GET /api/v1/notebook/resurface/

    Returns {cards: [{object, signal, signal_label, explanation, score, actions}]}

    Params: ?count=<1-5>, ?notebook=<slug>, ?project=<slug>, ?exclude=<ids>
    """
    from .resurface import score_candidates
    from .serializers import ObjectDetailSerializer

    count = min(int(request.query_params.get('count', 3)), 5)
    notebook_slug = request.query_params.get('notebook')
    project_slug = request.query_params.get('project')

    exclude_str = request.query_params.get('exclude', '')
    exclude_ids = [int(x) for x in exclude_str.split(',') if x.strip().isdigit()]

    qs = Object.objects.filter(
        status='active', is_deleted=False
    ).select_related('object_type', 'notebook', 'project')

    if notebook_slug:
        qs = qs.filter(notebook__slug=notebook_slug)
    if project_slug:
        qs = qs.filter(project__slug=project_slug)
    if exclude_ids:
        qs = qs.exclude(pk__in=exclude_ids)

    # Exclude objects dismissed from resurface within the last 30 days
    dismissed_ids = set(
        Node.objects.filter(
            node_type='retrospective',
            title__startswith='Dismissed from resurface:',
            occurred_at__gte=timezone.now() - timedelta(days=30),
        ).values_list('object_ref_id', flat=True)
    )
    if dismissed_ids:
        qs = qs.exclude(pk__in=dismissed_ids)

    candidates = score_candidates(qs[:500], notebook_slug=notebook_slug, project_slug=project_slug)
    top = candidates[:count]

    obj_map = {
        o.pk: o
        for o in Object.objects.filter(
            pk__in=[c['object_id'] for c in top]
        ).select_related('object_type')
    }

    cards = []
    for c in top:
        obj = obj_map.get(c['object_id'])
        if not obj:
            continue
        cards.append({
            'object': ObjectDetailSerializer(obj).data,
            'signal': c['signal'],
            'signal_label': c['signal_label'],
            'explanation': c['explanation'],
            'score': round(c['score'], 3),
            'actions': ['add_note', 'connect', 'dismiss'],
        })

    return Response({'cards': cards, 'meta': {'count': len(cards)}})


@api_view(['POST'])
def resurface_dismiss_view(request):
    """
    POST /api/v1/notebook/resurface/dismiss/

    Dismiss a resurface suggestion so it won't re-appear for 30 days.
    Records the dismissal as a retrospective Node on the master Timeline,
    which resurface_view queries to suppress dismissed objects.

    Input: {object_id: int}
    """
    object_id = request.data.get('object_id')
    if not object_id:
        return Response({'detail': 'object_id required.'}, status=400)

    try:
        obj = Object.objects.get(pk=object_id, is_deleted=False)
    except Object.DoesNotExist:
        return Response({'detail': 'Object not found.'}, status=404)

    from .signals import _get_master_timeline
    timeline = _get_master_timeline()

    Node.objects.create(
        node_type='retrospective',
        title=f'Dismissed from resurface: {obj.display_title[:60]}',
        body='User dismissed this object from the resurface queue.',
        object_ref=obj,
        timeline=timeline,
    )

    return Response({'detail': 'Dismissed.', 'object_id': object_id})


@api_view(['GET', 'PATCH'])
def notebook_engine_config_view(request, slug):
    """
    GET/PATCH /api/v1/notebook/notebooks/<slug>/engine-config/

    GET: returns current engine_config and resolved novelty value
    PATCH: accepts {"novelty": 0.0-1.0} and updates engine_config
    """
    from .engine import interpolate_config

    notebook = get_object_or_404(Notebook, slug=slug)

    if request.method == 'GET':
        current_novelty = (notebook.engine_config or {}).get('novelty', 0.3)
        return Response({
            'engine_config': notebook.engine_config,
            'novelty': current_novelty,
            'resolved_config': interpolate_config(current_novelty),
        })

    # PATCH
    novelty = request.data.get('novelty')
    if novelty is None or not (0.0 <= float(novelty) <= 1.0):
        return Response(
            {'error': 'novelty must be a float between 0.0 and 1.0'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    novelty = float(novelty)
    config = interpolate_config(novelty)
    config['novelty'] = novelty
    notebook.engine_config = config
    notebook.save(update_fields=['engine_config', 'updated_at'])
    return Response({'novelty': novelty, 'engine_config': config})


@api_view(['POST'])
def object_connect_view(request, slug):
    """
    POST /api/v1/notebook/objects/<slug>/connect/

    Manually connect two Objects. Body: {target_slug, edge_type?, reason?}
    """
    obj = get_object_or_404(Object, slug=slug, is_deleted=False)
    target_slug = request.data.get('target_slug')
    if not target_slug:
        return Response(
            {'detail': 'target_slug is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    target = get_object_or_404(Object, slug=target_slug, is_deleted=False)

    edge, created = Edge.objects.get_or_create(
        from_object=obj,
        to_object=target,
        defaults={
            'edge_type': request.data.get('edge_type', 'related'),
            'reason': request.data.get('reason', ''),
            'strength': 0.5,
            'is_auto': False,
            'engine': 'manual',
        },
    )

    from .serializers import EdgeSerializer
    return Response(
        EdgeSerializer(edge).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


# ---------------------------------------------------------------------------
# Task 22: Export endpoints (Markdown + JSON archive)
# ---------------------------------------------------------------------------

@api_view(['GET'])
def export_object_view(request, slug):
    """
    GET /api/v1/notebook/export/object/<slug>/

    Returns Markdown with YAML frontmatter for a single Object.
    """
    from django.shortcuts import get_object_or_404

    obj = get_object_or_404(
        Object.objects.select_related('object_type', 'notebook', 'project'),
        slug=slug,
    )

    # Build YAML frontmatter
    lines = ['---']
    lines.append(f'sha_hash: {obj.sha_hash}')
    lines.append(f'title: "{obj.title}"')
    lines.append(f'type: {obj.object_type.slug if obj.object_type else "unknown"}')
    lines.append(f'status: {obj.status}')
    if obj.url:
        lines.append(f'url: {obj.url}')
    if obj.notebook:
        lines.append(f'notebook: {obj.notebook.slug}')
    if obj.project:
        lines.append(f'project: {obj.project.slug}')
    if obj.captured_at:
        lines.append(f'captured_at: {obj.captured_at.isoformat()}')
    if obj.created_at:
        lines.append(f'created_at: {obj.created_at.isoformat()}')
    if obj.updated_at:
        lines.append(f'updated_at: {obj.updated_at.isoformat()}')
    if obj.is_pinned:
        lines.append('pinned: true')
    if obj.is_starred:
        lines.append('starred: true')

    # OG metadata
    if obj.og_title:
        lines.append(f'og_title: "{obj.og_title}"')
    if obj.og_description:
        lines.append(f'og_description: "{obj.og_description}"')
    if obj.og_image:
        lines.append(f'og_image: {obj.og_image}')

    # Components
    components = obj.components.select_related('component_type').order_by('sort_order')
    if components.exists():
        lines.append('components:')
        for comp in components:
            lines.append(f'  - type: {comp.component_type.slug}')
            lines.append(f'    key: {comp.key}')
            lines.append(f'    value: "{comp.value}"')

    # Connections
    edges_out = obj.edges_out.select_related('to_object')
    edges_in = obj.edges_in.select_related('from_object')
    all_edges = list(edges_out) + list(edges_in)
    if all_edges:
        lines.append('connections:')
        for edge in all_edges:
            if edge.from_object_id == obj.id:
                other = edge.to_object
                direction = 'to'
            else:
                other = edge.from_object
                direction = 'from'
            lines.append(f'  - {direction}: "{other.display_title}"')
            lines.append(f'    type: {edge.edge_type}')
            if edge.reason:
                lines.append(f'    reason: "{edge.reason}"')

    lines.append('---')
    lines.append('')

    # Body
    if obj.body:
        lines.append(obj.body)

    markdown = '\n'.join(lines)

    return Response(
        markdown,
        content_type='text/markdown; charset=utf-8',
    )


@api_view(['GET'])
def export_notebook_view(request, slug):
    """
    GET /api/v1/notebook/export/notebook/<slug>/

    Returns a JSON archive of an entire Notebook:
    {notebook, objects, edges, components}
    """
    from django.shortcuts import get_object_or_404

    notebook = get_object_or_404(Notebook, slug=slug)

    # All Objects in this Notebook
    objects = Object.objects.filter(notebook=notebook).select_related('object_type')
    obj_ids = set(objects.values_list('id', flat=True))

    # Serialize objects
    objects_data = []
    for obj in objects:
        objects_data.append({
            'id': obj.id,
            'sha_hash': obj.sha_hash,
            'title': obj.title,
            'slug': obj.slug,
            'type': obj.object_type.slug if obj.object_type else '',
            'body': obj.body,
            'url': obj.url,
            'properties': obj.properties,
            'status': obj.status,
            'is_pinned': obj.is_pinned,
            'is_starred': obj.is_starred,
            'og_title': obj.og_title,
            'og_description': obj.og_description,
            'og_image': obj.og_image,
            'captured_at': obj.captured_at.isoformat() if obj.captured_at else None,
            'created_at': obj.created_at.isoformat() if obj.created_at else None,
        })

    # Components for these Objects
    components = Component.objects.filter(
        object_id__in=obj_ids
    ).select_related('component_type')

    components_data = []
    for comp in components:
        components_data.append({
            'object_id': comp.object_id,
            'type': comp.component_type.slug,
            'key': comp.key,
            'value': comp.value,
            'sort_order': comp.sort_order,
        })

    # Edges where both endpoints are in this Notebook
    edges = Edge.objects.filter(
        from_object_id__in=obj_ids,
        to_object_id__in=obj_ids,
    )

    edges_data = []
    for edge in edges:
        edges_data.append({
            'from_object_id': edge.from_object_id,
            'to_object_id': edge.to_object_id,
            'edge_type': edge.edge_type,
            'reason': edge.reason,
            'strength': float(edge.strength) if edge.strength else 0.0,
            'engine': edge.engine,
            'is_auto': edge.is_auto,
        })

    return Response({
        'notebook': {
            'name': notebook.name,
            'slug': notebook.slug,
            'description': notebook.description,
            'color': notebook.color,
            'engine_config': notebook.engine_config,
        },
        'objects': objects_data,
        'components': components_data,
        'edges': edges_data,
        'meta': {
            'exported_at': timezone.now().isoformat(),
            'object_count': len(objects_data),
            'component_count': len(components_data),
            'edge_count': len(edges_data),
        },
    })


# ---------------------------------------------------------------------------
# Compose Live Query (Task 1)
# ---------------------------------------------------------------------------

try:
    from rest_framework.throttling import AnonRateThrottle

    class ComposeThrottle(AnonRateThrottle):
        rate = '600/hour'
        scope = 'compose'
except ImportError:
    ComposeThrottle = None


@api_view(['POST'])
def compose_related_view(request):
    """
    POST /api/v1/notebook/compose/related/

    Real-time related-object query for the Compose Mode Live Graph.
    Runs 3-pass lightweight engine on unsaved text. Sub-200ms target.

    Input: {text, notebook_slug?, limit?, min_score?}
    Output: {query_id, text_length, passes_run, objects}
    """
    text = request.data.get('text', '').strip()
    if len(text) < 20:
        return Response({
            'objects': [],
            'passes_run': [],
            'text_length': len(text),
        })

    notebook_slug = request.data.get('notebook_slug', '')
    limit = min(int(request.data.get('limit', 8)), 15)
    min_score = float(request.data.get('min_score', 0.25))

    import hashlib
    query_id = hashlib.md5(text[:200].encode()).hexdigest()[:12]

    from .compose_engine import run_compose_query
    results = run_compose_query(
        text=text,
        notebook_slug=notebook_slug or None,
        limit=limit,
        min_score=min_score,
    )

    return Response({
        'query_id': query_id,
        'text_length': len(text),
        'passes_run': results['passes_run'],
        'objects': results['objects'],
    })

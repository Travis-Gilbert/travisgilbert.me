# CommonPlace Backend: Claude Code Build Spec

> **One phase per session. Do not attempt multiple phases in a single session.**
> **Branch:** `feature/networks-v4` (or create fresh: `feature/commonplace-backend`)
> **App path:** `research_api/apps/notebook/`
> **Django project config:** `research_api/config/`

---

## Current State of the Backend (as of this spec)

The following files exist and are substantially complete. Read them before
touching anything.

| File | Status | Notes |
|------|--------|-------|
| `models.py` | ~90% done | Missing `is_deleted`, `parent_sha` fields. Component model is correct. |
| `engine.py` | ~70% done | 3-pass pipeline works. Topic reasons are keyword lists, not explanations. Async not implemented. |
| `signals.py` | ~80% done | Uses `post_delete` for deletion (needs soft-delete pattern). Modification fires on every save. |
| `services.py` | ~60% done | `quick_capture()` works. Uses old field signature. Synchronous engine call is a problem. |
| `views.py` | ~65% done | Custom endpoints exist but response shapes do not match the contract. |
| `serializers.py` | ~70% done | Exists, not audited in detail. Verify field completeness per phase. |
| `urls.py` | ~80% done | Router registered. Missing a few custom URL patterns. |
| `admin.py` | ~85% done | Good. Minor additions per phase. |

**Key architectural contracts to preserve throughout every phase:**
- Nodes are append-only. The only mutable field is `retrospective_notes`.
  Always use `Node.objects.filter(pk=...).update(retrospective_notes=...)` for retro updates.
- Every `Edge.reason` must be a plain-English sentence explaining *why*, not a keyword list.
- `_generate_sha()` in models.py creates all SHA hashes. Never reuse a SHA.
- All timestamps use `django.utils.timezone`. Never use `datetime.now()`.
- The master Timeline (`is_master=True`) must always exist. Use `get_or_create`.

---

## Phase 1: Model Fixes and Migrations

**Files:** `models.py`, then `makemigrations` + `migrate`

### 1a. Add missing fields to Object model

Find the `Object` class. Add after `is_starred`:

```python
is_deleted = models.BooleanField(
    default=False,
    db_index=True,
    help_text='Soft-delete flag. Never hard-delete Objects.',
)
```

### 1b. Add missing field to Project model

Find the `Project` class. Add after `sha_hash`:

```python
parent_sha = models.CharField(
    max_length=40,
    blank=True,
    default='',
    help_text='SHA of the parent Project when forked. Empty for originals.',
)
```

### 1c. Verify Edge model has `related` in edge_type choices

The `signals.py` creates edges with `edge_type='related'` from relationship
components. Confirm `related` is in `Edge.edge_type` choices. If not, add it:

```python
('related', 'Related'),
```

### 1d. Run migrations

```bash
cd research_api
python manage.py makemigrations notebook --name="add_soft_delete_and_parent_sha"
python manage.py migrate
```

### 1e. Verify master Timeline exists

```bash
python manage.py shell -c "
from apps.notebook.models import Timeline
t, created = Timeline.objects.get_or_create(
    is_master=True,
    defaults={'name': 'Master Timeline', 'slug': 'master'}
)
print('Timeline:', t, 'Created:', created)
"
```

**Deliverable:** `python manage.py check` passes with no errors.

---

## Phase 2: Soft Deletion

**Files:** `signals.py`, `views.py`, `engine.py`

The current code uses `post_delete` which hard-deletes Objects. Objects must
never be hard-deleted. The Timeline integrity promise depends on this.

### 2a. Update signals.py

Remove the `create_deletion_node` `post_delete` receiver entirely.

The deletion Node will now be created by a `soft_delete` action in the
ViewSet (Phase 2b). The signal should not create deletion Nodes.

Also fix the modification signal: it currently fires on every save including
the initial creation save, creating a spurious modification Node alongside
the creation Node. Fix by checking `created` flag:

```python
@receiver(post_save, sender='notebook.Object')
def create_object_node(sender, instance, created, **kwargs):
    if kwargs.get('raw', False):
        return
    # Skip if is_deleted was just set (soft_delete action handles that Node)
    if not created and instance.is_deleted:
        return
    timeline = _get_master_timeline()
    from .models import Node
    if created:
        Node.objects.create(
            node_type='creation',
            title=f'Created: {instance.display_title[:80]}',
            object_ref=instance,
            timeline=timeline,
        )
    # Do NOT create modification Nodes from the signal.
    # Modification Nodes are created explicitly in ObjectViewSet.perform_update()
    # to avoid noise from engine-driven saves.
```

### 2b. Add soft_delete action to ObjectViewSet in views.py

```python
@action(detail=True, methods=['post'], url_path='delete')
def soft_delete(self, request, slug=None):
    """
    POST /api/v1/notebook/objects/<slug>/delete/
    Soft-delete an Object: sets is_deleted=True and creates a DELETION Node.
    """
    obj = self.get_object()
    if obj.is_deleted:
        return Response({'detail': 'Already deleted.'}, status=status.HTTP_400_BAD_REQUEST)

    from .models import Node, Timeline, _generate_sha
    timeline = Timeline.objects.filter(is_master=True).first()

    obj.is_deleted = True
    obj.save(update_fields=['is_deleted', 'updated_at'])

    Node.objects.create(
        node_type='deletion',
        title=f'Deleted: {obj.display_title[:80]}',
        body=request.data.get('reason', ''),
        object_ref=obj,
        timeline=timeline,
    )

    return Response({'detail': 'Object soft-deleted.'}, status=status.HTTP_200_OK)
```

### 2c. Add is_deleted filter to every Object queryset

In `ObjectViewSet.get_queryset()`, `graph_data_view`, `resurface_view`, and
`quick_capture_view`, add `.filter(is_deleted=False)` to every Object query.

In `engine.py`, add `.filter(is_deleted=False)` to candidate queries in
`find_topic_connections` and `find_shared_entity_connections`.

### 2d. Add perform_update to ObjectViewSet

```python
def perform_update(self, serializer):
    """Create an explicit modification Node on meaningful updates."""
    obj = serializer.save()
    from .models import Node, Timeline
    timeline = Timeline.objects.filter(is_master=True).first()
    if timeline:
        changed = list(serializer.validated_data.keys())
        Node.objects.create(
            node_type='modification',
            title=f'Updated: {obj.display_title[:80]}',
            body=f'Fields changed: {", ".join(changed)}',
            object_ref=obj,
            timeline=timeline,
        )
```

**Deliverable:** Create an Object, soft-delete it, verify it no longer appears
in `/api/v1/notebook/objects/` but still exists in DB. Verify deletion Node
appears in the master timeline.

---

## Phase 3: Async Engine Execution

**Files:** `services.py`, `signals.py`, `requirements/`

The engine runs synchronously inside `post_save` signals and `services.py`.
For a URL capture this blocks the request for 2-5 seconds. Fix with threading
for now; task queue later.

### 3a. Wrap engine calls in a background thread

In `services.py`, replace the direct `run_engine(obj)` call:

```python
import threading

def _run_engine_async(obj_pk: int, notebook_slug: str | None = None):
    """Run the connection engine in a background thread."""
    try:
        from .models import Object, Notebook
        from .engine import run_engine
        obj = Object.objects.get(pk=obj_pk)
        notebook = Notebook.objects.filter(slug=notebook_slug).first() if notebook_slug else None
        run_engine(obj, notebook=notebook)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(
            'Async engine failed for Object %s: %s', obj_pk, exc
        )

def quick_capture(...) -> Object:
    # ... existing creation logic ...
    
    # Fire engine in background thread (non-blocking)
    thread = threading.Thread(
        target=_run_engine_async,
        args=(obj.pk, notebook.slug if notebook else None),
        daemon=True,
    )
    thread.start()
    
    return obj
```

### 3b. Remove engine call from post_save signal

The `create_object_node` signal in `signals.py` should ONLY create the Node.
It should NOT call `run_engine`. The engine is already called from
`services.quick_capture()`. The signal calling it too creates double-execution.

Search for any `run_engine` call in `signals.py` and remove it.

### 3c. Add a management command to run the engine manually

Create `management/commands/run_engine_all.py`:

```python
from django.core.management.base import BaseCommand
from apps.notebook.models import Object
from apps.notebook.engine import run_engine

class Command(BaseCommand):
    help = 'Run the connection engine across all active, non-deleted Objects.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=None)

    def handle(self, *args, **options):
        qs = Object.objects.filter(status='active', is_deleted=False)
        if options['limit']:
            qs = qs[:options['limit']]
        total = qs.count()
        self.stdout.write(f'Running engine on {total} objects...')
        for i, obj in enumerate(qs, 1):
            results = run_engine(obj)
            self.stdout.write(
                f'[{i}/{total}] {obj.display_title[:40]} -> '
                f'{results["edges_from_shared"]} shared + '
                f'{results["edges_from_topics"]} topic edges'
            )
        self.stdout.write(self.style.SUCCESS('Done.'))
```

**Deliverable:** POST to `/api/v1/notebook/capture/` returns in under 500ms.
Run `python manage.py run_engine_all --limit 10` and see edge output.

---

## Phase 4: Capture Endpoint Rewrite

**Files:** `views.py`, `services.py`

The capture endpoint uses old field names. Rewrite to match the contract.

### 4a. New capture serializer

Replace `QuickCaptureSerializer` in `views.py` with:

```python
class CaptureInputSerializer(serializers.Serializer):
    content = serializers.CharField(required=True, allow_blank=False)
    hint_type = serializers.ChoiceField(
        choices=['source', 'hunch', 'quote', 'note', 'person', 'concept', 'place', 'org'],
        required=False,
        default=None,
        allow_null=True,
    )
    notebook_slug = serializers.SlugField(required=False, default='', allow_blank=True)
    project_slug = serializers.SlugField(required=False, default='', allow_blank=True)
```

### 4b. Update quick_capture_view

```python
@api_view(['POST'])
def quick_capture_view(request):
    """
    POST /api/v1/notebook/capture/

    Accepts:
      content      - URL, free text, or base64 file (required)
      hint_type    - optional type override
      notebook_slug - optional context
      project_slug  - optional context

    Type inference:
      content starts with http(s)://  -> source
      hint_type provided               -> use hint_type
      otherwise                        -> note
    """
    serializer = CaptureInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    content = data['content'].strip()
    hint_type = data.get('hint_type')

    # Infer type
    is_url = content.startswith('http://') or content.startswith('https://')
    object_type_slug = hint_type or ('source' if is_url else 'note')

    from .services import quick_capture
    obj = quick_capture(
        body='' if is_url else content,
        url=content if is_url else '',
        title='',
        object_type_slug=object_type_slug,
        notebook_slug=data.get('notebook_slug', ''),
        project_slug=data.get('project_slug', ''),
    )

    creation_node = obj.timeline_nodes.filter(node_type='creation').first()

    return Response({
        'object': ObjectDetailSerializer(obj).data,
        'inferred_type': object_type_slug,
        'creation_node': NodeListSerializer(creation_node).data if creation_node else None,
    }, status=status.HTTP_201_CREATED)
```

### 4c. Keep backward-compatible old endpoint

Add the old `quick_capture_view` logic under `/api/v1/notebook/capture/legacy/`
so any existing test scripts don't break. Remove after Phase 7 testing is done.

**Deliverable:**
```bash
curl -X POST http://localhost:8000/api/v1/notebook/capture/ \
  -H "Content-Type: application/json" \
  -d '{"content": "https://wikipedia.org/wiki/Desire_path"}'
# Returns: {object: {...}, inferred_type: "source", creation_node: {...}}

curl -X POST http://localhost:8000/api/v1/notebook/capture/ \
  -H "Content-Type: application/json" \
  -d '{"content": "What if parking lots are misclassified public squares?", "hint_type": "hunch"}'
# Returns: {object: {...}, inferred_type: "hunch", creation_node: {...}}
```

---

## Phase 5: Graph Endpoint Rewrite

**Files:** `views.py`

The graph endpoint returns `{objects, edges}` with numeric IDs. The contract
requires prefixed string IDs, a size computation, and `body_preview`.

### 5a. Rewrite graph_data_view

Replace the existing `graph_data_view` with:

```python
BASE_NODE_SIZE = 12
MAX_NODE_SIZE = 48

@api_view(['GET'])
def graph_data_view(request):
    """
    GET /api/v1/notebook/graph/

    Returns {nodes, edges} for D3 force-directed graph.
    Node IDs are prefixed strings: "object:<pk>"

    Filters: ?notebook=<slug>, ?project=<slug>, ?type=<slug>
    """
    obj_qs = Object.objects.filter(
        is_deleted=False
    ).select_related('object_type').annotate(
        edge_count=Count('edges_out', distinct=True) + Count('edges_in', distinct=True),
    )

    notebook_slug = request.query_params.get('notebook')
    if notebook_slug:
        obj_qs = obj_qs.filter(notebook__slug=notebook_slug)

    project_slug = request.query_params.get('project')
    if project_slug:
        obj_qs = obj_qs.filter(project__slug=project_slug)

    object_type_slug = request.query_params.get('type')
    if object_type_slug:
        obj_qs = obj_qs.filter(object_type__slug=object_type_slug)

    nodes = []
    obj_pks = set()
    type_counts = {}

    for obj in obj_qs:
        obj_pks.add(obj.pk)
        type_slug = obj.object_type.slug if obj.object_type else 'unknown'
        type_counts[type_slug] = type_counts.get(type_slug, 0) + 1

        body_len = len(obj.body or '')
        edge_c = obj.edge_count or 0
        size = min(BASE_NODE_SIZE + (body_len / 200) + (edge_c * 2), MAX_NODE_SIZE)

        nodes.append({
            'id': f'object:{obj.pk}',
            'label': obj.display_title,
            'type': type_slug,
            'color': obj.object_type.color if obj.object_type else '#9A8E82',
            'icon': obj.object_type.icon if obj.object_type else 'note-pencil',
            'size': round(size, 1),
            'body_preview': (obj.body or '')[:80],
            'edge_count': edge_c,
            'slug': obj.slug,
        })

    edge_qs = Edge.objects.filter(
        from_object_id__in=obj_pks,
        to_object_id__in=obj_pks,
    )

    edges = []
    for edge in edge_qs:
        edges.append({
            'source': f'object:{edge.from_object_id}',
            'target': f'object:{edge.to_object_id}',
            'label': edge.reason,
            'weight': round(float(edge.strength or 0.5), 3),
            'is_manual': not edge.is_auto,
            'edge_type': edge.edge_type,
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
```

**Deliverable:** `GET /api/v1/notebook/graph/` returns nodes with IDs like
`"object:42"` and size values. Verify in browser or curl. The CommonPlace
D3 canvas reads from this endpoint directly.

---

## Phase 6: Timeline Endpoint Rewrite

**Files:** `views.py`, `serializers.py`

The timeline feed endpoint returns flat paginated nodes. The contract requires
day-grouped format with icon mapping and has_retrospective flag.

### 6a. Node icon mapping constant

At the top of `views.py`, add:

```python
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
```

### 6b. Rewrite timeline_feed_view

Replace the existing `timeline_feed_view` function with:

```python
@api_view(['GET'])
def timeline_feed_view(request):
    """
    GET /api/v1/notebook/feed/

    Day-grouped paginated timeline feed.

    Filters: ?notebook=<slug>, ?project=<slug>, ?type=<node_type>,
             ?object_type=<slug>, ?date_from=<iso>, ?date_to=<iso>
    Pagination: ?page=1&per_page=50
    """
    qs = Node.objects.select_related(
        'object_ref', 'object_ref__object_type', 'timeline',
    ).filter(
        object_ref__is_deleted=False
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

    notebook_slug = request.query_params.get('notebook')
    if notebook_slug:
        qs = qs.filter(object_ref__notebook__slug=notebook_slug)

    project_slug = request.query_params.get('project')
    if project_slug:
        qs = qs.filter(object_ref__project__slug=project_slug)

    date_from = request.query_params.get('date_from')
    if date_from:
        qs = qs.filter(occurred_at__gte=date_from)

    date_to = request.query_params.get('date_to')
    if date_to:
        qs = qs.filter(occurred_at__lte=date_to)

    # Pagination
    per_page = min(int(request.query_params.get('per_page', 50)), 200)
    page = max(int(request.query_params.get('page', 1)), 1)
    total = qs.count()
    offset = (page - 1) * per_page
    nodes = list(qs[offset:offset + per_page])

    # Group by date
    from collections import OrderedDict
    days = OrderedDict()

    for node in nodes:
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
```

**Deliverable:** `GET /api/v1/notebook/feed/` returns
`{days: [{date, nodes: [...]}], total, page}`. Curl it and verify the day-grouping.

---

## Phase 7: Object Detail Enhancement

**Files:** `views.py`, `serializers.py`

The Object detail endpoint needs to return connections, history, and
project/notebook context in a single call.

### 7a. Update ObjectDetailSerializer in serializers.py

The serializer needs to include:
- `connections`: list of related objects with explanation
- `history`: last 20 timeline Nodes related to this Object
- `projects`: array of project slugs this Object belongs to
- `notebooks`: array of notebook slugs

```python
class ObjectConnectionSerializer(serializers.Serializer):
    """One connection (Edge) for the Object detail panel."""
    connected_object = serializers.SerializerMethodField()
    explanation = serializers.CharField(source='reason')
    is_manual = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField()
    edge_type = serializers.CharField()

    def get_connected_object(self, edge):
        # Return the OTHER end of the edge, not the current object
        current_id = self.context.get('current_object_id')
        other = edge.to_object if edge.from_object_id == current_id else edge.from_object
        return {
            'id': f'object:{other.pk}',
            'type': other.object_type.slug if other.object_type else 'unknown',
            'type_color': other.object_type.color if other.object_type else '#9A8E82',
            'title': other.display_title,
            'slug': other.slug,
        }

    def get_is_manual(self, edge):
        return not edge.is_auto
```

In `ObjectDetailSerializer`, add these fields:
```python
connections = serializers.SerializerMethodField()
history = serializers.SerializerMethodField()
projects = serializers.SerializerMethodField()
notebooks = serializers.SerializerMethodField()
id_prefixed = serializers.SerializerMethodField()

def get_id_prefixed(self, obj):
    return f'object:{obj.pk}'

def get_connections(self, obj):
    from .models import Edge
    edges = Edge.objects.filter(
        Q(from_object=obj) | Q(to_object=obj)
    ).select_related(
        'from_object', 'from_object__object_type',
        'to_object', 'to_object__object_type',
    ).order_by('-strength')[:20]
    return ObjectConnectionSerializer(
        edges, many=True, context={'current_object_id': obj.pk}
    ).data

def get_history(self, obj):
    from .models import Node
    nodes = obj.timeline_nodes.order_by('-occurred_at')[:20]
    return [
        {
            'node_type': n.node_type,
            'icon': NODE_ICONS.get(n.node_type, 'circle'),
            'timestamp': n.occurred_at.isoformat(),
            'summary': n.title,
        }
        for n in nodes
    ]

def get_projects(self, obj):
    if obj.project:
        return [obj.project.slug]
    return []

def get_notebooks(self, obj):
    if obj.notebook:
        return [obj.notebook.slug]
    return []
```

Note: `NODE_ICONS` needs to be importable from serializers.py or moved to
a `constants.py` file. Keep it in `views.py` and import if needed.

**Deliverable:** `GET /api/v1/notebook/objects/<slug>/` returns a payload
with `connections`, `history`, `projects`, `notebooks` fields. Test with
an Object that has at least one Edge.

---

## Phase 8: Resurface Service Extraction

**Files:** NEW `resurface.py`, `views.py`, `urls.py`

Extract the inline scoring logic from `resurface_view` into a dedicated
service module.

### 8a. Create apps/notebook/resurface.py

```python
"""
Resurface service: selects Objects for serendipitous rediscovery.

Five signals, each returning (object_id, score, signal_name, explanation).
All signals are merged, deduplicated (keep highest score per object),
sorted by score, and returned as ordered candidates.
"""
import logging
from datetime import timedelta

from django.db.models import Count, Max, Q, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

logger = logging.getLogger(__name__)


def connection_recency(qs, now, **kwargs):
    """
    Boost Objects that recently acquired a new connection but were
    created more than 30 days ago. Weight: 0.30.
    """
    results = []
    candidates = qs.annotate(
        latest_edge_at=Coalesce(Max('edges_out__created_at'), Max('edges_in__created_at'), Value(None)),
    ).filter(latest_edge_at__gte=now - timedelta(days=14))

    for obj in candidates:
        obj_age = (now - obj.captured_at).days if obj.captured_at else 0
        edge_age = (now - obj.latest_edge_at).days
        if obj_age > 30 and edge_age < 14:
            score = 0.30 * max(0, 1.0 - edge_age / 14)
            results.append((
                obj.pk, score, 'connection_recency',
                f'This {getattr(obj.object_type, "name", "object").lower()} '
                f'recently connected to something new.',
            ))
    return results


def orphan_score(qs, **kwargs):
    """
    Boost Objects with zero or very few connections. Weight: 0.25.
    """
    results = []
    candidates = qs.annotate(
        ec=Count('edges_out', distinct=True) + Count('edges_in', distinct=True)
    )
    for obj in candidates:
        ec = obj.ec or 0
        if ec == 0:
            results.append((obj.pk, 0.25, 'orphan', 'No connections yet. Ripe for discovery.'))
        elif ec <= 2:
            results.append((obj.pk, 0.15, 'orphan', 'Lightly connected. Could use more links.'))
    return results


def engagement_decay(qs, now, **kwargs):
    """
    Boost Objects not updated recently. Weight: 0.20.
    """
    results = []
    for obj in qs:
        days = (now - obj.updated_at).days if obj.updated_at else 365
        if days > 30:
            score = min(0.20, 0.20 * (days / 180))
            results.append((
                obj.pk, score, 'engagement_decay',
                f'Not revisited in {days} days.',
            ))
    return results


def temporal_resonance(qs, now, **kwargs):
    """
    Boost Objects captured on or around the same calendar date in past years.
    Weight: 0.15 exact match, 0.05 same month.
    """
    results = []
    for obj in qs:
        if not obj.captured_at:
            continue
        if (obj.captured_at.month == now.month
                and obj.captured_at.day == now.day
                and obj.captured_at.year != now.year):
            years_ago = now.year - obj.captured_at.year
            results.append((
                obj.pk, 0.15, 'temporal_resonance',
                f'Captured on this day {years_ago} year(s) ago.',
            ))
        elif abs(obj.captured_at.month - now.month) <= 1 and obj.captured_at.year != now.year:
            results.append((
                obj.pk, 0.05, 'temporal_resonance',
                'Captured around this time of year.',
            ))
    return results


def contextual_fit(qs, notebook_slug=None, project_slug=None, **kwargs):
    """
    Boost Objects in the currently active Notebook or Project. Weight: 0.10.
    """
    results = []
    for obj in qs:
        if notebook_slug and obj.notebook and obj.notebook.slug == notebook_slug:
            results.append((obj.pk, 0.10, 'contextual_fit', 'In your active notebook.'))
        elif project_slug and obj.project and obj.project.slug == project_slug:
            results.append((obj.pk, 0.10, 'contextual_fit', 'In your active project.'))
    return results


SIGNAL_LABELS = {
    'connection_recency': 'Connection Recency',
    'orphan': 'Waiting for Connections',
    'engagement_decay': 'Fading From View',
    'temporal_resonance': 'This Day in History',
    'contextual_fit': 'In Your Current Context',
}


def score_candidates(qs, notebook_slug=None, project_slug=None):
    """
    Run all signals against a queryset of Objects.
    Returns a list of dicts: {object, score, signal, signal_label, explanation}
    ordered by score descending.
    """
    from .models import Object
    now = timezone.now()
    all_results = []

    for signal_fn in [connection_recency, orphan_score, engagement_decay,
                      temporal_resonance, contextual_fit]:
        try:
            results = signal_fn(
                qs=qs, now=now,
                notebook_slug=notebook_slug,
                project_slug=project_slug,
            )
            all_results.extend(results)
        except Exception as exc:
            logger.warning('Resurface signal %s failed: %s', signal_fn.__name__, exc)

    # Deduplicate: keep highest score per object
    best = {}
    for obj_id, score, signal, explanation in all_results:
        if obj_id not in best or score > best[obj_id]['score']:
            best[obj_id] = {
                'object_id': obj_id,
                'score': score,
                'signal': signal,
                'signal_label': SIGNAL_LABELS.get(signal, signal),
                'explanation': explanation,
            }

    # Sort and return object PKs in order
    return sorted(best.values(), key=lambda x: x['score'], reverse=True)
```

### 8b. Rewrite resurface_view in views.py

```python
@api_view(['GET'])
def resurface_view(request):
    """
    GET /api/v1/notebook/resurface/

    Returns {cards: [{object, signal, signal_label, explanation, score, actions}]}

    Params: ?count=<1-5>, ?notebook=<slug>, ?project=<slug>, ?exclude=<ids>
    """
    from .resurface import score_candidates

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

    candidates = score_candidates(qs[:500], notebook_slug=notebook_slug, project_slug=project_slug)
    top = candidates[:count]

    obj_map = {o.pk: o for o in Object.objects.filter(pk__in=[c['object_id'] for c in top]).select_related('object_type')}

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
```

### 8c. Add dismiss and connect endpoints to urls.py

```python
path('resurface/dismiss/', views.resurface_dismiss_view, name='resurface-dismiss'),
path('objects/<slug>/connect/', views.object_connect_view, name='object-connect'),
```

### 8d. Add dismiss_view stub

```python
@api_view(['POST'])
def resurface_dismiss_view(request):
    """POST /api/v1/notebook/resurface/dismiss/ - Mark object as dismissed for this cycle."""
    # For now: no-op (frontend stores dismissals in state/localStorage).
    # Future: write to a DismissedObject model with expiry.
    return Response({'detail': 'Dismissed.'})
```

**Deliverable:** `GET /api/v1/notebook/resurface/?count=3` returns 3 cards
with signal, explanation, and full Object data.

---

## Phase 9: Novelty Dial Endpoint

**Files:** `views.py`, `urls.py`, `engine.py`

### 9a. Add engine config constants to engine.py

```python
HIGH_NOVELTY_CONFIG = {
    'engines': ['spacy', 'sbert'],
    'topic_threshold': 0.10,
    'max_candidates': 1000,
    'sbert_threshold': 0.40,
    'entity_types': [
        'PERSON', 'ORG', 'GPE', 'LOC', 'EVENT', 'WORK_OF_ART', 'DATE',
    ],
}

def interpolate_config(novelty: float) -> dict:
    """
    Interpolate between conservative and aggressive engine configs.
    novelty: float 0.0 (conservative) to 1.0 (aggressive)
    """
    conservative = DEFAULT_ENGINE_CONFIG
    aggressive = HIGH_NOVELTY_CONFIG
    return {
        'engines': aggressive['engines'] if novelty > 0.5 else conservative['engines'],
        'topic_threshold': (
            conservative['topic_threshold']
            - (conservative['topic_threshold'] - aggressive['topic_threshold']) * novelty
        ),
        'max_candidates': int(
            conservative['max_candidates']
            + (aggressive['max_candidates'] - conservative['max_candidates']) * novelty
        ),
        'entity_types': (
            aggressive['entity_types']
            if novelty > 0.3
            else conservative.get('entity_types', aggressive['entity_types'])
        ),
    }
```

### 9b. Add engine-config endpoint to views.py

```python
@api_view(['GET', 'PATCH'])
def notebook_engine_config_view(request, slug):
    """
    GET/PATCH /api/v1/notebook/notebooks/<slug>/engine-config/

    GET: returns current engine_config and resolved novelty value
    PATCH: accepts {"novelty": 0.0-1.0} and updates engine_config
    """
    from .models import Notebook
    from .engine import interpolate_config

    notebook = get_object_or_404(Notebook, slug=slug)

    if request.method == 'GET':
        current_novelty = notebook.engine_config.get('novelty', 0.3)
        return Response({
            'engine_config': notebook.engine_config,
            'novelty': current_novelty,
            'resolved_config': interpolate_config(current_novelty),
        })

    if request.method == 'PATCH':
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
```

### 9c. Add URL pattern to urls.py

```python
path('notebooks/<slug>/engine-config/', views.notebook_engine_config_view, name='notebook-engine-config'),
```

**Deliverable:**
```bash
PATCH /api/v1/notebook/notebooks/research/engine-config/
{"novelty": 0.8}
# Returns: {novelty: 0.8, engine_config: {topic_threshold: 0.14, max_candidates: 900, ...}}
```

---

## Phase 10: Connection Explanation Quality

**Files:** `engine.py`

The most important phase. The current Pass 3 explanation is:
`"Shared topics: parking, urban, zoning."`

This is a keyword list. The product requires:
`"Both notes examine how urban infrastructure shapes public behavior."`

### 10a. Improve Jaccard explanation synthesis

Replace the `reason = f'Shared topics: {", ".join(top_shared)}.'` line with
a structured template that extracts *meaningful* shared concepts:

```python
def _synthesize_topic_reason(my_keywords: set, other_keywords: set, obj_a, obj_b) -> str:
    """
    Generate a plain-English explanation of why two Objects are connected.
    Uses keyword overlap to infer the conceptual link.
    """
    overlap = my_keywords & other_keywords
    top = sorted(overlap, key=len, reverse=True)[:4]  # Prefer longer, more specific words

    type_a = obj_a.object_type.name if obj_a.object_type else 'note'
    type_b = obj_b.object_type.name if obj_b.object_type else 'note'

    if not top:
        return f'These two {type_a.lower()}s share thematic content.'

    if len(top) == 1:
        return f'Both {type_a.lower()}s discuss {top[0]}.'

    concept_str = ', '.join(top[:-1]) + f' and {top[-1]}'
    return f'Both explore {concept_str}.'
```

Replace the reason construction in `find_topic_connections`:
```python
reason = _synthesize_topic_reason(my_keywords, other_keywords, obj, other)
```

### 10b. Improve shared-entity explanation

In `find_shared_entity_connections`, replace the generic reason:
```python
# Old:
reason = f'Both notes reference {entity.text} ({entity.entity_type.lower()}).'

# New:
type_label = {
    'PERSON': 'person', 'ORG': 'organization', 'GPE': 'place',
    'LOC': 'location', 'EVENT': 'event', 'WORK_OF_ART': 'work',
}.get(entity.entity_type, entity.entity_type.lower())

reason = f'Both mention {entity.text}, the same {type_label}.'
```

### 10c. Stub an LLM-quality explanation path (do not call yet, just wire it)

Add this function to `engine.py` as a stub that will be activated later:

```python
LLM_EXPLANATION_ENABLED = False  # Set to True when LLM call is ready

def _llm_explanation(obj_a: Object, obj_b: Object) -> str | None:
    """
    Call an LLM to synthesize a high-quality connection explanation.
    Only runs when LLM_EXPLANATION_ENABLED is True.

    Stub implementation: returns None (falls back to template reason).
    Real implementation: POST to anthropic /v1/messages with a
    prompt that includes both objects' titles + body excerpts.
    """
    if not LLM_EXPLANATION_ENABLED:
        return None
    # TODO: implement Anthropic API call
    # prompt = f"In one sentence, explain the conceptual connection between:
    # A: {obj_a.title} - {obj_a.body[:200]}
    # B: {obj_b.title} - {obj_b.body[:200]}"
    return None
```

In `find_topic_connections`, try LLM first, fall back to template:
```python
reason = _llm_explanation(obj, other) or _synthesize_topic_reason(...)
```

**Deliverable:** Create 5 notes with related content. Run engine. Check
Edge reasons in Django admin. They should read like natural language,
not keyword lists.

---

## Phase 11: Project Forking

**Files:** `views.py`, `models.py` (migrations already done in Phase 1)

### 11a. Add fork action to ProjectViewSet

```python
@action(detail=True, methods=['post'], url_path='fork')
def fork(self, request, slug=None):
    """
    POST /api/v1/notebook/projects/<slug>/fork/

    Deep-copies a Project and all its Objects into a new Project.
    Records parent_sha for lineage tracking.
    """
    from .models import Node, Timeline, _generate_sha

    source = self.get_object()
    new_name = request.data.get('name', f'{source.name} (fork)')

    # Create forked project
    forked = Project.objects.create(
        name=new_name,
        notebook=source.notebook,
        description=source.description,
        status='active',
        parent_sha=source.sha_hash,
        mode=source.mode,
        template_layout=source.template_layout,
    )

    # Deep-copy Objects
    original_objects = source.project_objects.filter(is_deleted=False)
    for obj in original_objects:
        Object.objects.create(
            title=obj.title,
            object_type=obj.object_type,
            body=obj.body,
            url=obj.url,
            properties=obj.properties,
            og_title=obj.og_title,
            og_description=obj.og_description,
            og_image=obj.og_image,
            og_site_name=obj.og_site_name,
            notebook=forked.notebook,
            project=forked,
            status=obj.status,
            capture_method='auto',
        )

    # Create PROJECT_CREATED Node with fork lineage
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
```

**Deliverable:** POST to `/api/v1/notebook/projects/<slug>/fork/` creates
a new project with all objects copied and a timeline node recording the fork.

---

## Phase 12: Seed Data and Sample Objects

**Files:** `management/commands/seed_commonplace.py`

Create a seed command that populates the database with useful test data.

```python
from django.core.management.base import BaseCommand
from apps.notebook.models import ObjectType, ComponentType, Timeline, Notebook

OBJECT_TYPES = [
    {'name': 'Note', 'slug': 'note', 'icon': 'note-pencil', 'color': '#D4CCC4', 'is_built_in': True, 'sort_order': 1},
    {'name': 'Source', 'slug': 'source', 'icon': 'book-open', 'color': '#2D5F6B', 'is_built_in': True, 'sort_order': 2},
    {'name': 'Person', 'slug': 'person', 'icon': 'person', 'color': '#B45A2D', 'is_built_in': True, 'sort_order': 3},
    {'name': 'Place', 'slug': 'place', 'icon': 'map-pin', 'color': '#C49A4A', 'is_built_in': True, 'sort_order': 4},
    {'name': 'Organization', 'slug': 'organization', 'icon': 'building', 'color': '#5A7A4A', 'is_built_in': True, 'sort_order': 5},
    {'name': 'Concept', 'slug': 'concept', 'icon': 'lightbulb', 'color': '#7A5A8A', 'is_built_in': True, 'sort_order': 6},
    {'name': 'Event', 'slug': 'event', 'icon': 'calendar', 'color': '#4A6A8A', 'is_built_in': True, 'sort_order': 7},
    {'name': 'Hunch', 'slug': 'hunch', 'icon': 'sparkle', 'color': '#B45A6A', 'is_built_in': True, 'sort_order': 8},
    {'name': 'Quote', 'slug': 'quote', 'icon': 'quotes', 'color': '#C4884A', 'is_built_in': True, 'sort_order': 9},
    {'name': 'Task', 'slug': 'task', 'icon': 'check-circle', 'color': '#C46A3A', 'is_built_in': True, 'sort_order': 10},
    {'name': 'Script', 'slug': 'script', 'icon': 'code', 'color': '#6A7A8A', 'is_built_in': True, 'sort_order': 11},
]

COMPONENT_TYPES = [
    {'name': 'Text', 'slug': 'text', 'data_type': 'text', 'triggers_node': False, 'is_built_in': True},
    {'name': 'Date', 'slug': 'date', 'data_type': 'date', 'triggers_node': True, 'is_built_in': True},
    {'name': 'Recurring Date', 'slug': 'recurring-date', 'data_type': 'recurring_date', 'triggers_node': True, 'is_built_in': True},
    {'name': 'Relationship', 'slug': 'relationship', 'data_type': 'relationship', 'triggers_node': True, 'is_built_in': True},
    {'name': 'URL', 'slug': 'url', 'data_type': 'url', 'triggers_node': False, 'is_built_in': True},
    {'name': 'Author', 'slug': 'author', 'data_type': 'text', 'triggers_node': False, 'is_built_in': True},
    {'name': 'Status', 'slug': 'status', 'data_type': 'status', 'triggers_node': True, 'is_built_in': True},
    {'name': 'Tag', 'slug': 'tag', 'data_type': 'tag', 'triggers_node': False, 'is_built_in': True},
    {'name': 'Number', 'slug': 'number', 'data_type': 'number', 'triggers_node': False, 'is_built_in': True},
]

class Command(BaseCommand):
    help = 'Seed built-in ObjectTypes, ComponentTypes, and master Timeline.'

    def handle(self, *args, **options):
        for data in OBJECT_TYPES:
            _, created = ObjectType.objects.get_or_create(slug=data['slug'], defaults=data)
            self.stdout.write(f'{"Created" if created else "Exists"}: ObjectType {data["name"]}')

        for data in COMPONENT_TYPES:
            _, created = ComponentType.objects.get_or_create(slug=data['slug'], defaults=data)
            self.stdout.write(f'{"Created" if created else "Exists"}: ComponentType {data["name"]}')

        timeline, created = Timeline.objects.get_or_create(
            is_master=True,
            defaults={'name': 'Master Timeline', 'slug': 'master'},
        )
        self.stdout.write(f'{"Created" if created else "Exists"}: Master Timeline')

        self.stdout.write(self.style.SUCCESS('Seed complete.'))
```

**Deliverable:** `python manage.py seed_commonplace` runs without errors.
All built-in types appear in Django admin and in `/api/v1/notebook/object-types/`.

---

## Phase 13: Auto-Objectification Guard

**Files:** `engine.py`

The `auto_objectify` function currently creates Objects silently for any
extracted PERSON or ORG entity. This will produce garbage at scale.

### 13a. Add confidence threshold and deduplication

```python
AUTO_OBJECTIFY_MIN_LENGTH = 4  # Skip entities shorter than this
AUTO_OBJECTIFY_CONFIDENCE_THRESHOLD = 0.7  # Require entity confidence > 0.7 if available

def auto_objectify(obj: Object) -> list[Object]:
    """
    Auto-create Objects for high-confidence PERSON/ORG entities.

    Guards:
    - Entity text must be >= 4 characters
    - Entity must not be a common stop-word or single word if it's a person
    - Case-insensitive deduplication: "New York" and "new york" resolve to same Object
    - Only PERSON and ORG types (not GPE/LOC: too noisy)
    """
    entities = ResolvedEntity.objects.filter(
        source_object=obj,
        resolved_object__isnull=True,
        entity_type__in=['PERSON', 'ORG'],
    )

    created_objects = []

    for entity in entities:
        # Skip short/low-quality entities
        if len(entity.text.strip()) < AUTO_OBJECTIFY_MIN_LENGTH:
            continue
        if entity.text.strip().lower() in STOP_WORDS:
            continue

        target_type_slug = ENTITY_TO_OBJECT_TYPE.get(entity.entity_type)
        if not target_type_slug:
            continue

        # Case-insensitive deduplication
        existing = Object.objects.filter(
            object_type__slug=target_type_slug,
            is_deleted=False,
        ).filter(
            Q(title__iexact=entity.text.strip())
            | Q(title__icontains=entity.normalized_text)
        ).first()

        if existing:
            entity.resolved_object = existing
            entity.save(update_fields=['resolved_object'])
            continue

        object_type = ObjectType.objects.filter(slug=target_type_slug).first()
        if not object_type:
            continue

        new_obj = Object.objects.create(
            title=entity.text.strip(),
            object_type=object_type,
            body=f'Auto-created from mention in: {obj.display_title}',
            status='active',
            capture_method='auto',
            notebook=obj.notebook,  # Inherit notebook context
        )

        entity.resolved_object = new_obj
        entity.save(update_fields=['resolved_object'])

        Edge.objects.get_or_create(
            from_object=obj,
            to_object=new_obj,
            edge_type='mentions',
            defaults={
                'reason': f'{obj.display_title[:40]} mentions {entity.text}.',
                'strength': 0.7,
                'is_auto': True,
                'engine': 'spacy',
            },
        )

        created_objects.append(new_obj)

    return created_objects
```

**Deliverable:** Create a note mentioning "New York" and "she". Verify that
"New York" creates a Place Object but "she" does not.

---

## Phase 14: URL Pattern Audit

**Files:** `urls.py`

Verify all required endpoints are registered. The complete URL set should include:

```python
# ViewSets via router
router.register('object-types', ObjectTypeViewSet, basename='object-type')
router.register('component-types', ComponentTypeViewSet, basename='component-type')
router.register('objects', ObjectViewSet, basename='object')
router.register('components', ComponentViewSet, basename='component')
router.register('nodes', NodeViewSet, basename='node')
router.register('edges', EdgeViewSet, basename='edge')
router.register('notebooks', NotebookViewSet, basename='notebook')
router.register('projects', ProjectViewSet, basename='project')
router.register('timelines', TimelineViewSet, basename='timeline')
router.register('layouts', LayoutViewSet, basename='layout')
router.register('daily-logs', DailyLogViewSet, basename='daily-log')

# Custom endpoints
path('capture/', views.quick_capture_view, name='capture'),
path('feed/', views.timeline_feed_view, name='timeline-feed'),
path('graph/', views.graph_data_view, name='graph-data'),
path('resurface/', views.resurface_view, name='resurface'),
path('resurface/dismiss/', views.resurface_dismiss_view, name='resurface-dismiss'),
path('notebooks/<slug>/engine-config/', views.notebook_engine_config_view, name='notebook-engine-config'),
```

Run `python manage.py show_urls | grep notebook` to verify all paths resolve.

---

## Frontend Connection Points

> The frontend is a Next.js app in `src/app/(commonplace)/`.
> These are the API contracts the frontend reads from. Do not change
> these shapes once the frontend components are built.

### Endpoints the frontend depends on (do not change signatures after Phase 14)

| Frontend Component | Endpoint | Method | Notes |
|-------------------|----------|--------|-------|
| Capture bar | `/api/v1/notebook/capture/` | POST | `{content, hint_type, notebook_slug}` |
| Timeline view | `/api/v1/notebook/feed/` | GET | `{days: [{date, nodes}], total, page}` |
| Network/D3 graph | `/api/v1/notebook/graph/` | GET | `{nodes: [{id: "object:pk", ...}], edges}` |
| Object detail panel | `/api/v1/notebook/objects/<slug>/` | GET | `{connections, history, projects, notebooks}` |
| Resurface view | `/api/v1/notebook/resurface/` | GET | `{cards: [{object, signal, explanation}]}` |
| Sidebar: notebook list | `/api/v1/notebook/notebooks/` | GET | Standard DRF list |
| Sidebar: project list | `/api/v1/notebook/projects/` | GET | Standard DRF list |
| Sidebar: object types | `/api/v1/notebook/object-types/` | GET | For + palette |
| Novelty dial | `/api/v1/notebook/notebooks/<slug>/engine-config/` | PATCH | `{novelty: 0.0-1.0}` |
| Soft delete | `/api/v1/notebook/objects/<slug>/delete/` | POST | `{reason: "optional"}` |
| Retrospective add | `/api/v1/notebook/nodes/<pk>/retrospective/` | POST | `{text: "..."}` |
| Manual edge | `/api/v1/notebook/edges/` | POST | `{from_object, to_object, reason, edge_type}` |
| Layout save | `/api/v1/notebook/layouts/` | POST/PATCH | Pane tree JSON |
| Project fork | `/api/v1/notebook/projects/<slug>/fork/` | POST | `{name: "..."}` |

### Node ID format used throughout the frontend

All Object IDs in graph and timeline responses use `"object:<pk>"` prefix.
When the frontend navigates to an Object detail, it strips the prefix and
calls `/api/v1/notebook/objects/<pk>/` or `/api/v1/notebook/objects/<slug>/`.

### CORS

Confirm `CORS_ALLOWED_ORIGINS` in `config/settings/` includes `http://localhost:3000`
and the Vercel production domain for the Next.js app. Without this, every
frontend API call fails with a CORS error.

---

## Testing Checklist (Manual, Before Each Phase is Complete)

Use curl or the DRF browsable API at `http://localhost:8000/api/v1/notebook/`.

```bash
# Phase 1
python manage.py check
python manage.py seed_commonplace

# Phase 2
curl -X POST http://localhost:8000/api/v1/notebook/objects/test-object/delete/
# Verify object has is_deleted=True in admin, still exists in DB

# Phase 3
time curl -X POST http://localhost:8000/api/v1/notebook/capture/ \
  -H "Content-Type: application/json" \
  -d '{"content": "https://example.com"}'
# Should return in < 500ms

# Phase 4
curl -X POST http://localhost:8000/api/v1/notebook/capture/ \
  -H "Content-Type: application/json" \
  -d '{"content": "What if parking lots are misclassified public squares?", "hint_type": "hunch"}'
# Returns {object: {object_type: "hunch"}, inferred_type: "hunch"}

# Phase 5
curl http://localhost:8000/api/v1/notebook/graph/
# Node IDs must be "object:42" format, not plain integers

# Phase 6
curl http://localhost:8000/api/v1/notebook/feed/
# Must return {days: [{date: "...", nodes: [...]}]}

# Phase 7
curl http://localhost:8000/api/v1/notebook/objects/some-slug/
# Must include connections[], history[], projects[], notebooks[]

# Phase 8
curl "http://localhost:8000/api/v1/notebook/resurface/?count=3"
# Must return {cards: [{object, signal, explanation}]}

# Phase 9
curl -X PATCH http://localhost:8000/api/v1/notebook/notebooks/research/engine-config/ \
  -H "Content-Type: application/json" \
  -d '{"novelty": 0.8}'

# Phase 10
python manage.py run_engine_all --limit 10
# Edge reasons should read as natural language

# Phase 12
python manage.py seed_commonplace
curl http://localhost:8000/api/v1/notebook/object-types/
# Should list all 11 built-in types with correct colors/icons
```

---

## Known Issues to Address (Not Phased)

These are smaller issues found in the current code. Fix in whichever phase
is most related.

1. **DailyLog signal double-fires** on Object save: `log_object_activity`
   and `create_object_node` are both `post_save` receivers on Object.
   Both fire on every save. The modification Node should only fire on
   explicit updates (handled in Phase 2), not on engine-driven saves
   like `enrich_url()` which also triggers a save.

2. **Edge `related` type missing from choices**: `signals.py` creates
   edges with `edge_type='related'` but `Edge.edge_type` choices do
   not include `'related'`. This will cause a DB constraint error on
   some backends. Add it in Phase 1.

3. **`enrich_url` uses raw regex, not BeautifulSoup**: The OG scraper
   in `services.py` uses regex on raw HTML. This will silently miss
   a lot of tags. Consider adding `beautifulsoup4` to `requirements.txt`
   and doing `from bs4 import BeautifulSoup` for the enrichment parse.
   Not blocking but will affect source capture quality.

4. **`ObjectViewSet.get_object()` does not handle is_deleted**:
   Currently `get_object_or_404` will find deleted Objects. Add
   `.filter(is_deleted=False)` to the queryset in `get_queryset()`
   but allow admin-level views to override with `?include_deleted=true`.

5. **No explicit API versioning prefix check**: The DRF router is
   presumably mounted at `/api/v1/notebook/` but verify in
   `config/urls.py` that this is correct and matches what the
   frontend expects.

---

## After All Phases: Pre-Production Checklist

- [ ] All 14 phases completed and manually tested
- [ ] `python manage.py seed_commonplace` idempotent (run twice, no duplicates)
- [ ] CORS configured for production Vercel domain
- [ ] `DEBUG=False` does not break any endpoint
- [ ] spaCy model downloaded on Railway: add `python -m spacy download en_core_web_sm` to Procfile or Railway build command
- [ ] `python manage.py run_engine_all` completes without errors on production DB
- [ ] Django admin accessible and all models visible
- [ ] No hard `Object.objects.delete()` calls anywhere in the codebase (search: `grep -r "\.delete()" apps/notebook/`)

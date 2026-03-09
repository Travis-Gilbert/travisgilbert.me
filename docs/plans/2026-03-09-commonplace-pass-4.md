# CommonPlace Redesign: Pass 4 (Data Canvas, PyTensor, SSE Push, Search, Export)

> With Redis, S3, and Modal in place, these features are now unblocked.
> Data visualization, probabilistic models, real-time push, full-text search,
> data export, and offline resilience.
>
> **Prerequisite:** Passes 1-3 complete. Redis, S3, Modal configured.

---

## Batch 18: Data Canvas (Altair/Vega-Lite)

### Overview

See the full spec in `2026-03-08-commonplace-data-canvas.md`. This batch
implements the core: data extraction from Objects, 8 visualization templates,
Vega-Lite rendering, and save-as-Object flow.

### Key files

| File | Purpose |
|---|---|
| `research_api/apps/notebook/canvas_engine.py` (NEW) | Extract structured data from Objects, infer field types, generate Altair specs |
| `research_api/apps/notebook/canvas_templates.py` (NEW) | 8 built-in visualization templates (timeline, type distribution, connection density, entity co-occurrence, capture heatmap, knowledge growth, vocabulary frequency, custom scatter) |
| `src/components/commonplace/DataCanvas.tsx` (NEW) | Template picker + field mapper + save flow |
| `src/components/commonplace/VegaLiteChart.tsx` (NEW) | Thin Vega-Lite renderer with Patent Parchment theming |

### API

- `POST /api/v1/notebook/canvas/suggest/` - Accepts `object_ids[]`, returns suggested specs
- `POST /api/v1/notebook/canvas/generate/` - Accepts template ID + field mappings, returns custom spec
- `POST /api/v1/notebook/canvas/save/` - Saves visualization as a new Object (type: visualization)

### Frontend integration

Data Canvas is a new view mode alongside Grid, Timeline, Graph. Chart icon in header.
When clicked with active filters, it auto-suggests visualizations for the filtered set.

### Altair theme

All charts use Patent Parchment colors and fonts (Vollkorn titles, Cabin body,
Courier Prime axis labels, terracotta/teal/gold/purple category palette).
See the full theme definition in the data canvas spec.

### Verification

- [ ] 8 templates generate valid Vega-Lite specs
- [ ] Charts render with Patent Parchment theming
- [ ] Tooltips work on all chart types
- [ ] Save-as-Object creates a visualization Object with the spec
- [ ] `npm run build` passes

---

## Batch 19: PyMC/PyTensor Probabilistic Models

### Overview

With enough historical data (100+ Objects, 30+ days of use), PyMC models
can provide predictive intelligence on top of the deterministic connection engine.

### Dependencies

```
# requirements/analytics.txt (optional, heavy)
pymc>=5.10.0
pytensor>=2.18.0
arviz>=0.17.0
```

These are large dependencies (PyTensor compiles C code). They should NOT
be in base.txt. Create a separate requirements file and install only on
environments that will run analytics. The RQ worker is the right place
(it already has PyTorch for SBERT).

### Models

**Model 1: Capture Rate Changepoint Detection**

Detects "research bursts" where daily capture count spikes above baseline.
Uses a Bayesian changepoint model (PyMC switchpoint).

```python
import pymc as pm

with pm.Model() as capture_model:
    # Prior: baseline rate and burst rate
    baseline = pm.Exponential('baseline', lam=1/3)  # ~3 captures/day
    burst = pm.Exponential('burst', lam=1/8)        # ~8 captures/day
    switchpoint = pm.DiscreteUniform('switchpoint', lower=0, upper=n_days)

    rate = pm.math.switch(switchpoint >= day_index, baseline, burst)
    captures = pm.Poisson('captures', mu=rate, observed=daily_counts)

    trace = pm.sample(2000, return_inferencedata=True)
```

Output: posterior probability of being in a "burst" state on any given day.
Visualized in the Data Canvas as a shaded region on the Knowledge Growth chart.

**Model 2: Hunch Graduation Prediction**

Logistic regression predicting the probability that a Hunch will become an essay.
Features: days since capture, number of connected Sources, body length, entity count.

```python
with pm.Model() as graduation_model:
    # Priors
    beta_days = pm.Normal('beta_days', mu=0, sigma=1)
    beta_sources = pm.Normal('beta_sources', mu=0, sigma=1)
    beta_length = pm.Normal('beta_length', mu=0, sigma=1)
    intercept = pm.Normal('intercept', mu=-2, sigma=2)

    logit_p = (intercept +
               beta_days * days_since_capture +
               beta_sources * source_count +
               beta_length * body_length_normalized)

    p = pm.math.sigmoid(logit_p)
    graduated = pm.Bernoulli('graduated', p=p, observed=graduation_labels)

    trace = pm.sample(2000, return_inferencedata=True)
```

Output: probability that each active Hunch will graduate. Hunches above 70%
get a "Ready to graduate?" prompt via the contextual retrospective system.

**Model 3: Connection Strength Temporal Decay**

Edge strengths currently are static. This model introduces time-based decay
that weakens connections you haven't revisited and strengthens connections
you keep engaging with.

```python
with pm.Model() as decay_model:
    half_life = pm.HalfNormal('half_life', sigma=30)  # days
    reinforcement = pm.Exponential('reinforcement', lam=1/0.1)

    decayed_strength = original_strength * pm.math.exp(
        -0.693 * days_since_last_touch / half_life
    )
    reinforced_strength = decayed_strength + reinforcement * touch_count

    observed_engagement = pm.Normal(
        'engagement',
        mu=reinforced_strength,
        sigma=0.1,
        observed=actual_engagement,
    )
```

Output: adjusted edge strengths that the Resurface engine uses as signals.
Decayed connections become Resurface candidates ("You haven't visited this
connection in 45 days. Still relevant?").

### Integration points

- Canvas templates can show PyMC posterior distributions as uncertainty bands
- Resurface signals incorporate graduation probability and decay scores
- Contextual retrospective prompts triggered by model thresholds
- All models run as RQ tasks on the `engine` queue (not real-time)

### Verification

- [ ] Capture rate model detects simulated burst in test data
- [ ] Graduation model produces probabilities for active Hunches
- [ ] Decay model adjusts edge strengths based on time
- [ ] Results integrate with Data Canvas charts
- [ ] `python manage.py test` passes

---

## Batch 20: Server-Sent Events (Real-Time Push)

### Overview

When the connection engine discovers new edges after saving an Object,
push the results to the open Live Research Graph panel (or the grid)
without requiring a manual refresh.

### Architecture

Django SSE (not WebSockets). Simpler, no Channels dependency, works through
Railway's proxy. Redis pub/sub for the message bus.

```python
# apps/notebook/sse_views.py (NEW)
import json
import time

from django.http import StreamingHttpResponse
from django_rq import get_queue


def sse_connection_updates(request, notebook_slug=''):
    """
    SSE endpoint: streams new connection events to the frontend.

    The client opens a persistent connection:
      const es = new EventSource('/api/v1/notebook/sse/connections/');
      es.onmessage = (e) => { const data = JSON.parse(e.data); ... };

    The engine task publishes to Redis pub/sub when it creates new edges.
    This view subscribes and forwards events to the client.
    """
    import redis as redis_lib
    from django.conf import settings

    r = redis_lib.from_url(settings.REDIS_URL)
    pubsub = r.pubsub()
    channel = f'connections:{notebook_slug}' if notebook_slug else 'connections:*'
    pubsub.psubscribe(channel)

    def event_stream():
        yield 'retry: 5000\n\n'  # Reconnect after 5s on disconnect
        for message in pubsub.listen():
            if message['type'] == 'pmessage':
                data = message['data']
                if isinstance(data, bytes):
                    data = data.decode()
                yield f'data: {data}\n\n'

    response = StreamingHttpResponse(
        event_stream(),
        content_type='text/event-stream',
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'  # Disable nginx buffering
    return response
```

**Publishing from the engine task:**
```python
# In tasks.py, after run_engine completes:
import redis as redis_lib
from django.conf import settings

r = redis_lib.from_url(settings.REDIS_URL)
r.publish(f'connections:{notebook_slug}', json.dumps({
    'type': 'new_edges',
    'object_id': obj.pk,
    'object_title': obj.title,
    'edge_count': new_edge_count,
    'edges': [{'target_title': e.to_object.title, 'reason': e.reason} for e in new_edges],
}))
```

**Frontend hook:**
```typescript
function useConnectionSSE(notebookSlug?: string) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const url = `/api/v1/notebook/sse/connections/${notebookSlug || ''}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setEvents(prev => [data, ...prev].slice(0, 20));
      // Trigger Sonner toast
      toast(`${data.edge_count} new connections found for "${data.object_title}"`);
    };
    return () => es.close();
  }, [notebookSlug]);

  return events;
}
```

### Verification

- [ ] SSE endpoint streams events from Redis pub/sub
- [ ] Engine task publishes after edge creation
- [ ] Frontend receives events and shows Sonner toasts
- [ ] Live Research Graph updates when SSE fires
- [ ] `npm run build` passes

---

## Batch 21: Postgres Full-Text Search

### Overview

The command palette needs server-side ranked search. With 1000+ Objects,
client-side filtering is too slow.

### Migration

```python
from django.contrib.postgres.search import SearchVectorField
from django.contrib.postgres.indexes import GinIndex

class Migration(migrations.Migration):
    operations = [
        migrations.AddField(
            model_name='object',
            name='search_vector',
            field=SearchVectorField(null=True),
        ),
        migrations.AddIndex(
            model_name='object',
            index=GinIndex(fields=['search_vector'], name='idx_obj_fts'),
        ),
    ]
```

### Signal to update on save

```python
from django.contrib.postgres.search import SearchVector

@receiver(post_save, sender=Object)
def update_search_vector(sender, instance, **kwargs):
    Object.objects.filter(pk=instance.pk).update(
        search_vector=(
            SearchVector('title', weight='A') +
            SearchVector('body', weight='B') +
            SearchVector('search_text', weight='C')
        )
    )
```

### Search endpoint

```python
from django.contrib.postgres.search import SearchQuery, SearchRank

class SearchView(APIView):
    def get(self, request):
        q = request.query_params.get('q', '')
        if not q:
            return Response({'results': []})
        query = SearchQuery(q, search_type='websearch')
        results = (
            Object.objects
            .filter(search_vector=query, is_deleted=False)
            .annotate(rank=SearchRank('search_vector', query))
            .order_by('-rank')
            [:20]
        )
        return Response({
            'results': ObjectSearchSerializer(results, many=True).data
        })
```

### Verification

- [ ] Search vector field populated on Object save
- [ ] GIN index created in migration
- [ ] Search endpoint returns ranked results
- [ ] Command palette uses server-side search for 100+ objects
- [ ] `python manage.py test` passes

---

## Batch 22: Data Export

### Overview

`GET /api/v1/notebook/export/` returns a ZIP containing all user data.
Table stakes for SaaS trust.

### Contents of the ZIP

```
commonplace-export-2026-03-09/
  manifest.json          # Export metadata (date, version, counts)
  objects.json           # All Objects with components
  edges.json             # All Edges with explanations
  nodes.json             # All Timeline Nodes
  notebooks.json         # All Notebooks with config
  projects.json          # All Projects
  files/                 # Original uploaded files from S3
    {sha_hash}/
      filename.pdf
      filename.docx
  visualizations/        # Saved Data Canvas specs
    {slug}.json
```

### Implementation

```python
@api_view(['GET'])
def export_data(request):
    """Generate and return a ZIP of all user data."""
    import io
    import json
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Objects
        objects = Object.objects.filter(is_deleted=False)
        zf.writestr('objects.json', json.dumps(
            ObjectExportSerializer(objects, many=True).data, indent=2
        ))

        # Edges
        edges = Edge.objects.all()
        zf.writestr('edges.json', json.dumps(
            EdgeExportSerializer(edges, many=True).data, indent=2
        ))

        # ... nodes, notebooks, projects, files from S3

        # Manifest
        zf.writestr('manifest.json', json.dumps({
            'exported_at': timezone.now().isoformat(),
            'version': '1.0',
            'object_count': objects.count(),
            'edge_count': edges.count(),
        }, indent=2))

    buf.seek(0)
    response = HttpResponse(buf.read(), content_type='application/zip')
    response['Content-Disposition'] = (
        f'attachment; filename="commonplace-export-{timezone.now().date()}.zip"'
    )
    return response
```

### Verification

- [ ] Export endpoint generates valid ZIP
- [ ] ZIP contains objects, edges, nodes, notebooks, projects
- [ ] Files from S3 are included
- [ ] Manifest has correct counts
- [ ] `python manage.py test` passes

---

## Batch 23: Offline Resilience (IndexedDB Capture Queue)

### Overview

If the API is down, captures should persist locally and sync when connectivity
returns. Currently, unsynced captures live in React state and are lost on
page refresh.

### Frontend: IndexedDB persistence

```bash
npm install idb-keyval
```

```typescript
import { get, set, del, keys } from 'idb-keyval';

// On capture (before API sync):
await set(`capture:${object.id}`, object);

// On sync success:
await del(`capture:${object.id}`);

// On page load, check for unsynced captures:
const allKeys = await keys();
const unsyncedKeys = allKeys.filter(k => String(k).startsWith('capture:'));
for (const key of unsyncedKeys) {
  const obj = await get(key);
  syncCapture(obj);  // retry
}
```

### Verification

- [ ] Captures persist in IndexedDB before API sync
- [ ] Unsynced captures retry on page load
- [ ] Successfully synced captures are removed from IndexedDB
- [ ] `npm run build` passes

---

## Batch 24: Keyboard Shortcuts Registry

### Overview

A `?` shortcut that opens a shortcuts cheat sheet (like GitHub's).

### Shortcuts to register

| Shortcut | Action |
|---|---|
| `Cmd+K` | Command palette |
| `Cmd+N` | New capture (open compose) |
| `Cmd+G` | Toggle graph view |
| `Cmd+T` | Toggle timeline view |
| `Cmd+D` | Toggle Data Canvas |
| `Escape` | Close drawer/palette/compose |
| `?` | Show shortcuts cheat sheet |
| `J/K` | Navigate cards (down/up) |
| `Enter` | Open selected card |
| `Cmd+E` | Edit selected object |

### Verification

- [ ] All shortcuts work
- [ ] `?` opens cheat sheet overlay
- [ ] No conflicts with browser shortcuts
- [ ] `npm run build` passes

---

## Implementation Order (Pass 4)

1. **Batch 21:** Full-text search (unblocks command palette at scale)
2. **Batch 18:** Data Canvas (biggest feature, self-contained)
3. **Batch 20:** SSE push (needs Redis, unblocks live updates)
4. **Batch 22:** Data export (independent, trust-building)
5. **Batch 23:** Offline resilience (independent, reliability)
6. **Batch 24:** Keyboard shortcuts (polish)
7. **Batch 19:** PyMC models (research direction, needs data)

---

## Architecture Diagram (Post-Pass 4)

```
                    Vercel
                      |
              Next.js 16 Frontend
              (Grid, Timeline, Graph,
               Compose, Data Canvas)
                      |
                      | REST API + SSE
                      |
              Railway: Django REST
              (research_api)
                 /    |    \
                /     |     \
    Postgres   Redis   S3 (AWS)
    (data)    (cache,  (files,
              queues,  thumbnails)
              pub/sub)
                |
          RQ Worker (same container)
          - engine queue
          - ingestion queue
          - default queue
                |
          Modal (GPU, optional)
          - SAM-2 image analysis
          - Future: heavy NLP
```

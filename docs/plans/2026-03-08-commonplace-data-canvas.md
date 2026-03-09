# CommonPlace Feature: Data Canvas (Altair/Vega-Lite Visualization Builder)

> Let users shape their captured knowledge into data visualizations,
> statistical models, and analytical patterns.
>
> Built on Vega/Vega-Lite (rendered client-side) with an Altair-powered
> backend that generates specs from Object data.
>
> Phase: Post-launch. Requires Passes 1-3 and infrastructure (Redis, S3).

---

## What This Feature Is

CommonPlace users capture structured and semi-structured knowledge: Sources
with authors and dates, Places with coordinates and populations, Events with
timelines, People with roles and organizations. Right now this data lives
as text in Object bodies and JSON in Components. The Data Canvas turns it
into interactive visualizations.

The user selects a set of Objects (via the existing grid filters, a Notebook,
or a Project), chooses a visualization template, and the system generates a
Vega-Lite spec from the Object data. The visualization renders in a dedicated
pane. Users can modify mappings, add derived fields, and save visualizations
as first-class Objects (type: "visualization") in their knowledge graph.

**Why this is valuable for the CommonPlace user:**

Investigation work produces data. An urban planning researcher capturing
zoning changes, building permits, and council meeting minutes across 40
Objects is sitting on a dataset. Today they would export to a spreadsheet
and build charts there. Data Canvas keeps the analysis inside the knowledge
graph, connected to the source Objects, with the full connection engine
running on the visualization itself.

A visualization Object can connect to the Sources it was derived from.
A Hunch about "parking lot construction peaked in the 1960s" can be
tested against captured data without leaving CommonPlace.

---

## Architecture

### Why Altair + Vega-Lite (not D3 directly)

The existing graph views (KnowledgeMap, SourceGraph) use D3 directly.
That works for force-directed network graphs where you need full control.
But for statistical/analytical visualizations (bar charts, scatter plots,
timelines, heatmaps, regressions), D3 requires hundreds of lines of
imperative code per chart type. Vega-Lite is declarative: one JSON spec
produces the entire chart. Altair generates those specs from Python.

The split:
- **Backend (Altair):** Transforms Object data into Vega-Lite JSON specs.
  Handles data wrangling, field inference, aggregation, and template matching.
- **Frontend (Vega-Lite embed):** Renders the spec as an interactive SVG.
  Handles tooltips, selection, zoom, and export.

This means the frontend is thin (just a Vega-Lite renderer) and the
intelligence (what visualization fits this data) lives in Python where
the Object data already is.

### Data Flow

```
User selects Objects (via grid filter, Notebook, or Project)
     |
     v
POST /api/v1/notebook/canvas/suggest/
  { object_ids: [1, 2, 3, ...], hint?: "timeline" }
     |
     v
canvas_engine.py:
  1. Extract structured fields from Objects + Components
  2. Infer field types (temporal, categorical, quantitative, geographic)
  3. Match to visualization templates
  4. Generate Vega-Lite spec via Altair
     |
     v
Response: { specs: [{ type, title, description, vega_lite_spec }] }
     |
     v
Frontend: VegaLiteCanvas.tsx renders the spec
User: modifies field mappings, saves as Object
```

---

## Backend: canvas_engine.py

### New file: `research_api/apps/notebook/canvas_engine.py`

**Dependencies:**
```
altair>=5.2.0
vl-convert-python>=1.1.0  # For server-side PNG export
```

### Step 1: Extract structured data from Objects

```python
def extract_canvas_data(object_ids: list[int]) -> dict:
    """
    Pull structured fields from a set of Objects into a flat table.

    Each Object contributes one row. Columns come from:
    - Object model fields: title, object_type, captured_at, body (length)
    - Component values: each Component key becomes a column
    - Edge data: edge_count, connected_types
    - Entity data: extracted entity names and types

    Returns:
      {
        'rows': [{ field: value, ... }, ...],
        'fields': {
          'field_name': {
            'type': 'temporal' | 'quantitative' | 'nominal' | 'ordinal',
            'source': 'model' | 'component' | 'edge' | 'entity',
          }
        }
      }
    """
    objects = (
        Object.objects
        .filter(pk__in=object_ids, is_deleted=False)
        .select_related('object_type')
        .prefetch_related('components', 'components__component_type',
                          'edges_out', 'edges_in', 'extracted_entities')
    )

    rows = []
    all_fields = {}

    for obj in objects:
        row = {
            'title': obj.title,
            'type': obj.object_type.slug if obj.object_type else 'note',
            'type_color': obj.object_type.color if obj.object_type else '#7A6E62',
            'captured_at': obj.captured_at.isoformat(),
            'body_length': len(obj.body),
            'edge_count': obj.edges_out.count() + obj.edges_in.count(),
        }

        # Components become columns
        for comp in obj.components.all():
            key = comp.key.lower().replace(' ', '_')
            value = comp.value
            # Try to parse dates and numbers from string values
            if isinstance(value, str):
                parsed = _try_parse_value(value)
                row[key] = parsed
            elif isinstance(value, dict):
                # Flatten one level
                for k, v in value.items():
                    row[f'{key}_{k}'] = v
            else:
                row[key] = value

        # Entities as a list
        entities = list(obj.extracted_entities.values_list('text', flat=True))
        row['entities'] = entities
        row['entity_count'] = len(entities)

        rows.append(row)

    # Infer field types
    for key in set().union(*(r.keys() for r in rows)):
        values = [r.get(key) for r in rows if r.get(key) is not None]
        all_fields[key] = {
            'type': _infer_vega_type(values),
            'source': _infer_source(key),
            'non_null_count': len(values),
        }

    return {'rows': rows, 'fields': all_fields}
```

### Step 2: Suggest visualizations

```python
import altair as alt

TEMPLATES = [
    {
        'id': 'timeline',
        'name': 'Timeline',
        'description': 'Objects plotted along a time axis',
        'requires': {'temporal': 1, 'nominal': 0},
        'build': _build_timeline_chart,
    },
    {
        'id': 'type_distribution',
        'name': 'Type Distribution',
        'description': 'Object counts by type',
        'requires': {'nominal': 1},
        'build': _build_type_bar_chart,
    },
    {
        'id': 'connection_scatter',
        'name': 'Connection Density',
        'description': 'Objects by capture date and edge count',
        'requires': {'temporal': 1, 'quantitative': 1},
        'build': _build_connection_scatter,
    },
    {
        'id': 'entity_network',
        'name': 'Entity Co-occurrence',
        'description': 'Which entities appear together across objects',
        'requires': {'nominal': 2},
        'build': _build_entity_heatmap,
    },
    {
        'id': 'capture_heatmap',
        'name': 'Capture Heatmap',
        'description': 'When you capture (day of week x hour)',
        'requires': {'temporal': 1},
        'build': _build_capture_heatmap,
    },
    {
        'id': 'component_scatter',
        'name': 'Custom Scatter',
        'description': 'Map any two numeric/date fields to axes',
        'requires': {'quantitative': 2},
        'build': _build_generic_scatter,
    },
    {
        'id': 'word_frequency',
        'name': 'Vocabulary Frequency',
        'description': 'Most common terms across selected objects',
        'requires': {},
        'build': _build_word_frequency,
    },
    {
        'id': 'growth_curve',
        'name': 'Knowledge Growth',
        'description': 'Cumulative object count over time',
        'requires': {'temporal': 1},
        'build': _build_growth_curve,
    },
]


def suggest_visualizations(data: dict, hint: str = '') -> list[dict]:
    """
    Match available templates to the extracted data fields.
    Returns a list of { id, name, description, vega_lite_spec } dicts.
    """
    field_types = {f['type'] for f in data['fields'].values()}
    type_counts = {}
    for f in data['fields'].values():
        type_counts[f['type']] = type_counts.get(f['type'], 0) + 1

    results = []
    for template in TEMPLATES:
        # Check if data has required field types
        reqs = template['requires']
        if all(type_counts.get(t, 0) >= count for t, count in reqs.items()):
            try:
                chart = template['build'](data)
                spec = chart.to_dict()
                results.append({
                    'id': template['id'],
                    'name': template['name'],
                    'description': template['description'],
                    'vega_lite_spec': spec,
                })
            except Exception as exc:
                logger.warning('Template %s failed: %s', template['id'], exc)

    # Sort by hint match first
    if hint:
        results.sort(key=lambda r: (0 if hint in r['id'] else 1))

    return results
```

### Step 3: Build specific chart types

```python
def _build_timeline_chart(data: dict) -> alt.Chart:
    """Objects plotted on a timeline, colored by type, sized by edge count."""
    import pandas as pd

    df = pd.DataFrame(data['rows'])
    df['captured_at'] = pd.to_datetime(df['captured_at'])

    chart = alt.Chart(df).mark_circle().encode(
        x=alt.X('captured_at:T', title='Captured'),
        y=alt.Y('type:N', title='Object Type'),
        size=alt.Size('edge_count:Q', title='Connections', scale=alt.Scale(range=[40, 400])),
        color=alt.Color('type_color:N', scale=None),
        tooltip=['title:N', 'type:N', 'edge_count:Q', 'captured_at:T'],
    ).properties(
        width=600,
        height=300,
        title='Object Timeline',
    ).configure(
        background='#F2EDE5',
        font='Cabin',
        title=alt.TitleParams(font='Vollkorn', fontSize=16, color='#2A2420'),
        axis=alt.AxisConfig(labelFont='Courier Prime', labelFontSize=10,
                            titleFont='Cabin', gridColor='#E4DCD4'),
    ).interactive()

    return chart


def _build_capture_heatmap(data: dict) -> alt.Chart:
    """Heatmap of capture activity by day of week and hour."""
    import pandas as pd

    df = pd.DataFrame(data['rows'])
    df['captured_at'] = pd.to_datetime(df['captured_at'])
    df['day'] = df['captured_at'].dt.day_name()
    df['hour'] = df['captured_at'].dt.hour

    heatmap_data = df.groupby(['day', 'hour']).size().reset_index(name='count')

    return alt.Chart(heatmap_data).mark_rect().encode(
        x=alt.X('hour:O', title='Hour of Day'),
        y=alt.Y('day:N', title='Day of Week',
                 sort=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']),
        color=alt.Color('count:Q', scale=alt.Scale(scheme='oranges'), title='Captures'),
        tooltip=['day:N', 'hour:O', 'count:Q'],
    ).properties(
        width=500,
        height=200,
        title='When You Capture',
    ).interactive()


def _build_entity_heatmap(data: dict) -> alt.Chart:
    """Co-occurrence matrix of entities across objects."""
    import pandas as pd
    from itertools import combinations

    # Build entity pairs
    pairs = []
    for row in data['rows']:
        entities = row.get('entities', [])
        for a, b in combinations(sorted(set(entities)), 2):
            pairs.append({'entity_a': a, 'entity_b': b})

    if not pairs:
        return alt.Chart(pd.DataFrame({'x': []})).mark_point()

    df = pd.DataFrame(pairs)
    co = df.groupby(['entity_a', 'entity_b']).size().reset_index(name='count')

    return alt.Chart(co).mark_rect().encode(
        x='entity_a:N',
        y='entity_b:N',
        color=alt.Color('count:Q', scale=alt.Scale(scheme='teals')),
        tooltip=['entity_a:N', 'entity_b:N', 'count:Q'],
    ).properties(
        width=400,
        height=400,
        title='Entity Co-occurrence',
    ).interactive()
```

---

## Frontend: VegaLiteCanvas.tsx

### Dependencies

```bash
npm install vega vega-lite vega-embed
```

### File: `src/components/commonplace/DataCanvas.tsx` (NEW)

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useCommonPlace } from '@/lib/commonplace-context';
import VegaLiteChart from './VegaLiteChart';

/**
 * Data Canvas: visualization builder for CommonPlace objects.
 *
 * User flow:
 * 1. Current grid filter determines which objects are included
 * 2. System suggests visualizations based on available data fields
 * 3. User picks a template
 * 4. Vega-Lite spec renders interactively
 * 5. User can modify field mappings
 * 6. User saves visualization as a new Object (type: visualization)
 */
export default function DataCanvas({ objectIds }: { objectIds: number[] }) {
  const [suggestions, setSuggestions] = useState([]);
  const [activeSpec, setActiveSpec] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/v1/notebook/canvas/suggest/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object_ids: objectIds }),
    });
    const data = await res.json();
    setSuggestions(data.specs);
    setLoading(false);
  }, [objectIds]);

  // ... template picker, field mapper, save-as-object flow
}
```

### File: `src/components/commonplace/VegaLiteChart.tsx` (NEW)

```typescript
'use client';

import { useEffect, useRef } from 'react';
import embed from 'vega-embed';

export default function VegaLiteChart({ spec }: { spec: object }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !spec) return;

    embed(containerRef.current, spec as any, {
      actions: { export: true, source: false, compiled: false },
      theme: 'quartz',
      config: {
        background: '#F2EDE5',
        font: 'Cabin',
        title: { font: 'Vollkorn', fontSize: 16, color: '#2A2420' },
        axis: {
          labelFont: 'Courier Prime',
          labelFontSize: 10,
          titleFont: 'Cabin',
          gridColor: '#E4DCD4',
        },
      },
    }).catch(console.error);
  }, [spec]);

  return <div ref={containerRef} />;
}
```

### View integration

The Data Canvas appears as a new view mode alongside Grid, Timeline, and Graph.
Button in the header: chart icon. When clicked:

1. If the current filter has objects selected, auto-fetch suggestions
2. Show a template picker with preview thumbnails
3. Selecting a template renders the full interactive chart
4. "Save as Object" creates a visualization Object with the spec as body
   and the source object IDs as Components

---

## Visualization Templates (Phase 1)

| Template | What it shows | Data requirements |
|---|---|---|
| Object Timeline | Objects on time axis, colored by type, sized by connections | At least 1 temporal field |
| Type Distribution | Bar chart of object counts by type | Any objects |
| Connection Density | Scatter: capture date vs edge count | Temporal + quantitative |
| Entity Co-occurrence | Heatmap of which entities appear together | Objects with extracted entities |
| Capture Heatmap | Day-of-week x hour activity matrix | Temporal |
| Knowledge Growth | Cumulative line chart over time | Temporal |
| Vocabulary Frequency | Bar chart of most common terms | Any objects with body text |
| Custom Scatter | User maps any two fields to axes | 2+ quantitative or temporal fields |

## Visualization Templates (Phase 2: Firecrawl data)

When Sources have been scraped by Firecrawl, the extracted data becomes
much richer. Additional templates:

| Template | What it shows |
|---|---|
| Source Timeline | Publication dates of Sources plotted on a timeline |
| Citation Network | Which Sources cite each other (from extracted references) |
| Publication Frequency | How often Sources from different publishers appear |
| Reading Chronology | When you captured each Source vs when it was published |
| Geographic Distribution | Places mentioned across Sources plotted on a map |

---

## Altair Theming (Patent Parchment)

All generated charts use the Patent Parchment design system:

```python
COMMONPLACE_THEME = {
    'config': {
        'background': '#F2EDE5',
        'font': 'Cabin',
        'title': {
            'font': 'Vollkorn',
            'fontSize': 16,
            'fontWeight': 600,
            'color': '#2A2420',
        },
        'axis': {
            'labelFont': 'Courier Prime',
            'labelFontSize': 10,
            'labelColor': '#6A5E52',
            'titleFont': 'Cabin',
            'titleFontSize': 12,
            'titleColor': '#2A2420',
            'gridColor': '#E4DCD4',
            'domainColor': '#D4CCC4',
        },
        'legend': {
            'labelFont': 'Cabin',
            'titleFont': 'Courier Prime',
            'labelFontSize': 11,
        },
        'range': {
            'category': [
                '#B45A2D',  # terracotta
                '#2D5F6B',  # teal
                '#C49A4A',  # gold
                '#8B6FA0',  # purple
                '#5A7A4A',  # green
                '#4A7A9A',  # blue
                '#B06080',  # pink
                '#C47A3A',  # orange
                '#6B7A8A',  # steel
            ],
        },
        'mark': {
            'opacity': 0.8,
        },
        'view': {
            'stroke': '#D4CCC4',
        },
    }
}

alt.themes.register('commonplace', lambda: COMMONPLACE_THEME)
alt.themes.enable('commonplace')
```

---

## PyMC Integration (Phase 3, Research Direction)

PyMC/PyTensor could extend the Data Canvas from descriptive visualization
to probabilistic modeling. Specific applications:

1. **Capture rate anomaly detection:** Bayesian changepoint model on daily
   capture counts. Detects "research bursts" where activity spikes.

2. **Connection strength decay:** Temporal model where edge strengths decay
   if not reinforced. PyMC estimates the decay rate from user behavior.

3. **Hunch graduation prediction:** Logistic regression where the features
   are: days since capture, number of connected Sources, body length growth.
   Predicts probability that a Hunch will become an essay.

4. **Topic evolution:** Latent Dirichlet Allocation (via PyMC) on Object
   body text over time. Shows how research topics shift.

These are genuinely advanced and require hundreds of Objects and months of
history to produce meaningful results. Flag as research direction, not launch
feature. The integration point is the canvas_engine.py file: each PyMC model
produces a posterior distribution that Altair can visualize as uncertainty
bands, density plots, or prediction intervals.

---

## Implementation Order

1. Backend: canvas_engine.py with extract_canvas_data + 8 templates
2. Backend: POST /api/v1/notebook/canvas/suggest/ endpoint
3. Frontend: VegaLiteChart.tsx (thin renderer)
4. Frontend: DataCanvas.tsx (template picker + field mapper)
5. Frontend: View mode integration (chart icon in header)
6. Altair theme (Patent Parchment colors and fonts)
7. Save-as-Object flow (visualization type)
8. Phase 2: Firecrawl-enriched templates
9. Phase 3: PyMC models (research direction)

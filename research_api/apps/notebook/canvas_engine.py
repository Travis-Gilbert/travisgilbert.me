"""
Canvas engine: transforms CommonPlace Object data into Vega-Lite visualization specs.

Altair generates declarative Vega-Lite JSON. The frontend renders specs via vega-embed.
All chart intelligence lives here; the frontend is a thin renderer.
"""
import logging
from datetime import datetime

import altair as alt

from .models import Object

logger = logging.getLogger(__name__)

# Patent Parchment Altair theme
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

_MODEL_FIELDS = frozenset({'title', 'type', 'type_color', 'captured_at', 'body_length', 'edge_count'})
_ENTITY_FIELDS = frozenset({'entities', 'entity_count'})


def _try_parse_value(value: str):
    """Try to parse a string as an ISO date or float; return the original string on failure."""
    for fmt in ('%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S%z'):
        try:
            return datetime.strptime(value.strip(), fmt)
        except ValueError:
            continue
    try:
        return float(value)
    except ValueError:
        pass
    return value


def _infer_vega_type(values: list) -> str:
    """Infer the Vega-Lite field type from a list of sample values."""
    if not values:
        return 'nominal'
    sample = [v for v in values if v is not None][:20]
    if all(isinstance(v, datetime) for v in sample):
        return 'temporal'
    if any(isinstance(v, str) and 'T' in v and v.count('-') >= 2 for v in sample[:3]):
        return 'temporal'
    if all(isinstance(v, (int, float)) for v in sample):
        return 'quantitative'
    if all(isinstance(v, list) for v in sample):
        return 'ordinal'
    return 'nominal'


def _infer_source(key: str) -> str:
    """Classify a field key by its origin in the data model."""
    if key in _MODEL_FIELDS:
        return 'model'
    if key in _ENTITY_FIELDS:
        return 'entity'
    return 'component'


def extract_canvas_data(object_ids: list) -> dict:
    """
    Pull structured fields from a set of Objects into a flat table.

    Each Object contributes one row. Columns come from:
    - Object model fields: title, object_type, captured_at, body (length)
    - Component values: each Component key becomes a column
    - Edge data: edge_count
    - Entity data: extracted entity names

    Returns:
      {
        'rows': [{ field: value, ... }, ...],
        'fields': {
          'field_name': {
            'type': 'temporal' | 'quantitative' | 'nominal' | 'ordinal',
            'source': 'model' | 'component' | 'entity',
            'non_null_count': int,
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

        for comp in obj.components.all():
            key = comp.key.lower().replace(' ', '_')
            value = comp.value
            if isinstance(value, str):
                parsed = _try_parse_value(value)
                row[key] = parsed
            elif isinstance(value, dict):
                for k, v in value.items():
                    row[f'{key}_{k}'] = v
            else:
                row[key] = value

        entities = list(obj.extracted_entities.values_list('text', flat=True))
        row['entities'] = entities
        row['entity_count'] = len(entities)

        rows.append(row)

    for key in set().union(*(r.keys() for r in rows)):
        values = [r.get(key) for r in rows if r.get(key) is not None]
        all_fields[key] = {
            'type': _infer_vega_type(values),
            'source': _infer_source(key),
            'non_null_count': len(values),
        }

    return {'rows': rows, 'fields': all_fields}


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
                 sort=['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
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


def _build_type_bar_chart(data: dict) -> alt.Chart:
    """Horizontal bar chart of object count by type, colored by type_color."""
    import pandas as pd

    df = pd.DataFrame(data['rows'])
    type_counts = df.groupby(['type', 'type_color']).size().reset_index(name='count')
    type_counts = type_counts.sort_values('count', ascending=False)

    return alt.Chart(type_counts).mark_bar().encode(
        x=alt.X('count:Q', title='Object Count'),
        y=alt.Y('type:N', title='Type', sort='-x'),
        color=alt.Color('type_color:N', scale=None),
        tooltip=['type:N', 'count:Q'],
    ).properties(
        width=500,
        height=max(100, len(type_counts) * 30),
        title='Object Types',
    )


def _build_connection_scatter(data: dict) -> alt.Chart:
    """Scatter plot: capture date vs connection count, colored by object type."""
    import pandas as pd

    df = pd.DataFrame(data['rows'])
    df['captured_at'] = pd.to_datetime(df['captured_at'])

    return alt.Chart(df).mark_circle(size=80).encode(
        x=alt.X('captured_at:T', title='Captured'),
        y=alt.Y('edge_count:Q', title='Connections'),
        color=alt.Color('type:N', title='Type'),
        tooltip=['title:N', 'type:N', 'edge_count:Q', 'captured_at:T'],
    ).properties(
        width=600,
        height=300,
        title='Connection Density',
    ).interactive()


def _build_generic_scatter(data: dict) -> alt.Chart:
    """Scatter any two quantitative component fields; falls back to body_length vs edge_count."""
    import pandas as pd

    quant_component_fields = [
        k for k, v in data['fields'].items()
        if v['type'] == 'quantitative' and v['source'] == 'component' and v['non_null_count'] >= 2
    ]

    if len(quant_component_fields) >= 2:
        x_field, y_field = quant_component_fields[0], quant_component_fields[1]
    else:
        x_field, y_field = 'body_length', 'edge_count'

    df = pd.DataFrame(data['rows'])

    return alt.Chart(df).mark_circle(size=80).encode(
        x=alt.X(f'{x_field}:Q', title=x_field.replace('_', ' ').title()),
        y=alt.Y(f'{y_field}:Q', title=y_field.replace('_', ' ').title()),
        color=alt.Color('type:N', title='Type'),
        tooltip=['title:N', 'type:N', f'{x_field}:Q', f'{y_field}:Q'],
    ).properties(
        width=500,
        height=300,
        title=f'{x_field.replace("_", " ").title()} vs {y_field.replace("_", " ").title()}',
    ).interactive()


def _build_word_frequency(data: dict) -> alt.Chart:
    """Bar chart of most frequent terms drawn from object entities and titles."""
    import pandas as pd
    from collections import Counter

    _STOP_WORDS = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
        'for', 'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were',
        'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
        'will', 'would', 'could', 'should', 'may', 'might', 'this', 'that',
        'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
        'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what', 'which',
        'who', 'when', 'where', 'how', 'as', 'if', 'not', 'no', 'so',
    }

    tokens = []
    for row in data['rows']:
        tokens.extend(e.lower() for e in row.get('entities', []))
        title = row.get('title', '')
        words = [w.strip('.,!?;:').lower() for w in title.split()]
        tokens.extend(w for w in words if len(w) > 3 and w not in _STOP_WORDS)

    if not tokens:
        return alt.Chart(pd.DataFrame({'term': [], 'count': []})).mark_bar()

    top_terms = Counter(tokens).most_common(20)
    df = pd.DataFrame(top_terms, columns=['term', 'count'])

    return alt.Chart(df).mark_bar().encode(
        x=alt.X('count:Q', title='Frequency'),
        y=alt.Y('term:N', title='Term', sort='-x'),
        color=alt.value('#B45A2D'),
        tooltip=['term:N', 'count:Q'],
    ).properties(
        width=500,
        height=400,
        title='Vocabulary Frequency',
    )


def _build_growth_curve(data: dict) -> alt.Chart:
    """Cumulative object count over time as an interactive line chart."""
    import pandas as pd

    df = pd.DataFrame(data['rows'])
    df['captured_at'] = pd.to_datetime(df['captured_at'])
    df = df.sort_values('captured_at').reset_index(drop=True)
    df['cumulative'] = range(1, len(df) + 1)

    return alt.Chart(df).mark_line(point=True).encode(
        x=alt.X('captured_at:T', title='Date'),
        y=alt.Y('cumulative:Q', title='Total Objects'),
        tooltip=['title:N', 'captured_at:T', 'cumulative:Q'],
    ).properties(
        width=600,
        height=250,
        title='Knowledge Growth',
    ).interactive()


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


def suggest_visualizations(data: dict, hint: str = '') -> list:
    """
    Match available templates to the extracted data fields.
    Returns a list of { id, name, description, vega_lite_spec } dicts.
    """
    type_counts: dict = {}
    for f in data['fields'].values():
        type_counts[f['type']] = type_counts.get(f['type'], 0) + 1

    results = []
    for template in TEMPLATES:
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

    if hint:
        results.sort(key=lambda r: (0 if hint in r['id'] else 1))

    return results

"""
Graph builder for research source network.

Constructs a bipartite networkx graph from Source and SourceLink data.
Source nodes and content nodes are connected by SourceLink edges.

The graph is cached in memory with a 5-minute TTL and invalidated
on Source or SourceLink save via post_save signals.
"""

import time

import networkx as nx

from apps.research.models import Source, SourceLink

# In-memory cache for the graph
_graph_cache = {
    'graph': None,
    'expires_at': 0,
}

CACHE_TTL = 300  # 5 minutes


def invalidate_graph_cache():
    """Clear the cached graph (called from post_save signals)."""
    _graph_cache['graph'] = None
    _graph_cache['expires_at'] = 0


def build_graph():
    """
    Build a bipartite networkx Graph from Source and SourceLink data.

    Node types:
      - source:<slug> with type='source'
      - content:<content_type>:<content_slug> with type='content'

    Edges connect source nodes to content nodes via SourceLinks.
    Each edge carries the link role as an attribute.

    Returns the graph from cache if still valid; otherwise rebuilds.
    """
    now = time.time()
    if _graph_cache['graph'] is not None and now < _graph_cache['expires_at']:
        return _graph_cache['graph']

    G = nx.Graph()

    # Load all public sources as nodes
    sources = Source.objects.public().values_list(
        'slug', 'title', 'creator', 'source_type',
    )
    for slug, title, creator, source_type in sources:
        G.add_node(
            f'source:{slug}',
            node_type='source',
            slug=slug,
            title=title,
            creator=creator,
            source_type=source_type,
        )

    # Load all source links for public sources
    links = SourceLink.objects.filter(
        source__public=True,
    ).select_related('source').values_list(
        'source__slug',
        'content_type',
        'content_slug',
        'content_title',
        'role',
    )

    for source_slug, content_type, content_slug, content_title, role in links:
        source_id = f'source:{source_slug}'
        content_id = f'content:{content_type}:{content_slug}'

        # Add content node if not yet present
        if content_id not in G:
            G.add_node(
                content_id,
                node_type='content',
                content_type=content_type,
                slug=content_slug,
                title=content_title or content_slug,
            )

        # Add edge
        G.add_edge(source_id, content_id, role=role)

    _graph_cache['graph'] = G
    _graph_cache['expires_at'] = now + CACHE_TTL

    return G


def get_source_pagerank(graph=None, source_type=None, n=20):
    """
    Run PageRank on the bipartite graph and return ranked sources.

    Args:
        graph: Optional pre-built graph (uses build_graph() if None).
        source_type: Filter sources by type before ranking.
        n: Number of top sources to return.

    Returns list of dicts with slug, title, creator, source_type,
    influence_score, link_count, and connected_content.
    """
    if graph is None:
        graph = build_graph()

    if len(graph) == 0:
        return []

    scores = nx.pagerank(graph)

    results = []
    for node_id, score in scores.items():
        data = graph.nodes[node_id]
        if data.get('node_type') != 'source':
            continue
        if source_type and data.get('source_type') != source_type:
            continue

        # Get connected content
        neighbors = list(graph.neighbors(node_id))
        connected = [
            graph.nodes[n].get('slug', n)
            for n in neighbors
            if graph.nodes[n].get('node_type') == 'content'
        ]

        results.append({
            'slug': data['slug'],
            'title': data['title'],
            'creator': data.get('creator', ''),
            'source_type': data.get('source_type', ''),
            'influence_score': round(score, 6),
            'link_count': len(connected),
            'connected_content': connected,
        })

    results.sort(key=lambda r: -r['influence_score'])
    return results[:n]


def find_path(graph, from_id, to_id):
    """
    Find the shortest path between two nodes in the graph.

    Args:
        graph: The networkx graph.
        from_id: Full node ID (e.g. 'source:some-slug' or 'content:essay:some-slug').
        to_id: Full node ID.

    Returns dict with path info or found=False.
    """
    if from_id not in graph or to_id not in graph:
        return {'found': False, 'from': from_id, 'to': to_id, 'path_length': 0, 'path': []}

    try:
        path_nodes = nx.shortest_path(graph, from_id, to_id)
    except nx.NetworkXNoPath:
        return {'found': False, 'from': from_id, 'to': to_id, 'path_length': 0, 'path': []}

    path = []
    for i, node_id in enumerate(path_nodes):
        data = graph.nodes[node_id]
        entry = {
            'id': node_id,
            'type': data.get('node_type', 'unknown'),
            'label': data.get('title', node_id),
            'slug': data.get('slug', ''),
        }
        # Add edge info to next node
        if i < len(path_nodes) - 1:
            edge_data = graph.edges.get((node_id, path_nodes[i + 1]), {})
            entry['edge_to_next'] = edge_data.get('role', 'connected')
        else:
            entry['edge_to_next'] = ''

        path.append(entry)

    return {
        'found': True,
        'from': from_id,
        'to': to_id,
        'path_length': len(path_nodes) - 1,
        'path': path,
    }


def compute_reading_order(graph, target_slug, max_items=10):
    """
    Compute a reading order leading to a target content piece.

    Algorithm:
    1. Find all content that shares sources with the target.
    2. Build a directed dependency graph: if Content A's sources
       are a subset of Content B's sources, A is a prerequisite for B.
    3. Topological sort with the target as the terminal node.
    4. Truncate to max_items.

    Args:
        graph: The networkx graph.
        target_slug: Slug of the destination content piece (without prefix).
        max_items: Maximum items in the reading list.

    Returns dict with target and reading_order list.
    """
    # Find the target content node
    target_id = None
    for node_id, data in graph.nodes(data=True):
        if data.get('node_type') == 'content' and data.get('slug') == target_slug:
            target_id = node_id
            break

    if target_id is None:
        return {'target': target_slug, 'reading_order': []}

    # Get source neighbors for target
    target_sources = {
        n for n in graph.neighbors(target_id)
        if graph.nodes[n].get('node_type') == 'source'
    }

    if not target_sources:
        return {'target': target_slug, 'reading_order': []}

    # Find all content nodes sharing at least one source with target
    related_content = {}
    for source_id in target_sources:
        for content_id in graph.neighbors(source_id):
            if graph.nodes[content_id].get('node_type') == 'content' and content_id != target_id:
                if content_id not in related_content:
                    # Gather sources for this content node
                    content_sources = {
                        n for n in graph.neighbors(content_id)
                        if graph.nodes[n].get('node_type') == 'source'
                    }
                    related_content[content_id] = content_sources

    if not related_content:
        return {'target': target_slug, 'reading_order': []}

    # Build directed dependency graph
    dep_graph = nx.DiGraph()
    dep_graph.add_node(target_id)
    for cid in related_content:
        dep_graph.add_node(cid)

    # Content A is a prerequisite for Content B if A's sources are
    # a subset of B's sources (A covers foundational material for B)
    all_content = {target_id: target_sources, **related_content}
    for a_id, a_sources in all_content.items():
        for b_id, b_sources in all_content.items():
            if a_id != b_id and a_sources and a_sources < b_sources:
                dep_graph.add_edge(a_id, b_id)

    # Ensure target has incoming edges from related content
    for cid in related_content:
        shared = related_content[cid] & target_sources
        if shared and not dep_graph.has_edge(cid, target_id):
            dep_graph.add_edge(cid, target_id)

    # Topological sort (handle cycles by falling back to source-count ordering)
    try:
        sorted_nodes = list(nx.topological_sort(dep_graph))
    except nx.NetworkXUnfeasible:
        # Cycle detected: fall back to sorting by shared source count
        sorted_nodes = sorted(
            related_content.keys(),
            key=lambda cid: len(related_content[cid] & target_sources),
        )
        sorted_nodes.append(target_id)

    # Build the reading order
    reading_order = []
    for i, node_id in enumerate(sorted_nodes):
        if node_id == target_id:
            continue
        if len(reading_order) >= max_items:
            break

        data = graph.nodes[node_id]
        shared = (related_content.get(node_id, set()) & target_sources)
        shared_titles = [
            graph.nodes[s].get('title', s) for s in shared
        ]
        reason = f'Shares {len(shared)} source(s) with target'
        if shared_titles:
            reason += f': {", ".join(shared_titles[:3])}'

        reading_order.append({
            'position': i + 1,
            'content_type': data.get('content_type', ''),
            'slug': data.get('slug', ''),
            'title': data.get('title', ''),
            'reason': reason,
        })

    return {'target': target_slug, 'reading_order': reading_order}

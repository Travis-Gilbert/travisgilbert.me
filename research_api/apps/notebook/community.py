"""
Community detection for the notebook knowledge graph.

Builds a weighted undirected graph from Object and Edge records, runs
Louvain community detection, and can persist the result into Cluster
rows plus Object.cluster assignments.
"""

import logging
from collections import Counter

import networkx as nx

logger = logging.getLogger(__name__)


def build_networkx_graph(notebook=None):
    """
    Build a weighted undirected graph from notebook edges.
    """
    from .models import Edge, Object

    objects_qs = Object.objects.filter(is_deleted=False).select_related('object_type')
    if notebook is not None:
        objects_qs = objects_qs.filter(notebook=notebook)

    G = nx.Graph()
    for obj in objects_qs:
        G.add_node(
            obj.pk,
            title=obj.display_title,
            type=obj.object_type.slug if obj.object_type else 'note',
        )

    edges_qs = (
        Edge.objects
        .filter(
            from_object__is_deleted=False,
            to_object__is_deleted=False,
        )
        .select_related('from_object__object_type', 'to_object__object_type')
    )
    if notebook is not None:
        edges_qs = edges_qs.filter(
            from_object__notebook=notebook,
            to_object__notebook=notebook,
        )

    for edge in edges_qs:
        from_pk = edge.from_object_id
        to_pk = edge.to_object_id
        if from_pk == to_pk or from_pk not in G.nodes or to_pk not in G.nodes:
            continue

        weight = float(edge.strength or 0.0)
        if G.has_edge(from_pk, to_pk):
            G[from_pk][to_pk]['weight'] = max(G[from_pk][to_pk]['weight'], weight)
        else:
            G.add_edge(from_pk, to_pk, weight=weight)

    return G


def detect_communities(notebook=None, resolution=1.0):
    """
    Run Louvain community detection on the notebook graph.
    """
    G = build_networkx_graph(notebook=notebook)
    if G.number_of_nodes() < 3 or G.number_of_edges() == 0:
        return {
            'communities': [],
            'modularity': 0.0,
            'n_communities': 0,
            'n_nodes': G.number_of_nodes(),
            'n_edges': G.number_of_edges(),
        }

    communities = nx.community.louvain_communities(
        G,
        resolution=resolution,
        seed=42,
        weight='weight',
    )
    modularity = nx.community.modularity(G, communities, weight='weight')

    result_communities = []
    for community_id, members in enumerate(
        sorted(communities, key=lambda c: (-len(c), sorted(c))),
    ):
        member_pks = sorted(members)
        type_counts = Counter(
            G.nodes[pk].get('type', 'note')
            for pk in member_pks
            if pk in G.nodes
        )
        dominant_type = type_counts.most_common(1)[0][0] if type_counts else 'mixed'
        result_communities.append({
            'id': community_id,
            'member_pks': member_pks,
            'size': len(member_pks),
            'label': f'{dominant_type} cluster ({len(member_pks)} objects)',
            'top_types': dict(type_counts.most_common(3)),
        })

    return {
        'communities': result_communities,
        'modularity': round(float(modularity), 4),
        'n_communities': len(result_communities),
        'n_nodes': G.number_of_nodes(),
        'n_edges': G.number_of_edges(),
    }


def persist_communities(communities_result, notebook=None):
    """
    Replace persisted clusters for the given scope and update Object.cluster.
    """
    from .models import Cluster, Object

    objects_qs = Object.objects.filter(is_deleted=False)
    clusters_qs = Cluster.objects.all()
    if notebook is not None:
        objects_qs = objects_qs.filter(notebook=notebook)
        clusters_qs = clusters_qs.filter(notebook=notebook)
    else:
        objects_qs = objects_qs.filter(cluster__isnull=False)

    objects_qs.update(cluster=None)
    clusters_qs.delete()

    created_clusters = []
    for community in communities_result.get('communities', []):
        cluster = Cluster.objects.create(
            name=community['label'],
            notebook=notebook,
            label_tags=list(community.get('top_types', {}).keys()),
            modularity_score=communities_result.get('modularity', 0.0),
            member_count=community['size'],
        )
        Object.objects.filter(pk__in=community['member_pks']).update(cluster=cluster)
        created_clusters.append(cluster)

    logger.info(
        'Persisted %d communities for %s',
        len(created_clusters),
        notebook.slug if notebook is not None else 'global scope',
    )
    return created_clusters

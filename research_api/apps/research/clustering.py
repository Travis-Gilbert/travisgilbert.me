"""
Automatic cluster detection for content.

THE IDEA
========
Your content naturally groups into thematic clusters: a housing
policy cluster, an accessibility cluster, a transit design cluster.
Right now, those clusters exist in your head but not in the data.
This module discovers them automatically.

THE ALGORITHM: AGGLOMERATIVE (HIERARCHICAL) CLUSTERING
======================================================
Agglomerative clustering is a "bottom-up" approach:

1. Start with every content piece as its own cluster (N clusters)
2. Find the two closest clusters
3. Merge them into one (now N-1 clusters)
4. Repeat until you reach the desired number of clusters

"Closest" is defined by the LINKAGE method:
- Ward linkage (what we use): minimizes the total variance within
  clusters when merging. Tends to produce compact, even-sized clusters.
  This is what the scikit-learn example you uploaded demonstrates.
- Average linkage: uses the average distance between all pairs of
  points in two clusters.
- Complete linkage: uses the maximum distance between any two points
  in the clusters.

WHY WARD LINKAGE FOR YOUR DATA
================================
Your content items are represented as points in a similarity space.
Ward linkage produces the most balanced clusters because it penalizes
merging clusters that would increase internal variance. For a research
knowledge base where you want thematic groups (not one giant cluster
and a bunch of singletons), Ward is the right default.

THE CONNECTIVITY CONSTRAINT (from the scikit-learn example)
===========================================================
The structured clustering example you uploaded shows the difference
between:
- Unconstrained: cluster based on global similarity only
- Constrained: cluster based on similarity AND a connectivity graph

For your data, the connectivity constraint is your CONNECTION GRAPH.
Two content pieces can only be merged into the same cluster if they
have a direct or near-direct connection. This prevents distant but
superficially similar content from being grouped together.

Think of it this way: two essays might both discuss "maps," but if
one is about transit maps and the other is about historical property
maps, they shouldn't cluster together. The connectivity constraint
(shared sources, shared threads) prevents that by requiring a real
structural relationship.

DEPENDENCIES
============
scikit-learn: for AgglomerativeClustering
numpy: for the distance/similarity matrix
"""

import logging
from collections import Counter, defaultdict

import numpy as np
from sklearn.cluster import AgglomerativeClustering

from apps.research.models import Source, SourceLink

logger = logging.getLogger(__name__)


def _build_feature_vectors() -> tuple[list[dict], np.ndarray]:
    """
    Build feature vectors for all content pieces.

    Each content piece becomes a vector where the dimensions represent:
    - Source IDs (binary: does this content cite this source?)
    - Tags (binary: do this content's sources use this tag?)

    This is a TERM-DOCUMENT MATRIX, a foundational concept in
    information retrieval. Instead of terms being words, our "terms"
    are sources and tags. The matrix tells us the "vocabulary" of
    research materials each content piece draws from.

    Returns:
        content_items: list of dicts with content metadata
        feature_matrix: numpy array of shape (n_content, n_features)
    """
    # Gather all content pieces and their source/tag profiles
    all_links = (
        SourceLink.objects
        .select_related('source')
        .filter(source__public=True)
    )

    # Build the vocabulary: all unique source IDs and all unique tags
    all_source_ids = set()
    all_tags = set()
    content_profiles = defaultdict(lambda: {'source_ids': set(), 'tags': set()})
    content_info = {}

    for link in all_links:
        key = f"{link.content_type}:{link.content_slug}"
        content_profiles[key]['source_ids'].add(link.source_id)
        content_profiles[key]['tags'].update(link.source.tags or [])
        all_source_ids.add(link.source_id)
        all_tags.update(link.source.tags or [])

        content_info[key] = {
            'content_type': link.content_type,
            'content_slug': link.content_slug,
            'content_title': link.content_title or link.content_slug,
        }

    if len(content_profiles) < 2:
        return [], np.array([])

    # Create ordered lists for consistent indexing
    source_id_list = sorted(all_source_ids)
    tag_list = sorted(all_tags)
    source_id_index = {sid: i for i, sid in enumerate(source_id_list)}
    tag_index = {tag: i + len(source_id_list) for i, tag in enumerate(tag_list)}

    n_features = len(source_id_list) + len(tag_list)
    content_keys = sorted(content_profiles.keys())

    # Build the matrix
    # Each row is a content piece, each column is a feature (source or tag)
    # Values are binary: 1 if the content cites that source / uses that tag
    matrix = np.zeros((len(content_keys), n_features), dtype=np.float32)

    for row, key in enumerate(content_keys):
        profile = content_profiles[key]
        for sid in profile['source_ids']:
            matrix[row, source_id_index[sid]] = 1.0
        for tag in profile['tags']:
            matrix[row, tag_index[tag]] = 1.0

    content_items = [
        {'key': key, **content_info.get(key, {})}
        for key in content_keys
    ]

    return content_items, matrix


def _build_connectivity_matrix(content_items: list[dict]) -> np.ndarray | None:
    """
    Build a connectivity matrix from shared sources.

    This is the STRUCTURED constraint from the scikit-learn example.
    Two content pieces are "connected" if they share at least one source.

    The matrix is symmetric and binary:
        connectivity[i][j] = 1 if content i and content j share a source
        connectivity[i][j] = 0 otherwise

    Without this constraint, clustering uses only the feature vectors
    (global similarity). With it, clustering also respects the local
    structure of your knowledge graph: only content that is directly
    connected through shared research can be merged into the same cluster.
    """
    n = len(content_items)
    if n < 2:
        return None

    # Build a mapping from source_id to content indices
    source_to_indices = defaultdict(set)

    all_links = SourceLink.objects.filter(source__public=True)
    key_to_index = {item['key']: i for i, item in enumerate(content_items)}

    for link in all_links:
        key = f"{link.content_type}:{link.content_slug}"
        if key in key_to_index:
            source_to_indices[link.source_id].add(key_to_index[key])

    # Build the connectivity matrix
    connectivity = np.zeros((n, n), dtype=np.int32)

    for source_id, indices in source_to_indices.items():
        indices_list = list(indices)
        for i in range(len(indices_list)):
            for j in range(i + 1, len(indices_list)):
                connectivity[indices_list[i], indices_list[j]] = 1
                connectivity[indices_list[j], indices_list[i]] = 1

    # Every node is connected to itself
    np.fill_diagonal(connectivity, 1)

    return connectivity


def _label_cluster(content_items: list[dict], indices: list[int]) -> dict:
    """
    Generate a human-readable label for a cluster.

    Examines the sources cited by cluster members, finds the most
    common tags, and uses those as the cluster label. This is a simple
    form of automatic labeling: the cluster's identity is defined by
    the most prevalent tags across its members.
    """
    # Collect all source tags for content in this cluster
    tag_counter = Counter()
    slugs = []

    for idx in indices:
        item = content_items[idx]
        slugs.append(item.get('content_slug', ''))

        links = SourceLink.objects.filter(
            content_type=item.get('content_type', ''),
            content_slug=item.get('content_slug', ''),
        ).select_related('source')

        for link in links:
            tag_counter.update(link.source.tags or [])

    # Top tags become the cluster label
    top_tags = [tag for tag, _ in tag_counter.most_common(3)]
    label = ', '.join(top_tags) if top_tags else f'cluster-{indices[0]}'

    return {
        'label': label,
        'top_tags': top_tags,
        'tag_distribution': dict(tag_counter.most_common(10)),
    }


def compute_clusters(
    n_clusters: int | None = None,
    use_connectivity: bool = True,
    linkage: str = 'ward',
    include_semantic: bool = False,
) -> dict:
    """
    Discover thematic clusters in the content.

    Parameters:
        n_clusters: Number of clusters. If None, estimated automatically
                    as roughly sqrt(n_content) (a common heuristic).
        use_connectivity: If True, use the shared-source connectivity
                         constraint (structured clustering). If False,
                         use unconstrained clustering.
        linkage: 'ward', 'average', 'complete', or 'single'.
                 Ward is recommended for most cases.
        include_semantic: If True, add embedding-based features to the
                         feature vectors. Requires spaCy with vectors.

    Returns:
        {
            'clusters': [
                {
                    'id': 0,
                    'label': 'housing, zoning, policy',
                    'top_tags': ['housing', 'zoning', 'policy'],
                    'members': [
                        {'content_type': 'essay', 'content_slug': '...', ...}
                    ],
                    'size': 4,
                    'tag_distribution': {'housing': 8, 'zoning': 5, ...}
                }
            ],
            'n_clusters': 4,
            'n_content': 12,
            'linkage': 'ward',
            'structured': true
        }
    """
    content_items, feature_matrix = _build_feature_vectors()

    if len(content_items) < 2:
        return {
            'clusters': [],
            'n_clusters': 0,
            'n_content': len(content_items),
            'linkage': linkage,
            'structured': use_connectivity,
            'note': 'Not enough content to cluster (need at least 2 items).',
        }

    # Optionally add semantic features (embedding vectors)
    if include_semantic:
        try:
            from apps.research.embeddings import build_content_text, get_document_vector

            semantic_vectors = []
            for item in content_items:
                links = SourceLink.objects.filter(
                    content_type=item.get('content_type', ''),
                    content_slug=item.get('content_slug', ''),
                ).select_related('source')

                texts = [
                    build_content_text(
                        title=link.source.title,
                        annotation=link.source.public_annotation,
                        tags=link.source.tags,
                        creator=link.source.creator,
                    )
                    for link in links
                ]

                if texts:
                    vec = get_document_vector(' '.join(texts))
                    semantic_vectors.append(vec)
                else:
                    # Zero vector for content with no sources
                    semantic_vectors.append(np.zeros(300))

            semantic_matrix = np.array(semantic_vectors, dtype=np.float32)

            # Normalize both matrices to [0, 1] range before combining
            # so that neither dominates the distance calculation
            from sklearn.preprocessing import normalize
            if feature_matrix.max() > 0:
                struct_norm = normalize(feature_matrix, norm='l2')
            else:
                struct_norm = feature_matrix

            sem_norms = np.linalg.norm(semantic_matrix, axis=1, keepdims=True)
            sem_norms[sem_norms == 0] = 1.0
            sem_norm = semantic_matrix / sem_norms

            # Combine: 60% structural, 40% semantic
            feature_matrix = np.hstack([
                struct_norm * 0.6,
                sem_norm * 0.4,
            ])

        except Exception as e:
            logger.warning('Semantic features unavailable for clustering: %s', e)
            # Fall through with structural features only

    n_content = len(content_items)

    # Auto-determine cluster count if not specified
    if n_clusters is None:
        # Heuristic: sqrt(n) clusters, minimum 2, maximum 10
        n_clusters = max(2, min(10, int(np.sqrt(n_content))))

    # Don't request more clusters than content items
    n_clusters = min(n_clusters, n_content)

    # Build connectivity constraint if requested
    connectivity = None
    if use_connectivity:
        connectivity = _build_connectivity_matrix(content_items)

        # Check if the connectivity graph is connected enough.
        # If some content has zero connections, Ward linkage with
        # connectivity will fail. Fall back to unconstrained.
        if connectivity is not None:
            row_sums = connectivity.sum(axis=1) - 1  # subtract self-connection
            if (row_sums == 0).any():
                logger.info(
                    'Some content has no shared sources. '
                    'Falling back to unconstrained clustering.'
                )
                connectivity = None

    # Run the clustering
    try:
        model = AgglomerativeClustering(
            n_clusters=n_clusters,
            linkage=linkage,
            connectivity=connectivity,
        )
        model.fit(feature_matrix)
        labels = model.labels_
    except Exception as e:
        # If structured clustering fails (e.g., disconnected graph),
        # retry without connectivity
        logger.warning('Structured clustering failed (%s), retrying unconstrained', e)
        model = AgglomerativeClustering(
            n_clusters=n_clusters,
            linkage=linkage,
        )
        model.fit(feature_matrix)
        labels = model.labels_
        connectivity = None

    # Group content by cluster label
    clusters = []
    for cluster_id in range(n_clusters):
        indices = [i for i, label in enumerate(labels) if label == cluster_id]
        if not indices:
            continue

        members = [
            {
                'content_type': content_items[i].get('content_type', ''),
                'content_slug': content_items[i].get('content_slug', ''),
                'content_title': content_items[i].get('content_title', ''),
            }
            for i in indices
        ]

        cluster_info = _label_cluster(content_items, indices)

        clusters.append({
            'id': cluster_id,
            'label': cluster_info['label'],
            'top_tags': cluster_info['top_tags'],
            'members': members,
            'size': len(members),
            'tag_distribution': cluster_info['tag_distribution'],
        })

    # Sort clusters by size (largest first)
    clusters.sort(key=lambda c: c['size'], reverse=True)

    return {
        'clusters': clusters,
        'n_clusters': len(clusters),
        'n_content': n_content,
        'linkage': linkage,
        'structured': connectivity is not None,
    }

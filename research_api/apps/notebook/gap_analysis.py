"""
Structural gap detection between notebook communities.

A gap is a pair of communities with very few edges between them relative to
the number of possible cross-community links. These are useful candidates for
future resurfacing or bridge-building work.
"""

import logging

logger = logging.getLogger(__name__)


def find_structural_gaps(G, communities, min_semantic_sim=0.3):
    """
    Find sparse inter-community regions in the graph.

    `min_semantic_sim` is reserved for a later semantic-bridge pass. The
    current batch only computes structural sparsity and returns an empty
    `bridge_candidates` list placeholder.
    """
    del min_semantic_sim

    gaps = []

    for i, comm_a in enumerate(communities):
        for j, comm_b in enumerate(communities):
            if j <= i:
                continue

            pks_a = set(comm_a.get('member_pks', []))
            pks_b = set(comm_b.get('member_pks', []))
            potential_edges = len(pks_a) * len(pks_b)
            if potential_edges == 0:
                continue

            inter_edges = 0
            for pk_a in pks_a:
                for pk_b in pks_b:
                    if G.has_edge(pk_a, pk_b):
                        inter_edges += 1

            density = inter_edges / potential_edges
            gap_score = (1.0 - density) * min(len(pks_a), len(pks_b))

            if inter_edges < 3 and gap_score > 2.0:
                gaps.append({
                    'community_a': i,
                    'community_b': j,
                    'community_a_label': comm_a.get('label', ''),
                    'community_b_label': comm_b.get('label', ''),
                    'inter_edges': inter_edges,
                    'potential_edges': potential_edges,
                    'gap_score': round(gap_score, 2),
                    'bridge_candidates': [],
                })

    gaps.sort(key=lambda gap: gap['gap_score'], reverse=True)
    logger.info('Computed %d structural gaps', len(gaps))
    return gaps

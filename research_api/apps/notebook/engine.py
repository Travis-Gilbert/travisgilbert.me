"""
Connection Engine: finds relationships between KnowledgeNodes.

This is the brain of the notebook. It replaces manual tagging with
automatic discovery. Every connection includes a reason explaining
WHY the link exists, making the graph browsable and useful.

The engine runs in three passes:

Pass 1: Entity Resolution (spaCy NER)
  Extract named entities from node body/title, create ResolvedEntity
  records, match entities to existing KnowledgeNodes, create 'mentions'
  edges when a match is found.

Pass 2: Shared Entity Connections
  Find nodes that reference the same entity, create 'shared_entity'
  edges with explanation. Example: "Both notes reference Jane Jacobs."

Pass 3: Topic Similarity (keyword overlap)
  Compare text content across nodes via Jaccard similarity, create
  'shared_topic' edges for high similarity pairs.
  Example: "Shared topics: zoning, suburban, land use."

Future passes:
  Temporal clustering, citation chains, semantic similarity via embeddings.
"""

import logging
import re
from collections import Counter

import spacy
from django.db.models import Q

from .models import Edge, KnowledgeNode, NodeType, ResolvedEntity

logger = logging.getLogger(__name__)

# Load spaCy model (small English model, fast, good NER)
# Install: python3 -m spacy download en_core_web_sm
try:
    nlp = spacy.load('en_core_web_sm')
except OSError:
    nlp = None
    logger.warning(
        'spaCy model not found. Run: python3 -m spacy download en_core_web_sm'
    )


# Entity types we care about (spaCy labels)
ENTITY_TYPES_OF_INTEREST = {
    'PERSON', 'ORG', 'GPE', 'LOC', 'EVENT', 'WORK_OF_ART', 'DATE',
}

# Map spaCy entity types to NodeType slugs for auto-objectification
ENTITY_TO_NODE_TYPE = {
    'PERSON': 'person',
    'ORG': 'organization',
    'GPE': 'place',
    'LOC': 'place',
    'EVENT': 'event',
    'WORK_OF_ART': 'source',
}

# Common English stop words for topic similarity
STOP_WORDS = {
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
    'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this',
    'that', 'these', 'those', 'it', 'its', 'not', 'no', 'so', 'if',
    'about', 'up', 'out', 'then', 'than', 'also', 'just', 'more',
    'some', 'very', 'how', 'what', 'when', 'where', 'which', 'who',
    'all', 'each', 'every', 'both', 'few', 'most', 'other', 'into',
    'over', 'such', 'only', 'own', 'same', 'here', 'there', 'they',
    'them', 'their', 'my', 'your', 'our',
}


def _extract_keywords(text: str) -> set[str]:
    """Extract significant words (3+ chars, not stop words)."""
    words = re.findall(r'\b[a-z]{3,}\b', text.lower())
    return {w for w in words if w not in STOP_WORDS}


def extract_entities(node: KnowledgeNode) -> list[ResolvedEntity]:
    """Pass 1: Extract named entities from a node using spaCy.

    Creates ResolvedEntity records and attempts to resolve them
    to existing KnowledgeNodes. If a matching node exists, creates
    a 'mentions' Edge automatically.
    """
    if nlp is None:
        return []

    text = f'{node.title} {node.body}'.strip()
    if not text:
        return []

    doc = nlp(text)
    entities = []

    for ent in doc.ents:
        if ent.label_ not in ENTITY_TYPES_OF_INTEREST:
            continue
        if len(ent.text.strip()) < 2:
            continue

        normalized = ent.text.lower().strip()

        # Check if we already extracted this entity from this node
        existing = ResolvedEntity.objects.filter(
            source_node=node,
            normalized_text=normalized,
            entity_type=ent.label_,
        ).first()

        if existing:
            entities.append(existing)
            continue

        # Try to resolve to an existing KnowledgeNode
        resolved_node = None
        target_type_slug = ENTITY_TO_NODE_TYPE.get(ent.label_)

        if target_type_slug:
            resolved_node = (
                KnowledgeNode.objects
                .filter(node_type__slug=target_type_slug)
                .filter(
                    Q(title__icontains=ent.text)
                    | Q(search_text__icontains=normalized)
                )
                .first()
            )

        entity = ResolvedEntity.objects.create(
            source_node=node,
            text=ent.text,
            entity_type=ent.label_,
            normalized_text=normalized,
            resolved_node=resolved_node,
        )
        entities.append(entity)

        # If resolved, create a 'mentions' edge
        if resolved_node and resolved_node.id != node.id:
            Edge.objects.get_or_create(
                from_node=node,
                to_node=resolved_node,
                edge_type='mentions',
                defaults={
                    'reason': (
                        f'This note mentions {ent.text} '
                        f'({ent.label_.lower()}).'
                    ),
                    'strength': 0.7,
                    'is_auto': True,
                },
            )

    return entities


def find_shared_entity_connections(node: KnowledgeNode) -> list[Edge]:
    """Pass 2: Find other nodes that share entities with this node.

    If Node A mentions "Jane Jacobs" and Node B also mentions
    "Jane Jacobs", create an edge between A and B with the reason:
    "Both notes reference Jane Jacobs."
    """
    my_entities = ResolvedEntity.objects.filter(source_node=node)
    new_edges = []

    for entity in my_entities:
        siblings = (
            ResolvedEntity.objects
            .filter(
                normalized_text=entity.normalized_text,
                entity_type=entity.entity_type,
            )
            .exclude(source_node=node)
            .select_related('source_node')
        )

        for sibling in siblings:
            other_node = sibling.source_node
            edge, created = Edge.objects.get_or_create(
                from_node=node,
                to_node=other_node,
                edge_type='shared_entity',
                defaults={
                    'reason': (
                        f'Both notes reference {entity.text} '
                        f'({entity.entity_type.lower()}).'
                    ),
                    'strength': 0.6,
                    'is_auto': True,
                },
            )
            if created:
                new_edges.append(edge)

    return new_edges


def find_topic_connections(
    node: KnowledgeNode,
    threshold: float = 0.3,
) -> list[Edge]:
    """Pass 3: Find nodes with overlapping content via keyword analysis.

    Uses Jaccard similarity on extracted keywords. The reason field
    explains WHICH words overlap:
    "Shared topics: zoning, suburban, land use."
    """
    my_keywords = _extract_keywords(f'{node.title} {node.body}')
    if len(my_keywords) < 3:
        return []

    # Compare against recent non-self nodes (cap at 500 for performance)
    candidates = (
        KnowledgeNode.objects
        .exclude(pk=node.pk)
        .exclude(search_text='')
        .order_by('-captured_at')
        [:500]
    )

    new_edges = []

    for other in candidates:
        other_keywords = _extract_keywords(f'{other.title} {other.body}')
        if len(other_keywords) < 3:
            continue

        overlap = my_keywords & other_keywords
        union = my_keywords | other_keywords

        if not union:
            continue

        jaccard = len(overlap) / len(union)

        if jaccard >= threshold and len(overlap) >= 3:
            top_shared = sorted(overlap)[:6]
            reason = f'Shared topics: {", ".join(top_shared)}.'

            edge, created = Edge.objects.get_or_create(
                from_node=node,
                to_node=other,
                edge_type='shared_topic',
                defaults={
                    'reason': reason,
                    'strength': min(jaccard * 2, 1.0),
                    'is_auto': True,
                },
            )
            if created:
                new_edges.append(edge)

    return new_edges


def auto_objectify(node: KnowledgeNode) -> list[KnowledgeNode]:
    """Auto-objectification: create KnowledgeNodes for significant entities.

    If a note mentions "Richard Hamming" and no Person node exists for
    him, create one automatically. The new node gets type=Person and a
    body like "Auto-created from mention in: [original note title]".

    Only creates nodes for PERSON and ORG entities (high confidence).
    Places and dates are too ambiguous for auto-creation.
    """
    entities = ResolvedEntity.objects.filter(
        source_node=node,
        resolved_node__isnull=True,
        entity_type__in=['PERSON', 'ORG'],
    )

    created_nodes = []

    for entity in entities:
        target_type_slug = ENTITY_TO_NODE_TYPE.get(entity.entity_type)
        if not target_type_slug:
            continue

        # Check if a matching node was created since our last run
        existing = KnowledgeNode.objects.filter(
            node_type__slug=target_type_slug,
            title__iexact=entity.text,
        ).first()

        if existing:
            entity.resolved_node = existing
            entity.save(update_fields=['resolved_node'])
            continue

        # Create the object node
        node_type = NodeType.objects.filter(slug=target_type_slug).first()
        if not node_type:
            continue

        new_node = KnowledgeNode.objects.create(
            title=entity.text,
            node_type=node_type,
            body=f'Auto-created from mention in: {node.display_title}',
            status='inbox',
            capture_method='auto',
        )

        entity.resolved_node = new_node
        entity.save(update_fields=['resolved_node'])

        # Create the mentions edge
        Edge.objects.get_or_create(
            from_node=node,
            to_node=new_node,
            edge_type='mentions',
            defaults={
                'reason': f'This note mentions {entity.text}.',
                'strength': 0.7,
                'is_auto': True,
            },
        )

        created_nodes.append(new_node)

    return created_nodes


def run_engine(node: KnowledgeNode) -> dict:
    """Run the full connection engine on a single node.

    Returns a summary dict of what was found/created.
    """
    results = {
        'entities_extracted': 0,
        'edges_from_entities': 0,
        'edges_from_shared': 0,
        'edges_from_topics': 0,
        'nodes_auto_created': 0,
    }

    # Pass 1: Entity extraction
    entities = extract_entities(node)
    results['entities_extracted'] = len(entities)

    # Pass 1b: Auto-objectification
    created = auto_objectify(node)
    results['nodes_auto_created'] = len(created)

    # Pass 2: Shared entity connections
    shared_edges = find_shared_entity_connections(node)
    results['edges_from_shared'] = len(shared_edges)

    # Pass 3: Topic similarity
    topic_edges = find_topic_connections(node)
    results['edges_from_topics'] = len(topic_edges)

    # Count total mentions edges (some created during extract, some during objectify)
    results['edges_from_entities'] = (
        Edge.objects
        .filter(from_node=node, edge_type='mentions', is_auto=True)
        .count()
    )

    logger.info(
        'Connection engine results for "%s": %s',
        node.display_title[:40],
        results,
    )

    return results

"""
Connection Engine: finds relationships between Objects.

Three-pass spaCy pipeline + per-Notebook configuration.

Pass 1: Named entity extraction (spaCy NER)
Pass 2: Shared entity edge discovery
Pass 3: Topic similarity via Jaccard index on keyword overlap

Also: auto-objectification of PERSON/ORG entities,
connection Node creation for every new Edge.
"""

import logging
import re
from collections import Counter

from django.db.models import Q
from django.utils import timezone

from .models import Component, Edge, Node, Object, ObjectType, ResolvedEntity, Timeline

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# spaCy model
# ---------------------------------------------------------------------------

try:
    import spacy
    nlp = spacy.load('en_core_web_sm')
except (OSError, ImportError):
    nlp = None
    logger.warning(
        'spaCy model not found. Run: python3 -m spacy download en_core_web_sm'
    )

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ENTITY_TYPES_OF_INTEREST = {
    'PERSON', 'ORG', 'GPE', 'LOC', 'EVENT', 'WORK_OF_ART', 'DATE',
}

ENTITY_TO_OBJECT_TYPE = {
    'PERSON': 'person',
    'ORG': 'organization',
    'GPE': 'place',
    'LOC': 'place',
    'EVENT': 'event',
    'WORK_OF_ART': 'source',
}

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

DEFAULT_ENGINE_CONFIG = {
    'engines': ['spacy'],
    'topic_threshold': 0.3,
    'max_candidates': 500,
}

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


# ---------------------------------------------------------------------------
# Engine configuration (Task 10)
# ---------------------------------------------------------------------------

def get_engine_config(notebook=None) -> dict:
    """
    Return engine config, optionally merged with Notebook overrides.

    Default config sets spaCy as the only active engine with a 0.3
    Jaccard threshold and 500-candidate cap for topic matching.
    Notebooks can override any key via their engine_config JSONField.
    """
    config = dict(DEFAULT_ENGINE_CONFIG)
    if notebook and notebook.engine_config:
        config.update(notebook.engine_config)
    return config


def _get_active_engines(config: dict, object_count: int) -> set[str]:
    """
    Determine active engines based on config and corpus size (Task 11).

    Below 500 objects: whatever config specifies (default: spaCy only).
    At 500+: auto-add tfidf engine for broader coverage.
    """
    engines = set(config.get('engines', ['spacy']))
    if object_count >= 500:
        engines.add('tfidf')
    return engines


def _get_master_timeline() -> Timeline | None:
    """Get the master timeline for Node creation."""
    return Timeline.objects.filter(is_master=True).first()


# ---------------------------------------------------------------------------
# Text extraction helpers
# ---------------------------------------------------------------------------

def _extract_keywords(text: str) -> set[str]:
    """Extract significant words (3+ chars, not stop words)."""
    words = re.findall(r'\b[a-z]{3,}\b', text.lower())
    return {w for w in words if w not in STOP_WORDS}


def _build_full_text(obj: Object) -> str:
    """
    Build the full text for an Object by combining title, body,
    and all text-bearing Component values (Task 9).

    This gives the engine richer input than title+body alone,
    picking up author names, locations, and other Component data.
    """
    parts = [obj.title or '', obj.body or '']

    # Include Component values (strings and the 'text' values from JSON)
    for comp in obj.components.select_related('component_type').all():
        val = comp.value
        if isinstance(val, str):
            parts.append(val)
        elif isinstance(val, dict) and 'text' in val:
            parts.append(str(val['text']))
        elif isinstance(val, (int, float)):
            pass  # Skip numeric values
        else:
            parts.append(str(val))

    return ' '.join(p for p in parts if p)


# ---------------------------------------------------------------------------
# Pass 1: Entity extraction
# ---------------------------------------------------------------------------

def extract_entities(obj: Object, config: dict | None = None) -> list[ResolvedEntity]:
    """
    Extract named entities from an Object using spaCy NER.

    Uses _build_full_text() to include Component values alongside
    title and body for richer entity discovery.
    """
    if nlp is None:
        return []

    text = _build_full_text(obj)
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

        existing = ResolvedEntity.objects.filter(
            source_object=obj,
            normalized_text=normalized,
            entity_type=ent.label_,
        ).first()

        if existing:
            entities.append(existing)
            continue

        resolved_object = None
        target_type_slug = ENTITY_TO_OBJECT_TYPE.get(ent.label_)

        if target_type_slug:
            resolved_object = (
                Object.objects
                .filter(object_type__slug=target_type_slug)
                .filter(
                    Q(title__icontains=ent.text)
                    | Q(search_text__icontains=normalized)
                )
                .first()
            )

        entity = ResolvedEntity.objects.create(
            source_object=obj,
            text=ent.text,
            entity_type=ent.label_,
            normalized_text=normalized,
            resolved_object=resolved_object,
        )
        entities.append(entity)

        if resolved_object and resolved_object.id != obj.id:
            Edge.objects.get_or_create(
                from_object=obj,
                to_object=resolved_object,
                edge_type='mentions',
                defaults={
                    'reason': (
                        f'This note mentions {ent.text} '
                        f'({ent.label_.lower()}).'
                    ),
                    'strength': 0.7,
                    'is_auto': True,
                    'engine': 'spacy',
                },
            )

    return entities


# ---------------------------------------------------------------------------
# Pass 2: Shared entity connections
# ---------------------------------------------------------------------------

def find_shared_entity_connections(obj: Object, config: dict | None = None) -> list[Edge]:
    """Find other Objects that share entities with this one."""
    my_entities = ResolvedEntity.objects.filter(source_object=obj)
    new_edges = []

    for entity in my_entities:
        siblings = (
            ResolvedEntity.objects
            .filter(
                normalized_text=entity.normalized_text,
                entity_type=entity.entity_type,
                source_object__is_deleted=False,
            )
            .exclude(source_object=obj)
            .select_related('source_object')
        )

        for sibling in siblings:
            other_obj = sibling.source_object
            type_label = {
                'PERSON': 'person', 'ORG': 'organization', 'GPE': 'place',
                'LOC': 'location', 'EVENT': 'event', 'WORK_OF_ART': 'work',
            }.get(entity.entity_type, entity.entity_type.lower())

            edge, created = Edge.objects.get_or_create(
                from_object=obj,
                to_object=other_obj,
                edge_type='shared_entity',
                defaults={
                    'reason': (
                        f'Both mention {entity.text}, the same {type_label}.'
                    ),
                    'strength': 0.6,
                    'is_auto': True,
                    'engine': 'spacy',
                },
            )
            if created:
                new_edges.append(edge)

    return new_edges


# ---------------------------------------------------------------------------
# Pass 3: Topic similarity
# ---------------------------------------------------------------------------

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


def find_topic_connections(
    obj: Object,
    config: dict | None = None,
) -> list[Edge]:
    """
    Find Objects with overlapping content via keyword analysis.

    Uses per-Notebook config for threshold and max_candidates.
    Includes Component text values for richer keyword extraction.
    """
    if config is None:
        config = DEFAULT_ENGINE_CONFIG

    threshold = config.get('topic_threshold', 0.3)
    max_candidates = config.get('max_candidates', 500)

    my_text = _build_full_text(obj)
    my_keywords = _extract_keywords(my_text)
    if len(my_keywords) < 3:
        return []

    candidates = (
        Object.objects
        .filter(is_deleted=False)
        .exclude(pk=obj.pk)
        .exclude(search_text='')
        .order_by('-captured_at')
        [:max_candidates]
    )

    new_edges = []

    for other in candidates:
        other_text = _build_full_text(other)
        other_keywords = _extract_keywords(other_text)
        if len(other_keywords) < 3:
            continue

        overlap = my_keywords & other_keywords
        union = my_keywords | other_keywords

        if not union:
            continue

        jaccard = len(overlap) / len(union)

        if jaccard >= threshold and len(overlap) >= 3:
            reason = (
                _llm_explanation(obj, other)
                or _synthesize_topic_reason(my_keywords, other_keywords, obj, other)
            )

            edge, created = Edge.objects.get_or_create(
                from_object=obj,
                to_object=other,
                edge_type='shared_topic',
                defaults={
                    'reason': reason,
                    'strength': min(jaccard * 2, 1.0),
                    'is_auto': True,
                    'engine': 'spacy',
                },
            )
            if created:
                new_edges.append(edge)

    return new_edges


# ---------------------------------------------------------------------------
# LLM explanation stub (Phase 10c)
# ---------------------------------------------------------------------------

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
    # prompt = (
    #     "In one sentence, explain the conceptual connection between:\n"
    #     f"A: {obj_a.title} - {(obj_a.body or '')[:200]}\n"
    #     f"B: {obj_b.title} - {(obj_b.body or '')[:200]}"
    # )
    return None


# ---------------------------------------------------------------------------
# Auto-objectification
# ---------------------------------------------------------------------------

AUTO_OBJECTIFY_MIN_LENGTH = 4


def auto_objectify(obj: Object) -> list[Object]:
    """Auto-create Objects for high-confidence PERSON/ORG entities.

    Guards:
    - Entity text must be >= 4 characters
    - Entity must not be a common stop-word
    - Case-insensitive deduplication
    - Only PERSON and ORG types (GPE/LOC are too noisy)
    """
    entities = ResolvedEntity.objects.filter(
        source_object=obj,
        resolved_object__isnull=True,
        entity_type__in=['PERSON', 'ORG'],
    )

    created_objects = []

    for entity in entities:
        text = entity.text.strip()

        # Skip short or low-quality entities
        if len(text) < AUTO_OBJECTIFY_MIN_LENGTH:
            continue
        if text.lower() in STOP_WORDS:
            continue

        target_type_slug = ENTITY_TO_OBJECT_TYPE.get(entity.entity_type)
        if not target_type_slug:
            continue

        # Case-insensitive deduplication
        existing = Object.objects.filter(
            object_type__slug=target_type_slug,
            is_deleted=False,
        ).filter(
            Q(title__iexact=text)
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
            title=text,
            object_type=object_type,
            body=f'Auto-created from mention in: {obj.display_title}',
            status='active',
            capture_method='auto',
            notebook=obj.notebook,
        )

        entity.resolved_object = new_obj
        entity.save(update_fields=['resolved_object'])

        Edge.objects.get_or_create(
            from_object=obj,
            to_object=new_obj,
            edge_type='mentions',
            defaults={
                'reason': f'{obj.display_title[:40]} mentions {text}.',
                'strength': 0.7,
                'is_auto': True,
                'engine': 'spacy',
            },
        )

        created_objects.append(new_obj)

    return created_objects


# ---------------------------------------------------------------------------
# Stub engines (Task 11: future expansion)
# ---------------------------------------------------------------------------

def _run_tfidf_engine(obj: Object, config: dict) -> list[Edge]:
    """TF-IDF similarity engine. Placeholder for future implementation."""
    logger.info('TF-IDF engine: not yet implemented. Skipping.')
    return []


def _run_semantic_engine(obj: Object, config: dict) -> list[Edge]:
    """Semantic embedding engine. Placeholder for future implementation."""
    logger.info('Semantic engine: not yet implemented. Skipping.')
    return []


# ---------------------------------------------------------------------------
# Connection Node creation (Task 12)
# ---------------------------------------------------------------------------

def _create_connection_nodes(edges: list[Edge], engine_name: str) -> int:
    """
    Create timeline Nodes for newly discovered Edges.

    Each new Edge gets a Node with type='connection' on the master Timeline.
    Returns the count of Nodes created.
    """
    timeline = _get_master_timeline()
    if not timeline:
        logger.warning('No master timeline found. Skipping connection Nodes.')
        return 0

    count = 0
    for edge in edges:
        Node.objects.create(
            node_type='connection',
            title=f'{edge.from_object.display_title[:30]} <> {edge.to_object.display_title[:30]}',
            body=edge.reason,
            object_ref=edge.from_object,
            timeline=timeline,
            tags=[engine_name, edge.edge_type],
        )
        count += 1

    return count


# ---------------------------------------------------------------------------
# Main engine runner
# ---------------------------------------------------------------------------

def run_engine(obj: Object, notebook=None) -> dict:
    """
    Run the full connection engine on a single Object.

    Accepts optional notebook to use per-Notebook engine config.
    Creates connection Nodes for every new Edge discovered.
    """
    config = get_engine_config(notebook or obj.notebook)
    object_count = Object.objects.count()
    active_engines = _get_active_engines(config, object_count)

    results = {
        'engines_active': sorted(active_engines),
        'entities_extracted': 0,
        'edges_from_entities': 0,
        'edges_from_shared': 0,
        'edges_from_topics': 0,
        'edges_from_tfidf': 0,
        'edges_from_semantic': 0,
        'objects_auto_created': 0,
        'connection_nodes_created': 0,
    }

    all_new_edges = []

    # Pass 1: Entity extraction (always runs with spaCy)
    if 'spacy' in active_engines:
        entities = extract_entities(obj, config)
        results['entities_extracted'] = len(entities)

        created = auto_objectify(obj)
        results['objects_auto_created'] = len(created)

    # Pass 2: Shared entity connections
    if 'spacy' in active_engines:
        shared_edges = find_shared_entity_connections(obj, config)
        results['edges_from_shared'] = len(shared_edges)
        all_new_edges.extend(shared_edges)

    # Pass 3: Topic similarity
    if 'spacy' in active_engines:
        topic_edges = find_topic_connections(obj, config)
        results['edges_from_topics'] = len(topic_edges)
        all_new_edges.extend(topic_edges)

    # Optional engines (Task 11: auto-escalation stubs)
    if 'tfidf' in active_engines:
        tfidf_edges = _run_tfidf_engine(obj, config)
        results['edges_from_tfidf'] = len(tfidf_edges)
        all_new_edges.extend(tfidf_edges)

    if 'semantic' in active_engines:
        semantic_edges = _run_semantic_engine(obj, config)
        results['edges_from_semantic'] = len(semantic_edges)
        all_new_edges.extend(semantic_edges)

    # Count entity mention edges
    results['edges_from_entities'] = (
        Edge.objects
        .filter(from_object=obj, edge_type='mentions', is_auto=True)
        .count()
    )

    # Create connection Nodes for new edges (Task 12)
    nodes_created = _create_connection_nodes(all_new_edges, 'spacy')
    results['connection_nodes_created'] = nodes_created

    logger.info(
        'Connection engine results for "%s": %s',
        obj.display_title[:40],
        results,
    )

    return results

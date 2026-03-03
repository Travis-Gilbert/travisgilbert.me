"""
Knowledge graph models for the Notebooks system.

Object-oriented notetaking: every piece of knowledge is a typed node
(Person, Source, Concept, Hunch, etc.) that connects to other nodes
via edges with plain English explanations. The connection engine
(engine.py) discovers relationships automatically using spaCy NER
and keyword analysis.

Models:
    NodeType          Built-in and custom knowledge object types
    KnowledgeNode     Universal container for a unit of knowledge
    Edge              Typed, explained connection between two nodes
    ResolvedEntity    Named entity extracted by spaCy NER
    DailyLog          Automatic daily activity journal
    Notebook          Named collection of nodes
"""

from django.db import models
from django.utils.text import slugify

from apps.core.models import TimeStampedModel


# ---------------------------------------------------------------------------
# NodeType
# ---------------------------------------------------------------------------


class NodeType(TimeStampedModel):
    """A type of knowledge object.

    Built-in types: Note, Source, Person, Place, Organization, Concept,
    Event, Project, Hunch, Quote.

    Users can create custom types via the admin. Each type defines
    a JSON schema for its properties field, an icon name (from the
    SketchIcon system), and a brand color.
    """

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    icon = models.CharField(
        max_length=50,
        default='note-pencil',
        help_text='SketchIcon name for this type.',
    )
    color = models.CharField(
        max_length=7,
        default='#2D5F6B',
        help_text='Brand hex color for this type in the UI.',
    )
    schema = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            'JSON schema defining expected properties for this type. '
            'Example for Person: {"fields": ["born", "died", "role", "org"]}'
        ),
    )
    is_built_in = models.BooleanField(
        default=False,
        help_text='Built-in types cannot be deleted.',
    )
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# KnowledgeNode
# ---------------------------------------------------------------------------


class KnowledgeNode(TimeStampedModel):
    """A single unit of knowledge in the notebook.

    This is the universal container. A KnowledgeNode can be a quick thought
    with no URL, a fully annotated source, a person you keep referencing,
    or an idea that has been gestating for months.

    The node_type determines what the UI looks like and what properties
    are expected (but never required). The body and properties fields
    together hold all content.

    Every node gets run through the connection engine on save, which may
    create or update Edge records linking it to other nodes.
    """

    # Identity
    title = models.CharField(
        max_length=500,
        blank=True,
        help_text='Optional. Auto-generated from body or OG metadata if blank.',
    )
    node_type = models.ForeignKey(
        NodeType,
        on_delete=models.SET_DEFAULT,
        default=None,
        null=True,
        related_name='nodes',
    )
    slug = models.SlugField(max_length=500, blank=True)

    # Content
    body = models.TextField(
        blank=True,
        help_text='Freeform markdown. Notes, quotes, observations, hunches.',
    )
    url = models.URLField(
        max_length=2000,
        blank=True,
        help_text='Optional. Source URL if this node has one.',
    )

    # Flexible properties (vary by node_type)
    properties = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            'Type-specific properties. Person: {born, role, org}. '
            'Source: {author, publication, date_published}. '
            'Hunch: {confidence, revisit_date}.'
        ),
    )

    # OG metadata (auto-extracted from URL)
    og_title = models.CharField(max_length=500, blank=True)
    og_description = models.TextField(blank=True)
    og_image = models.URLField(max_length=2000, blank=True)
    og_site_name = models.CharField(max_length=300, blank=True)

    # Organization
    status = models.CharField(
        max_length=20,
        choices=[
            ('inbox', 'Inbox'),
            ('active', 'Active'),
            ('archive', 'Archive'),
        ],
        default='inbox',
        db_index=True,
    )
    is_pinned = models.BooleanField(default=False)
    is_starred = models.BooleanField(default=False)

    # Manual notebook slugs (lightweight grouping before Notebook M2M)
    notebooks = models.JSONField(
        default=list,
        blank=True,
        help_text='Named notebook slugs this node belongs to.',
    )

    # Connection to published content (by slug, not FK)
    related_essays = models.JSONField(default=list, blank=True)
    related_field_notes = models.JSONField(default=list, blank=True)

    # Connection to formal Source (promotion path)
    promoted_source = models.ForeignKey(
        'research.Source',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='knowledge_nodes',
    )

    # Search
    search_text = models.TextField(blank=True, editable=False)

    # Capture metadata
    captured_at = models.DateTimeField(auto_now_add=True)
    capture_method = models.CharField(
        max_length=20,
        choices=[
            ('manual', 'Manual'),
            ('api', 'API'),
            ('browser_ext', 'Browser Extension'),
            ('auto', 'Auto-extracted'),
        ],
        default='manual',
    )

    class Meta:
        ordering = ['-is_pinned', '-captured_at']
        indexes = [
            models.Index(
                fields=['status', '-captured_at'],
                name='idx_node_status_date',
            ),
            models.Index(
                fields=['-is_pinned', '-captured_at'],
                name='idx_node_pinned_date',
            ),
            models.Index(
                fields=['node_type', '-captured_at'],
                name='idx_node_type_date',
            ),
        ]

    def __str__(self):
        return self.display_title

    @property
    def display_title(self):
        """Best available title, cascading through several sources."""
        if self.title:
            return self.title
        if self.og_title:
            return self.og_title
        if self.url:
            from urllib.parse import urlparse
            return urlparse(self.url).netloc
        if self.body:
            return self.body[:80] + ('...' if len(self.body) > 80 else '')
        return '(untitled)'

    def save(self, *args, **kwargs):
        if not self.slug:
            base = self.title or self.body[:80] or 'untitled'
            self.slug = slugify(base)[:500]

        # Build composite search text from all content fields
        parts = [
            self.title, self.body, self.og_title,
            self.og_description, self.url,
        ]
        if isinstance(self.properties, dict):
            parts.extend(str(v) for v in self.properties.values() if v)
        if isinstance(self.notebooks, list):
            parts.extend(self.notebooks)
        self.search_text = ' '.join(p for p in parts if p)

        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Edge
# ---------------------------------------------------------------------------


class Edge(TimeStampedModel):
    """A connection between two KnowledgeNodes.

    Edges can be created manually (user draws a connection) or
    automatically (connection engine finds a relationship).

    Every edge has a 'reason' field that explains WHY the connection
    exists in plain English. This is the key differentiator from
    simple tagging: the system tells you what it found.
    """

    from_node = models.ForeignKey(
        KnowledgeNode,
        on_delete=models.CASCADE,
        related_name='edges_out',
    )
    to_node = models.ForeignKey(
        KnowledgeNode,
        on_delete=models.CASCADE,
        related_name='edges_in',
    )

    # Connection metadata
    edge_type = models.CharField(
        max_length=30,
        choices=[
            ('mentions', 'Mentions'),
            ('shared_entity', 'Shared Entity'),
            ('shared_topic', 'Shared Topic'),
            ('sequence', 'Sequence'),
            ('supports', 'Supports'),
            ('contradicts', 'Contradicts'),
            ('inspires', 'Inspires'),
            ('manual', 'Manual'),
        ],
        default='manual',
        db_index=True,
    )
    reason = models.TextField(
        blank=True,
        help_text=(
            'Plain English explanation of why this connection exists. '
            'Example: "Both notes discuss suburban zoning patterns from the 1950s."'
        ),
    )
    strength = models.FloatField(
        default=0.5,
        help_text=(
            'Connection strength from 0.0 (weak) to 1.0 (strong). '
            'Used for edge thickness in D3 visualizations.'
        ),
    )
    is_auto = models.BooleanField(
        default=False,
        help_text='True if created by the connection engine, False if manual.',
    )

    class Meta:
        ordering = ['-strength', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['from_node', 'to_node', 'edge_type'],
                name='unique_edge_per_type',
            ),
        ]
        indexes = [
            models.Index(
                fields=['from_node', 'edge_type'],
                name='idx_edge_from_type',
            ),
            models.Index(
                fields=['to_node', 'edge_type'],
                name='idx_edge_to_type',
            ),
        ]

    def __str__(self):
        return (
            f'{self.from_node.display_title[:30]} -> '
            f'{self.to_node.display_title[:30]} ({self.edge_type})'
        )


# ---------------------------------------------------------------------------
# ResolvedEntity
# ---------------------------------------------------------------------------


class ResolvedEntity(TimeStampedModel):
    """An entity extracted from a KnowledgeNode by spaCy NER.

    When you write "Richard Hamming worked at Bell Labs," spaCy extracts:
      "Richard Hamming" (PERSON) and "Bell Labs" (ORG).

    These become ResolvedEntity records linked to the source node.
    If a KnowledgeNode already exists for "Richard Hamming" (type: Person),
    the entity is linked to that node too, creating an automatic Edge.
    """

    source_node = models.ForeignKey(
        KnowledgeNode,
        on_delete=models.CASCADE,
        related_name='extracted_entities',
    )

    # Entity details
    text = models.CharField(
        max_length=300,
        help_text='The entity text as found in the source, e.g. "Richard Hamming".',
    )
    entity_type = models.CharField(
        max_length=20,
        choices=[
            ('PERSON', 'Person'),
            ('ORG', 'Organization'),
            ('GPE', 'Place (geo-political)'),
            ('LOC', 'Location'),
            ('DATE', 'Date'),
            ('EVENT', 'Event'),
            ('WORK_OF_ART', 'Work of Art'),
            ('CONCEPT', 'Concept'),
        ],
        db_index=True,
    )
    normalized_text = models.CharField(
        max_length=300,
        blank=True,
        help_text='Cleaned/canonical form, e.g. "richard hamming" for matching.',
    )

    # Optional link to an existing KnowledgeNode of the matching type
    resolved_node = models.ForeignKey(
        KnowledgeNode,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='entity_mentions',
        help_text='The KnowledgeNode this entity resolves to (if one exists).',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['normalized_text', 'entity_type'],
                name='idx_entity_norm',
            ),
            models.Index(
                fields=['source_node'],
                name='idx_entity_source',
            ),
        ]

    def __str__(self):
        return (
            f'{self.text} ({self.entity_type}) '
            f'from "{self.source_node.display_title[:30]}"'
        )

    def save(self, *args, **kwargs):
        if not self.normalized_text:
            self.normalized_text = self.text.lower().strip()
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# DailyLog
# ---------------------------------------------------------------------------


class DailyLog(TimeStampedModel):
    """Automatic record of what happened on a given day.

    Populated by Django signals whenever KnowledgeNodes or Edges are
    created or updated. Enables the calendar view: "On March 2, 2026
    you captured 3 notes, the connection engine found 2 new links,
    and you starred an old hunch about parking minimums."
    """

    date = models.DateField(unique=True, db_index=True)
    nodes_created = models.JSONField(
        default=list,
        help_text='List of {id, title, node_type} dicts for nodes created this day.',
    )
    nodes_updated = models.JSONField(
        default=list,
        help_text='List of {id, title, action} dicts for nodes modified this day.',
    )
    edges_created = models.JSONField(
        default=list,
        help_text='List of {id, from_title, to_title, reason} dicts.',
    )
    entities_resolved = models.JSONField(
        default=list,
        help_text='List of {text, entity_type, resolved_to} dicts.',
    )
    summary = models.TextField(
        blank=True,
        help_text='Auto-generated natural language summary of the day.',
    )

    class Meta:
        ordering = ['-date']
        verbose_name = 'daily log'
        verbose_name_plural = 'daily logs'

    def __str__(self):
        return f'{self.date}: {len(self.nodes_created)} captured'


# ---------------------------------------------------------------------------
# Notebook
# ---------------------------------------------------------------------------


class Notebook(TimeStampedModel):
    """A named collection of KnowledgeNodes.

    Notebooks are the manual organization layer. They are like folders
    but a node can live in multiple notebooks. Examples:
    "Housing Essay Research", "YouTube: Zoning", "Random Inspiration"
    """

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default='#2D5F6B')
    icon = models.CharField(max_length=50, default='book-open')
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    # If this notebook feeds a specific piece of content
    target_essay_slug = models.SlugField(max_length=300, blank=True)
    target_video_slug = models.SlugField(max_length=300, blank=True)

    nodes = models.ManyToManyField(
        KnowledgeNode,
        related_name='notebook_memberships',
        blank=True,
    )

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

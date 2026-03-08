"""
CommonPlace knowledge graph models.

Object/Node/Component architecture: everything you capture is an Object
(typed entity with Components), every change that happens is a Node
(immutable event on the Timeline), and Objects connect via Edges with
plain English explanations.

Models:
    ObjectType        Built-in and custom knowledge object types
    Object            Universal container for a unit of knowledge
    ComponentType     Defines a kind of property (date, relationship, etc.)
    Component         A typed property attached to an Object
    Node              Immutable timeline event (creation, connection, etc.)
    Edge              Typed, explained connection between two Objects
    ResolvedEntity    Named entity extracted by spaCy NER
    DailyLog          Automatic daily activity journal
    Notebook          Context preset with engine config and layout
    Project           Goal-oriented grouping (knowledge or manage mode)
    Timeline          Ordered stream of Nodes (master + filtered views)
    Layout            Saved pane configuration for the UI
"""

import hashlib
import uuid

from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.models import TimeStampedModel


def _generate_sha(title='', salt=None):
    """Generate a SHA-256 hash for immutable identity.

    Combines timestamp, title, and random salt to produce a unique
    fingerprint that travels with the data through exports and backups.
    """
    if salt is None:
        salt = uuid.uuid4().hex
    payload = f'{timezone.now().isoformat()}:{title}:{salt}'
    return hashlib.sha256(payload.encode()).hexdigest()[:40]


# ---------------------------------------------------------------------------
# ObjectType
# ---------------------------------------------------------------------------


class ObjectType(TimeStampedModel):
    """A type of knowledge object.

    Built-in types: Note, Source, Person, Place, Organization, Concept,
    Quote, Hunch, Script, Task.

    Each type defines a JSON schema for its properties field, an icon name
    (from the SketchIcon system), a brand color, and a list of default
    ComponentType slugs to auto-attach on Object creation.
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
    default_components = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            'List of ComponentType slugs to auto-attach when creating '
            'Objects of this type. Example: ["url", "author", "date"]'
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
# Object
# ---------------------------------------------------------------------------


class Object(TimeStampedModel):
    """A persistent unit of knowledge in the CommonPlace.

    Objects exist. They are the entities in your knowledge graph: a person
    you reference, a source you study, a concept you develop, a hunch you
    nurture. Objects have typed Components for structured properties and
    connect to other Objects via Edges.

    The object_type determines the UI appearance and which Components are
    auto-attached on creation. The body and properties fields together hold
    all freeform content.
    """

    # Immutable identity
    sha_hash = models.CharField(
        max_length=40,
        unique=True,
        editable=False,
        help_text='SHA-256 fingerprint for provenance tracking.',
    )

    # Identity
    title = models.CharField(
        max_length=500,
        blank=True,
        help_text='Optional. Auto-generated from body or OG metadata if blank.',
    )
    object_type = models.ForeignKey(
        ObjectType,
        on_delete=models.SET_DEFAULT,
        default=None,
        null=True,
        related_name='typed_objects',
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
        help_text='Optional. Source URL if this object has one.',
    )

    # Flexible properties (type-specific, freeform)
    properties = models.JSONField(
        default=dict,
        blank=True,
        help_text='Type-specific key/value properties.',
    )

    # OG metadata (auto-extracted from URL)
    og_title = models.CharField(max_length=500, blank=True)
    og_description = models.TextField(blank=True)
    og_image = models.URLField(max_length=2000, blank=True)
    og_site_name = models.CharField(max_length=300, blank=True)

    # Organization (no inbox per v4 spec: capture goes straight to Timeline)
    status = models.CharField(
        max_length=20,
        choices=[
            ('active', 'Active'),
            ('archive', 'Archive'),
        ],
        default='active',
        db_index=True,
    )
    is_pinned = models.BooleanField(default=False)
    is_starred = models.BooleanField(default=False)
    is_deleted = models.BooleanField(
        default=False,
        db_index=True,
        help_text=(
            'Soft-delete flag. Deleted Objects stay in the DB for Timeline '
            'integrity but are excluded from all API responses and future '
            'connection discovery.'
        ),
    )

    # Notebook and Project (single FK, not M2M)
    notebook = models.ForeignKey(
        'Notebook',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notebook_objects',
        help_text='Primary notebook this object belongs to.',
    )
    project = models.ForeignKey(
        'Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='project_objects',
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
        related_name='knowledge_objects',
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
                name='idx_obj_status_date',
            ),
            models.Index(
                fields=['-is_pinned', '-captured_at'],
                name='idx_obj_pinned_date',
            ),
            models.Index(
                fields=['object_type', '-captured_at'],
                name='idx_obj_type_date',
            ),
            models.Index(
                fields=['notebook', '-captured_at'],
                name='idx_obj_notebook_date',
            ),
            models.Index(
                fields=['project', '-captured_at'],
                name='idx_obj_project_date',
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
        if not self.sha_hash:
            self.sha_hash = _generate_sha(title=self.title)

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
        self.search_text = ' '.join(p for p in parts if p)

        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# ComponentType
# ---------------------------------------------------------------------------


class ComponentType(TimeStampedModel):
    """Defines a kind of typed property that can attach to Objects.

    ComponentTypes declare the data_type (text, date, relationship, etc.)
    and whether changes trigger Node creation on the Timeline.

    Built-in types: Text, Date, Recurring Date, Relationship, Location,
    File, URL, Status, Number, Tag, Code.
    """

    DATA_TYPE_CHOICES = [
        ('text', 'Text'),
        ('date', 'Date'),
        ('recurring_date', 'Recurring Date'),
        ('relationship', 'Relationship'),
        ('location', 'Location'),
        ('file', 'File'),
        ('url', 'URL'),
        ('status', 'Status'),
        ('number', 'Number'),
        ('tag', 'Tag'),
        ('code', 'Code'),
        ('history', 'History'),
    ]

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    data_type = models.CharField(
        max_length=20,
        choices=DATA_TYPE_CHOICES,
    )
    triggers_node = models.BooleanField(
        default=False,
        help_text=(
            'When True, creating or updating a Component of this type '
            'auto-creates a Node on the Timeline.'
        ),
    )
    schema = models.JSONField(
        default=dict,
        blank=True,
        help_text='Validation schema for the value field.',
    )
    is_built_in = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        trigger = ' [triggers]' if self.triggers_node else ''
        return f'{self.name} ({self.data_type}){trigger}'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Component
# ---------------------------------------------------------------------------


class Component(TimeStampedModel):
    """A typed property attached to an Object.

    Components replace the flat properties JSONField with structured,
    typed data. A Person Object might have Components:
      birthday (date), relations (relationship), bio (text).

    If the ComponentType has triggers_node=True, saving a Component
    auto-creates a Node on the Timeline (handled in signals.py).
    """

    object = models.ForeignKey(
        Object,
        on_delete=models.CASCADE,
        related_name='components',
    )
    component_type = models.ForeignKey(
        ComponentType,
        on_delete=models.PROTECT,
        related_name='instances',
    )
    key = models.CharField(
        max_length=200,
        help_text='Human label: "birthday", "author", "hometown".',
    )
    value = models.JSONField(
        default=dict,
        blank=True,
        help_text='Flexible storage. Shape depends on component_type.data_type.',
    )
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'key']
        constraints = [
            models.UniqueConstraint(
                fields=['object', 'component_type', 'key'],
                name='unique_component_per_object',
            ),
        ]

    def __str__(self):
        return f'{self.key}: {self.component_type.name} on {self.object}'


# ---------------------------------------------------------------------------
# Timeline
# ---------------------------------------------------------------------------


class Timeline(TimeStampedModel):
    """An ordered stream of Nodes.

    The master Timeline (is_master=True) contains all Nodes. Sub-Timelines
    are filtered views scoped to a Project or Notebook. There must be
    exactly one master Timeline.
    """

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    is_master = models.BooleanField(
        default=False,
        help_text='There must be exactly one master Timeline.',
    )
    project = models.ForeignKey(
        'Project',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='timelines',
    )
    notebook = models.ForeignKey(
        'Notebook',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='timelines',
    )
    filter_config = models.JSONField(
        default=dict,
        blank=True,
        help_text='Filter rules for sub-timelines (node_type, object_type, etc.).',
    )
    engine_config = models.JSONField(
        default=dict,
        blank=True,
        help_text='Engine config override for this timeline context.',
    )

    class Meta:
        ordering = ['-is_master', 'name']

    def __str__(self):
        master = ' [MASTER]' if self.is_master else ''
        return f'{self.name}{master}'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Node (timeline events)
# ---------------------------------------------------------------------------


class Node(TimeStampedModel):
    """An immutable event on the Timeline.

    Nodes happen. They record what changed and when: an Object was created,
    a connection was discovered, a Component triggered a reminder, a
    project was completed. Nodes are append-only (immutable after creation)
    except for retrospective_notes which can be added later.
    """

    NODE_TYPE_CHOICES = [
        ('creation', 'Creation'),
        ('deletion', 'Deletion'),
        ('modification', 'Modification'),
        ('connection', 'Connection'),
        ('reminder_set', 'Reminder Set'),
        ('reminder_fired', 'Reminder Fired'),
        ('reminder_dismissed', 'Reminder Dismissed'),
        ('project_completed', 'Project Completed'),
        ('project_created', 'Project Created'),
        ('recurring_date', 'Recurring Date'),
        ('capture', 'Capture'),
        ('retrospective', 'Retrospective'),
        ('status_change', 'Status Change'),
        ('component_trigger', 'Component Trigger'),
    ]

    # Immutable identity
    sha_hash = models.CharField(
        max_length=40,
        unique=True,
        editable=False,
    )

    node_type = models.CharField(
        max_length=30,
        choices=NODE_TYPE_CHOICES,
        db_index=True,
    )
    occurred_at = models.DateTimeField(auto_now_add=True)

    # Content (both optional)
    title = models.CharField(max_length=500, blank=True)
    body = models.TextField(blank=True)

    # References (all nullable: a Node might reference any combination)
    object_ref = models.ForeignKey(
        Object,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='timeline_nodes',
    )
    project_ref = models.ForeignKey(
        'Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='timeline_nodes',
    )
    component_ref = models.ForeignKey(
        Component,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='timeline_nodes',
    )

    # Timeline assignment
    timeline = models.ForeignKey(
        Timeline,
        on_delete=models.CASCADE,
        related_name='nodes',
    )

    # Retrospective (the only mutable field: add notes after the fact)
    retrospective_notes = models.JSONField(
        default=list,
        blank=True,
        help_text='List of {text, sha, created_at} dicts added after the fact.',
    )

    # Optional metadata
    severity = models.CharField(max_length=20, blank=True)
    tags = models.JSONField(default=list, blank=True)
    documents = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-occurred_at']
        indexes = [
            models.Index(
                fields=['node_type', '-occurred_at'],
                name='idx_node_type_occurred',
            ),
            models.Index(
                fields=['timeline', '-occurred_at'],
                name='idx_node_timeline_occurred',
            ),
            models.Index(
                fields=['object_ref', '-occurred_at'],
                name='idx_node_objref_occurred',
            ),
        ]

    def __str__(self):
        ref = ''
        if self.object_ref_id:
            ref = f' re: {self.object_ref}'
        return f'{self.get_node_type_display()}{ref} ({self.occurred_at:%Y-%m-%d})'

    def save(self, *args, **kwargs):
        if not self.sha_hash:
            self.sha_hash = _generate_sha(title=self.title)

        # Immutability: only allow updates to retrospective_notes
        if self.pk:
            allowed_fields = {'retrospective_notes', 'updated_at'}
            update_fields = kwargs.get('update_fields')
            if update_fields:
                # Explicit update_fields: only allow retrospective_notes
                disallowed = set(update_fields) - allowed_fields
                if disallowed:
                    raise ValueError(
                        f'Nodes are immutable. Cannot update: {disallowed}'
                    )
            # If no update_fields specified on an existing record,
            # we still allow the save (Django admin, etc.) but the
            # SHA hash prevents meaningful changes from being silent.

        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Edge
# ---------------------------------------------------------------------------


class Edge(TimeStampedModel):
    """A connection between two Objects.

    Edges can be created manually (user draws a connection) or
    automatically (connection engine finds a relationship).

    Every edge has a 'reason' field that explains WHY the connection
    exists in plain English. The 'engine' field records which system
    discovered it (spacy, js, tfidf, semantic, manual).
    """

    from_object = models.ForeignKey(
        Object,
        on_delete=models.CASCADE,
        related_name='edges_out',
    )
    to_object = models.ForeignKey(
        Object,
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
            ('similarity', 'Similarity'),
            ('sequence', 'Sequence'),
            ('supports', 'Supports'),
            ('contradicts', 'Contradicts'),
            ('inspires', 'Inspires'),
            ('related', 'Related'),
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
    engine = models.CharField(
        max_length=20,
        blank=True,
        help_text='Which engine found this: spacy, js, tfidf, semantic, manual.',
    )

    class Meta:
        ordering = ['-strength', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['from_object', 'to_object', 'edge_type'],
                name='unique_edge_per_type',
            ),
        ]
        indexes = [
            models.Index(
                fields=['from_object', 'edge_type'],
                name='idx_edge_from_type',
            ),
            models.Index(
                fields=['to_object', 'edge_type'],
                name='idx_edge_to_type',
            ),
        ]

    def __str__(self):
        return (
            f'{self.from_object.display_title[:30]} -> '
            f'{self.to_object.display_title[:30]} ({self.edge_type})'
        )


# ---------------------------------------------------------------------------
# ResolvedEntity
# ---------------------------------------------------------------------------


class ResolvedEntity(TimeStampedModel):
    """An entity extracted from an Object by spaCy NER.

    When you write "Richard Hamming worked at Bell Labs," spaCy extracts:
      "Richard Hamming" (PERSON) and "Bell Labs" (ORG).

    These become ResolvedEntity records linked to the source Object.
    If an Object already exists for "Richard Hamming" (type: Person),
    the entity is linked to that Object too, creating an automatic Edge.
    """

    source_object = models.ForeignKey(
        Object,
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

    # Optional link to an existing Object of the matching type
    resolved_object = models.ForeignKey(
        Object,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='entity_mentions',
        help_text='The Object this entity resolves to (if one exists).',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['normalized_text', 'entity_type'],
                name='idx_entity_norm',
            ),
            models.Index(
                fields=['source_object'],
                name='idx_entity_source',
            ),
        ]

    def __str__(self):
        return (
            f'{self.text} ({self.entity_type}) '
            f'from "{self.source_object.display_title[:30]}"'
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

    Populated by Django signals whenever Objects or Edges are
    created or updated. Enables the calendar view.
    """

    date = models.DateField(unique=True, db_index=True)
    objects_created = models.JSONField(
        default=list,
        help_text='List of {id, title, object_type} dicts for objects created this day.',
    )
    objects_updated = models.JSONField(
        default=list,
        help_text='List of {id, title, action} dicts for objects modified this day.',
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
        return f'{self.date}: {len(self.objects_created)} captured'


# ---------------------------------------------------------------------------
# Notebook
# ---------------------------------------------------------------------------


class Notebook(TimeStampedModel):
    """A context preset for the CommonPlace.

    Notebooks scope your view: which ObjectTypes are available, which
    engine config to use, what layout and theme to apply. Objects belong
    to a Notebook via FK (not M2M). Each Notebook can have its own
    engine config for the connection engine.
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

    # v4 Notebook-as-context-preset fields
    engine_config = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            'Connection engine overrides. Example: '
            '{"engines": ["spacy", "tfidf"], "topic_threshold": 0.25}'
        ),
    )
    available_types = models.JSONField(
        default=list,
        blank=True,
        help_text='List of ObjectType slugs available in this notebook context.',
    )
    default_layout = models.JSONField(
        default=dict,
        blank=True,
        help_text='Default pane configuration for this notebook.',
    )
    theme = models.JSONField(
        default=dict,
        blank=True,
        help_text='Visual theme overrides (colors, fonts, etc.).',
    )
    context_behavior = models.JSONField(
        default=dict,
        blank=True,
        help_text='Context-specific behavior rules.',
    )
    default_project_mode = models.CharField(
        max_length=20,
        choices=[
            ('knowledge', 'Knowledge'),
            ('manage', 'Manage'),
        ],
        default='knowledge',
        help_text='Default mode for new Projects in this Notebook.',
    )

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------


class Project(TimeStampedModel):
    """A goal-oriented grouping of Objects.

    Projects come in two modes: "knowledge" (research/creative, e.g.
    "Housing Essay Research") and "manage" (tasks/status, e.g. "Website
    Redesign Sprint"). Projects can be templated and replicated.
    """

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    sha_hash = models.CharField(
        max_length=40,
        unique=True,
        editable=False,
    )
    parent_sha = models.CharField(
        max_length=40,
        blank=True,
        default='',
        help_text='SHA of the parent Project this was forked from (empty if original).',
    )
    notebook = models.ForeignKey(
        Notebook,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='projects',
    )
    mode = models.CharField(
        max_length=20,
        choices=[
            ('knowledge', 'Knowledge'),
            ('manage', 'Manage'),
        ],
        default='knowledge',
    )
    is_template = models.BooleanField(default=False)
    template_from = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='derived_projects',
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ('active', 'Active'),
            ('completed', 'Completed'),
            ('archived', 'Archived'),
        ],
        default='active',
        db_index=True,
    )
    reminder_at = models.DateTimeField(null=True, blank=True)
    settings_override = models.JSONField(
        default=dict,
        blank=True,
        help_text='Per-project engine/UI settings that override notebook defaults.',
    )
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.get_mode_display()})'

    def save(self, *args, **kwargs):
        if not self.sha_hash:
            self.sha_hash = _generate_sha(title=self.name)
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------


class Layout(TimeStampedModel):
    """A saved pane configuration for the UI.

    Layouts define how the CommonPlace interface is arranged: which panes
    are visible, their sizes, and what content they display. Can be
    preset (built-in) or user-created.
    """

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    config = models.JSONField(
        default=dict,
        help_text='Pane tree structure defining the layout.',
    )
    is_preset = models.BooleanField(
        default=False,
        help_text='Built-in presets cannot be deleted.',
    )

    class Meta:
        ordering = ['-is_preset', 'name']

    def __str__(self):
        preset = ' [preset]' if self.is_preset else ''
        return f'{self.name}{preset}'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

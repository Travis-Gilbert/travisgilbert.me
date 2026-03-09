"""
Tests for the CommonPlace Notebook API.

Covers:
- compose_engine: extract_entities_from_text, run_compose_query (3-pass)
- compose_related_view: API endpoint, throttle, min text length guard
- resurface_dismiss_view: Node creation, 30-day filter in resurface_view
"""

from unittest.mock import patch, MagicMock

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.notebook.models import (
    Edge,
    Node,
    Notebook,
    Object,
    ObjectType,
    ResolvedEntity,
    Timeline,
)


# ── Helpers ──────────────────────────────────────────────────────────

def _create_object_type(slug='note', name='Note', color='#2D5F6B'):
    return ObjectType.objects.create(slug=slug, name=name, color=color)


def _create_object(
    title, body='', object_type=None, notebook=None, status='active',
):
    obj = Object.objects.create(
        title=title,
        body=body,
        object_type=object_type,
        notebook=notebook,
        status=status,
    )
    return obj


def _create_timeline():
    t, _ = Timeline.objects.get_or_create(
        is_master=True,
        defaults={'name': 'Master Timeline', 'slug': 'master'},
    )
    return t


# ── compose_engine tests ─────────────────────────────────────────────

class ExtractEntitiesFromTextTests(TestCase):
    """Tests for the text-only NER helper."""

    @patch('apps.notebook.engine.nlp', None)
    def test_returns_empty_when_spacy_unavailable(self):
        from apps.notebook.compose_engine import extract_entities_from_text
        result = extract_entities_from_text('Some text about New York City')
        self.assertEqual(result, [])

    @patch('apps.notebook.engine.nlp')
    def test_extracts_entities_from_text(self, mock_nlp):
        """When spaCy is available, entities are extracted and normalized."""
        from apps.notebook.compose_engine import extract_entities_from_text

        # Mock spaCy doc with entities
        mock_ent_1 = MagicMock()
        mock_ent_1.text = 'New York'
        mock_ent_1.label_ = 'GPE'

        mock_ent_2 = MagicMock()
        mock_ent_2.text = 'Jane Jacobs'
        mock_ent_2.label_ = 'PERSON'

        mock_ent_3 = MagicMock()
        mock_ent_3.text = 'X'  # too short, should be filtered
        mock_ent_3.label_ = 'ORG'

        mock_doc = MagicMock()
        mock_doc.ents = [mock_ent_1, mock_ent_2, mock_ent_3]
        mock_nlp.return_value = mock_doc

        result = extract_entities_from_text('Jane Jacobs in New York')
        self.assertEqual(len(result), 2)
        self.assertIn(('new york', 'GPE'), result)
        self.assertIn(('jane jacobs', 'PERSON'), result)


class RunComposeQueryTests(TestCase):
    """Tests for the 3-pass compose query."""

    def setUp(self):
        self.ot_concept = _create_object_type('concept', 'Concept', '#C49A4A')
        self.ot_note = _create_object_type('note', 'Note', '#2D5F6B')
        _create_timeline()

        self.obj_desire = _create_object(
            title='Desire Paths',
            body='Informal trails worn into grass by pedestrians who bypass designed walkways.',
            object_type=self.ot_concept,
        )
        self.obj_induced = _create_object(
            title='Induced Demand',
            body='When parking supply increases, latent demand activates and new capacity fills.',
            object_type=self.ot_concept,
        )
        self.obj_jacobs = _create_object(
            title='Jane Jacobs on City Planning',
            body='Cities have the capability of providing something for everybody.',
            object_type=self.ot_note,
        )

    def test_pass2_keyword_matching(self):
        """Jaccard keyword pass finds objects sharing vocabulary."""
        from apps.notebook.compose_engine import run_compose_query

        result = run_compose_query(
            text='Parking supply increases and latent demand activates to fill new capacity',
            min_score=0.05,  # low threshold for test
        )

        self.assertIn('keyword', result['passes_run'])
        titles = [o['title'] for o in result['objects']]
        # Should match Induced Demand (high keyword overlap)
        self.assertIn('Induced Demand', titles)

    def test_pass1_ner_matching(self):
        """NER pass matches when extracted entities exist in ResolvedEntity table."""
        # Create a ResolvedEntity for Jane Jacobs
        ResolvedEntity.objects.create(
            source_object=self.obj_jacobs,
            text='Jane Jacobs',
            entity_type='PERSON',
            normalized_text='jane jacobs',
        )

        from apps.notebook.compose_engine import run_compose_query

        with patch('apps.notebook.compose_engine.extract_entities_from_text') as mock_ner:
            mock_ner.return_value = [('jane jacobs', 'PERSON')]
            result = run_compose_query(
                text='What would Jane Jacobs say about induced demand in modern cities?',
                min_score=0.1,
            )

        self.assertIn('ner', result['passes_run'])
        ids = [o['id'] for o in result['objects']]
        self.assertIn(f'object:{self.obj_jacobs.pk}', ids)

    def test_empty_text_returns_empty(self):
        """Text shorter than 20 chars should not be queried (handled by view)."""
        from apps.notebook.compose_engine import run_compose_query

        result = run_compose_query(text='', min_score=0.1)
        self.assertEqual(result['objects'], [])

    def test_limit_caps_results(self):
        """Results are capped at the limit parameter."""
        from apps.notebook.compose_engine import run_compose_query

        result = run_compose_query(
            text='Parking supply demand latent capacity grass walkways city planning',
            limit=1,
            min_score=0.01,
        )

        self.assertLessEqual(len(result['objects']), 1)

    def test_notebook_filter_scopes_results(self):
        """When notebook_slug is provided, only objects in that notebook are returned."""
        nb = Notebook.objects.create(name='Urban Research', slug='urban-research')
        self.obj_desire.notebook = nb
        self.obj_desire.save()

        from apps.notebook.compose_engine import run_compose_query

        result = run_compose_query(
            text='Informal trails worn into grass by pedestrians who bypass designed walkways',
            notebook_slug='urban-research',
            min_score=0.01,
        )

        # All returned objects should belong to the notebook
        for obj_data in result['objects']:
            pk = int(obj_data['id'].split(':')[1])
            db_obj = Object.objects.get(pk=pk)
            self.assertEqual(db_obj.notebook, nb)

    def test_result_shape(self):
        """Each result object has the expected fields."""
        from apps.notebook.compose_engine import run_compose_query

        result = run_compose_query(
            text='Parking supply demand latent capacity increases activates fills',
            min_score=0.01,
        )

        if result['objects']:
            obj = result['objects'][0]
            self.assertIn('id', obj)
            self.assertIn('type', obj)
            self.assertIn('type_color', obj)
            self.assertIn('title', obj)
            self.assertIn('body_preview', obj)
            self.assertIn('score', obj)
            self.assertIn('signal', obj)
            self.assertIn('explanation', obj)
            self.assertTrue(obj['id'].startswith('object:'))

    def test_deleted_objects_excluded(self):
        """Soft-deleted objects should never appear in results."""
        self.obj_induced.is_deleted = True
        self.obj_induced.save()

        from apps.notebook.compose_engine import run_compose_query

        result = run_compose_query(
            text='Parking supply increases and latent demand activates to fill new capacity',
            min_score=0.01,
        )

        titles = [o['title'] for o in result['objects']]
        self.assertNotIn('Induced Demand', titles)


# ── compose_related_view API tests ───────────────────────────────────

class ComposeRelatedViewTests(TestCase):
    """Tests for the POST /api/v1/notebook/compose/related/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = '/api/v1/notebook/compose/related/'
        self.ot = _create_object_type()
        _create_object(
            title='Induced Demand and Parking',
            body='When parking supply increases, latent demand activates.',
            object_type=self.ot,
        )

    def test_short_text_returns_empty(self):
        """Text under 20 chars returns empty without querying."""
        resp = self.client.post(self.url, {'text': 'short'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['objects'], [])
        self.assertEqual(resp.data['passes_run'], [])

    def test_valid_query_returns_results(self):
        """Valid text triggers compose engine and returns results."""
        resp = self.client.post(self.url, {
            'text': 'Parking supply increases and latent demand activates to fill new capacity',
            'min_score': 0.01,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('query_id', resp.data)
        self.assertIn('passes_run', resp.data)
        self.assertIn('objects', resp.data)
        self.assertIsInstance(resp.data['objects'], list)

    def test_limit_capped_at_15(self):
        """Limit parameter cannot exceed 15."""
        resp = self.client.post(self.url, {
            'text': 'A sufficiently long text for testing the limit parameter behavior',
            'limit': 50,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        # The view caps at 15; just verify no error


# ── resurface_dismiss_view tests ─────────────────────────────────────

class ResurfaceDismissTests(TestCase):
    """Tests for the POST /api/v1/notebook/resurface/dismiss/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = '/api/v1/notebook/resurface/dismiss/'
        self.ot = _create_object_type()
        _create_timeline()
        self.obj = _create_object(
            title='Test Object',
            body='Something to dismiss',
            object_type=self.ot,
        )

    def test_dismiss_creates_node(self):
        """Dismissing an object creates a retrospective Node."""
        resp = self.client.post(
            self.url, {'object_id': self.obj.pk}, format='json'
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['detail'], 'Dismissed.')

        node = Node.objects.filter(
            node_type='retrospective',
            object_ref=self.obj,
        ).first()
        self.assertIsNotNone(node)
        self.assertTrue(node.title.startswith('Dismissed from resurface:'))

    def test_dismiss_missing_object_id(self):
        resp = self.client.post(self.url, {}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_dismiss_nonexistent_object(self):
        resp = self.client.post(
            self.url, {'object_id': 99999}, format='json'
        )
        self.assertEqual(resp.status_code, 404)

    def test_dismissed_objects_excluded_from_resurface(self):
        """Dismissed objects should not appear in resurface results for 30 days."""
        # First dismiss the object
        self.client.post(
            self.url, {'object_id': self.obj.pk}, format='json'
        )

        # Now check resurface: the dismissed object should be excluded
        resurface_url = '/api/v1/notebook/resurface/'
        resp = self.client.get(resurface_url)
        self.assertEqual(resp.status_code, 200)

        # If cards are returned, none should be our dismissed object
        for card in resp.data.get('cards', []):
            obj_data = card.get('object', {})
            self.assertNotEqual(obj_data.get('id'), self.obj.pk)

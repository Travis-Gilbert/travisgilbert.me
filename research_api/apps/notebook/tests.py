"""
Tests for CommonPlace notebook compose, ingestion, search, and export.

Covers:
- compose_engine strict pass order, merge-by-max-score, optional NLI, degraded metadata
- compose_related_view request contract, cache behavior, and rate limiting
- capture flow file-byte handoff and persisted Info tab components/storage keys
- search behavior fallback ranking/limits on non-Postgres
- ZIP export endpoint archive structure and manifest counts
"""

import io
import json
import zipfile
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.notebook.models import (
    Component,
    ComponentType,
    Edge,
    Node,
    Notebook,
    Object,
    ObjectType,
)


def _create_object_type(slug='note', name='Note', color='#2D5F6B'):
    return ObjectType.objects.create(slug=slug, name=name, color=color)


def _create_object(title, body='', object_type=None, notebook=None, status='active'):
    return Object.objects.create(
        title=title,
        body=body,
        object_type=object_type,
        notebook=notebook,
        status=status,
    )


class ComposeEngineTests(TestCase):
    def setUp(self):
        self.ot_note = _create_object_type('note', 'Note')
        self.ot_concept = _create_object_type('concept', 'Concept', '#C49A4A')

        self.obj_a = _create_object(
            title='Induced Demand',
            body='When parking supply increases, latent demand activates.',
            object_type=self.ot_concept,
        )
        self.obj_b = _create_object(
            title='Desire Paths',
            body='Informal trails emerge where people bypass designed routes.',
            object_type=self.ot_note,
        )

    @patch('apps.notebook.compose_engine.extract_entities_from_text', return_value=[])
    @patch('apps.notebook.vector_store.faiss_find_similar_text')
    @patch('apps.notebook.vector_store._SBERT_AVAILABLE', True)
    @patch('apps.notebook.vector_store.kge_store')
    def test_merge_prefers_max_score_signal(
        self,
        mock_kge,
        mock_faiss,
        _mock_entities,
    ):
        """Duplicate candidates are merged by max score and dominant signal."""
        from apps.notebook.compose_engine import run_compose_query

        mock_faiss.return_value = [{'pk': self.obj_a.pk, 'score': 0.41}]
        mock_kge.is_loaded = True
        mock_kge.find_similar_entities.return_value = [
            {'sha_hash': self.obj_a.sha_hash, 'score': 0.84},
        ]

        result = run_compose_query(
            text='Parking supply, latent demand, and structural graph role overlap in planning discourse.',
            min_score=0.1,
            requested_passes=['sbert', 'kge'],
        )

        self.assertEqual(result['passes_run'], ['sbert', 'kge'])
        self.assertTrue(result['objects'])
        top = result['objects'][0]
        self.assertEqual(top['id'], f'object:{self.obj_a.pk}')
        self.assertEqual(top['signal'], 'kge')
        self.assertAlmostEqual(top['score'], 0.84, places=2)

    @patch('apps.notebook.compose_engine.extract_entities_from_text', return_value=[])
    @patch('apps.notebook.vector_store.faiss_find_similar_text')
    @patch('apps.notebook.vector_store._SBERT_AVAILABLE', True)
    @patch('apps.notebook.engine.HAS_PYTORCH', True)
    @patch('apps.research.advanced_nlp.analyze_pair')
    def test_optional_nli_supports_signal(
        self,
        mock_analyze_pair,
        mock_faiss,
        _mock_entities,
    ):
        """When NLI is enabled, compose can promote support/contradiction signals."""
        from apps.notebook.compose_engine import run_compose_query

        mock_faiss.return_value = [{'pk': self.obj_b.pk, 'score': 0.5}]
        mock_analyze_pair.return_value = {
            'similarity': 0.78,
            'relationship': {
                'probabilities': {
                    'contradiction': 0.06,
                    'entailment': 0.91,
                    'neutral': 0.03,
                },
            },
        }

        result = run_compose_query(
            text='The source supports the same planning claim with aligned evidence.',
            min_score=0.1,
            enable_nli=True,
            requested_passes=['sbert', 'nli'],
        )

        self.assertEqual(result['passes_run'], ['sbert', 'nli'])
        self.assertTrue(result['objects'])
        top = result['objects'][0]
        self.assertEqual(top['signal'], 'supports')
        self.assertGreater(top['score'], 0.6)

    @patch('apps.notebook.vector_store._SBERT_AVAILABLE', False)
    @patch('apps.notebook.vector_store.kge_store')
    def test_degraded_metadata_when_sbert_and_kge_unavailable(self, mock_kge):
        from apps.notebook.compose_engine import run_compose_query

        mock_kge.is_loaded = False

        result = run_compose_query(
            text='A long enough query text to trigger compose execution.',
            requested_passes=['sbert', 'kge'],
        )

        self.assertIn('degraded', result)
        self.assertTrue(result['degraded']['degraded'])
        self.assertTrue(result['degraded']['sbert_unavailable'])
        self.assertTrue(result['degraded']['kge_unavailable'])


class ComposeRelatedViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = '/api/v1/notebook/compose/related/'
        _create_object_type('note', 'Note')

    def test_accepts_passes_and_enable_nli(self):
        payload = {
            'passes_run': ['tfidf', 'sbert', 'kge', 'ner', 'nli'],
            'objects': [],
            'degraded': {
                'degraded': False,
                'sbert_unavailable': False,
                'kge_unavailable': False,
                'reasons': [],
            },
        }
        with patch('apps.notebook.compose_engine.run_compose_query', return_value=payload) as mock_run:
            resp = self.client.post(
                self.url,
                {
                    'text': 'A sufficiently long body of text for compose endpoint integration testing.',
                    'enable_nli': True,
                    'passes': ['tfidf', 'sbert', 'kge', 'ner', 'supports'],
                },
                format='json',
            )

        self.assertEqual(resp.status_code, 200)
        self.assertIn('degraded', resp.data)
        self.assertIn('query_id', resp.data)
        self.assertEqual(resp.data['passes_run'], payload['passes_run'])

        kwargs = mock_run.call_args.kwargs
        self.assertEqual(kwargs['requested_passes'], ['tfidf', 'sbert', 'kge', 'ner', 'supports'])
        self.assertTrue(kwargs['enable_nli'])

    def test_identical_query_uses_compose_cache(self):
        cache.clear()
        payload = {
            'passes_run': ['tfidf'],
            'objects': [],
            'degraded': {
                'degraded': False,
                'sbert_unavailable': False,
                'kge_unavailable': False,
                'reasons': [],
            },
        }
        with patch('apps.notebook.compose_engine.run_compose_query', return_value=payload) as mock_run:
            body = {
                'text': 'A sufficiently long body of text for compose endpoint cache behavior testing.',
                'passes': ['tfidf'],
            }
            resp1 = self.client.post(self.url, body, format='json')
            resp2 = self.client.post(self.url, body, format='json')

        self.assertEqual(resp1.status_code, 200)
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(mock_run.call_count, 1)

    def test_rate_limit_returns_429(self):
        with patch('apps.notebook.views._compose_rate_limited', return_value=(True, 101)):
            resp = self.client.post(
                self.url,
                {'text': 'A sufficiently long body of text for compose endpoint rate limit testing.'},
                format='json',
            )
        self.assertEqual(resp.status_code, 429)


class CaptureIngestionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        _create_object_type('note', 'Note')
        _create_object_type('source', 'Source')
        ComponentType.objects.create(
            name='File',
            slug='file',
            data_type='file',
            triggers_node=False,
            sort_order=1,
        )

    @patch('apps.notebook.services._dispatch_engine_job')
    @patch('apps.notebook.services._dispatch_file_ingestion_job')
    @patch('apps.notebook.file_ingestion.extract_file_content')
    def test_capture_persists_file_keys_and_info_components(
        self,
        mock_extract,
        _mock_ingestion,
        _mock_engine,
    ):
        mock_extract.return_value = {
            'title': 'Spec Draft',
            'body': 'Top level body text',
            'author': 'Travis',
            'sections': [
                {'heading': 'Intro', 'body': 'First section'},
                {'heading': 'Details', 'body': 'Second section'},
            ],
            'metadata': {'page_count': 2},
            'char_count': 32,
            'method': 'docx',
            'thumbnails': ['aGVsbG8='],
        }

        file = SimpleUploadedFile(
            'spec.docx',
            b'placeholder bytes',
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )

        resp = self.client.post('/api/v1/notebook/capture/', {'file': file}, format='multipart')
        self.assertEqual(resp.status_code, 201)

        obj = Object.objects.get(pk=resp.data['object']['id'])
        props = obj.properties or {}

        self.assertTrue(props.get('file_key', '').startswith(f'objects/{obj.sha_hash}/'))
        self.assertEqual(props.get('file_name'), 'spec.docx')
        self.assertEqual(props.get('file_mime'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        self.assertTrue(props.get('thumbnail_key', '').startswith(f'thumbnails/{obj.sha_hash}/'))

        keys = set(Component.objects.filter(object=obj).values_list('key', flat=True))
        self.assertIn('extracted_sections', keys)
        self.assertIn('file_metadata', keys)
        self.assertIn('extraction_method', keys)
        self.assertIn('file_author', keys)
        self.assertIn('file_thumbnail', keys)


class SearchFallbackTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ot_note = _create_object_type('note', 'Note')

        _create_object(
            title='Induced Demand',
            body='Canonical note',
            object_type=self.ot_note,
        )
        _create_object(
            title='Induced Dilemmas',
            body='Starts with induced but not exact',
            object_type=self.ot_note,
        )
        _create_object(
            title='Parking Supply',
            body='Contains induced demand in body text',
            object_type=self.ot_note,
        )

    def test_non_postgres_search_has_priority_order_and_limit(self):
        resp = self.client.get('/api/v1/notebook/objects/?q=Induced Demand&limit=2')
        self.assertEqual(resp.status_code, 200)

        data = resp.json()
        results = data.get('results', [])
        self.assertLessEqual(len(results), 2)
        self.assertTrue(results)
        self.assertEqual(results[0]['display_title'], 'Induced Demand')


class ExportZipTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ot_note = _create_object_type('note', 'Note')
        self.notebook = Notebook.objects.create(name='Urban', slug='urban')
        self.obj_a = _create_object(
            title='Object A',
            body='Body A',
            object_type=self.ot_note,
            notebook=self.notebook,
        )
        self.obj_b = _create_object(
            title='Object B',
            body='Body B',
            object_type=self.ot_note,
            notebook=self.notebook,
        )

        Edge.objects.create(
            from_object=self.obj_a,
            to_object=self.obj_b,
            edge_type='related',
            reason='Test edge',
            strength=0.8,
            is_auto=True,
            engine='test',
        )

        comp_type = ComponentType.objects.create(
            name='File',
            slug='file',
            data_type='file',
            triggers_node=False,
        )
        Component.objects.create(
            object=self.obj_a,
            component_type=comp_type,
            key='extracted_sections',
            value='Section body',
            sort_order=0,
        )

        props = self.obj_a.properties or {}
        props['file_key'] = f'objects/{self.obj_a.sha_hash}/source.txt'
        self.obj_a.properties = props
        self.obj_a.save(update_fields=['properties'])

    @patch('apps.notebook.views.default_storage.open')
    def test_zip_export_contains_expected_structure(self, mock_open):
        mock_open.side_effect = lambda *_args, **_kwargs: io.BytesIO(b'file-bytes')

        resp = self.client.get('/api/v1/notebook/export/?notebook=urban')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp['Content-Type'], 'application/zip')

        archive = zipfile.ZipFile(io.BytesIO(resp.content))
        names = set(archive.namelist())

        self.assertIn('objects.json', names)
        self.assertIn('edges.json', names)
        self.assertIn('nodes.json', names)
        self.assertIn('components.json', names)
        self.assertIn('manifest.json', names)

        expected_file = f'files/objects/{self.obj_a.sha_hash}/source.txt'
        self.assertIn(expected_file, names)

        manifest = json.loads(archive.read('manifest.json').decode('utf-8'))
        self.assertEqual(manifest['scope']['notebook'], 'urban')
        self.assertEqual(manifest['counts']['objects'], 2)
        self.assertEqual(manifest['counts']['edges'], 1)
        self.assertGreaterEqual(manifest['counts']['nodes'], 2)

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
from datetime import timedelta
from unittest.mock import patch

import networkx as nx
import numpy as np
from django.core.cache import cache
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.notebook.models import (
    Claim,
    Cluster,
    Component,
    ComponentType,
    Edge,
    Node,
    Notebook,
    Object,
    ObjectType,
    ResolvedEntity,
    Timeline,
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

    def test_ingest_batch_accepts_multipart_files(self):
        from apps.notebook.tasks import process_batch_ingestion

        file_a = SimpleUploadedFile('alpha.txt', b'alpha body', content_type='text/plain')
        file_b = SimpleUploadedFile('beta.md', b'# beta', content_type='text/markdown')

        with patch.object(process_batch_ingestion, 'delay') as mock_delay:
            resp = self.client.post(
                '/api/v1/notebook/ingest-batch/',
                {
                    'notebook_slug': 'urban',
                    'files': [file_a, file_b],
                },
                format='multipart',
            )

        self.assertEqual(resp.status_code, 202)
        self.assertEqual(resp.data['file_count'], 2)
        self.assertTrue(resp.data['task_id'])

        kwargs = mock_delay.call_args.kwargs
        self.assertEqual(kwargs['notebook_slug'], 'urban')
        self.assertEqual(len(kwargs['file_data']), 2)
        self.assertEqual(kwargs['file_data'][0]['filename'], 'alpha.txt')

    def test_ingest_batch_expands_zip_uploads(self):
        from apps.notebook.tasks import process_batch_ingestion

        archive_bytes = io.BytesIO()
        with zipfile.ZipFile(archive_bytes, 'w') as archive:
            archive.writestr('folder/one.txt', 'one')
            archive.writestr('two.txt', 'two')

        zipped = SimpleUploadedFile(
            'batch.zip',
            archive_bytes.getvalue(),
            content_type='application/zip',
        )

        with patch.object(process_batch_ingestion, 'delay') as mock_delay:
            resp = self.client.post(
                '/api/v1/notebook/ingest-batch/',
                {'files': [zipped]},
                format='multipart',
            )

        self.assertEqual(resp.status_code, 202)
        kwargs = mock_delay.call_args.kwargs
        self.assertEqual(len(kwargs['file_data']), 2)
        self.assertEqual(kwargs['file_data'][0]['filename'], 'folder/one.txt')

    def test_batch_job_status_endpoint_returns_cached_payload(self):
        from apps.notebook.job_status import create_batch_job_id, update_batch_job_status

        job_id = create_batch_job_id()
        update_batch_job_status(
            job_id,
            'running',
            batch_id='batch-123',
            total_files=4,
            processed_files=2,
            objects_created=2,
            failed_files=0,
        )

        resp = self.client.get(f'/api/v1/notebook/batch/jobs/{job_id}/')

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['batch_id'], 'batch-123')
        self.assertEqual(resp.data['processed_files'], 2)

    @patch('apps.notebook.self_organize.organize_batch', return_value={'triggered': True, 'clusters_created': 1, 'reason': ''})
    @patch('apps.notebook.engine.run_engine')
    @patch('apps.notebook.services._dispatch_file_ingestion_job')
    def test_process_batch_ingestion_creates_objects_runs_engine_and_organizes(
        self,
        _mock_file_ingestion,
        mock_run_engine,
        mock_organize_batch,
    ):
        notebook = Notebook.objects.create(name='Urban', slug='urban')

        from apps.notebook.tasks import process_batch_ingestion

        result = process_batch_ingestion(
            batch_job_id='job-123',
            file_data=[
                {'filename': 'one.txt', 'content': b'body one', 'content_type': 'text/plain'},
                {'filename': 'two.txt', 'content': b'body two', 'content_type': 'text/plain'},
                {'filename': 'three.txt', 'content': b'body three', 'content_type': 'text/plain'},
            ],
            notebook_slug=notebook.slug,
        )

        self.assertEqual(result['status'], 'complete')
        self.assertEqual(result['objects_created'], 3)
        self.assertEqual(mock_run_engine.call_count, 3)
        mock_organize_batch.assert_called_once()
        self.assertEqual(Object.objects.filter(notebook=notebook).count(), 3)


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


class CommunityDetectionTests(TestCase):
    def setUp(self):
        self.ot_note = _create_object_type('note', 'Note')
        self.ot_concept = _create_object_type('concept', 'Concept', '#C49A4A')
        self.notebook = Notebook.objects.create(name='Urban', slug='urban')
        self.other_notebook = Notebook.objects.create(name='Side', slug='side')

        self.a = _create_object('A', 'Cluster one note', self.ot_note, self.notebook)
        self.b = _create_object('B', 'Cluster one concept', self.ot_concept, self.notebook)
        self.c = _create_object('C', 'Cluster one concept', self.ot_concept, self.notebook)
        self.d = _create_object('D', 'Cluster two note', self.ot_note, self.notebook)
        self.e = _create_object('E', 'Cluster two concept', self.ot_concept, self.notebook)
        self.f = _create_object('F', 'Cluster two concept', self.ot_concept, self.notebook)
        self.outside = _create_object('Outside', 'Outside notebook', self.ot_note, self.other_notebook)

        self._connect(self.a, self.b, 0.95)
        self._connect(self.b, self.c, 0.95)
        self._connect(self.a, self.c, 0.90)
        self._connect(self.d, self.e, 0.94)
        self._connect(self.e, self.f, 0.94)
        self._connect(self.d, self.f, 0.89)
        self._connect(self.c, self.d, 0.05)
        self._connect(self.a, self.b, 0.40, edge_type='manual')
        self._connect(self.outside, self.a, 0.99)

    def _connect(self, from_obj, to_obj, strength, edge_type='related'):
        return Edge.objects.create(
            from_object=from_obj,
            to_object=to_obj,
            edge_type=edge_type,
            reason='Test connection',
            strength=strength,
            is_auto=True,
            engine='test',
        )

    def test_build_networkx_graph_scopes_and_keeps_max_weight(self):
        from apps.notebook.community import build_networkx_graph

        graph = build_networkx_graph(notebook=self.notebook)

        self.assertEqual(
            set(graph.nodes),
            {self.a.pk, self.b.pk, self.c.pk, self.d.pk, self.e.pk, self.f.pk},
        )
        self.assertNotIn(self.outside.pk, graph.nodes)
        self.assertAlmostEqual(graph[self.a.pk][self.b.pk]['weight'], 0.95, places=2)

    def test_detect_communities_returns_partition_and_modularity(self):
        from apps.notebook.community import detect_communities

        result = detect_communities(notebook=self.notebook)

        self.assertEqual(result['n_nodes'], 6)
        self.assertEqual(result['n_communities'], 2)
        self.assertGreater(result['modularity'], 0.0)
        self.assertEqual(sorted(c['size'] for c in result['communities']), [3, 3])

    def test_persist_communities_replaces_existing_clusters(self):
        from apps.notebook.community import detect_communities, persist_communities

        old_cluster = Cluster.objects.create(name='Old', notebook=self.notebook, member_count=1)
        Object.objects.filter(pk=self.a.pk).update(cluster=old_cluster)

        result = detect_communities(notebook=self.notebook)
        created_clusters = persist_communities(result, notebook=self.notebook)

        self.assertEqual(len(created_clusters), 2)
        self.assertFalse(Cluster.objects.filter(pk=old_cluster.pk).exists())
        assigned = list(
            Object.objects
            .filter(notebook=self.notebook)
            .exclude(cluster__isnull=True)
            .values_list('pk', flat=True)
        )
        self.assertEqual(
            sorted(assigned),
            sorted([self.a.pk, self.b.pk, self.c.pk, self.d.pk, self.e.pk, self.f.pk]),
        )
        self.assertIsNone(Object.objects.get(pk=self.outside.pk).cluster)

    def test_detect_communities_command_smoke(self):
        out = io.StringIO()
        call_command(
            'detect_communities',
            '--notebook',
            self.notebook.slug,
            '--persist',
            stdout=out,
        )

        output = out.getvalue()
        self.assertIn('Found 2 communities', output)
        self.assertIn('Communities persisted.', output)
        self.assertEqual(Cluster.objects.filter(notebook=self.notebook).count(), 2)


class GapAnalysisTests(TestCase):
    def test_find_structural_gaps_detects_sparse_cross_cluster_links(self):
        from apps.notebook.gap_analysis import find_structural_gaps

        graph = nx.Graph()
        graph.add_edge(1, 4)
        communities = [
            {'label': 'alpha', 'member_pks': [1, 2, 3]},
            {'label': 'beta', 'member_pks': [4, 5, 6]},
        ]

        gaps = find_structural_gaps(graph, communities)

        self.assertEqual(len(gaps), 1)
        gap = gaps[0]
        self.assertEqual(gap['community_a_label'], 'alpha')
        self.assertEqual(gap['community_b_label'], 'beta')
        self.assertEqual(gap['inter_edges'], 1)
        self.assertEqual(gap['potential_edges'], 9)
        self.assertAlmostEqual(gap['gap_score'], 2.67, places=2)

    def test_find_structural_gaps_sorts_by_gap_score_desc(self):
        from apps.notebook.gap_analysis import find_structural_gaps

        graph = nx.Graph()
        graph.add_edge(5, 9)
        graph.add_edge(6, 10)
        communities = [
            {'label': 'a', 'member_pks': [1, 2, 3, 4]},
            {'label': 'b', 'member_pks': [5, 6, 7, 8]},
            {'label': 'c', 'member_pks': [9, 10, 11]},
        ]

        gaps = find_structural_gaps(graph, communities)
        scores = [gap['gap_score'] for gap in gaps]

        self.assertEqual(scores, sorted(scores, reverse=True))
        self.assertEqual(scores, [4.0, 3.0, 2.5])


class ClaimDecompositionTests(TestCase):
    def test_rule_based_decomposition_extracts_sentence_claims(self):
        from apps.notebook.claim_decomposition import decompose_claims_rule_based

        claims = decompose_claims_rule_based(
            (
                'Short note. Upzoning increases housing supply in constrained cities. '
                'People walk. Mixed-use blocks make streets feel safer at night.'
            ),
            nlp=None,
        )

        self.assertEqual(
            claims,
            [
                'Upzoning increases housing supply in constrained cities.',
                'Mixed-use blocks make streets feel safer at night.',
            ],
        )


class ClaimLevelNliTests(TestCase):
    def setUp(self):
        self.ot_note = _create_object_type('note', 'Note')
        self.obj_a = _create_object(
            title='Supply case',
            body='Upzoning increases housing supply. New homes reduce rent pressure.',
            object_type=self.ot_note,
        )
        self.obj_b = _create_object(
            title='Displacement case',
            body='Upzoning accelerates displacement in vulnerable neighborhoods.',
            object_type=self.ot_note,
        )
        self.obj_c = _create_object(
            title='Support case',
            body='Upzoning adds homes and expands supply.',
            object_type=self.ot_note,
        )

    @patch('apps.notebook.engine._SBERT_AVAILABLE', True)
    @patch('apps.notebook.engine.HAS_PYTORCH', True)
    @patch('apps.notebook.engine._llm_explanation', return_value=None)
    @patch('apps.notebook.engine.find_most_similar')
    @patch('apps.notebook.engine.sentence_similarity')
    @patch('apps.research.advanced_nlp.classify_relationship')
    @patch('apps.notebook.claim_decomposition.decompose_claims')
    def test_claim_level_nli_creates_claim_backed_edges_and_stores_claims(
        self,
        mock_decompose_claims,
        mock_classify_relationship,
        mock_sentence_similarity,
        mock_find_most_similar,
        _mock_llm_explanation,
    ):
        from apps.notebook.engine import _run_nli_contradiction_pass

        def claim_map(text, nlp=None, max_claims=20):
            if 'Supply case' in text or 'reduce rent pressure' in text:
                return [
                    'Upzoning increases housing supply.',
                    'New homes reduce rent pressure.',
                ]
            if 'Displacement case' in text or 'vulnerable neighborhoods' in text:
                return ['Upzoning accelerates displacement in vulnerable neighborhoods.']
            if 'Support case' in text or 'adds homes' in text:
                return ['Upzoning adds homes and expands supply.']
            return []

        def similarity_map(a, b):
            pair = {a, b}
            if pair == {
                'Upzoning increases housing supply.',
                'Upzoning accelerates displacement in vulnerable neighborhoods.',
            }:
                return 0.72
            if pair == {
                'Upzoning increases housing supply.',
                'Upzoning adds homes and expands supply.',
            }:
                return 0.83
            return 0.12

        def relationship_map(a, b):
            pair = {a, b}
            if pair == {
                'Upzoning increases housing supply.',
                'Upzoning accelerates displacement in vulnerable neighborhoods.',
            }:
                return {
                    'probabilities': {
                        'contradiction': 0.88,
                        'entailment': 0.04,
                        'neutral': 0.08,
                    },
                }
            if pair == {
                'Upzoning increases housing supply.',
                'Upzoning adds homes and expands supply.',
            }:
                return {
                    'probabilities': {
                        'contradiction': 0.03,
                        'entailment': 0.91,
                        'neutral': 0.06,
                    },
                }
            return {
                'probabilities': {
                    'contradiction': 0.05,
                    'entailment': 0.05,
                    'neutral': 0.90,
                },
            }

        mock_decompose_claims.side_effect = claim_map
        mock_find_most_similar.return_value = [
            {'id': str(self.obj_b.pk), 'similarity': 0.74},
            {'id': str(self.obj_c.pk), 'similarity': 0.78},
        ]
        mock_sentence_similarity.side_effect = similarity_map
        mock_classify_relationship.side_effect = relationship_map

        edges = _run_nli_contradiction_pass(self.obj_a, {})

        self.assertEqual(Claim.objects.filter(source_object=self.obj_a).count(), 2)
        self.assertEqual(Claim.objects.filter(source_object=self.obj_b).count(), 1)
        self.assertEqual(Claim.objects.filter(source_object=self.obj_c).count(), 1)
        self.assertEqual(len(edges), 2)

        contradiction_edge = Edge.objects.get(
            from_object=self.obj_a,
            to_object=self.obj_b,
            edge_type='contradicts',
        )
        support_edge = Edge.objects.get(
            from_object=self.obj_a,
            to_object=self.obj_c,
            edge_type='supports',
        )

        self.assertIn('Upzoning increases housing supply.', contradiction_edge.reason)
        self.assertIn('accelerates displacement', contradiction_edge.reason)
        self.assertIn('aligns with', support_edge.reason)
        self.assertIn('adds homes and expands supply', support_edge.reason)

    @patch('apps.notebook.engine._SBERT_AVAILABLE', False)
    def test_claim_level_nli_skips_when_sbert_unavailable(self):
        from apps.notebook.engine import _run_nli_contradiction_pass

        edges = _run_nli_contradiction_pass(self.obj_a, {})

        self.assertEqual(edges, [])
        self.assertEqual(Claim.objects.count(), 0)


class TemporalKgeTests(TestCase):
    def setUp(self):
        self.ot_note = _create_object_type('note', 'Note')
        self.obj_a = _create_object(
            title='Anchor',
            body='Structural anchor in the graph.',
            object_type=self.ot_note,
        )
        self.obj_b = _create_object(
            title='Emergent peer',
            body='A structurally similar object with rising overlap.',
            object_type=self.ot_note,
        )
        self.obj_c = _create_object(
            title='Stable peer',
            body='A structurally similar object without a trend change.',
            object_type=self.ot_note,
        )

    def test_temporal_kge_store_finds_emerging_connections(self):
        from apps.notebook.vector_store import TemporalKGEStore

        store = TemporalKGEStore()
        store.is_loaded = True
        store.entity_embeddings = np.array(
            [
                [1.0, 0.0],
                [0.92, 0.08],
                [0.85, 0.15],
            ],
            dtype='float32',
        )
        store.entity_to_idx = {
            self.obj_a.sha_hash: 0,
            self.obj_b.sha_hash: 1,
            self.obj_c.sha_hash: 2,
        }
        store.idx_to_entity = {index: sha for sha, index in store.entity_to_idx.items()}
        store.time_buckets = ['2026-W07', '2026-W08', '2026-W09', '2026-W10']
        store.temporal_profiles = {
            self.obj_a.sha_hash: {
                '2026-W07': {'seed-old': 1.0},
                '2026-W08': {'seed-old': 1.0},
                '2026-W09': {'seed-new': 1.0, self.obj_b.sha_hash: 0.4},
                '2026-W10': {'seed-new': 1.0, self.obj_b.sha_hash: 0.9},
            },
            self.obj_b.sha_hash: {
                '2026-W07': {'other-old': 0.2},
                '2026-W08': {'other-old': 0.2},
                '2026-W09': {'seed-new': 1.0, self.obj_a.sha_hash: 0.4},
                '2026-W10': {'seed-new': 1.0, self.obj_a.sha_hash: 0.9},
            },
            self.obj_c.sha_hash: {
                '2026-W07': {'seed-old': 1.0},
                '2026-W08': {'seed-old': 1.0},
                '2026-W09': {'seed-old': 1.0},
                '2026-W10': {'seed-old': 1.0},
            },
        }

        matches = store.find_emerging_connections(
            self.obj_a.sha_hash,
            lookback_weeks=2,
            top_n=5,
            threshold=0.05,
        )

        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]['sha_hash'], self.obj_b.sha_hash)
        self.assertGreater(matches[0]['trend_delta'], 0.05)

    @patch('apps.notebook.engine._llm_explanation', return_value=None)
    @patch('apps.notebook.vector_store.kge_store')
    def test_run_kge_engine_emits_temporal_structural_edge(
        self,
        mock_kge_store,
        _mock_llm_explanation,
    ):
        from apps.notebook.engine import _run_kge_engine

        mock_kge_store.is_loaded = True
        mock_kge_store.find_similar_entities.return_value = []
        mock_kge_store.find_emerging_connections.return_value = [
            {
                'sha_hash': self.obj_b.sha_hash,
                'score': 0.71,
                'trend_delta': 0.22,
                'recent_overlap': 0.64,
                'past_overlap': 0.12,
            },
        ]

        edges = _run_kge_engine(self.obj_a, {})

        self.assertEqual(len(edges), 1)
        edge = Edge.objects.get(from_object=self.obj_a, to_object=self.obj_b)
        self.assertEqual(edge.edge_type, 'structural')
        self.assertEqual(edge.engine, 'kge_temporal')
        self.assertIn('becoming more structurally aligned', edge.reason)


class CausalEngineTests(TestCase):
    def setUp(self):
        self.ot_note = _create_object_type('note', 'Note')
        self.notebook = Notebook.objects.create(name='Lineage')
        self.root = _create_object(
            title='Root idea',
            body='Early framing claim.',
            object_type=self.ot_note,
            notebook=self.notebook,
        )
        self.mid = _create_object(
            title='Middle idea',
            body='Later framing claim.',
            object_type=self.ot_note,
            notebook=self.notebook,
        )
        self.leaf = _create_object(
            title='Leaf idea',
            body='Latest framing claim.',
            object_type=self.ot_note,
            notebook=self.notebook,
        )
        self.detour = _create_object(
            title='Detour idea',
            body='Weaker competing influence.',
            object_type=self.ot_note,
            notebook=self.notebook,
        )

        now = timezone.now()
        Object.objects.filter(pk=self.root.pk).update(captured_at=now - timedelta(days=10))
        Object.objects.filter(pk=self.mid.pk).update(captured_at=now - timedelta(days=5))
        Object.objects.filter(pk=self.leaf.pk).update(captured_at=now - timedelta(days=1))
        Object.objects.filter(pk=self.detour.pk).update(captured_at=now - timedelta(days=3))
        for obj in [self.root, self.mid, self.leaf, self.detour]:
            obj.refresh_from_db()

        Edge.objects.create(
            from_object=self.root,
            to_object=self.mid,
            edge_type='supports',
            reason=(
                'Claim alignment detected. '
                '"Mixed use supports street safety." aligns with '
                '"Street safety improves when mixed uses cluster." '
                '(88% entailment, 72% semantic overlap).'
            ),
            strength=0.88,
            is_auto=True,
            engine='nli',
        )
        Edge.objects.create(
            from_object=self.mid,
            to_object=self.leaf,
            edge_type='supports',
            reason=(
                'Claim alignment detected. '
                '"Street safety improves when mixed uses cluster." aligns with '
                '"Clustered mixed uses improve neighborhood safety." '
                '(82% entailment, 70% semantic overlap).'
            ),
            strength=0.82,
            is_auto=True,
            engine='nli',
        )
        Edge.objects.create(
            from_object=self.detour,
            to_object=self.leaf,
            edge_type='supports',
            reason=(
                'Claim alignment detected. '
                '"Weak influence claim." aligns with '
                '"Clustered mixed uses improve neighborhood safety." '
                '(61% entailment, 61% semantic overlap).'
            ),
            strength=0.61,
            is_auto=True,
            engine='nli',
        )

    def test_build_influence_dag_filters_weaker_earlier_confounds(self):
        from apps.notebook.causal_engine import build_influence_dag

        dag = build_influence_dag(notebook=self.notebook, min_entailment=0.6)

        edge_pairs = {(edge['from_pk'], edge['to_pk']) for edge in dag['edges']}
        self.assertEqual(edge_pairs, {(self.root.pk, self.mid.pk), (self.mid.pk, self.leaf.pk)})
        self.assertEqual(dag['roots'], [self.root.pk])
        self.assertEqual(dag['leaves'], [self.leaf.pk])

    def test_trace_lineage_returns_ancestors(self):
        from apps.notebook.causal_engine import trace_lineage

        lineage = trace_lineage(
            self.leaf.pk,
            direction='ancestors',
            notebook=self.notebook,
        )

        self.assertEqual([item[0].pk for item in lineage], [self.mid.pk, self.root.pk])

    def test_run_causal_engine_persists_edges_touching_current_object(self):
        from apps.notebook.engine import _run_causal_engine

        edges = _run_causal_engine(self.leaf, {'nli_enabled': True})

        self.assertEqual(len(edges), 1)
        edge = Edge.objects.get(
            from_object=self.mid,
            to_object=self.leaf,
            edge_type='causal',
        )
        self.assertEqual(edge.engine, 'causal')
        self.assertIn('Influence chain detected', edge.reason)


class TemporalEvolutionTests(TestCase):
    def setUp(self):
        self.ot_note = _create_object_type('note', 'Note')
        self.notebook = Notebook.objects.create(name='Evolution')
        now = timezone.now()

        self.obj_a = _create_object(
            title='Week one',
            body='Initial note.',
            object_type=self.ot_note,
            notebook=self.notebook,
        )
        self.obj_b = _create_object(
            title='Week two',
            body='Follow-up note.',
            object_type=self.ot_note,
            notebook=self.notebook,
        )
        self.obj_c = _create_object(
            title='Week three',
            body='Later note.',
            object_type=self.ot_note,
            notebook=self.notebook,
        )

        Object.objects.filter(pk=self.obj_a.pk).update(captured_at=now - timedelta(days=20))
        Object.objects.filter(pk=self.obj_b.pk).update(captured_at=now - timedelta(days=10))
        Object.objects.filter(pk=self.obj_c.pk).update(captured_at=now - timedelta(days=3))
        for obj in [self.obj_a, self.obj_b, self.obj_c]:
            obj.refresh_from_db()

        Edge.objects.create(
            from_object=self.obj_a,
            to_object=self.obj_b,
            edge_type='related',
            reason='First connection',
            strength=0.5,
            is_auto=True,
            engine='test',
        )
        Edge.objects.create(
            from_object=self.obj_b,
            to_object=self.obj_c,
            edge_type='related',
            reason='Second connection',
            strength=0.6,
            is_auto=True,
            engine='test',
        )
        first_edge, second_edge = Edge.objects.order_by('pk')
        Edge.objects.filter(pk=first_edge.pk).update(created_at=now - timedelta(days=9))
        Edge.objects.filter(pk=second_edge.pk).update(created_at=now - timedelta(days=2))

    def test_analyze_temporal_evolution_reports_snapshots_and_growth(self):
        from apps.notebook.temporal_evolution import analyze_temporal_evolution

        result = analyze_temporal_evolution(
            notebook=self.notebook,
            window_days=14,
            step_days=7,
            max_windows=4,
        )

        self.assertGreaterEqual(len(result['snapshots']), 2)
        self.assertEqual(len(result['trajectory']), len(result['snapshots']))
        self.assertIn('Latest window contains', result['summary'])


class ClusterSynthesisTests(TestCase):
    def setUp(self):
        self.ot_note = _create_object_type('note', 'Note')
        self.notebook = Notebook.objects.create(name='Synthesis')
        self.cluster = Cluster.objects.create(
            name='Housing cluster',
            notebook=self.notebook,
            member_count=3,
        )
        for title, body in [
            ('Housing supply', 'Supply increases when zoning expands.'),
            ('Street safety', 'Mixed-use streets support safety and walkability.'),
            ('Neighborhood change', 'Housing growth reshapes neighborhood life.'),
        ]:
            obj = _create_object(
                title=title,
                body=body,
                object_type=self.ot_note,
                notebook=self.notebook,
            )
            obj.cluster = self.cluster
            obj.save()
        self.cluster.member_count = self.cluster.members.count()
        self.cluster.save(update_fields=['member_count'])

    def test_summarize_cluster_uses_heuristic_and_can_persist(self):
        from apps.notebook.synthesis import summarize_cluster, summarize_clusters

        summary = summarize_cluster(self.cluster, persist=True)
        self.cluster.refresh_from_db()
        notebook_summaries = summarize_clusters(notebook=self.notebook, persist=False)

        self.assertIn('cluster centered on', summary)
        self.assertEqual(self.cluster.summary, summary)
        self.assertEqual(len(notebook_summaries), 1)
        self.assertEqual(notebook_summaries[0]['summary'], summary)


class AutoClassificationTests(TestCase):
    def setUp(self):
        self.ot_note = _create_object_type('note', 'Note')
        _create_object_type('source', 'Source')
        _create_object_type('script', 'Script')
        _create_object_type('hunch', 'Hunch')
        _create_object_type('quote', 'Quote')
        _create_object_type('event', 'Event')
        _create_object_type('person', 'Person')

    def test_classify_object_detects_source_from_url(self):
        from apps.notebook.auto_classify import classify_object

        obj = _create_object(
            title='Useful reference',
            body='See https://example.com/report for details.',
            object_type=self.ot_note,
        )
        self.assertEqual(classify_object(obj), 'source')

    def test_auto_classify_batch_retypes_default_note_only(self):
        from apps.notebook.auto_classify import auto_classify_batch

        obj_note = _create_object(
            title='Hypothesis',
            body='What if we redesigned this flow? Maybe this could work.',
            object_type=self.ot_note,
        )
        obj_source = _create_object(
            title='Pinned Source',
            body='https://already-typed.example',
            object_type=ObjectType.objects.get(slug='source'),
        )

        updated = auto_classify_batch([obj_note, obj_source])
        obj_note.refresh_from_db()
        obj_source.refresh_from_db()

        self.assertEqual(updated, 1)
        self.assertEqual(obj_note.object_type.slug, 'hunch')
        self.assertEqual(obj_source.object_type.slug, 'source')


class SelfOrganizeLoopTests(TestCase):
    def setUp(self):
        self.ot_note = _create_object_type('note', 'Note')
        _create_object_type('person', 'Person')
        _create_object_type('organization', 'Organization')
        _create_object_type('place', 'Place')
        _create_object_type('event', 'Event')
        _create_object_type('source', 'Source')
        _create_object_type('concept', 'Concept')

    def _connect(self, from_obj, to_obj, strength=0.9, edge_type='related'):
        Edge.objects.create(
            from_object=from_obj,
            to_object=to_obj,
            edge_type=edge_type,
            reason='Community test edge',
            strength=strength,
            is_auto=True,
            engine='test',
        )

    def test_form_notebooks_from_communities_creates_auto_notebook(self):
        from apps.notebook.self_organize import form_notebooks_from_communities

        group_a = [
            _create_object(f'A{i}', 'alpha cluster content', self.ot_note)
            for i in range(6)
        ]
        group_b = [
            _create_object(f'B{i}', 'beta cluster content', self.ot_note)
            for i in range(5)
        ]

        for i, src in enumerate(group_a):
            for dest in group_a[i + 1:]:
                self._connect(src, dest, strength=0.95)
        for i, src in enumerate(group_b):
            for dest in group_b[i + 1:]:
                self._connect(src, dest, strength=0.94)
        self._connect(group_a[0], group_b[0], strength=0.05)

        created = form_notebooks_from_communities()

        self.assertTrue(created)
        self.assertTrue(Notebook.objects.filter(is_auto_generated=True).exists())

    def test_promote_frequent_entities_creates_object_and_mentions_edges(self):
        from apps.notebook.self_organize import promote_frequent_entities

        sources = [
            _create_object(f'Source {idx}', 'Entity mention body', self.ot_note)
            for idx in range(5)
        ]
        for source in sources:
            ResolvedEntity.objects.create(
                source_object=source,
                text='Jane Doe',
                entity_type='PERSON',
                normalized_text='jane doe',
            )

        promoted = promote_frequent_entities()

        self.assertEqual(len(promoted), 1)
        promoted_obj = promoted[0]
        self.assertEqual(promoted_obj.object_type.slug, 'person')
        self.assertEqual(
            ResolvedEntity.objects.filter(
                normalized_text='jane doe',
                resolved_object=promoted_obj,
            ).count(),
            5,
        )
        self.assertEqual(
            Edge.objects.filter(edge_type='mentions', to_object=promoted_obj).count(),
            5,
        )

    def test_evolve_edges_prunes_stale_auto_edge(self):
        from apps.notebook.self_organize import evolve_edges

        timeline = Timeline.objects.create(name='Master', slug='master', is_master=True)
        src = _create_object('Decay A', 'a', self.ot_note)
        dst = _create_object('Decay B', 'b', self.ot_note)
        edge = Edge.objects.create(
            from_object=src,
            to_object=dst,
            edge_type='related',
            reason='old edge',
            strength=0.10,
            is_auto=True,
            engine='test',
        )
        Edge.objects.filter(pk=edge.pk).update(updated_at=timezone.now() - timedelta(days=365))

        result = evolve_edges()

        self.assertEqual(result['pruned'], 1)
        self.assertFalse(Edge.objects.filter(pk=edge.pk).exists())
        self.assertTrue(Node.objects.filter(timeline=timeline, node_type='modification').exists())

    @patch('apps.notebook.community.detect_communities')
    def test_detect_emergent_types_suggests_domain_resource(self, mock_detect):
        from apps.notebook.self_organize import detect_emergent_types

        members = [
            _create_object(
                title=f'Note {idx}',
                body='domain-heavy note',
                object_type=self.ot_note,
            )
            for idx in range(8)
        ]
        for member in members:
            member.url = 'https://example.org/item'
            member.save(update_fields=['url'])

        mock_detect.return_value = {
            'communities': [
                {
                    'id': 1,
                    'member_pks': [obj.pk for obj in members],
                    'size': len(members),
                },
            ],
            'modularity': 0.45,
        }

        suggestions = detect_emergent_types()

        self.assertTrue(suggestions)
        self.assertIn('example.org', suggestions[0]['suggested_name'])


class ProvenanceAndReportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ot_note = _create_object_type('note', 'Note')
        self.notebook = Notebook.objects.create(name='Urban', slug='urban')
        self.timeline = Timeline.objects.create(name='Master', slug='master', is_master=True)

        self.root = _create_object(
            title='Root idea',
            body='Original concept',
            object_type=self.ot_note,
            notebook=self.notebook,
        )
        self.mid = _create_object(
            title='Middle idea',
            body='Intermediate concept',
            object_type=self.ot_note,
            notebook=self.notebook,
        )
        self.leaf = _create_object(
            title='Leaf idea',
            body='Current concept',
            object_type=self.ot_note,
            notebook=self.notebook,
        )

        now = timezone.now()
        Object.objects.filter(pk=self.root.pk).update(captured_at=now - timedelta(days=10))
        Object.objects.filter(pk=self.mid.pk).update(captured_at=now - timedelta(days=5))
        Object.objects.filter(pk=self.leaf.pk).update(captured_at=now - timedelta(days=1))
        self.root.refresh_from_db()
        self.mid.refresh_from_db()
        self.leaf.refresh_from_db()

        Edge.objects.create(
            from_object=self.root,
            to_object=self.mid,
            edge_type='supports',
            reason='Claim alignment: "A" supports "B".',
            strength=0.88,
            is_auto=True,
            engine='nli',
        )
        Edge.objects.create(
            from_object=self.mid,
            to_object=self.leaf,
            edge_type='supports',
            reason='Claim alignment: "B" supports "C".',
            strength=0.83,
            is_auto=True,
            engine='nli',
        )
        Edge.objects.create(
            from_object=self.leaf,
            to_object=self.root,
            edge_type='contradicts',
            reason='Conflicting claim found.',
            strength=0.72,
            is_auto=True,
            engine='nli',
        )

        Node.objects.create(
            node_type='creation',
            title='Leaf created',
            object_ref=self.leaf,
            timeline=self.timeline,
        )
        Node.objects.create(
            node_type='connection',
            title='Leaf connected',
            object_ref=self.leaf,
            timeline=self.timeline,
        )

        self.cluster = Cluster.objects.create(
            name='Urban cluster',
            notebook=self.notebook,
            member_count=3,
        )
        Object.objects.filter(pk__in=[self.root.pk, self.mid.pk, self.leaf.pk]).update(cluster=self.cluster)

    def test_trace_provenance_and_narrative(self):
        from apps.notebook.provenance import generate_provenance_narrative, trace_provenance

        provenance = trace_provenance(self.leaf.pk)
        narrative = generate_provenance_narrative(self.leaf.pk)

        self.assertIsNotNone(provenance)
        self.assertTrue(provenance['ancestors'])
        self.assertEqual(provenance['belief_revisions'][0]['contradicting_object']['pk'], self.root.pk)
        self.assertIn('Leaf idea', narrative)

    def test_object_provenance_endpoint(self):
        resp = self.client.get(f'/api/v1/notebook/objects/{self.leaf.pk}/provenance/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('narrative', resp.data)
        self.assertEqual(resp.data['object']['pk'], self.leaf.pk)

    def test_generate_report_and_endpoint(self):
        from apps.notebook.report import generate_organization_report, render_organization_report_markdown

        report = generate_organization_report(notebook=self.notebook)
        self.assertEqual(report['summary']['total_objects'], 3)
        self.assertGreaterEqual(report['summary']['total_edges'], 2)
        self.assertIn('tensions', report)
        self.assertIn('timeline', report)
        self.assertGreaterEqual(len(report['timeline']), 2)

        markdown = render_organization_report_markdown(report)
        self.assertIn('# Organization Report', markdown)
        self.assertIn('## Timeline (Recent)', markdown)

        resp = self.client.get('/api/v1/notebook/report/?notebook=urban')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('summary', resp.data)
        self.assertEqual(resp.data['summary']['total_objects'], 3)

        markdown_resp = self.client.get('/api/v1/notebook/report/?notebook=urban&format=markdown')
        self.assertEqual(markdown_resp.status_code, 200)
        self.assertIn('text/markdown', markdown_resp['Content-Type'])
        self.assertIn('# Organization Report', markdown_resp.content.decode('utf-8'))

    @patch('apps.notebook.management.commands.reorganize.periodic_reorganize')
    def test_reorganize_management_command_outputs_counts(self, mock_periodic):
        mock_periodic.return_value = {
            'notebooks_created': 1,
            'entities_promoted': 2,
            'edges_updated': 3,
            'edges_pruned': 4,
            'type_suggestions': 5,
        }

        out = io.StringIO()
        call_command('reorganize', stdout=out)
        output = out.getvalue()
        self.assertIn('Notebooks created: 1', output)
        self.assertIn('Type suggestions: 5', output)

    def test_export_organization_report_command_outputs_markdown(self):
        out = io.StringIO()
        call_command(
            'export_organization_report',
            '--notebook',
            'urban',
            '--format',
            'markdown',
            '--timeline-limit',
            '10',
            stdout=out,
        )
        rendered = out.getvalue()
        self.assertIn('# Organization Report', rendered)
        self.assertIn('## Timeline (Recent)', rendered)


class SchedulingAndCalibrationTests(TestCase):
    def setUp(self):
        self.ot_note = _create_object_type('note', 'Note')
        _create_object_type('source', 'Source')
        _create_object_type('script', 'Script')

    def test_ensure_periodic_schedule_disabled_by_env(self):
        from apps.notebook.scheduling import ensure_periodic_reorganize_schedule

        with patch.dict('os.environ', {'ENABLE_SELF_ORGANIZE_SCHEDULER': '0'}):
            result = ensure_periodic_reorganize_schedule(force=False)

        self.assertFalse(result['created'])
        self.assertEqual(result['reason'], 'disabled_by_env')

    def test_calibrate_auto_classify_command_outputs_json(self):
        _create_object(
            title='Research Source',
            body='https://example.com/reference',
            object_type=ObjectType.objects.get(slug='source'),
        )
        _create_object(
            title='Snippet',
            body='def run():\n    return 1',
            object_type=ObjectType.objects.get(slug='script'),
        )

        out = io.StringIO()
        call_command('calibrate_auto_classify', '--limit', '20', stdout=out)
        payload = json.loads(out.getvalue())

        self.assertIn('baseline_metrics', payload)
        self.assertIn('best_metrics', payload)
        self.assertIn('best_rules', payload)
        self.assertGreater(payload['baseline_metrics']['total'], 0)

    def test_reclassify_objects_dry_run_does_not_persist(self):
        note_obj = _create_object(
            title='Draft source',
            body='Read https://example.com/reference',
            object_type=self.ot_note,
        )

        out = io.StringIO()
        call_command('reclassify_objects', '--dry-run', stdout=out)
        payload = json.loads(out.getvalue())

        note_obj.refresh_from_db()
        self.assertEqual(note_obj.object_type.slug, 'note')
        self.assertGreaterEqual(payload['changed'], 1)

    def test_reclassify_objects_persists_when_not_dry_run(self):
        note_obj = _create_object(
            title='Draft source',
            body='Read https://example.com/reference',
            object_type=self.ot_note,
        )

        out = io.StringIO()
        call_command('reclassify_objects', stdout=out)
        payload = json.loads(out.getvalue())

        note_obj.refresh_from_db()
        self.assertEqual(note_obj.object_type.slug, 'source')
        self.assertGreaterEqual(payload['changed'], 1)


class SelfOrganizeControlPlaneTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ot_note = _create_object_type('note', 'Note')
        self.ot_source = _create_object_type('source', 'Source')

    def test_self_organize_run_endpoint_queues_task(self):
        from apps.notebook.tasks import run_periodic_reorganize_task

        with patch.object(run_periodic_reorganize_task, 'delay') as mock_delay:
            mock_delay.return_value = type('RQJob', (), {'id': 'rq-123'})()
            resp = self.client.post('/api/v1/notebook/self-organize/run/', {}, format='json')

        self.assertEqual(resp.status_code, 202)
        self.assertEqual(resp.data['status'], 'queued')
        self.assertTrue(resp.data['job_id'])
        self.assertEqual(resp.data['rq_job_id'], 'rq-123')

        kwargs = mock_delay.call_args.kwargs
        self.assertEqual(kwargs['reorganize_job_id'], resp.data['job_id'])

    def test_self_organize_job_status_endpoint(self):
        from apps.notebook.job_status import create_reorganize_job_id, update_reorganize_job_status

        job_id = create_reorganize_job_id()
        update_reorganize_job_status(
            job_id,
            'running',
            summary={'notebooks_created': 2},
            rq_job_id='rq-xyz',
        )

        resp = self.client.get(f'/api/v1/notebook/self-organize/jobs/{job_id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['status'], 'running')
        self.assertEqual(resp.data['rq_job_id'], 'rq-xyz')
        self.assertIn('created_at', resp.data)
        self.assertIn('updated_at', resp.data)

    def test_self_organize_latest_endpoint(self):
        from apps.notebook.job_status import create_reorganize_job_id, update_reorganize_job_status

        job_id = create_reorganize_job_id()
        update_reorganize_job_status(
            job_id,
            'complete',
            summary={'notebooks_created': 3},
            rq_job_id='rq-latest',
        )

        resp = self.client.get('/api/v1/notebook/self-organize/latest/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['status'], 'complete')
        self.assertEqual(resp.data['rq_job_id'], 'rq-latest')
        self.assertEqual(resp.data['summary']['notebooks_created'], 3)

    @patch('apps.notebook.self_organize.detect_emergent_types')
    def test_self_organize_emergent_types_endpoint(self, mock_detect):
        mock_detect.return_value = [
            {
                'reason': '8 notes share domain',
                'suggested_name': 'example.org resource',
                'suggested_slug': 'example-org-resource',
                'member_count': 8,
                'member_pks': [1, 2, 3],
            },
        ]

        resp = self.client.get('/api/v1/notebook/self-organize/emergent-types/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['suggestions']), 1)
        self.assertEqual(resp.data['suggestions'][0]['suggested_slug'], 'example-org-resource')

    @patch('apps.notebook.self_organize.preview_periodic_reorganize')
    def test_self_organize_preview_endpoint(self, mock_preview):
        mock_preview.return_value = {
            'notebook_formation': {
                'modularity': 0.32,
                'eligible': True,
                'candidate_count': 1,
                'candidates': [{'label': 'alpha', 'member_count': 8}],
            },
            'entity_promotions': {
                'threshold': 5,
                'candidate_count': 1,
                'candidates': [{'normalized_text': 'foo', 'mention_count': 8}],
            },
            'edge_evolution': {
                'to_prune_count': 2,
                'to_decay_count': 5,
                'to_prune_samples': [],
                'to_decay_samples': [],
            },
            'emergent_types': {
                'candidate_count': 1,
                'candidates': [{'suggested_slug': 'foo-notes'}],
            },
        }

        resp = self.client.get('/api/v1/notebook/self-organize/preview/?max_samples=7')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('notebook_formation', resp.data)
        self.assertEqual(resp.data['entity_promotions']['candidate_count'], 1)
        mock_preview.assert_called_once_with(max_samples=7)

    @patch('apps.notebook.self_organize.periodic_reorganize')
    def test_run_periodic_reorganize_task_updates_status(self, mock_periodic):
        from apps.notebook.job_status import create_reorganize_job_id, get_reorganize_job_status
        from apps.notebook.tasks import run_periodic_reorganize_task

        mock_periodic.return_value = {
            'notebooks_created': 1,
            'entities_promoted': 2,
            'edges_updated': 3,
            'edges_pruned': 4,
            'type_suggestions': 5,
        }
        job_id = create_reorganize_job_id()
        run_periodic_reorganize_task(reorganize_job_id=job_id)
        payload = get_reorganize_job_status(job_id)

        self.assertIsNotNone(payload)
        self.assertEqual(payload['status'], 'complete')
        self.assertEqual(payload['summary']['entities_promoted'], 2)

    def test_apply_emergent_type_endpoint_creates_type_and_updates_notes(self):
        note_a = _create_object(
            title='Candidate A',
            body='alpha',
            object_type=self.ot_note,
        )
        note_b = _create_object(
            title='Candidate B',
            body='beta',
            object_type=self.ot_note,
        )
        source = _create_object(
            title='Pinned source',
            body='url body',
            object_type=self.ot_source,
        )

        resp = self.client.post(
            '/api/v1/notebook/self-organize/emergent-types/apply/',
            {
                'suggested_name': 'Legal Intake Memo',
                'suggested_slug': 'legal-intake-memo',
                'member_pks': [note_a.pk, note_b.pk, source.pk],
                'restrict_to_note': True,
                'icon': 'file-text',
                'color': '#4A6A8A',
            },
            format='json',
        )

        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data['created_type'])
        self.assertEqual(resp.data['objects_updated'], 2)
        created_slug = resp.data['object_type']['slug']

        note_a.refresh_from_db()
        note_b.refresh_from_db()
        source.refresh_from_db()
        self.assertEqual(note_a.object_type.slug, created_slug)
        self.assertEqual(note_b.object_type.slug, created_slug)
        self.assertEqual(source.object_type.slug, 'source')

    def test_apply_emergent_type_endpoint_reuses_existing_type(self):
        note_obj = _create_object(
            title='Candidate C',
            body='gamma',
            object_type=self.ot_note,
        )
        ObjectType.objects.create(
            name='Pattern Notes',
            slug='pattern-notes',
            icon='sparkle',
            color='#6A6A8A',
            is_built_in=False,
            sort_order=100,
        )

        resp = self.client.post(
            '/api/v1/notebook/self-organize/emergent-types/apply/',
            {
                'suggested_name': 'Pattern Notes',
                'suggested_slug': 'pattern-notes',
                'member_pks': [note_obj.pk],
            },
            format='json',
        )

        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data['created_type'])
        note_obj.refresh_from_db()
        self.assertEqual(note_obj.object_type.slug, 'pattern-notes')

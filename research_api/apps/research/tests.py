from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np
from django.test import SimpleTestCase


class AdvancedNlpInstructionTests(SimpleTestCase):
    def tearDown(self):
        from apps.research import advanced_nlp

        advanced_nlp._sentence_model = None
        advanced_nlp._sentence_model_name = ''

    @patch('apps.research.advanced_nlp.get_sentence_model')
    def test_encode_text_uses_query_prefix_for_instruction_model(self, mock_get_model):
        from apps.research import advanced_nlp

        model = Mock()
        model.encode.return_value = np.array([1.0, 0.0], dtype='float32')
        mock_get_model.return_value = model
        advanced_nlp._sentence_model_name = 'nomic-ai/nomic-embed-text-v1.5'

        advanced_nlp.encode_text('desire paths', task='similarity', role='query')

        model.encode.assert_called_once_with(
            'search_query: desire paths',
            convert_to_numpy=True,
        )

    @patch('apps.research.advanced_nlp.get_sentence_model')
    def test_encode_text_skips_prefix_for_fallback_model(self, mock_get_model):
        from apps.research import advanced_nlp

        model = Mock()
        model.encode.return_value = np.array([1.0, 0.0], dtype='float32')
        mock_get_model.return_value = model
        advanced_nlp._sentence_model_name = 'all-MiniLM-L6-v2'

        advanced_nlp.encode_text('desire paths', task='similarity', role='query')

        model.encode.assert_called_once_with(
            'desire paths',
            convert_to_numpy=True,
        )

    @patch('apps.research.advanced_nlp.batch_encode')
    @patch('apps.research.advanced_nlp.encode_text')
    @patch('apps.research.advanced_nlp.get_sentence_model')
    def test_find_most_similar_uses_query_and_document_roles(
        self,
        mock_get_model,
        mock_encode_text,
        mock_batch_encode,
    ):
        from apps.research.advanced_nlp import find_most_similar

        mock_get_model.return_value = Mock()
        mock_encode_text.return_value = np.array([1.0, 0.0], dtype='float32')
        mock_batch_encode.return_value = np.array([[1.0, 0.0], [0.0, 1.0]], dtype='float32')

        results = find_most_similar(
            target_text='query',
            candidate_texts=['doc a', 'doc b'],
            candidate_ids=['a', 'b'],
            threshold=0.1,
        )

        mock_encode_text.assert_called_once_with('query', task='similarity', role='query')
        mock_batch_encode.assert_called_once_with(
            ['doc a', 'doc b'],
            task='similarity',
            role='document',
        )
        self.assertEqual(results[0]['id'], 'a')


class RequirementSplitTests(SimpleTestCase):
    def test_production_requirements_do_not_include_heavy_nlp_stack(self):
        repo_root = Path(__file__).resolve().parents[2]
        production = (repo_root / 'requirements' / 'production.txt').read_text()

        self.assertNotIn('torch', production)
        self.assertNotIn('sentence-transformers', production)
        self.assertNotIn('faiss-cpu', production)

    def test_local_requirements_include_heavy_nlp_stack(self):
        repo_root = Path(__file__).resolve().parents[2]
        local = (repo_root / 'requirements' / 'local.txt').read_text()
        development = (repo_root / 'requirements' / 'development.txt').read_text()

        self.assertIn('torch>=2.0', local)
        self.assertIn('sentence-transformers>=3.0', local)
        self.assertIn('faiss-cpu>=1.7', local)
        self.assertIn('-r local.txt', development)

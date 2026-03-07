"""
Tests for the Research API product.

Batch 0: API Keys, Rate Limiting, and Usage Analytics.
Batch 1: Full-Text Search with Faceted Filtering.
Batch 2: Graph Algorithms (PageRank, Path Finding, Reading Order).
Batch 3: Export and Import Formats.
Batch 4: Temporal Analysis and Trend Detection.
Batch 5: Source Health and Link Rot Detection.
Batch 6: Contradiction and Tension Detection.
Batch 7: Research Sessions (Saved Subgraph Snapshots).
Batch 8: Webhooks (Event-Driven Architecture).

Covers:
- APIKey model and key generation
- APIKeyMiddleware (auth, rate limiting, exemptions, logging)
- register_api_key endpoint
- usage_analytics endpoint
- APIKeyAuthentication DRF class
- Graph builder, PageRank, path finding, reading order
- Multi-format export (json, bibtex, ris, opml, csv, json-ld)
- Multi-format import (bibtex, ris, csv, opml, json)
- ImportJob audit trail
- HealthCheck model and source health endpoint
- Tension detection (counterargument, publisher divergence, temporal, tag divergence)
- ResearchSession and SessionNode models
- Session CRUD endpoints (create, list, detail, update, delete)
- Session feature flag enforcement (can_sessions)
- Computed edges between session nodes
- WebhookSubscription and WebhookDelivery models
- Webhook CRUD endpoints and feature flag enforcement
- HMAC signature verification
- Dispatch service with failure tracking and auto-deactivation
"""

import datetime
from datetime import timedelta
from unittest.mock import MagicMock, patch

import requests as requests_lib

from django.test import TestCase, RequestFactory, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.api.models import (
    APIKey,
    HealthCheck,
    ImportJob,
    ResearchSession,
    SessionNode,
    UsageLog,
    WebhookDelivery,
    WebhookSubscription,
)
from apps.research.models import ResearchThread, Source, SourceLink, ThreadEntry


# ── Model tests ─────────────────────────────────────────────────────

class APIKeyModelTests(TestCase):
    """APIKey model and key generation."""

    def test_key_auto_generated_with_prefix(self):
        key = APIKey.objects.create(
            name='Test App',
            owner_email='test@example.com',
        )
        self.assertTrue(key.key.startswith('rk_live_'))
        self.assertEqual(len(key.key), 56)  # rk_live_ (8) + 48 hex chars

    def test_key_uniqueness(self):
        keys = set()
        for i in range(50):
            k = APIKey.objects.create(
                name=f'App {i}',
                owner_email=f'user{i}@example.com',
            )
            keys.add(k.key)
        self.assertEqual(len(keys), 50)

    def test_default_tier_is_free(self):
        key = APIKey.objects.create(
            name='Default Tier',
            owner_email='user@example.com',
        )
        self.assertEqual(key.tier, 'free')

    def test_default_rate_limit(self):
        key = APIKey.objects.create(
            name='Rate Test',
            owner_email='user@example.com',
        )
        self.assertEqual(key.requests_per_hour, 100)

    def test_str_representation(self):
        key = APIKey.objects.create(
            name='My Tool',
            owner_email='user@example.com',
            tier='researcher',
        )
        self.assertEqual(str(key), 'My Tool (researcher)')

    def test_feature_flags_default_false(self):
        key = APIKey.objects.create(
            name='Flags Test',
            owner_email='user@example.com',
        )
        self.assertFalse(key.can_import)
        self.assertFalse(key.can_webhook)
        self.assertFalse(key.can_sessions)


class UsageLogModelTests(TestCase):
    """UsageLog model."""

    def test_create_usage_log(self):
        key = APIKey.objects.create(
            name='Log Test',
            owner_email='user@example.com',
        )
        log = UsageLog.objects.create(
            api_key=key,
            endpoint='/api/v1/sources/',
            method='GET',
            status_code=200,
            response_time_ms=42,
        )
        self.assertEqual(log.api_key, key)
        self.assertIsNotNone(log.timestamp)

    def test_cascade_delete(self):
        key = APIKey.objects.create(
            name='Cascade Test',
            owner_email='user@example.com',
        )
        UsageLog.objects.create(
            api_key=key,
            endpoint='/api/v1/sources/',
            method='GET',
            status_code=200,
            response_time_ms=10,
        )
        self.assertEqual(UsageLog.objects.count(), 1)
        key.delete()
        self.assertEqual(UsageLog.objects.count(), 0)


# ── Middleware tests ─────────────────────────────────────────────────

class MiddlewareTests(TestCase):
    """APIKeyMiddleware: auth, rate limiting, exemptions."""

    def setUp(self):
        self.client = APIClient()
        self.key = APIKey.objects.create(
            name='Middleware Test',
            owner_email='user@example.com',
            requests_per_hour=5,
        )

    def test_unauthenticated_request_returns_401(self):
        response = self.client.get('/api/v1/sources/')
        self.assertEqual(response.status_code, 401)
        self.assertIn('Authentication required', response.json()['error'])

    def test_invalid_key_returns_401(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer rk_live_invalid')
        response = self.client.get('/api/v1/sources/')
        self.assertEqual(response.status_code, 401)
        self.assertIn('Invalid API key', response.json()['error'])

    def test_empty_bearer_returns_401(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ')
        response = self.client.get('/api/v1/sources/')
        self.assertEqual(response.status_code, 401)

    def test_deactivated_key_returns_401(self):
        self.key.is_active = False
        self.key.save()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')
        response = self.client.get('/api/v1/sources/')
        self.assertEqual(response.status_code, 401)
        self.assertIn('deactivated', response.json()['error'])

    def test_valid_key_passes_through(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')
        response = self.client.get('/api/v1/stats/')
        self.assertEqual(response.status_code, 200)

    def test_rate_limit_enforced(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')
        # Exhaust rate limit (5 requests)
        for _ in range(5):
            self.client.get('/api/v1/stats/')

        # 6th request should be rate limited
        response = self.client.get('/api/v1/stats/')
        self.assertEqual(response.status_code, 429)
        self.assertIn('Rate limit exceeded', response.json()['error'])
        self.assertEqual(response['Retry-After'], '3600')

    def test_exempt_path_register(self):
        response = self.client.post(
            '/api/v1/keys/register/',
            {'name': 'Test', 'email': 'test@example.com'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)

    def test_exempt_path_promote_bypasses_api_key_middleware(self):
        # promote endpoint is exempt from API key middleware auth.
        # It uses its own INTERNAL_API_KEY check, which returns 401
        # when the key is empty/missing. We verify the middleware
        # doesn't intercept by confirming the response error message
        # comes from the view (not the middleware).
        response = self.client.post('/api/v1/internal/promote/', format='json')
        # The view's own auth returns 401 with a different message
        # than the middleware's "Authentication required" message.
        error_msg = response.json().get('error', '')
        self.assertNotIn('Provide Authorization: Bearer', error_msg)

    def test_non_api_paths_unaffected(self):
        response = self.client.get('/health/')
        self.assertNotEqual(response.status_code, 401)

    def test_usage_logged_after_request(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')
        self.client.get('/api/v1/stats/')
        self.assertEqual(UsageLog.objects.filter(api_key=self.key).count(), 1)
        log = UsageLog.objects.first()
        self.assertEqual(log.endpoint, '/api/v1/stats/')
        self.assertEqual(log.method, 'GET')
        self.assertEqual(log.status_code, 200)
        self.assertGreaterEqual(log.response_time_ms, 0)

    def test_last_used_at_updated(self):
        self.assertIsNone(self.key.last_used_at)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')
        self.client.get('/api/v1/stats/')
        self.key.refresh_from_db()
        self.assertIsNotNone(self.key.last_used_at)


# ── Registration endpoint tests ─────────────────────────────────────

class RegisterAPIKeyTests(TestCase):
    """POST /api/v1/keys/register/"""

    def setUp(self):
        self.client = APIClient()

    def test_register_creates_key(self):
        response = self.client.post(
            '/api/v1/keys/register/',
            {'name': 'My Tool', 'email': 'user@example.com'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data['key'].startswith('rk_live_'))
        self.assertEqual(data['name'], 'My Tool')
        self.assertEqual(data['tier'], 'free')
        self.assertEqual(data['requests_per_hour'], 100)

    def test_register_requires_name(self):
        response = self.client.post(
            '/api/v1/keys/register/',
            {'email': 'user@example.com'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('name', response.json()['error'])

    def test_register_requires_email(self):
        response = self.client.post(
            '/api/v1/keys/register/',
            {'name': 'Tool'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.json()['error'])

    def test_register_persists_key(self):
        self.client.post(
            '/api/v1/keys/register/',
            {'name': 'Persisted', 'email': 'p@example.com'},
            format='json',
        )
        self.assertEqual(APIKey.objects.filter(name='Persisted').count(), 1)


# ── Usage analytics endpoint tests ──────────────────────────────────

class UsageAnalyticsTests(TestCase):
    """GET /api/v1/usage/"""

    def setUp(self):
        self.client = APIClient()
        self.key = APIKey.objects.create(
            name='Analytics Test',
            owner_email='user@example.com',
            requests_per_hour=1000,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.get('/api/v1/usage/')
        self.assertEqual(response.status_code, 401)

    def test_returns_analytics(self):
        # Create some usage
        for i in range(3):
            UsageLog.objects.create(
                api_key=self.key,
                endpoint='/api/v1/sources/',
                method='GET',
                status_code=200,
                response_time_ms=50 + i * 10,
            )

        response = self.client.get('/api/v1/usage/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['total_requests'], 3)
        self.assertEqual(data['days'], 30)
        self.assertIn('by_endpoint', data)
        self.assertIn('by_day', data)
        self.assertIn('rate_limit', data)

    def test_rate_limit_status(self):
        response = self.client.get('/api/v1/usage/')
        data = response.json()
        self.assertEqual(data['rate_limit']['tier'], 'free')
        self.assertEqual(data['rate_limit']['limit'], 1000)

    def test_days_parameter(self):
        response = self.client.get('/api/v1/usage/?days=7')
        data = response.json()
        self.assertEqual(data['days'], 7)

    def test_days_clamped(self):
        response = self.client.get('/api/v1/usage/?days=999')
        data = response.json()
        self.assertEqual(data['days'], 90)

    def test_by_endpoint_breakdown(self):
        UsageLog.objects.create(
            api_key=self.key,
            endpoint='/api/v1/sources/',
            method='GET',
            status_code=200,
            response_time_ms=30,
        )
        UsageLog.objects.create(
            api_key=self.key,
            endpoint='/api/v1/graph/',
            method='GET',
            status_code=200,
            response_time_ms=80,
        )

        response = self.client.get('/api/v1/usage/')
        data = response.json()
        endpoints = {e['endpoint'] for e in data['by_endpoint']}
        self.assertIn('/api/v1/sources/', endpoints)
        self.assertIn('/api/v1/graph/', endpoints)


# ── Search endpoint tests (Batch 1) ─────────────────────────────────

class SearchTests(TestCase):
    """GET /api/v1/search/"""

    def setUp(self):
        self.client = APIClient()
        self.key = APIKey.objects.create(
            name='Search Test',
            owner_email='user@example.com',
            requests_per_hour=1000,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')

        # Create test sources
        self.s1 = Source.objects.create(
            title='Urban Housing Policy in Chicago',
            creator='Jane Smith',
            source_type='article',
            public_annotation='Analysis of affordable housing initiatives.',
            tags=['housing', 'urban-design', 'chicago'],
            public=True,
        )
        self.s2 = Source.objects.create(
            title='Public Transit Patterns',
            creator='John Doe',
            source_type='book',
            public_annotation='Study of bus and rail networks.',
            tags=['transit', 'urban-design'],
            public=True,
        )
        self.s3 = Source.objects.create(
            title='Private Housing Notes',
            creator='Admin',
            public=False,  # Not public
        )

        # Create a thread
        self.thread = ResearchThread.objects.create(
            title='Housing Investigation',
            description='Exploring how housing policy shapes neighborhoods.',
            public=True,
        )

    def test_requires_query(self):
        response = self.client.get('/api/v1/search/')
        self.assertEqual(response.status_code, 400)
        self.assertIn('q parameter', response.json()['error'])

    def test_empty_query_returns_400(self):
        response = self.client.get('/api/v1/search/?q=')
        self.assertEqual(response.status_code, 400)

    def test_search_returns_results(self):
        response = self.client.get('/api/v1/search/?q=housing')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(data['total'], 1)
        self.assertEqual(data['query'], 'housing')

    def test_search_finds_source_by_title(self):
        response = self.client.get('/api/v1/search/?q=Chicago')
        data = response.json()
        slugs = [r['slug'] for r in data['results'] if r['type'] == 'source']
        self.assertIn(self.s1.slug, slugs)

    def test_search_finds_source_by_creator(self):
        response = self.client.get('/api/v1/search/?q=Jane Smith')
        data = response.json()
        slugs = [r['slug'] for r in data['results'] if r['type'] == 'source']
        self.assertIn(self.s1.slug, slugs)

    def test_search_excludes_private_sources(self):
        response = self.client.get('/api/v1/search/?q=Private')
        data = response.json()
        slugs = [r['slug'] for r in data['results'] if r['type'] == 'source']
        self.assertNotIn(self.s3.slug, slugs)

    def test_search_finds_threads(self):
        response = self.client.get('/api/v1/search/?q=Investigation')
        data = response.json()
        types = [r['type'] for r in data['results']]
        self.assertIn('thread', types)

    def test_filter_by_type(self):
        response = self.client.get('/api/v1/search/?q=urban&type=book')
        data = response.json()
        for r in data['results']:
            if r['type'] == 'source':
                self.assertEqual(r['source_type'], 'book')

    def test_filter_by_tag(self):
        response = self.client.get('/api/v1/search/?q=urban&tag=chicago')
        data = response.json()
        source_results = [r for r in data['results'] if r['type'] == 'source']
        for r in source_results:
            self.assertIn('chicago', r['tags'])

    def test_facets_returned(self):
        response = self.client.get('/api/v1/search/?q=urban&facets=source_type,tag')
        data = response.json()
        self.assertIn('source_type', data['facets'])
        self.assertIn('tag', data['facets'])

    def test_facets_not_returned_without_param(self):
        response = self.client.get('/api/v1/search/?q=urban')
        data = response.json()
        self.assertEqual(data['facets'], {})

    def test_pagination(self):
        response = self.client.get('/api/v1/search/?q=urban&per_page=1&page=1')
        data = response.json()
        self.assertEqual(data['per_page'], 1)
        self.assertLessEqual(len(data['results']), 1)
        self.assertGreaterEqual(data['total_pages'], 1)

    def test_per_page_clamped(self):
        response = self.client.get('/api/v1/search/?q=urban&per_page=999')
        data = response.json()
        self.assertEqual(data['per_page'], 100)

    def test_result_shape(self):
        response = self.client.get('/api/v1/search/?q=housing')
        data = response.json()
        required_keys = {'query', 'total', 'results', 'facets', 'page', 'per_page', 'total_pages'}
        self.assertTrue(required_keys.issubset(data.keys()))
        if data['results']:
            result = data['results'][0]
            result_keys = {'type', 'id', 'slug', 'title', 'snippet', 'rank', 'source_type', 'tags', 'creator'}
            self.assertTrue(result_keys.issubset(result.keys()))

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.get('/api/v1/search/?q=housing')
        self.assertEqual(response.status_code, 401)


# ── Graph algorithm tests (Batch 2) ─────────────────────────────

class GraphTestMixin:
    """Shared setup for graph algorithm tests."""

    def setUp(self):
        from apps.research.graph import invalidate_graph_cache
        invalidate_graph_cache()

        self.client = APIClient()
        self.key = APIKey.objects.create(
            name='Graph Test',
            owner_email='user@example.com',
            requests_per_hour=1000,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')

        # Create sources
        self.src_a = Source.objects.create(
            title='Source Alpha', slug='source-alpha',
            creator='Author A', source_type='book', public=True,
        )
        self.src_b = Source.objects.create(
            title='Source Beta', slug='source-beta',
            creator='Author B', source_type='article', public=True,
        )
        self.src_c = Source.objects.create(
            title='Source Gamma', slug='source-gamma',
            creator='Author C', source_type='book', public=True,
        )
        self.src_private = Source.objects.create(
            title='Private Source', slug='private-source',
            public=False,
        )

        # Create source links (source -> content edges)
        # Essay 1 uses sources A and B
        SourceLink.objects.create(
            source=self.src_a, content_type='essay',
            content_slug='essay-one', content_title='Essay One',
            role='primary',
        )
        SourceLink.objects.create(
            source=self.src_b, content_type='essay',
            content_slug='essay-one', content_title='Essay One',
            role='background',
        )
        # Essay 2 uses sources A, B, and C
        SourceLink.objects.create(
            source=self.src_a, content_type='essay',
            content_slug='essay-two', content_title='Essay Two',
            role='primary',
        )
        SourceLink.objects.create(
            source=self.src_b, content_type='essay',
            content_slug='essay-two', content_title='Essay Two',
            role='data',
        )
        SourceLink.objects.create(
            source=self.src_c, content_type='essay',
            content_slug='essay-two', content_title='Essay Two',
            role='reference',
        )
        # Field note uses only source C
        SourceLink.objects.create(
            source=self.src_c, content_type='field_note',
            content_slug='note-one', content_title='Note One',
            role='primary',
        )


class GraphBuilderTests(GraphTestMixin, TestCase):
    """Tests for the graph builder utility."""

    def test_build_graph_creates_nodes(self):
        from apps.research.graph import build_graph
        G = build_graph()
        # 3 public sources + 3 content nodes = 6
        self.assertEqual(len(G.nodes), 6)

    def test_build_graph_creates_edges(self):
        from apps.research.graph import build_graph
        G = build_graph()
        # 6 source links = 6 edges
        self.assertEqual(len(G.edges), 6)

    def test_private_sources_excluded(self):
        from apps.research.graph import build_graph
        G = build_graph()
        self.assertNotIn('source:private-source', G)

    def test_cache_invalidation(self):
        from apps.research.graph import build_graph, invalidate_graph_cache
        g1 = build_graph()
        # Add a new source and invalidate
        Source.objects.create(
            title='Source Delta', slug='source-delta',
            source_type='article', public=True,
        )
        invalidate_graph_cache()
        g2 = build_graph()
        self.assertGreater(len(g2.nodes), len(g1.nodes))


class PageRankTests(GraphTestMixin, TestCase):
    """GET /api/v1/sources/ranked/"""

    def test_returns_ranked_sources(self):
        response = self.client.get('/api/v1/sources/ranked/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('sources', data)
        self.assertGreater(len(data['sources']), 0)

    def test_sources_have_influence_score(self):
        response = self.client.get('/api/v1/sources/ranked/')
        data = response.json()
        for source in data['sources']:
            self.assertIn('influence_score', source)
            self.assertGreater(source['influence_score'], 0)

    def test_sources_ordered_by_score(self):
        response = self.client.get('/api/v1/sources/ranked/')
        data = response.json()
        scores = [s['influence_score'] for s in data['sources']]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_n_parameter_limits_results(self):
        response = self.client.get('/api/v1/sources/ranked/?n=1')
        data = response.json()
        self.assertEqual(len(data['sources']), 1)

    def test_type_filter(self):
        response = self.client.get('/api/v1/sources/ranked/?type=book')
        data = response.json()
        for source in data['sources']:
            self.assertEqual(source['source_type'], 'book')

    def test_result_shape(self):
        response = self.client.get('/api/v1/sources/ranked/')
        data = response.json()
        source = data['sources'][0]
        required = {'slug', 'title', 'creator', 'source_type',
                    'influence_score', 'link_count', 'connected_content'}
        self.assertTrue(required.issubset(source.keys()))

    def test_connected_content_populated(self):
        response = self.client.get('/api/v1/sources/ranked/')
        data = response.json()
        # Source Alpha links to essay-one and essay-two
        alpha = next(
            (s for s in data['sources'] if s['slug'] == 'source-alpha'),
            None,
        )
        self.assertIsNotNone(alpha)
        self.assertGreaterEqual(alpha['link_count'], 2)

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.get('/api/v1/sources/ranked/')
        self.assertEqual(response.status_code, 401)


class PathFindingTests(GraphTestMixin, TestCase):
    """GET /api/v1/path/"""

    def test_requires_from_and_to(self):
        response = self.client.get('/api/v1/path/')
        self.assertEqual(response.status_code, 400)

    def test_requires_to(self):
        response = self.client.get('/api/v1/path/?from=source:source-alpha')
        self.assertEqual(response.status_code, 400)

    def test_finds_path_between_sources(self):
        # Alpha -> essay-one -> Beta (through shared content)
        response = self.client.get(
            '/api/v1/path/?from=source:source-alpha&to=source:source-beta'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['found'])
        self.assertGreater(data['path_length'], 0)
        self.assertGreater(len(data['path']), 0)

    def test_path_has_correct_shape(self):
        response = self.client.get(
            '/api/v1/path/?from=source:source-alpha&to=source:source-beta'
        )
        data = response.json()
        node = data['path'][0]
        required = {'id', 'type', 'label', 'slug', 'edge_to_next'}
        self.assertTrue(required.issubset(node.keys()))

    def test_no_path_returns_found_false(self):
        # Create an isolated source with no links
        Source.objects.create(
            title='Isolated Source', slug='isolated-source',
            public=True,
        )
        from apps.research.graph import invalidate_graph_cache
        invalidate_graph_cache()

        response = self.client.get(
            '/api/v1/path/?from=source:isolated-source&to=source:source-alpha'
        )
        data = response.json()
        self.assertFalse(data['found'])

    def test_nonexistent_node_returns_found_false(self):
        response = self.client.get(
            '/api/v1/path/?from=source:nonexistent&to=source:source-alpha'
        )
        data = response.json()
        self.assertFalse(data['found'])

    def test_content_node_path(self):
        response = self.client.get(
            '/api/v1/path/?from=content:essay:essay-one&to=content:essay:essay-two'
        )
        data = response.json()
        self.assertTrue(data['found'])

    def test_default_slug_resolution(self):
        # Bare slug should be resolved as content:essay:<slug>
        response = self.client.get(
            '/api/v1/path/?from=essay-one&to=essay-two'
        )
        data = response.json()
        self.assertTrue(data['found'])

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.get('/api/v1/path/?from=a&to=b')
        self.assertEqual(response.status_code, 401)


class ReadingOrderTests(GraphTestMixin, TestCase):
    """GET /api/v1/reading-order/"""

    def test_requires_target(self):
        response = self.client.get('/api/v1/reading-order/')
        self.assertEqual(response.status_code, 400)

    def test_returns_reading_order(self):
        # essay-two shares sources with essay-one and note-one
        response = self.client.get('/api/v1/reading-order/?target=essay-two')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['target'], 'essay-two')
        self.assertGreater(len(data['reading_order']), 0)

    def test_reading_order_has_position(self):
        response = self.client.get('/api/v1/reading-order/?target=essay-two')
        data = response.json()
        for item in data['reading_order']:
            self.assertIn('position', item)
            self.assertIn('slug', item)
            self.assertIn('reason', item)

    def test_max_parameter(self):
        response = self.client.get('/api/v1/reading-order/?target=essay-two&max=1')
        data = response.json()
        self.assertLessEqual(len(data['reading_order']), 1)

    def test_nonexistent_target_returns_empty(self):
        response = self.client.get('/api/v1/reading-order/?target=nonexistent')
        data = response.json()
        self.assertEqual(data['reading_order'], [])

    def test_target_not_in_reading_order(self):
        # The target itself should not appear in the prerequisites
        response = self.client.get('/api/v1/reading-order/?target=essay-two')
        data = response.json()
        slugs = [item['slug'] for item in data['reading_order']]
        self.assertNotIn('essay-two', slugs)

    def test_result_shape(self):
        response = self.client.get('/api/v1/reading-order/?target=essay-two')
        data = response.json()
        required_top = {'target', 'reading_order'}
        self.assertTrue(required_top.issubset(data.keys()))
        if data['reading_order']:
            item = data['reading_order'][0]
            required_item = {'position', 'content_type', 'slug', 'title', 'reason'}
            self.assertTrue(required_item.issubset(item.keys()))

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.get('/api/v1/reading-order/?target=essay-two')
        self.assertEqual(response.status_code, 401)


class EmptyGraphTests(TestCase):
    """Graph endpoints handle empty/sparse data gracefully."""

    def setUp(self):
        from apps.research.graph import invalidate_graph_cache
        invalidate_graph_cache()

        self.client = APIClient()
        self.key = APIKey.objects.create(
            name='Empty Graph Test',
            owner_email='user@example.com',
            requests_per_hour=1000,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')

    def test_ranked_empty_graph(self):
        response = self.client.get('/api/v1/sources/ranked/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['sources'], [])

    def test_path_empty_graph(self):
        response = self.client.get('/api/v1/path/?from=a&to=b')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['found'])

    def test_reading_order_empty_graph(self):
        response = self.client.get('/api/v1/reading-order/?target=anything')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['reading_order'], [])


# ── Batch 3: Export and Import ───────────────────────────────────

class ExportTestMixin:
    """Shared setUp for export tests."""

    def setUp(self):
        self.client = APIClient()
        self.key = APIKey.objects.create(
            name='Export User',
            owner_email='export@example.com',
            requests_per_hour=1000,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')

        self.source1 = Source.objects.create(
            title='The Power Broker',
            slug='power-broker',
            creator='Robert Caro',
            source_type='book',
            url='https://example.com/power-broker',
            publication='Knopf',
            date_published='1974-09-16',
            public_annotation='Definitive study of Robert Moses.',
            tags=['urban-planning', 'politics'],
            public=True,
        )
        self.source2 = Source.objects.create(
            title='Death and Life of Great American Cities',
            slug='death-and-life',
            creator='Jane Jacobs',
            source_type='article',
            url='https://example.com/death-and-life',
            publication='Random House',
            date_published='1961-01-01',
            public_annotation='Critique of urban renewal.',
            tags=['urban-planning', 'cities'],
            public=True,
        )
        Source.objects.create(
            title='Private Notes',
            slug='private-notes',
            public=False,
        )


class ExportFormatTests(ExportTestMixin, TestCase):
    """Tests for the export endpoint across all formats."""

    def test_requires_format(self):
        response = self.client.get('/api/v1/export/')
        self.assertEqual(response.status_code, 400)
        self.assertIn('format', response.json()['error'].lower())

    def test_invalid_format(self):
        response = self.client.get('/api/v1/export/?format=xml')
        self.assertEqual(response.status_code, 400)

    def test_export_json(self):
        response = self.client.get('/api/v1/export/?format=json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('application/json', response['Content-Type'])
        self.assertIn('attachment', response['Content-Disposition'])
        import json
        data = json.loads(response.content)
        self.assertEqual(len(data), 2)  # excludes private source

    def test_export_bibtex(self):
        response = self.client.get('/api/v1/export/?format=bibtex')
        self.assertEqual(response.status_code, 200)
        self.assertIn('application/x-bibtex', response['Content-Type'])
        content = response.content.decode()
        self.assertIn('@book{', content)
        self.assertIn('The Power Broker', content)
        self.assertIn('Robert Caro', content)

    def test_export_ris(self):
        response = self.client.get('/api/v1/export/?format=ris')
        self.assertEqual(response.status_code, 200)
        self.assertIn('application/x-research-info-systems', response['Content-Type'])
        content = response.content.decode()
        self.assertIn('TY  - BOOK', content)
        self.assertIn('TI  - The Power Broker', content)
        self.assertIn('ER  - ', content)

    def test_export_opml(self):
        response = self.client.get('/api/v1/export/?format=opml')
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/x-opml', response['Content-Type'])
        content = response.content.decode()
        self.assertIn('The Power Broker', content)
        self.assertIn('<opml', content)

    def test_export_csv(self):
        response = self.client.get('/api/v1/export/?format=csv')
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/csv', response['Content-Type'])
        content = response.content.decode()
        self.assertIn('title,creator,source_type', content)
        self.assertIn('The Power Broker', content)

    def test_export_jsonld(self):
        response = self.client.get('/api/v1/export/?format=json-ld')
        self.assertEqual(response.status_code, 200)
        self.assertIn('application/ld+json', response['Content-Type'])
        import json
        data = json.loads(response.content)
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]['@context'], 'https://schema.org')

    def test_export_excludes_private(self):
        response = self.client.get('/api/v1/export/?format=json')
        import json
        data = json.loads(response.content)
        slugs = [s.get('slug') for s in data]
        self.assertNotIn('private-notes', slugs)

    def test_export_filter_by_type(self):
        response = self.client.get('/api/v1/export/?format=json&type=book')
        import json
        data = json.loads(response.content)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['slug'], 'power-broker')

    def test_export_filter_by_tag(self):
        response = self.client.get('/api/v1/export/?format=json&tag=cities')
        import json
        data = json.loads(response.content)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['slug'], 'death-and-life')

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.get('/api/v1/export/?format=json')
        self.assertEqual(response.status_code, 401)


class ImportTests(TestCase):
    """Tests for the import endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.key = APIKey.objects.create(
            name='Import User',
            owner_email='import@example.com',
            requests_per_hour=1000,
            can_import=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')

    def test_import_requires_can_import(self):
        """Key without can_import gets 403."""
        no_import_key = APIKey.objects.create(
            name='No Import',
            owner_email='noimport@example.com',
            can_import=False,
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {no_import_key.key}')
        from io import BytesIO
        from django.core.files.uploadedfile import SimpleUploadedFile
        f = SimpleUploadedFile('test.json', b'[]', content_type='application/json')
        response = client.post('/api/v1/import/', {'format': 'json', 'file': f})
        self.assertEqual(response.status_code, 403)

    def test_import_requires_format(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        f = SimpleUploadedFile('test.txt', b'data', content_type='text/plain')
        response = self.client.post('/api/v1/import/', {'file': f})
        self.assertEqual(response.status_code, 400)

    def test_import_requires_file(self):
        response = self.client.post('/api/v1/import/', {'format': 'json'})
        self.assertEqual(response.status_code, 400)

    def test_import_json(self):
        import json
        from django.core.files.uploadedfile import SimpleUploadedFile
        data = json.dumps([
            {'title': 'Imported Book', 'creator': 'Author A', 'source_type': 'book'},
            {'title': 'Imported Article', 'creator': 'Author B', 'source_type': 'article'},
        ])
        f = SimpleUploadedFile('sources.json', data.encode(), content_type='application/json')
        response = self.client.post('/api/v1/import/', {'format': 'json', 'file': f})
        self.assertEqual(response.status_code, 201)
        result = response.json()
        self.assertEqual(result['created'], 2)
        self.assertEqual(result['status'], 'completed')
        self.assertTrue(Source.objects.filter(slug='imported-book').exists())

    def test_import_bibtex(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        bibtex = (
            '@book{test_book,\n'
            '  title = {A Test Book},\n'
            '  author = {John Doe},\n'
            '  year = {2024},\n'
            '}\n'
        )
        f = SimpleUploadedFile('refs.bib', bibtex.encode(), content_type='application/x-bibtex')
        response = self.client.post('/api/v1/import/', {'format': 'bibtex', 'file': f})
        self.assertIn(response.status_code, [200, 201])
        self.assertTrue(Source.objects.filter(slug='a-test-book').exists())

    def test_import_ris(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        ris = (
            'TY  - JOUR\n'
            'TI  - A Test Article\n'
            'AU  - Jane Smith\n'
            'PY  - 2023\n'
            'ER  - \n'
        )
        f = SimpleUploadedFile('refs.ris', ris.encode(), content_type='application/x-research-info-systems')
        response = self.client.post('/api/v1/import/', {'format': 'ris', 'file': f})
        self.assertIn(response.status_code, [200, 201])
        self.assertTrue(Source.objects.filter(slug='a-test-article').exists())

    def test_import_csv(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        csv_data = (
            'title,creator,source_type,url\n'
            'CSV Source,CSV Author,book,https://example.com\n'
        )
        f = SimpleUploadedFile('sources.csv', csv_data.encode(), content_type='text/csv')
        response = self.client.post('/api/v1/import/', {'format': 'csv', 'file': f})
        self.assertIn(response.status_code, [200, 201])
        self.assertTrue(Source.objects.filter(slug='csv-source').exists())

    def test_import_dry_run(self):
        """dry_run parses and previews without creating records."""
        import json
        from django.core.files.uploadedfile import SimpleUploadedFile
        data = json.dumps([
            {'title': 'Dry Run Source', 'source_type': 'book'},
        ])
        f = SimpleUploadedFile('dry.json', data.encode(), content_type='application/json')
        response = self.client.post(
            '/api/v1/import/',
            {'format': 'json', 'file': f, 'dry_run': 'true'},
        )
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertIn('preview', result)
        self.assertEqual(len(result['preview']), 1)
        self.assertFalse(Source.objects.filter(slug='dry-run-source').exists())

    def test_import_skips_duplicates(self):
        """Duplicate sources (by slug) are skipped."""
        Source.objects.create(title='Existing Source', slug='existing-source', public=True)
        import json
        from django.core.files.uploadedfile import SimpleUploadedFile
        data = json.dumps([{'title': 'Existing Source'}])
        f = SimpleUploadedFile('dup.json', data.encode(), content_type='application/json')
        response = self.client.post('/api/v1/import/', {'format': 'json', 'file': f})
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result['skipped'], 1)
        self.assertEqual(result['created'], 0)

    def test_import_creates_audit_trail(self):
        """Import creates an ImportJob record."""
        import json
        from django.core.files.uploadedfile import SimpleUploadedFile
        data = json.dumps([{'title': 'Audited Source'}])
        f = SimpleUploadedFile('audit.json', data.encode(), content_type='application/json')
        self.client.post('/api/v1/import/', {'format': 'json', 'file': f})
        job = ImportJob.objects.first()
        self.assertIsNotNone(job)
        self.assertEqual(job.format, 'json')
        self.assertEqual(job.filename, 'audit.json')
        self.assertEqual(job.created_count, 1)

    def test_import_handles_missing_titles(self):
        """Records without titles are reported as errors."""
        import json
        from django.core.files.uploadedfile import SimpleUploadedFile
        data = json.dumps([{'creator': 'No Title Author'}])
        f = SimpleUploadedFile('bad.json', data.encode(), content_type='application/json')
        response = self.client.post('/api/v1/import/', {'format': 'json', 'file': f})
        result = response.json()
        self.assertEqual(result['status'], 'completed_with_errors')
        self.assertEqual(len(result['errors']), 1)

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.post('/api/v1/import/', {'format': 'json'})
        self.assertEqual(response.status_code, 401)


# ===========================================================================
# Batch 4: Temporal Analysis and Trend Detection
# ===========================================================================

class TrendsTests(TestCase):
    """Tests for the /api/v1/trends/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.key = APIKey.objects.create(
            name='Trends Test',
            owner_email='user@example.com',
            requests_per_hour=1000,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')

        today = timezone.now().date()
        # Create sources spread over the last 90 days
        for i in range(10):
            src = Source.objects.create(
                title=f'Trend Source {i}',
                slug=f'trend-source-{i}',
                public=True,
            )
            # Backdate created_at
            Source.objects.filter(pk=src.pk).update(
                created_at=timezone.now() - datetime.timedelta(days=i * 9),
            )

    def test_returns_series(self):
        response = self.client.get('/api/v1/trends/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('series', data)
        self.assertIn('direction', data)
        self.assertIn('summary', data)
        self.assertIn('window_days', data)

    def test_default_window_is_30(self):
        response = self.client.get('/api/v1/trends/')
        self.assertEqual(response.json()['window_days'], 30)

    def test_custom_window(self):
        response = self.client.get('/api/v1/trends/?window=7')
        self.assertEqual(response.json()['window_days'], 7)

    def test_window_clamped(self):
        response = self.client.get('/api/v1/trends/?window=999')
        self.assertEqual(response.json()['window_days'], 365)
        response = self.client.get('/api/v1/trends/?window=0')
        self.assertEqual(response.json()['window_days'], 1)

    def test_series_has_dates(self):
        response = self.client.get('/api/v1/trends/')
        series = response.json()['series']
        self.assertTrue(len(series) > 0)
        self.assertIn('date', series[0])

    def test_direction_values(self):
        response = self.client.get('/api/v1/trends/')
        direction = response.json()['direction']
        valid_values = {'accelerating', 'decelerating', 'stable'}
        for key, value in direction.items():
            self.assertIn(value, valid_values)

    def test_metric_filter_sources(self):
        response = self.client.get('/api/v1/trends/?metric=sources')
        data = response.json()
        self.assertIn('sources', data['direction'])
        self.assertNotIn('links', data['direction'])

    def test_metric_filter_invalid(self):
        response = self.client.get('/api/v1/trends/?metric=invalid')
        self.assertEqual(response.status_code, 400)

    def test_summary_fields(self):
        response = self.client.get('/api/v1/trends/')
        summary = response.json()['summary']
        self.assertIn('most_active_day', summary)
        self.assertIn('longest_gap_days', summary)
        self.assertIn('current_streak_days', summary)

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.get('/api/v1/trends/')
        self.assertEqual(response.status_code, 401)


class ThreadVelocityTests(TestCase):
    """Tests for the /api/v1/threads/velocity/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.key = APIKey.objects.create(
            name='Velocity Test',
            owner_email='user@example.com',
            requests_per_hour=1000,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')

        today = timezone.now().date()

        # Active thread: entries in the last 7 days
        self.active_thread = ResearchThread.objects.create(
            title='Active Research',
            slug='active-research',
            status='active',
            started_date=today - datetime.timedelta(days=60),
            public=True,
        )
        for i in range(5):
            ThreadEntry.objects.create(
                thread=self.active_thread,
                entry_type='note',
                date=today - datetime.timedelta(days=i),
                title=f'Recent Entry {i}',
                order=i,
            )

        # Stale thread: last entry 45 days ago
        self.stale_thread = ResearchThread.objects.create(
            title='Stale Thread',
            slug='stale-thread',
            status='active',
            started_date=today - datetime.timedelta(days=120),
            public=True,
        )
        ThreadEntry.objects.create(
            thread=self.stale_thread,
            entry_type='note',
            date=today - datetime.timedelta(days=45),
            title='Old Entry',
            order=0,
        )

        # Dormant thread: no entries
        self.dormant_thread = ResearchThread.objects.create(
            title='Dormant Thread',
            slug='dormant-thread',
            status='active',
            started_date=today - datetime.timedelta(days=200),
            public=True,
        )

        # Private thread: should be excluded
        ResearchThread.objects.create(
            title='Private Thread',
            slug='private-thread',
            status='active',
            started_date=today,
            public=False,
        )

    def test_returns_threads(self):
        response = self.client.get('/api/v1/threads/velocity/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('threads', data)
        self.assertTrue(len(data['threads']) >= 3)

    def test_excludes_private_threads(self):
        response = self.client.get('/api/v1/threads/velocity/')
        slugs = [t['slug'] for t in response.json()['threads']]
        self.assertNotIn('private-thread', slugs)

    def test_thread_shape(self):
        response = self.client.get('/api/v1/threads/velocity/')
        thread = next(
            t for t in response.json()['threads']
            if t['slug'] == 'active-research'
        )
        expected_keys = {
            'slug', 'title', 'status', 'entry_count',
            'entries_last_30_days', 'entries_last_7_days',
            'days_since_last_entry', 'velocity', 'staleness',
            'started_date', 'last_entry_date',
        }
        self.assertEqual(set(thread.keys()), expected_keys)

    def test_active_thread_is_fresh(self):
        response = self.client.get('/api/v1/threads/velocity/')
        thread = next(
            t for t in response.json()['threads']
            if t['slug'] == 'active-research'
        )
        self.assertEqual(thread['staleness'], 'fresh')
        self.assertEqual(thread['entry_count'], 5)
        self.assertTrue(thread['velocity'] > 0)

    def test_stale_thread_is_stale(self):
        response = self.client.get('/api/v1/threads/velocity/')
        thread = next(
            t for t in response.json()['threads']
            if t['slug'] == 'stale-thread'
        )
        self.assertEqual(thread['staleness'], 'stale')
        self.assertEqual(thread['days_since_last_entry'], 45)

    def test_dormant_thread(self):
        response = self.client.get('/api/v1/threads/velocity/')
        thread = next(
            t for t in response.json()['threads']
            if t['slug'] == 'dormant-thread'
        )
        self.assertEqual(thread['staleness'], 'dormant')
        self.assertEqual(thread['entry_count'], 0)
        self.assertEqual(thread['velocity'], 0.0)
        self.assertIsNone(thread['days_since_last_entry'])

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.get('/api/v1/threads/velocity/')
        self.assertEqual(response.status_code, 401)


# ── Batch 5: Source Health and Link Rot Detection ────────────────────


class HealthCheckModelTests(TestCase):
    """HealthCheck model basics."""

    def test_create_health_check(self):
        source = Source.objects.create(
            title='Example Source',
            url='https://example.com/article',
            public=True,
        )
        hc = HealthCheck.objects.create(
            source=source,
            status_code=200,
            is_alive=True,
        )
        self.assertEqual(hc.source, source)
        self.assertTrue(hc.is_alive)
        self.assertEqual(hc.status_code, 200)
        self.assertIn('alive', str(hc))

    def test_dead_check_with_archive(self):
        source = Source.objects.create(
            title='Dead Source',
            url='https://deadlink.example.com',
            public=True,
        )
        hc = HealthCheck.objects.create(
            source=source,
            status_code=404,
            is_alive=False,
            has_archive=True,
            archive_url='https://web.archive.org/web/2024/https://deadlink.example.com',
            error_message='',
        )
        self.assertFalse(hc.is_alive)
        self.assertTrue(hc.has_archive)
        self.assertIn('dead', str(hc))

    def test_latest_by_checked_at(self):
        source = Source.objects.create(
            title='Multi Check',
            url='https://example.com',
            public=True,
        )
        HealthCheck.objects.create(source=source, status_code=200, is_alive=True)
        latest = HealthCheck.objects.create(source=source, status_code=503, is_alive=False)
        self.assertEqual(
            HealthCheck.objects.filter(source=source).latest(),
            latest,
        )


class SourceHealthEndpointTests(TestCase):
    """GET /api/v1/sources/health/"""

    def setUp(self):
        self.client = APIClient()
        self.key = APIKey.objects.create(
            name='Health Test',
            owner_email='health@example.com',
            requests_per_hour=1000,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')

        # Sources with URLs
        self.alive_source = Source.objects.create(
            title='Alive Source',
            url='https://alive.example.com',
            public=True,
        )
        self.dead_source = Source.objects.create(
            title='Dead Source',
            url='https://dead.example.com',
            public=True,
        )
        self.redirect_source = Source.objects.create(
            title='Redirect Source',
            url='https://old.example.com',
            public=True,
        )
        self.unchecked_source = Source.objects.create(
            title='Unchecked Source',
            url='https://unchecked.example.com',
            public=True,
        )
        # Source without URL (should be excluded)
        Source.objects.create(
            title='No URL Source',
            url='',
            public=True,
        )

        # Create health checks
        HealthCheck.objects.create(
            source=self.alive_source,
            status_code=200,
            is_alive=True,
        )
        HealthCheck.objects.create(
            source=self.dead_source,
            status_code=404,
            is_alive=False,
            has_archive=True,
            archive_url='https://web.archive.org/web/2024/https://dead.example.com',
        )
        HealthCheck.objects.create(
            source=self.redirect_source,
            status_code=301,
            is_alive=True,
            redirect_url='https://new.example.com/page',
        )

    def test_health_summary(self):
        response = self.client.get('/api/v1/sources/health/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        summary = data['summary']
        self.assertEqual(summary['total_with_url'], 4)
        self.assertEqual(summary['alive'], 1)
        self.assertEqual(summary['dead'], 1)
        self.assertEqual(summary['redirected'], 1)
        self.assertEqual(summary['unchecked'], 1)
        self.assertEqual(summary['archived'], 1)

    def test_health_sources_list(self):
        response = self.client.get('/api/v1/sources/health/')
        sources = response.json()['sources']
        self.assertEqual(len(sources), 4)

        slugs = {s['slug'] for s in sources}
        self.assertIn('alive-source', slugs)
        self.assertIn('dead-source', slugs)

    def test_filter_alive(self):
        response = self.client.get('/api/v1/sources/health/?status=alive')
        sources = response.json()['sources']
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]['status'], 'alive')
        self.assertEqual(sources[0]['slug'], 'alive-source')

    def test_filter_dead(self):
        response = self.client.get('/api/v1/sources/health/?status=dead')
        sources = response.json()['sources']
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]['status'], 'dead')
        self.assertTrue(sources[0]['has_archive'])

    def test_filter_redirect(self):
        response = self.client.get('/api/v1/sources/health/?status=redirect')
        sources = response.json()['sources']
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]['status'], 'redirect')
        self.assertEqual(sources[0]['redirect_url'], 'https://new.example.com/page')

    def test_filter_unknown(self):
        response = self.client.get('/api/v1/sources/health/?status=unknown')
        sources = response.json()['sources']
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]['slug'], 'unchecked-source')

    def test_stale_days_filter(self):
        # All checks were just created (today), so stale_days=0 should exclude them
        # Only unchecked source (never checked) should remain
        response = self.client.get('/api/v1/sources/health/?stale_days=0')
        sources = response.json()['sources']
        # Unchecked source has last_checked=None, so it passes the stale filter
        unchecked = [s for s in sources if s['last_checked'] is None]
        self.assertTrue(len(unchecked) >= 1)

    def test_archive_url_on_dead_source(self):
        response = self.client.get('/api/v1/sources/health/?status=dead')
        source = response.json()['sources'][0]
        self.assertEqual(
            source['archive_url'],
            'https://web.archive.org/web/2024/https://dead.example.com',
        )

    def test_no_url_source_excluded(self):
        response = self.client.get('/api/v1/sources/health/')
        slugs = {s['slug'] for s in response.json()['sources']}
        self.assertNotIn('no-url-source', slugs)

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.get('/api/v1/sources/health/')
        self.assertEqual(response.status_code, 401)


# ── Batch 6: Contradiction and Tension Detection ─────────────────────


class TensionTests(TestCase):
    """GET /api/v1/tensions/"""

    def setUp(self):
        self.client = APIClient()
        self.key = APIKey.objects.create(
            name='Tension Test',
            owner_email='tension@example.com',
            requests_per_hour=1000,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.key.key}')

        # Source A: primary role on essay
        self.source_primary = Source.objects.create(
            title='Housing Data Report',
            creator='Jane Smith',
            source_type='article',
            publication='Urban Institute',
            tags=['housing', 'urban-design', 'data'],
            date_published=datetime.date(2020, 1, 15),
            public=True,
        )
        # Source B: counterargument role on same essay
        self.source_counter = Source.objects.create(
            title='Housing Policy Critique',
            creator='John Doe',
            source_type='article',
            publication='Heritage Foundation',
            tags=['housing', 'urban-design', 'policy'],
            date_published=datetime.date(2021, 6, 1),
            public=True,
        )
        # Source C: same tags, different publisher, no role tension
        self.source_divergent = Source.objects.create(
            title='Transit and Housing Nexus',
            creator='Alex Kim',
            source_type='book',
            publication='MIT Press',
            tags=['housing', 'urban-design', 'transit'],
            date_published=datetime.date(2023, 3, 10),
            public=True,
        )
        # Source D: same topic, very old (temporal tension)
        self.source_old = Source.objects.create(
            title='Housing in the 1990s',
            creator='Old Author',
            source_type='article',
            publication='Urban Institute',
            tags=['housing', 'urban-design'],
            date_published=datetime.date(2010, 1, 1),
            public=True,
        )

        # Create SourceLinks for role-based tension
        SourceLink.objects.create(
            source=self.source_primary,
            content_type='essay',
            content_slug='housing-policy-analysis',
            role='primary',
        )
        SourceLink.objects.create(
            source=self.source_counter,
            content_type='essay',
            content_slug='housing-policy-analysis',
            role='counterargument',
        )

    def test_returns_tensions(self):
        response = self.client.get('/api/v1/tensions/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('tensions', data)
        self.assertIsInstance(data['tensions'], list)

    def test_role_based_tension_detected(self):
        response = self.client.get('/api/v1/tensions/')
        tensions = response.json()['tensions']
        counterarg = [t for t in tensions if t['tension_type'] == 'counterargument']
        self.assertTrue(len(counterarg) >= 1)
        t = counterarg[0]
        slugs = {t['source_a']['slug'], t['source_b']['slug']}
        self.assertIn('housing-data-report', slugs)
        self.assertIn('housing-policy-critique', slugs)

    def test_tension_shape(self):
        response = self.client.get('/api/v1/tensions/')
        tensions = response.json()['tensions']
        if tensions:
            t = tensions[0]
            self.assertIn('source_a', t)
            self.assertIn('source_b', t)
            self.assertIn('score', t)
            self.assertIn('tension_type', t)
            self.assertIn('explanation', t)
            self.assertIn('shared_content', t)
            self.assertIn('shared_tags', t)
            # Source summaries have expected keys
            self.assertIn('slug', t['source_a'])
            self.assertIn('title', t['source_a'])
            self.assertIn('creator', t['source_a'])
            self.assertIn('publication', t['source_a'])

    def test_tension_explanation_is_readable(self):
        response = self.client.get('/api/v1/tensions/')
        tensions = response.json()['tensions']
        for t in tensions:
            self.assertTrue(len(t['explanation']) > 10)

    def test_publisher_divergence(self):
        response = self.client.get('/api/v1/tensions/')
        tensions = response.json()['tensions']
        pub_tensions = [t for t in tensions if t['tension_type'] == 'publisher_divergence']
        # Should find divergence: Urban Institute vs Heritage Foundation vs MIT Press
        self.assertTrue(len(pub_tensions) >= 1)

    def test_topic_filter(self):
        response = self.client.get('/api/v1/tensions/?topic=housing')
        tensions = response.json()['tensions']
        # All returned tensions should involve sources tagged 'housing'
        for t in tensions:
            combined_tags = set(t.get('shared_tags', []))
            # At minimum, the sources share the topic
            self.assertTrue(
                len(combined_tags) > 0 or t['tension_type'] == 'counterargument',
            )

    def test_content_filter(self):
        response = self.client.get('/api/v1/tensions/?content=housing-policy-analysis')
        tensions = response.json()['tensions']
        counterarg = [t for t in tensions if t['tension_type'] == 'counterargument']
        self.assertTrue(len(counterarg) >= 1)

    def test_min_score_filter(self):
        response = self.client.get('/api/v1/tensions/?min_score=0.95')
        tensions = response.json()['tensions']
        for t in tensions:
            self.assertGreaterEqual(t['score'], 0.95)

    def test_scores_sorted_descending(self):
        response = self.client.get('/api/v1/tensions/')
        tensions = response.json()['tensions']
        scores = [t['score'] for t in tensions]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_shared_content_on_role_tension(self):
        response = self.client.get('/api/v1/tensions/')
        tensions = response.json()['tensions']
        counterarg = [t for t in tensions if t['tension_type'] == 'counterargument']
        if counterarg:
            self.assertIn('housing-policy-analysis', counterarg[0]['shared_content'])

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.get('/api/v1/tensions/')
        self.assertEqual(response.status_code, 401)


# ── Batch 7: Research Sessions ───────────────────────────────────────


class ResearchSessionModelTests(TestCase):
    """ResearchSession and SessionNode model tests."""

    def setUp(self):
        self.api_key = APIKey.objects.create(
            name='Session Tester',
            owner_email='session@test.com',
            can_sessions=True,
        )

    def test_create_session(self):
        session = ResearchSession.objects.create(
            api_key=self.api_key,
            title='Housing Research',
            slug='housing-research',
        )
        self.assertEqual(session.title, 'Housing Research')
        self.assertTrue(session.is_active)

    def test_unique_together_api_key_slug(self):
        ResearchSession.objects.create(
            api_key=self.api_key,
            title='First',
            slug='my-session',
        )
        with self.assertRaises(Exception):
            ResearchSession.objects.create(
                api_key=self.api_key,
                title='Second',
                slug='my-session',
            )

    def test_different_keys_same_slug(self):
        """Different API keys can have sessions with the same slug."""
        other_key = APIKey.objects.create(
            name='Other Tester',
            owner_email='other@test.com',
            can_sessions=True,
        )
        ResearchSession.objects.create(
            api_key=self.api_key,
            title='First',
            slug='shared-slug',
        )
        session2 = ResearchSession.objects.create(
            api_key=other_key,
            title='Second',
            slug='shared-slug',
        )
        self.assertEqual(session2.slug, 'shared-slug')

    def test_session_node_creation(self):
        session = ResearchSession.objects.create(
            api_key=self.api_key,
            title='Test',
            slug='test',
        )
        node = SessionNode.objects.create(
            session=session,
            node_type='source',
            node_slug='test-source',
            notes='Important source',
        )
        self.assertEqual(node.node_type, 'source')
        self.assertEqual(session.nodes.count(), 1)

    def test_node_unique_together(self):
        session = ResearchSession.objects.create(
            api_key=self.api_key,
            title='Test',
            slug='test',
        )
        SessionNode.objects.create(
            session=session,
            node_type='source',
            node_slug='test-source',
        )
        with self.assertRaises(Exception):
            SessionNode.objects.create(
                session=session,
                node_type='source',
                node_slug='test-source',
            )


class SessionEndpointTests(TestCase):
    """Session CRUD endpoint tests."""

    def setUp(self):
        self.api_key = APIKey.objects.create(
            name='Session User',
            owner_email='session@test.com',
            can_sessions=True,
        )
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.api_key.key}')

        # Create a source and link for edge computation
        self.source = Source.objects.create(
            title='Urban Planning Theory',
            slug='urban-planning-theory',
            url='https://example.com/urban',
            source_type='article',
            public=True,
        )
        SourceLink.objects.create(
            source=self.source,
            content_type='essay',
            content_slug='housing-crisis',
            content_title='Housing Crisis',
            role='primary',
        )

    def test_create_session(self):
        response = self.client.post('/api/v1/sessions/', {
            'title': 'Housing Deep Dive',
            'nodes': [
                {'node_type': 'source', 'node_slug': 'urban-planning-theory'},
                {'node_type': 'essay', 'node_slug': 'housing-crisis'},
            ],
        }, format='json')
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['slug'], 'housing-deep-dive')
        self.assertEqual(data['node_count'], 2)

    def test_create_session_custom_slug(self):
        response = self.client.post('/api/v1/sessions/', {
            'title': 'My Research',
            'slug': 'custom-slug',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['slug'], 'custom-slug')

    def test_create_session_duplicate_slug_409(self):
        self.client.post('/api/v1/sessions/', {
            'title': 'First',
            'slug': 'same-slug',
        }, format='json')
        response = self.client.post('/api/v1/sessions/', {
            'title': 'Second',
            'slug': 'same-slug',
        }, format='json')
        self.assertEqual(response.status_code, 409)

    def test_create_session_no_title_400(self):
        response = self.client.post('/api/v1/sessions/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_list_sessions(self):
        ResearchSession.objects.create(
            api_key=self.api_key,
            title='Session A',
            slug='session-a',
        )
        ResearchSession.objects.create(
            api_key=self.api_key,
            title='Session B',
            slug='session-b',
        )
        response = self.client.get('/api/v1/sessions/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['sessions']), 2)

    def test_list_sessions_key_scoped(self):
        """Sessions from other API keys are not visible."""
        other_key = APIKey.objects.create(
            name='Other User',
            owner_email='other@test.com',
            can_sessions=True,
        )
        ResearchSession.objects.create(
            api_key=other_key,
            title='Other Session',
            slug='other-session',
        )
        ResearchSession.objects.create(
            api_key=self.api_key,
            title='My Session',
            slug='my-session',
        )
        response = self.client.get('/api/v1/sessions/')
        sessions = response.json()['sessions']
        self.assertEqual(len(sessions), 1)
        self.assertEqual(sessions[0]['slug'], 'my-session')

    def test_list_filter_active(self):
        ResearchSession.objects.create(
            api_key=self.api_key,
            title='Active',
            slug='active',
            is_active=True,
        )
        ResearchSession.objects.create(
            api_key=self.api_key,
            title='Archived',
            slug='archived',
            is_active=False,
        )
        response = self.client.get('/api/v1/sessions/?active=true')
        self.assertEqual(len(response.json()['sessions']), 1)
        self.assertEqual(response.json()['sessions'][0]['slug'], 'active')

    def test_session_detail_with_nodes(self):
        session = ResearchSession.objects.create(
            api_key=self.api_key,
            title='Detail Test',
            slug='detail-test',
        )
        SessionNode.objects.create(
            session=session,
            node_type='source',
            node_slug='urban-planning-theory',
        )
        SessionNode.objects.create(
            session=session,
            node_type='essay',
            node_slug='housing-crisis',
        )
        response = self.client.get('/api/v1/sessions/detail-test/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data['nodes']), 2)
        self.assertIn('edges', data)

    def test_session_detail_computed_edges(self):
        """Edges are computed between nodes that share sources."""
        session = ResearchSession.objects.create(
            api_key=self.api_key,
            title='Edge Test',
            slug='edge-test',
        )
        SessionNode.objects.create(
            session=session,
            node_type='source',
            node_slug='urban-planning-theory',
        )
        SessionNode.objects.create(
            session=session,
            node_type='essay',
            node_slug='housing-crisis',
        )
        response = self.client.get('/api/v1/sessions/edge-test/')
        edges = response.json()['edges']
        # Source is linked to essay via SourceLink, so there should be an edge
        self.assertTrue(len(edges) > 0)
        edge = edges[0]
        self.assertEqual(edge['source'], 'source:urban-planning-theory')
        self.assertEqual(edge['target'], 'essay:housing-crisis')

    def test_session_detail_not_found(self):
        response = self.client.get('/api/v1/sessions/nonexistent/')
        self.assertEqual(response.status_code, 404)

    def test_update_session_metadata(self):
        ResearchSession.objects.create(
            api_key=self.api_key,
            title='Original',
            slug='update-test',
        )
        response = self.client.patch('/api/v1/sessions/update-test/', {
            'title': 'Updated Title',
            'is_active': False,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['title'], 'Updated Title')
        self.assertFalse(response.json()['is_active'])

    def test_update_add_nodes(self):
        session = ResearchSession.objects.create(
            api_key=self.api_key,
            title='Add Nodes Test',
            slug='add-nodes',
        )
        response = self.client.patch('/api/v1/sessions/add-nodes/', {
            'add_nodes': [
                {'node_type': 'source', 'node_slug': 'urban-planning-theory'},
            ],
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['nodes']), 1)

    def test_update_remove_nodes(self):
        session = ResearchSession.objects.create(
            api_key=self.api_key,
            title='Remove Test',
            slug='remove-nodes',
        )
        SessionNode.objects.create(
            session=session,
            node_type='source',
            node_slug='urban-planning-theory',
        )
        SessionNode.objects.create(
            session=session,
            node_type='essay',
            node_slug='housing-crisis',
        )
        response = self.client.patch('/api/v1/sessions/remove-nodes/', {
            'remove_nodes': [
                {'node_type': 'source', 'node_slug': 'urban-planning-theory'},
            ],
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['nodes']), 1)
        self.assertEqual(response.json()['nodes'][0]['node_slug'], 'housing-crisis')

    def test_delete_session(self):
        ResearchSession.objects.create(
            api_key=self.api_key,
            title='Delete Me',
            slug='delete-me',
        )
        response = self.client.delete('/api/v1/sessions/delete-me/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(
            ResearchSession.objects.filter(slug='delete-me').exists()
        )

    def test_without_can_sessions_returns_403(self):
        no_session_key = APIKey.objects.create(
            name='No Sessions',
            owner_email='nosessions@test.com',
            can_sessions=False,
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {no_session_key.key}')

        response = client.get('/api/v1/sessions/')
        self.assertEqual(response.status_code, 403)

        response = client.post('/api/v1/sessions/', {
            'title': 'Nope',
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.get('/api/v1/sessions/')
        self.assertEqual(response.status_code, 401)


# ─── Batch 8: Webhooks ──────────────────────────────────────────────────────


class WebhookSubscriptionModelTests(TestCase):
    """Model-level tests for WebhookSubscription and WebhookDelivery."""

    def setUp(self):
        self.api_key = APIKey.objects.create(
            name='Webhook Tester',
            owner_email='hook@test.com',
            tier='researcher',
            can_webhook=True,
        )

    def test_create_subscription(self):
        sub = WebhookSubscription.objects.create(
            api_key=self.api_key,
            callback_url='https://example.com/hook',
            events=['source.created', 'source.updated'],
            secret='test-secret-123',
        )
        self.assertTrue(sub.is_active)
        self.assertEqual(sub.consecutive_failures, 0)
        self.assertEqual(sub.events, ['source.created', 'source.updated'])

    def test_unique_together_api_key_callback_url(self):
        WebhookSubscription.objects.create(
            api_key=self.api_key,
            callback_url='https://example.com/hook',
            events=['source.created'],
            secret='secret-1',
        )
        with self.assertRaises(Exception):
            WebhookSubscription.objects.create(
                api_key=self.api_key,
                callback_url='https://example.com/hook',
                events=['source.updated'],
                secret='secret-2',
            )

    def test_different_keys_same_url_allowed(self):
        other_key = APIKey.objects.create(
            name='Other Key',
            owner_email='other@test.com',
            can_webhook=True,
        )
        WebhookSubscription.objects.create(
            api_key=self.api_key,
            callback_url='https://example.com/hook',
            events=['source.created'],
            secret='secret-1',
        )
        sub2 = WebhookSubscription.objects.create(
            api_key=other_key,
            callback_url='https://example.com/hook',
            events=['source.created'],
            secret='secret-2',
        )
        self.assertIsNotNone(sub2.id)

    def test_delivery_creation(self):
        sub = WebhookSubscription.objects.create(
            api_key=self.api_key,
            callback_url='https://example.com/hook',
            events=['source.created'],
            secret='test-secret',
        )
        delivery = WebhookDelivery.objects.create(
            subscription=sub,
            event_type='source.created',
            payload={'data': {'slug': 'test'}},
            status_code=200,
            success=True,
        )
        self.assertTrue(delivery.success)
        self.assertEqual(delivery.event_type, 'source.created')
        self.assertEqual(sub.deliveries.count(), 1)

    def test_valid_events_list(self):
        self.assertEqual(len(WebhookSubscription.VALID_EVENTS), 9)
        self.assertIn('source.created', WebhookSubscription.VALID_EVENTS)
        self.assertIn('health.alert', WebhookSubscription.VALID_EVENTS)


class WebhookDispatchTests(TestCase):
    """Tests for the webhook dispatch service (webhooks.py)."""

    def setUp(self):
        self.api_key = APIKey.objects.create(
            name='Dispatch Tester',
            owner_email='dispatch@test.com',
            tier='researcher',
            can_webhook=True,
        )
        self.sub = WebhookSubscription.objects.create(
            api_key=self.api_key,
            callback_url='https://example.com/hook',
            events=['source.created', 'source.updated'],
            secret='dispatch-secret-abc',
        )

    def test_hmac_signature_is_verifiable(self):
        """HMAC signature produced by _sign_payload can be independently verified."""
        import hashlib
        import hmac as hmac_module
        import json

        from apps.api.webhooks import _sign_payload

        payload = {'event': 'source.created', 'data': {'slug': 'test'}}
        payload_bytes = json.dumps(payload, default=str).encode('utf-8')
        secret = 'my-secret-key'

        signature = _sign_payload(payload_bytes, secret)

        # Independently verify
        expected = hmac_module.new(
            secret.encode('utf-8'),
            payload_bytes,
            hashlib.sha256,
        ).hexdigest()
        self.assertEqual(signature, expected)

    @patch('apps.api.webhooks.requests.post')
    def test_dispatch_successful_delivery(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        from apps.api.webhooks import dispatch_event

        deliveries = dispatch_event('source.created', {'slug': 'test-source'})

        self.assertEqual(len(deliveries), 1)
        self.assertTrue(deliveries[0].success)
        self.assertEqual(deliveries[0].status_code, 200)
        self.assertEqual(deliveries[0].event_type, 'source.created')

        # Verify HMAC header was sent
        call_kwargs = mock_post.call_args
        headers = call_kwargs.kwargs.get('headers') or call_kwargs[1].get('headers', {})
        self.assertIn('X-Webhook-Signature', headers)
        self.assertTrue(headers['X-Webhook-Signature'].startswith('sha256='))

    @patch('apps.api.webhooks.requests.post')
    def test_dispatch_skips_non_matching_events(self, mock_post):
        from apps.api.webhooks import dispatch_event

        deliveries = dispatch_event('thread.created', {'slug': 'thread-1'})

        self.assertEqual(len(deliveries), 0)
        mock_post.assert_not_called()

    @patch('apps.api.webhooks.requests.post')
    def test_wildcard_subscription_receives_all_events(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        wildcard_sub = WebhookSubscription.objects.create(
            api_key=self.api_key,
            callback_url='https://example.com/wildcard',
            events=['*'],
            secret='wildcard-secret',
        )

        from apps.api.webhooks import dispatch_event

        deliveries = dispatch_event('thread.created', {'slug': 'any'})
        self.assertEqual(len(deliveries), 1)
        self.assertEqual(deliveries[0].subscription_id, wildcard_sub.id)

    @patch('apps.api.webhooks.requests.post')
    def test_five_failures_deactivates_subscription(self, mock_post):
        """Spec: 5 consecutive failures deactivate the subscription."""
        mock_post.side_effect = requests_lib.ConnectionError('refused')

        from apps.api.webhooks import dispatch_event

        for i in range(5):
            dispatch_event('source.created', {'attempt': i})

        self.sub.refresh_from_db()
        self.assertFalse(self.sub.is_active)
        self.assertEqual(self.sub.consecutive_failures, 5)

    @patch('apps.api.webhooks.requests.post')
    def test_success_resets_consecutive_failures(self, mock_post):
        self.sub.consecutive_failures = 3
        self.sub.save()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        from apps.api.webhooks import dispatch_event

        dispatch_event('source.created', {'slug': 'reset-test'})

        self.sub.refresh_from_db()
        self.assertEqual(self.sub.consecutive_failures, 0)

    @patch('apps.api.webhooks.requests.post')
    def test_inactive_subscription_not_delivered(self, mock_post):
        self.sub.is_active = False
        self.sub.save()

        from apps.api.webhooks import dispatch_event

        deliveries = dispatch_event('source.created', {'slug': 'no-deliver'})
        self.assertEqual(len(deliveries), 0)
        mock_post.assert_not_called()

    @patch('apps.api.webhooks.requests.post')
    def test_timeout_recorded_as_failure(self, mock_post):
        mock_post.side_effect = requests_lib.Timeout('timed out')

        from apps.api.webhooks import dispatch_event

        deliveries = dispatch_event('source.created', {'slug': 'timeout'})
        self.assertEqual(len(deliveries), 1)
        self.assertFalse(deliveries[0].success)
        self.assertIn('timed out', deliveries[0].error_message)


class WebhookEndpointTests(TestCase):
    """HTTP-level tests for webhook management endpoints."""

    def setUp(self):
        self.api_key = APIKey.objects.create(
            name='Webhook API Tester',
            owner_email='webhook-api@test.com',
            tier='researcher',
            can_webhook=True,
        )
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.api_key.key}')

    def test_create_subscription(self):
        response = self.client.post('/api/v1/webhooks/', {
            'callback_url': 'https://myapp.com/hooks/research',
            'events': ['source.created', 'source.updated'],
        }, format='json')
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['callback_url'], 'https://myapp.com/hooks/research')
        self.assertEqual(data['events'], ['source.created', 'source.updated'])
        self.assertTrue(data['is_active'])
        # Secret is returned on creation
        self.assertIn('secret', data)
        self.assertTrue(len(data['secret']) > 0)

    def test_create_with_custom_secret(self):
        response = self.client.post('/api/v1/webhooks/', {
            'callback_url': 'https://myapp.com/hooks/custom',
            'events': ['source.created'],
            'secret': 'my-custom-secret-value',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['secret'], 'my-custom-secret-value')

    def test_create_duplicate_returns_409(self):
        self.client.post('/api/v1/webhooks/', {
            'callback_url': 'https://myapp.com/hooks/dup',
            'events': ['source.created'],
        }, format='json')
        response = self.client.post('/api/v1/webhooks/', {
            'callback_url': 'https://myapp.com/hooks/dup',
            'events': ['source.updated'],
        }, format='json')
        self.assertEqual(response.status_code, 409)

    def test_create_invalid_events_returns_400(self):
        response = self.client.post('/api/v1/webhooks/', {
            'callback_url': 'https://myapp.com/hooks/bad',
            'events': ['source.created', 'invalid.event'],
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('invalid.event', response.json()['error'])

    def test_create_empty_events_returns_400(self):
        response = self.client.post('/api/v1/webhooks/', {
            'callback_url': 'https://myapp.com/hooks/empty',
            'events': [],
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_create_no_callback_url_returns_400(self):
        response = self.client.post('/api/v1/webhooks/', {
            'events': ['source.created'],
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_list_subscriptions(self):
        WebhookSubscription.objects.create(
            api_key=self.api_key,
            callback_url='https://example.com/hook-1',
            events=['source.created'],
            secret='s1',
        )
        WebhookSubscription.objects.create(
            api_key=self.api_key,
            callback_url='https://example.com/hook-2',
            events=['*'],
            secret='s2',
        )

        response = self.client.get('/api/v1/webhooks/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['webhooks']), 2)

    def test_list_is_key_scoped(self):
        other_key = APIKey.objects.create(
            name='Other Webhook User',
            owner_email='other-hook@test.com',
            can_webhook=True,
        )
        WebhookSubscription.objects.create(
            api_key=other_key,
            callback_url='https://other.com/hook',
            events=['source.created'],
            secret='other-secret',
        )

        response = self.client.get('/api/v1/webhooks/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['webhooks']), 0)

    def test_delete_subscription(self):
        sub = WebhookSubscription.objects.create(
            api_key=self.api_key,
            callback_url='https://example.com/to-delete',
            events=['source.created'],
            secret='del-secret',
        )
        response = self.client.delete(f'/api/v1/webhooks/{sub.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(WebhookSubscription.objects.filter(id=sub.id).exists())

    def test_delete_other_keys_subscription_returns_404(self):
        other_key = APIKey.objects.create(
            name='Other Owner',
            owner_email='own@test.com',
            can_webhook=True,
        )
        sub = WebhookSubscription.objects.create(
            api_key=other_key,
            callback_url='https://other.com/private',
            events=['source.created'],
            secret='priv',
        )
        response = self.client.delete(f'/api/v1/webhooks/{sub.id}/')
        self.assertEqual(response.status_code, 404)

    def test_delivery_log(self):
        sub = WebhookSubscription.objects.create(
            api_key=self.api_key,
            callback_url='https://example.com/deliveries',
            events=['source.created'],
            secret='log-secret',
        )
        WebhookDelivery.objects.create(
            subscription=sub,
            event_type='source.created',
            payload={'data': {'slug': 'test'}},
            status_code=200,
            success=True,
        )
        WebhookDelivery.objects.create(
            subscription=sub,
            event_type='source.created',
            payload={'data': {'slug': 'test-2'}},
            status_code=500,
            success=False,
            error_message='Server error',
        )

        response = self.client.get(f'/api/v1/webhooks/{sub.id}/deliveries/')
        self.assertEqual(response.status_code, 200)
        deliveries = response.json()['deliveries']
        self.assertEqual(len(deliveries), 2)
        # Most recent first
        self.assertFalse(deliveries[0]['success'])
        self.assertTrue(deliveries[1]['success'])

    @patch('apps.api.webhook_views.dispatch_event')
    def test_webhook_test_endpoint(self, mock_dispatch):
        sub = WebhookSubscription.objects.create(
            api_key=self.api_key,
            callback_url='https://example.com/test-hook',
            events=['*'],
            secret='test-secret',
        )
        delivery = WebhookDelivery.objects.create(
            subscription=sub,
            event_type='test',
            payload={'message': 'test'},
            status_code=200,
            success=True,
        )
        mock_dispatch.return_value = [delivery]

        response = self.client.post('/api/v1/webhooks/test/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['delivered'], 1)
        self.assertTrue(data['results'][0]['success'])

    def test_without_can_webhook_returns_403(self):
        no_hook_key = APIKey.objects.create(
            name='No Webhook',
            owner_email='nohook@test.com',
            can_webhook=False,
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {no_hook_key.key}')

        response = client.get('/api/v1/webhooks/')
        self.assertEqual(response.status_code, 403)

        response = client.post('/api/v1/webhooks/', {
            'callback_url': 'https://nope.com/hook',
            'events': ['source.created'],
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.get('/api/v1/webhooks/')
        self.assertEqual(response.status_code, 401)

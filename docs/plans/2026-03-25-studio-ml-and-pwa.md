# Studio ML-Powered Writing Surface + PWA Transformation

> **For Claude:** REQUIRED: Use /execute-plan to implement this plan task-by-task.

**Goal:** Connect the Theseus ML engine to Studio's writing surface (post-save analysis, connection constellation, claim audit, source suggestions) and package Studio as an installable PWA.

**Architecture:** Two parallel batches. Batch 5 (ML) builds bottom-up: Index-API endpoints -> Publishing API proxy -> Frontend API client -> React components. Batch 4 (PWA) adds loading states, Cmd+K search, manifest, view transitions, and service worker. ML features degrade gracefully offline.

**Tech Stack:** Django 5.x + DRF (Index-API, Publishing API), pgvector, SBERT (all-MiniLM-L6-v2), spaCy (en_core_web_md), NLI cross-encoder, Next.js 16 (App Router), React 19, D3.js v7, TypeScript, Workbox (service worker)

**Repos:**
- `Index-API/` at `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/`
- `Website/` at `/Users/travisgilbert/Tech Dev Local/Creative/Website/` (Next.js frontend)
- `publishing_api/` at `/Users/travisgilbert/Tech Dev Local/Creative/Website/publishing_api/`

---

## Batch 5: ML-Powered Writing Surface

### Task 1: Index-API: POST /api/v1/similar/text/ endpoint

The existing `embedding_service.find_similar(text=...)` already does pgvector cosine distance search against stored embeddings. This task wraps it in a new view that accepts raw text (not a stored slug).

**Files:**
- Modify: `Index-API/apps/api/connection_views.py` (add new view after line ~170)
- Modify: `Index-API/apps/api/urls.py:82` (add URL pattern after `similar/sources/`)
- Test: `Index-API/apps/api/tests/test_similar_text.py` (create)

**Step 1: Write the failing test**

```python
# Index-API/apps/api/tests/test_similar_text.py

from django.test import TestCase
from rest_framework.test import APIClient


class SimilarTextEndpointTest(TestCase):
    """POST /api/v1/similar/text/ accepts raw text, returns similar objects."""

    def setUp(self):
        self.client = APIClient()

    def test_empty_text_returns_empty(self):
        resp = self.client.post(
            '/api/v1/similar/text/',
            {'text': ''},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['similar'], [])

    def test_short_text_returns_note(self):
        resp = self.client.post(
            '/api/v1/similar/text/',
            {'text': 'too short'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('note', resp.data)

    def test_valid_text_returns_list(self):
        """With no stored embeddings, should return empty list gracefully."""
        long_text = 'Urban infrastructure and public space design. ' * 5
        resp = self.client.post(
            '/api/v1/similar/text/',
            {'text': long_text, 'top': 5, 'threshold': 0.3},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('similar', resp.data)
        self.assertIsInstance(resp.data['similar'], list)

    def test_rejects_get(self):
        resp = self.client.get('/api/v1/similar/text/')
        self.assertEqual(resp.status_code, 405)
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API
python3 manage.py test apps.api.tests.test_similar_text -v2
```
Expected: FAIL (URL not found, 404)

**Step 3: Implement the view**

Add to `Index-API/apps/api/connection_views.py` after the existing `similar_sources` view:

```python
@api_view(['POST'])
def similar_to_text(request):
    """
    POST /api/v1/similar/text/

    Find objects semantically similar to arbitrary text input.
    Designed for live draft analysis: Studio sends the current
    essay body, gets back related objects from the knowledge graph.

    Body: { "text": "...", "top": 8, "threshold": 0.4 }
    """
    text = request.data.get('text', '')
    if not text or len(text.strip()) < 50:
        return Response({
            'similar': [],
            'note': 'Text too short for meaningful similarity.',
        })

    top_n = min(int(request.data.get('top', 8)), 20)
    threshold = float(request.data.get('threshold', 0.4))

    from apps.notebook.embedding_service import find_similar
    from apps.notebook.models import Object

    results = find_similar(
        text=text[:3000],
        target_kind='object',
        top_n=top_n,
        threshold=threshold,
    )

    # Hydrate with Object data
    obj_ids = [r['target_id'] for r in results]
    objects = {
        o.pk: o
        for o in Object.objects.filter(
            pk__in=obj_ids, is_deleted=False,
        ).select_related('object_type')
    }

    similar = []
    for r in results:
        obj = objects.get(r['target_id'])
        if not obj:
            continue
        similar.append({
            'id': str(obj.pk),
            'title': obj.display_title or obj.title,
            'objectType': obj.object_type.slug if obj.object_type else 'unknown',
            'similarity': round(r['score'], 3),
            'excerpt': (obj.body or '')[:200],
        })

    return Response({'similar': similar})
```

**Step 4: Register the URL**

In `Index-API/apps/api/urls.py`, add after line 82 (after `similar/sources/`):

```python
    path('similar/text/', connection_views.similar_to_text, name='similar-text'),
```

**Step 5: Run tests to verify they pass**

```bash
python3 manage.py test apps.api.tests.test_similar_text -v2
```
Expected: PASS (all 4 tests)

**Step 6: Commit**

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API
git add apps/api/connection_views.py apps/api/urls.py apps/api/tests/test_similar_text.py
git commit -m "feat(api): add POST /similar/text/ endpoint for raw text similarity search"
```

---

### Task 2: Index-API: POST /api/v1/connections/draft/ endpoint

Multi-signal draft analysis: SBERT similarity + spaCy NER entity overlap + keyword scoring. Returns ranked connections and a D3-ready graph.

**Files:**
- Create: `Index-API/apps/research/draft_analysis.py`
- Modify: `Index-API/apps/api/connection_views.py` (add view)
- Modify: `Index-API/apps/api/urls.py:78` (add URL after `connections/graph/`)
- Test: `Index-API/apps/api/tests/test_draft_connections.py` (create)

**Step 1: Write the failing test**

```python
# Index-API/apps/api/tests/test_draft_connections.py

from django.test import TestCase
from rest_framework.test import APIClient


class DraftConnectionsEndpointTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_short_text_returns_empty(self):
        resp = self.client.post(
            '/api/v1/connections/draft/',
            {'text': 'short', 'content_type': 'essay', 'slug': 'test'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['connections'], [])
        self.assertEqual(resp.data['graph']['nodes'], [])

    def test_valid_text_returns_structure(self):
        long_text = 'Urban infrastructure and public space design shape human behavior. ' * 5
        resp = self.client.post(
            '/api/v1/connections/draft/',
            {'text': long_text, 'content_type': 'essay', 'slug': 'test-essay'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('connections', resp.data)
        self.assertIn('entities', resp.data)
        self.assertIn('graph', resp.data)
        self.assertIn('nodes', resp.data['graph'])
        self.assertIn('edges', resp.data['graph'])

    def test_rejects_get(self):
        resp = self.client.get('/api/v1/connections/draft/')
        self.assertEqual(resp.status_code, 405)
```

**Step 2: Run test to verify it fails**

```bash
python3 manage.py test apps.api.tests.test_draft_connections -v2
```

**Step 3: Create the draft analysis service**

```python
# Index-API/apps/research/draft_analysis.py
"""
Multi-signal analysis of a draft against the stored corpus.

Three passes:
1. SBERT embedding similarity (via pgvector)
2. spaCy NER entity extraction + overlap with stored objects
3. Keyword overlap scoring (TF approximation)

Returns both a ranked list and a D3-ready graph.
"""

import logging
import re
from collections import Counter

logger = logging.getLogger(__name__)


def _extract_keywords(text: str, top_n: int = 30) -> set[str]:
    """Extract significant keywords from text (simple TF approach)."""
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    stop = {
        'that', 'this', 'with', 'from', 'have', 'been', 'were', 'they',
        'their', 'would', 'could', 'should', 'about', 'which', 'there',
        'these', 'those', 'than', 'then', 'them', 'what', 'when', 'where',
        'will', 'more', 'some', 'into', 'also', 'other', 'very', 'just',
        'only', 'over', 'such', 'after', 'before', 'between', 'each',
        'because', 'does', 'most', 'through', 'while', 'being', 'both',
    }
    counts = Counter(w for w in words if w not in stop)
    return {w for w, _ in counts.most_common(top_n)}


def _extract_draft_entities(text: str) -> list[dict]:
    """Extract named entities from raw text using spaCy."""
    try:
        from apps.notebook.engine import nlp
    except ImportError:
        return []

    if nlp is None:
        return []

    doc = nlp(text[:10000])
    entities = []
    seen = set()
    for ent in doc.ents:
        if ent.label_ in ('PERSON', 'ORG', 'GPE', 'LOC', 'EVENT', 'WORK_OF_ART'):
            key = ent.text.lower().strip()
            if key not in seen and len(key) > 2:
                seen.add(key)
                entities.append({
                    'text': ent.text.strip(),
                    'type': ent.label_,
                    'lower': key,
                })
    return entities


def _score_entity_overlap(draft_entities: list[dict], obj) -> tuple[float, list[str]]:
    """Score entity overlap between draft entities and an object's body/title."""
    if not draft_entities:
        return 0.0, []

    obj_text = f'{obj.title or ""} {obj.body or ""}'.lower()
    shared = []
    for ent in draft_entities:
        if ent['lower'] in obj_text:
            shared.append(ent['text'])

    if not shared:
        return 0.0, []

    score = len(shared) / max(1, min(len(draft_entities), 10))
    return min(1.0, score), shared


def _score_keyword_overlap(draft_keywords: set[str], obj) -> float:
    """Score keyword overlap between draft and object."""
    if not draft_keywords:
        return 0.0

    obj_text = f'{obj.title or ""} {obj.body or ""}'.lower()
    obj_words = set(re.findall(r'\b[a-zA-Z]{4,}\b', obj_text))
    overlap = draft_keywords & obj_words
    if not overlap:
        return 0.0

    return min(1.0, len(overlap) / max(1, min(len(draft_keywords), len(obj_words))))


def analyze_draft(text: str, content_type: str, content_slug: str, top_n: int = 10) -> dict:
    """
    Multi-signal analysis of a draft against the stored corpus.

    Returns:
    {
        "connections": [...],
        "entities": ["Entity1", "Entity2"],
        "graph": { "nodes": [...], "edges": [...] }
    }
    """
    from apps.notebook.embedding_service import find_similar
    from apps.notebook.models import Object

    # Pass 1: SBERT similarity via pgvector
    semantic_results = find_similar(
        text=text[:3000],
        target_kind='object',
        top_n=top_n * 2,
        threshold=0.35,
    )

    candidate_ids = [r['target_id'] for r in semantic_results]
    semantic_scores = {r['target_id']: r['score'] for r in semantic_results}

    # Pass 2: Entity extraction + overlap
    draft_entities = _extract_draft_entities(text)
    entity_names = [e['text'] for e in draft_entities]

    # Pass 3: Keyword extraction
    draft_keywords = _extract_keywords(text)

    # Load candidate objects
    candidates = Object.objects.filter(
        pk__in=candidate_ids, is_deleted=False,
    ).select_related('object_type')

    # Also search for objects mentioning extracted entities
    if draft_entities:
        entity_terms = [e['lower'] for e in draft_entities[:10]]
        from django.db.models import Q
        entity_q = Q()
        for term in entity_terms:
            entity_q |= Q(title__icontains=term) | Q(body__icontains=term)
        extra_objects = (
            Object.objects
            .filter(entity_q, is_deleted=False)
            .exclude(pk__in=candidate_ids)
            .select_related('object_type')[:20]
        )
        candidates = list(candidates) + list(extra_objects)
    else:
        candidates = list(candidates)

    # Score each candidate with combined signals
    scored = []
    for obj in candidates:
        semantic = semantic_scores.get(obj.pk, 0.0)
        entity_score, shared_entities = _score_entity_overlap(draft_entities, obj)
        keyword = _score_keyword_overlap(draft_keywords, obj)

        # Weighted combination: semantic 50%, entity 30%, keyword 20%
        combined = (semantic * 0.50) + (entity_score * 0.30) + (keyword * 0.20)

        if combined < 0.15:
            continue

        scored.append({
            'id': str(obj.pk),
            'title': obj.display_title or obj.title,
            'objectType': obj.object_type.slug if obj.object_type else 'unknown',
            'score': round(combined, 3),
            'signals': {
                'semantic': round(semantic, 3),
                'entity_overlap': round(entity_score, 3),
                'keyword': round(keyword, 3),
            },
            'sharedEntities': shared_entities,
            'excerpt': (obj.body or '')[:200],
        })

    scored.sort(key=lambda x: x['score'], reverse=True)
    connections = scored[:top_n]

    # Build D3-ready graph
    draft_node_id = f'{content_type}:{content_slug}'
    nodes = [{
        'id': draft_node_id,
        'label': 'Your Draft',
        'type': content_type,
        'isDraft': True,
    }]
    edges = []

    for conn in connections:
        nodes.append({
            'id': f"object:{conn['id']}",
            'label': conn['title'],
            'type': conn['objectType'],
            'score': conn['score'],
            'isDraft': False,
        })
        edges.append({
            'source': draft_node_id,
            'target': f"object:{conn['id']}",
            'weight': conn['score'],
        })

    return {
        'connections': connections,
        'entities': entity_names,
        'graph': {'nodes': nodes, 'edges': edges},
    }
```

**Step 4: Add the view to connection_views.py**

```python
@api_view(['POST'])
def draft_connections(request):
    """
    POST /api/v1/connections/draft/

    Discover connections between a draft and the stored corpus.

    Body: { "text": "...", "content_type": "essay", "slug": "my-essay-slug", "top": 10 }
    """
    text = request.data.get('text', '')
    content_type = request.data.get('content_type', 'essay')
    slug = request.data.get('slug', '')
    top_n = min(int(request.data.get('top', 10)), 30)

    if len(text.strip()) < 50:
        return Response({
            'connections': [],
            'entities': [],
            'graph': {'nodes': [], 'edges': []},
        })

    from apps.research.draft_analysis import analyze_draft
    result = analyze_draft(text=text, content_type=content_type, content_slug=slug, top_n=top_n)
    return Response(result)
```

**Step 5: Register URL**

After `connections/graph/` (line 78):

```python
    path('connections/draft/', connection_views.draft_connections, name='draft-connections'),
```

**Step 6: Run tests, then commit**

```bash
python3 manage.py test apps.api.tests.test_draft_connections -v2
git add apps/research/draft_analysis.py apps/api/connection_views.py apps/api/urls.py apps/api/tests/test_draft_connections.py
git commit -m "feat(api): add POST /connections/draft/ multi-signal draft analysis endpoint"
```

---

### Task 3: Index-API: POST /api/v1/claims/audit/ endpoint

NLI-based claim audit: decompose draft into claims, check each against linked sources using the cross-encoder.

**Files:**
- Create: `Index-API/apps/research/claim_audit.py`
- Modify: `Index-API/apps/api/tension_views.py` (add view)
- Modify: `Index-API/apps/api/urls.py:74` (add URL after `tensions/`)
- Test: `Index-API/apps/api/tests/test_claim_audit.py` (create)

**Step 1: Write the failing test**

```python
# Index-API/apps/api/tests/test_claim_audit.py

from django.test import TestCase
from rest_framework.test import APIClient


class ClaimAuditEndpointTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_returns_structure(self):
        resp = self.client.post(
            '/api/v1/claims/audit/',
            {
                'text': 'Lead levels in Flint water exceeded EPA limits by a factor of ten. The city government knew about the contamination for months before acting.',
                'source_slugs': [],
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('claims', resp.data)
        self.assertIn('summary', resp.data)
        self.assertIn('total', resp.data['summary'])

    def test_empty_text_returns_empty(self):
        resp = self.client.post(
            '/api/v1/claims/audit/',
            {'text': '', 'source_slugs': []},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['claims'], [])
```

**Step 2: Run test to verify it fails**

```bash
python3 manage.py test apps.api.tests.test_claim_audit -v2
```

**Step 3: Create the claim audit service**

```python
# Index-API/apps/research/claim_audit.py
"""
NLI-based claim audit: decompose text into atomic claims and
check each against linked sources using the cross-encoder.

Uses sentence splitting as a proxy for claim decomposition.
Each sentence that makes an assertive statement is treated as a claim.
"""

import logging
import re

logger = logging.getLogger(__name__)


def _split_into_claims(text: str) -> list[dict]:
    """Split text into claim-like sentences with position tracking."""
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    claims = []
    position = 0

    for sent in sentences:
        sent = sent.strip()
        if not sent or len(sent) < 20:
            position += len(sent) + 1
            continue

        # Skip questions
        if sent.endswith('?'):
            position += len(sent) + 1
            continue

        claims.append({
            'text': sent,
            'position': text.find(sent, position),
        })
        position = text.find(sent, position) + len(sent)

    return claims


def _classify_claim_against_source(claim_text: str, source_text: str) -> tuple[bool, float]:
    """Use NLI cross-encoder to check if source supports the claim."""
    try:
        from apps.research.advanced_nlp import classify_relationship, HAS_PYTORCH
    except ImportError:
        return False, 0.0

    if not HAS_PYTORCH:
        return False, 0.0

    result = classify_relationship(claim_text, source_text)
    if result is None:
        return False, 0.0

    label = result.get('label', 'neutral')
    scores = result.get('scores', {})
    entailment = scores.get('entailment', 0.0)

    return label == 'entailment', round(entailment, 3)


def audit_claims(text: str, source_slugs: list[str]) -> dict:
    """
    Decompose text into claims, check each against sources.

    Returns:
    {
        "claims": [{"text", "position", "supported", "supportingSource", "confidence"}],
        "summary": {"total", "supported", "unsupported"}
    }
    """
    claims = _split_into_claims(text)
    if not claims:
        return {'claims': [], 'summary': {'total': 0, 'supported': 0, 'unsupported': 0}}

    # Load source texts
    source_texts = {}
    if source_slugs:
        from apps.research.models import Source
        sources = Source.objects.filter(slug__in=source_slugs)
        for src in sources:
            src_text = f'{src.title or ""} {src.annotation or ""}'
            if len(src_text.strip()) > 20:
                source_texts[src.slug] = src_text

    # Audit each claim
    audited = []
    supported_count = 0

    for claim in claims:
        best_support = None
        best_confidence = 0.0

        for slug, src_text in source_texts.items():
            is_supported, confidence = _classify_claim_against_source(
                claim['text'], src_text[:500],
            )
            if is_supported and confidence > best_confidence:
                best_support = slug
                best_confidence = confidence

        is_supported = best_support is not None
        if is_supported:
            supported_count += 1

        audited.append({
            'text': claim['text'],
            'position': claim['position'],
            'supported': is_supported,
            'supportingSource': best_support,
            'confidence': best_confidence if is_supported else None,
        })

    return {
        'claims': audited,
        'summary': {
            'total': len(audited),
            'supported': supported_count,
            'unsupported': len(audited) - supported_count,
        },
    }
```

**Step 4: Add the view to tension_views.py**

Append after the existing `tensions` view:

```python
@api_view(['POST'])
def audit_claims_view(request):
    """
    POST /api/v1/claims/audit/

    Decompose text into claims and check each against linked sources.
    Body: { "text": "...", "source_slugs": ["source-1", "source-2"] }
    """
    text = request.data.get('text', '')
    source_slugs = request.data.get('source_slugs', [])

    if not text or len(text.strip()) < 20:
        return Response({
            'claims': [],
            'summary': {'total': 0, 'supported': 0, 'unsupported': 0},
        })

    from apps.research.claim_audit import audit_claims
    result = audit_claims(text=text, source_slugs=source_slugs)
    return Response(result)
```

**Step 5: Register URL**

After `tensions/` (line 74):

```python
    path('claims/audit/', tension_views.audit_claims_view, name='audit-claims'),
```

**Step 6: Run tests, then commit**

```bash
python3 manage.py test apps.api.tests.test_claim_audit -v2
git add apps/research/claim_audit.py apps/api/tension_views.py apps/api/urls.py apps/api/tests/test_claim_audit.py
git commit -m "feat(api): add POST /claims/audit/ NLI claim verification endpoint"
```

---

### Task 4: Index-API: POST /api/v1/entities/extract/ endpoint

Auto-tag extraction via spaCy NER for raw text.

**Files:**
- Modify: `Index-API/apps/api/connection_views.py` (add view)
- Modify: `Index-API/apps/api/urls.py` (add URL)
- Test: `Index-API/apps/api/tests/test_extract_entities.py` (create)

**Step 1: Write the failing test**

```python
# Index-API/apps/api/tests/test_extract_entities.py

from django.test import TestCase
from rest_framework.test import APIClient


class ExtractEntitiesEndpointTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_returns_structure(self):
        resp = self.client.post(
            '/api/v1/entities/extract/',
            {'text': 'Barack Obama met with Angela Merkel at the White House to discuss NATO policy.'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('entities', resp.data)
        self.assertIn('tags', resp.data)

    def test_empty_text(self):
        resp = self.client.post(
            '/api/v1/entities/extract/',
            {'text': ''},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['entities'], [])
```

**Step 2: Implement the view**

Add to `connection_views.py`:

```python
@api_view(['POST'])
def extract_entities_view(request):
    """
    POST /api/v1/entities/extract/

    Extract named entities from text for tag suggestions.
    Body: { "text": "..." }
    Returns: { "entities": ["Name1", "Name2"], "tags": ["tag1", "tag2"] }
    """
    text = request.data.get('text', '')
    if not text or len(text.strip()) < 10:
        return Response({'entities': [], 'tags': []})

    try:
        from apps.research.draft_analysis import _extract_draft_entities
        raw_entities = _extract_draft_entities(text)
    except Exception:
        return Response({'entities': [], 'tags': []})

    entity_names = [e['text'] for e in raw_entities]

    seen = set()
    tags = []
    for e in raw_entities:
        tag = e['text'].lower().strip()
        if tag not in seen:
            seen.add(tag)
            tags.append(tag)

    return Response({'entities': entity_names, 'tags': tags})
```

**Step 3: Register URL**

```python
    path('entities/extract/', connection_views.extract_entities_view, name='extract-entities'),
```

**Step 4: Run tests, then commit**

```bash
python3 manage.py test apps.api.tests.test_extract_entities -v2
git add apps/api/connection_views.py apps/api/urls.py apps/api/tests/test_extract_entities.py
git commit -m "feat(api): add POST /entities/extract/ spaCy NER tag suggestion endpoint"
```

---

### Task 5: Publishing API: ML proxy endpoints

Add proxy functions and views for the four new Index-API endpoints. Follows the established `_api_config()` + `_auth_headers()` + `_TIMEOUT` + `StudioApiBaseView` pattern.

**Files:**
- Modify: `publishing_api/apps/editor/services.py` (add 4 proxy functions at end)
- Modify: `publishing_api/apps/editor/views.py:~2470` (add 4 view classes after Research Panel)
- Modify: `publishing_api/apps/editor/urls.py:~160` (add 4 URL patterns)

**Step 1: Add proxy functions to services.py**

Append to `publishing_api/apps/editor/services.py`:

```python
# -- ML Analysis Proxies ------------------------------------------------

def analyze_draft(text, content_type, content_slug, top_n=10):
    """Proxy draft analysis to Index-API."""
    base_url, api_key = _api_config()
    if not base_url:
        return {'connections': [], 'entities': [], 'graph': {'nodes': [], 'edges': []}}
    try:
        resp = httpx.post(
            f'{base_url}/api/v1/connections/draft/',
            json={'text': text, 'content_type': content_type, 'slug': content_slug, 'top': top_n},
            headers=_auth_headers(api_key),
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning('Draft analysis failed: %s', exc)
        return {'connections': [], 'entities': [], 'graph': {'nodes': [], 'edges': []}}


def find_similar_text(text, top_n=8, threshold=0.4):
    """Proxy text similarity to Index-API."""
    base_url, api_key = _api_config()
    if not base_url:
        return {'similar': []}
    try:
        resp = httpx.post(
            f'{base_url}/api/v1/similar/text/',
            json={'text': text, 'top': top_n, 'threshold': threshold},
            headers=_auth_headers(api_key),
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning('Text similarity failed: %s', exc)
        return {'similar': []}


def audit_claims(text, source_slugs):
    """Proxy claim audit to Index-API."""
    base_url, api_key = _api_config()
    if not base_url:
        return {'claims': [], 'summary': {'total': 0, 'supported': 0, 'unsupported': 0}}
    try:
        resp = httpx.post(
            f'{base_url}/api/v1/claims/audit/',
            json={'text': text, 'source_slugs': source_slugs},
            headers=_auth_headers(api_key),
            timeout=httpx.Timeout(30.0, connect=5.0),
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning('Claim audit failed: %s', exc)
        return {'claims': [], 'summary': {'total': 0, 'supported': 0, 'unsupported': 0}}


def extract_entities(text):
    """Proxy entity extraction to Index-API."""
    base_url, api_key = _api_config()
    if not base_url:
        return {'entities': [], 'tags': []}
    try:
        resp = httpx.post(
            f'{base_url}/api/v1/entities/extract/',
            json={'text': text},
            headers=_auth_headers(api_key),
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning('Entity extraction failed: %s', exc)
        return {'entities': [], 'tags': []}
```

**Step 2: Add view classes to views.py**

After the Research Panel views (~line 2470):

```python
# -- ML Analysis API ---------------------------------------------------

class StudioApiDraftConnectionsView(StudioApiBaseView):
    """POST: Analyze draft connections via Index-API."""
    def post(self, request):
        data = self._parse_json_body(request)
        if isinstance(data, HttpResponse):
            return data
        result = services.analyze_draft(
            data.get('text', ''), data.get('content_type', 'essay'),
            data.get('slug', ''), data.get('top', 10),
        )
        return self._json(result)


class StudioApiSimilarTextView(StudioApiBaseView):
    """POST: Find similar objects to raw text."""
    def post(self, request):
        data = self._parse_json_body(request)
        if isinstance(data, HttpResponse):
            return data
        result = services.find_similar_text(
            data.get('text', ''), data.get('top', 8), data.get('threshold', 0.4),
        )
        return self._json(result)


class StudioApiClaimAuditView(StudioApiBaseView):
    """POST: Audit claims against linked sources."""
    def post(self, request):
        data = self._parse_json_body(request)
        if isinstance(data, HttpResponse):
            return data
        result = services.audit_claims(data.get('text', ''), data.get('source_slugs', []))
        return self._json(result)


class StudioApiExtractEntitiesView(StudioApiBaseView):
    """POST: Extract entities for tag suggestions."""
    def post(self, request):
        data = self._parse_json_body(request)
        if isinstance(data, HttpResponse):
            return data
        result = services.extract_entities(data.get('text', ''))
        return self._json(result)
```

**Step 3: Add URL patterns**

After the existing research API routes:

```python
    # ML Analysis API (proxies to Index-API)
    path("editor/api/ml/draft-connections/",
         views.StudioApiDraftConnectionsView.as_view(), name="api-draft-connections"),
    path("editor/api/ml/similar-text/",
         views.StudioApiSimilarTextView.as_view(), name="api-similar-text"),
    path("editor/api/ml/claim-audit/",
         views.StudioApiClaimAuditView.as_view(), name="api-claim-audit"),
    path("editor/api/ml/extract-entities/",
         views.StudioApiExtractEntitiesView.as_view(), name="api-extract-entities"),
```

**Step 4: Commit**

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/publishing_api
git add apps/editor/services.py apps/editor/views.py apps/editor/urls.py
git commit -m "feat(editor): add ML analysis proxy endpoints for draft connections, similarity, claims, entities"
```

---

### Task 6: Frontend API client functions

Add TypeScript types and fetch functions for the four ML endpoints.

**Files:**
- Modify: `src/lib/studio-api.ts` (append ML types and functions)

**Step 1: Add types and functions**

Append to `src/lib/studio-api.ts`:

```typescript
// -- ML Analysis ------------------------------------------------------

export interface DraftConnection {
  id: string;
  title: string;
  objectType: string;
  score: number;
  signals: { semantic: number; entity_overlap: number; keyword: number };
  sharedEntities: string[];
  excerpt: string;
}

export interface DraftAnalysisResult {
  connections: DraftConnection[];
  entities: string[];
  graph: {
    nodes: Array<{ id: string; label: string; type: string; score?: number; isDraft?: boolean }>;
    edges: Array<{ source: string; target: string; weight: number }>;
  };
}

export interface SimilarObject {
  id: string;
  title: string;
  objectType: string;
  similarity: number;
  excerpt: string;
}

export interface ClaimAuditResult {
  claims: Array<{
    text: string;
    position: number;
    supported: boolean;
    supportingSource: string | null;
    confidence: number | null;
  }>;
  summary: { total: number; supported: number; unsupported: number };
}

export async function analyzeDraft(
  text: string, contentType: string, slug: string,
): Promise<DraftAnalysisResult> {
  return studioFetch<DraftAnalysisResult>('/ml/draft-connections/', {
    method: 'POST',
    body: JSON.stringify({ text, content_type: contentType, slug }),
  });
}

export async function findSimilarText(
  text: string,
): Promise<{ similar: SimilarObject[] }> {
  return studioFetch<{ similar: SimilarObject[] }>('/ml/similar-text/', {
    method: 'POST',
    body: JSON.stringify({ text, top: 8, threshold: 0.4 }),
  });
}

export async function auditClaims(
  text: string, sourceSlugs: string[],
): Promise<ClaimAuditResult> {
  return studioFetch<ClaimAuditResult>('/ml/claim-audit/', {
    method: 'POST',
    body: JSON.stringify({ text, source_slugs: sourceSlugs }),
  });
}

export async function extractEntities(
  text: string,
): Promise<{ entities: string[]; tags: string[] }> {
  return studioFetch<{ entities: string[]; tags: string[] }>(
    '/ml/extract-entities/',
    { method: 'POST', body: JSON.stringify({ text }) },
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/lib/studio-api.ts
git commit -m "feat(studio): add ML analysis API client types and functions"
```

---

### Task 7: ConnectionConstellation D3 force graph component

The flagship visual. Force-directed graph in the Connections tab showing the draft as center node with discovered connections radiating outward. Uses the existing `runSynchronousSimulation()` and `PRESET_STUDIO`.

**Files:**
- Create: `src/components/studio/ConnectionConstellation.tsx`

**Step 1: Create the component**

See the full component in the spec (5D). Key implementation notes:
- Uses `ResizeObserver` for responsive container sizing
- Calls `runSynchronousSimulation()` from `@/lib/graph/simulation` with PRESET_STUDIO overrides
- D3 zoom + SVG rendering (not canvas, since node count is small)
- Draft node: 16px radius, terracotta, glow ring
- Connected nodes: sized by score, colored by `getContentTypeIdentity()`
- Labels on nodes with radius > 8px
- Click handler calls `onNavigate(type, slug)` for non-draft nodes
- Empty state: "Save your draft to discover connections."
- Footer: connection count + entity count

**Step 2: Verify compilation, then commit**

```bash
git add src/components/studio/ConnectionConstellation.tsx
git commit -m "feat(studio): add ConnectionConstellation D3 force graph component"
```

---

### Task 8: Integrate ConnectionConstellation into WorkbenchPanel

Wire `analyzeDraft()` call on save, render constellation and connection list in LinksMode.

**Files:**
- Modify: `src/components/studio/WorkbenchPanel.tsx`

**Step 1: Read the current LinksMode**

Read `WorkbenchPanel.tsx`, locate LinksMode. Note its props, hooks, and rendering structure.

**Step 2: Add constellation integration**

- Import `ConnectionConstellation` and `analyzeDraft`
- Add `useState<DraftAnalysisResult | null>` and `useState<boolean>` for analyzing state
- Add `useEffect` triggered by save state changes that calls `analyzeDraft()`
- Render `ConnectionConstellation` above the existing source/backlink list
- Add connection list below the graph (ranked cards with score, shared entities)
- Add entity pills section

**Step 3: Verify in dev server, commit**

```bash
git add src/components/studio/WorkbenchPanel.tsx
git commit -m "feat(studio): integrate ConnectionConstellation into Connections tab"
```

---

### Task 9: Source suggestions in Research tab

After save, query `findSimilarText()` and show suggested sources in ResearchMode.

**Files:**
- Modify: `src/components/studio/WorkbenchPanel.tsx` (ResearchMode section)

**Step 1: Add to ResearchMode**

- Import `findSimilarText`, `SimilarObject`
- Add `useState<SimilarObject[]>` for suggestions
- Add `useEffect` triggered by save that calls `findSimilarText()`
- Render teal-accented suggestion cards below source intake

**Step 2: Verify, commit**

```bash
git add src/components/studio/WorkbenchPanel.tsx
git commit -m "feat(studio): add source suggestions from knowledge graph in Research tab"
```

---

### Task 10: ClaimAuditPanel (stage-gated)

Shows in Research tab only during "revising" or later stages. Runs NLI claim analysis.

**Files:**
- Create: `src/components/studio/ClaimAuditPanel.tsx`
- Modify: `src/components/studio/WorkbenchPanel.tsx` (add to ResearchMode)

**Step 1: Create ClaimAuditPanel**

- Manual trigger button ("Run Audit")
- Calls `auditClaims()` with editor text and source slugs
- Summary bar: total claims, supported (green), unsupported (terracotta)
- Claim list with color-coded left border (green=supported, terracotta=unsupported)
- Supporting source name and confidence shown on supported claims

**Step 2: Add to ResearchMode, gated by stage**

```typescript
{(stage === 'revising' || stage === 'production' || stage === 'published') && (
  <ClaimAuditPanel ... />
)}
```

**Step 3: Commit**

```bash
git add src/components/studio/ClaimAuditPanel.tsx src/components/studio/WorkbenchPanel.tsx
git commit -m "feat(studio): add stage-gated ClaimAuditPanel for NLI claim verification"
```

---

## Batch 4: PWA Transformation

### Task 11: Route loading states

**Files:**
- Create: `src/app/(studio)/studio/loading.tsx`
- Create: `src/app/(studio)/studio/[contentType]/loading.tsx`
- Create: `src/app/(studio)/studio/[contentType]/[slug]/loading.tsx`
- Modify: Studio CSS file (add `.studio-skeleton` pulse animation)

Skeleton layouts match each page structure. Use `studio-skeleton` class with CSS gradient pulse animation.

**Commit:** `feat(studio): add route loading skeletons with pulse animation`

---

### Task 12: PWA manifest

**Files:**
- Create: `src/app/(studio)/studio/manifest.ts` (Next.js MetadataRoute.Manifest)

```typescript
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Studio',
    short_name: 'Studio',
    description: 'Intelligence-augmented writing. Your research engine, always with you.',
    start_url: '/studio',
    scope: '/studio',
    display: 'standalone',
    background_color: '#13110F',
    theme_color: '#B45A2D',
    categories: ['productivity', 'utilities', 'education'],
    icons: [
      { src: '/studio-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/studio-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
```

**Commit:** `feat(studio): add PWA manifest for installable Studio app`

---

### Task 13: Content search in Cmd+K

**Files:**
- Modify: The existing command palette component (search for `cmdk` or `CommandDialog` in `src/components/studio/`)

Add debounced `searchContent(query)` (already in `studio-api.ts`) to the command palette search input. Results render as a navigable group.

**Commit:** `feat(studio): add content search to Cmd+K command palette`

---

### Task 14: Service worker

**Files:**
- Create: `public/studio-sw.js`
- Create: `src/app/(studio)/studio/offline/page.tsx`
- Modify: `src/app/(studio)/layout.tsx` (register SW)

Strategy:
- Static assets: CacheFirst
- Studio pages: NetworkFirst + offline fallback
- Studio API GET: StaleWhileRevalidate
- ML endpoints POST: NetworkOnly
- Offline page at `/studio/offline`

**Commit:** `feat(studio): add service worker with ML-aware caching and offline fallback`

---

## Verification Checklist

### Backend (Index-API)

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API
python3 manage.py test apps.api.tests -v2

# Manual smoke tests
curl -X POST http://localhost:8000/api/v1/similar/text/ \
  -H "Content-Type: application/json" \
  -d '{"text": "Urban infrastructure and public space design shape human behavior in ways we rarely notice."}'

curl -X POST http://localhost:8000/api/v1/connections/draft/ \
  -H "Content-Type: application/json" \
  -d '{"text": "Urban infrastructure and public space design shape human behavior.", "content_type": "essay", "slug": "test"}'
```

### Frontend

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website
npx tsc --noEmit
npm run dev
```

Verify: open Studio essay, save, check Connections tab for constellation, Research tab for suggestions.

### PWA

Chrome DevTools > Application: manifest loads, SW registered, Lighthouse PWA audit passes.

## Deploy Sequence

1. Index-API (Railway) first
2. Publishing API (Railway) second (wait ~2min)
3. Frontend (Vercel) last

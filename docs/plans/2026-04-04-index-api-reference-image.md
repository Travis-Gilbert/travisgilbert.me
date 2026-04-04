# Index-API: reference_image_url for Galaxy Answer Construction

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `reference_image_url` field to the `/ask/` endpoint response so the frontend can trace reference images into particle target positions for visual answer construction.

**Architecture:** After the existing retrieval pipeline completes, check whether the answer concerns a concrete entity (person, place, organization). If so, search SearXNG for an image. Add the URL to the response payload. This is a non-blocking enhancement: if image search fails or no entity is detected, the field is simply `null`.

**Tech Stack:** Django 5.x, DRF, existing SearXNG integration (`search_providers.py`), existing ask view (`views/ask.py`)

---

## Context

The Website frontend (GalaxyController) now supports image-traced answer construction. When the ask API response includes `reference_image_url`, the frontend runs TF.js Sobel edge detection on the image and assigns ALL dot grid particles to edge positions, creating portraits/shapes from the background dots.

The frontend code is merged and falls back gracefully to graph/cluster layouts when no image URL is present.

## Existing Infrastructure

| Component | File | What It Does |
|-----------|------|-------------|
| Ask view | `apps/notebook/views/ask.py:169` | `ask_question_view()`: retrieval pipeline, returns `{question_id, retrieval: {objects, claims, engines_used}}` |
| SearXNG provider | `apps/notebook/search_providers.py:25` | `SearXNGSearchProvider.search()`: queries SearXNG JSON API with `categories: 'general'`. Env var: `SEARXNG_BASE_URL` |
| Ask pipeline | `apps/notebook/services/ask_pipeline.py` | Alternative pipeline entry point (not used by main ask view) |
| Object types | `apps/notebook/views/ask.py:33` | `PERSONAL_TYPES` list, `TYPE_BOOSTS` dict |

## Key Design Decisions

- Image search runs AFTER the main retrieval, not during. It should not slow down the primary answer.
- Only search for images when the answer's top object is a person, place, or organization. Notes, hunches, and concepts don't need reference images.
- Use SearXNG's `categories: 'images'` parameter for image-specific results.
- CORS: the frontend loads images into an OffscreenCanvas with `crossOrigin: 'anonymous'`. Wikimedia and most image CDNs support this. Filter out URLs that are likely to block CORS.
- Time budget: image search should complete in <2s. Use a short httpx timeout.

---

## Task 1: Add Image Search Method to SearXNG Provider

**Files:**
- Modify: `apps/notebook/search_providers.py`

**What to do:**

Add a `search_images()` method to `SearXNGSearchProvider` that queries with `categories: 'images'` instead of `'general'`:

```python
def search_images(self, query: str, *, max_results: int = 3) -> list[dict]:
    """Search SearXNG for images. Returns list of {url, title, source} dicts."""
    if not self.is_available():
        return []

    import httpx

    try:
        resp = httpx.get(
            f'{self.base_url}/search',
            params={
                'q': query,
                'format': 'json',
                'categories': 'images',
            },
            timeout=5.0,
            follow_redirects=True,
        )
        resp.raise_for_status()
        data = resp.json()

        results = []
        for r in data.get('results', [])[:max_results]:
            img_url = r.get('img_src') or r.get('url', '')
            if not img_url:
                continue
            # Filter for CORS-friendly sources
            if not _is_cors_friendly_image(img_url):
                continue
            results.append({
                'url': img_url,
                'title': r.get('title', ''),
                'source': r.get('source', ''),
            })
        return results

    except Exception as exc:
        logger.warning('SearXNG image search failed for "%s": %s', query[:60], exc)
        return []


# Domains known to serve images with permissive CORS headers
_CORS_FRIENDLY_DOMAINS = [
    'upload.wikimedia.org',
    'commons.wikimedia.org',
    'i.imgur.com',
    'images.unsplash.com',
    'cdn.pixabay.com',
    'pbs.twimg.com',
]


def _is_cors_friendly_image(url: str) -> bool:
    """Check if the image URL is from a domain that serves CORS headers."""
    from urllib.parse import urlparse
    try:
        host = urlparse(url).hostname or ''
        return any(host.endswith(d) for d in _CORS_FRIENDLY_DOMAINS)
    except Exception:
        return False
```

**Commit:**
```bash
git add apps/notebook/search_providers.py
git commit -m "feat(ask): add SearXNG image search with CORS filtering"
```

---

## Task 2: Add Reference Image Lookup to Ask View

**Files:**
- Modify: `apps/notebook/views/ask.py`

**What to do:**

After the retrieval pipeline completes and before the final `Response()`, add image search logic:

```python
# After line 317 (after claim_payloads are built), before the AskQuestion.objects.create:

# Reference image search for visual answer construction
reference_image_url = None
if object_payloads:
    top_object_type = object_payloads[0].get('object_type_slug', '')
    # Only search for images when the answer is about a concrete entity
    if top_object_type in ('person', 'place', 'organization', 'event'):
        reference_image_url = _search_reference_image(
            question_text,
            top_object_type,
            object_payloads[0].get('title', ''),
        )
```

Add the helper function (before `ask_question_view`):

```python
def _search_reference_image(question: str, entity_type: str, entity_title: str) -> str | None:
    """Search SearXNG for a reference image matching the query subject."""
    from ..search_providers import SearXNGSearchProvider

    provider = SearXNGSearchProvider()
    if not provider.is_available():
        return None

    # Use entity title for more precise image search
    search_query = entity_title or question
    if entity_type == 'person':
        search_query = f'{search_query} portrait photo'
    elif entity_type == 'place':
        search_query = f'{search_query} landmark'

    results = provider.search_images(search_query, max_results=3)
    if results:
        return results[0]['url']
    return None
```

Update the response dict (line 328) to include the new field:

```python
return Response({
    'question_id': str(question_id),
    'retrieval': {
        'objects': object_payloads,
        'claims': claim_payloads,
        'engines_used': engines_used,
    },
    'reference_image_url': reference_image_url,
})
```

**Commit:**
```bash
git add apps/notebook/views/ask.py
git commit -m "feat(ask): add reference_image_url via SearXNG image search"
```

---

## Task 3: Verify End-to-End

**Steps:**

1. Start the Index-API dev server: `python3 manage.py runserver 8000`
2. Verify SearXNG is available: check `SEARXNG_BASE_URL` env var is set
3. Test with curl:

```bash
# Person query (should return reference_image_url)
curl -X POST http://localhost:8000/api/v1/notebook/ask/ \
  -H "Content-Type: application/json" \
  -d '{"question": "Who is Claude Shannon?"}'

# Note query (reference_image_url should be null)
curl -X POST http://localhost:8000/api/v1/notebook/ask/ \
  -H "Content-Type: application/json" \
  -d '{"question": "What are my recent notes about?"}'
```

4. Verify the image URL:
   - Is from a CORS-friendly domain (wikimedia, imgur, etc.)
   - Loads in a browser
   - Is an actual image (not a thumbnail page)

5. Test fallback:
   - Unset `SEARXNG_BASE_URL` and verify `reference_image_url` is `null` (no error)
   - Set it to a bad URL and verify graceful failure

---

## Deployment

After merging to main:

1. Railway auto-deploys the Index-API web service
2. No new env vars needed (uses existing `SEARXNG_BASE_URL`)
3. No migrations needed (response-only change, no model changes)
4. Frontend already deployed with image tracing support; it will start using `reference_image_url` as soon as the backend returns it

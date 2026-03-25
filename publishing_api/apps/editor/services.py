"""
Research API proxy services.

Follows the same httpx + Bearer token pattern established in
``apps.intake.services.promote_to_research``. All calls degrade
gracefully when the research API is unavailable or not configured.
"""

import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

# Match the timeout used by intake's promote_to_research
_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


def _api_config():
    """Return (base_url, api_key) or (None, None) when not configured."""
    url = getattr(settings, "RESEARCH_API_URL", "")
    key = getattr(settings, "RESEARCH_API_KEY", "")
    if not url or not key:
        return None, None
    return url.rstrip("/"), key


def _auth_headers(api_key: str) -> dict:
    return {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }


def fetch_research_trail(slug: str) -> dict:
    """
    Proxy the research_api trail endpoint for a content slug.

    Returns the aggregated research context:
    ``{ sources, backlinks, thread, mentions }``

    Falls back to an empty structure on any failure.
    """
    base_url, api_key = _api_config()
    empty = {"sources": [], "backlinks": [], "thread": None, "mentions": []}

    if not base_url:
        logger.debug("Research API not configured; returning empty trail")
        return empty

    endpoint = f"{base_url}/api/v1/trail/{slug}/"
    try:
        resp = httpx.get(endpoint, headers=_auth_headers(api_key), timeout=_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except httpx.TimeoutException:
        logger.warning("Research trail timed out for slug=%s", slug)
        return empty
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Research trail HTTP %s for slug=%s: %s",
            exc.response.status_code,
            slug,
            exc.response.text[:200],
        )
        return empty
    except httpx.HTTPError as exc:
        logger.warning("Research trail error for slug=%s: %s", slug, exc)
        return empty


def fetch_research_graph(slug: str | None = None) -> dict:
    """
    Proxy the research_api graph endpoint.

    Returns ``{ nodes, edges }`` for D3.js force graph.
    Optionally filters to a neighbourhood around ``slug``.

    Falls back to an empty graph on any failure.
    """
    base_url, api_key = _api_config()
    empty = {"nodes": [], "edges": []}

    if not base_url:
        logger.debug("Research API not configured; returning empty graph")
        return empty

    endpoint = f"{base_url}/api/v1/graph/"
    params = {}
    if slug:
        params["focus"] = slug

    try:
        resp = httpx.get(
            endpoint,
            headers=_auth_headers(api_key),
            params=params,
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.TimeoutException:
        logger.warning("Research graph timed out (slug=%s)", slug)
        return empty
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Research graph HTTP %s: %s",
            exc.response.status_code,
            exc.response.text[:200],
        )
        return empty
    except httpx.HTTPError as exc:
        logger.warning("Research graph error: %s", exc)
        return empty


# -- ML Analysis Proxies ------------------------------------------------


def analyze_draft(text, content_type, content_slug, top_n=10):
    """Proxy draft analysis to Index-API."""
    base_url, api_key = _api_config()
    if not base_url:
        return {"connections": [], "entities": [], "graph": {"nodes": [], "edges": []}}
    try:
        resp = httpx.post(
            f"{base_url}/api/v1/connections/draft/",
            json={"text": text, "content_type": content_type, "slug": content_slug, "top": top_n},
            headers=_auth_headers(api_key),
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("Draft analysis failed: %s", exc)
        return {"connections": [], "entities": [], "graph": {"nodes": [], "edges": []}}


def find_similar_text(text, top_n=8, threshold=0.4):
    """Proxy text similarity to Index-API."""
    base_url, api_key = _api_config()
    if not base_url:
        return {"similar": []}
    try:
        resp = httpx.post(
            f"{base_url}/api/v1/similar/text/",
            json={"text": text, "top": top_n, "threshold": threshold},
            headers=_auth_headers(api_key),
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("Text similarity failed: %s", exc)
        return {"similar": []}


def audit_claims(text, source_slugs):
    """Proxy claim audit to Index-API."""
    base_url, api_key = _api_config()
    if not base_url:
        return {"claims": [], "summary": {"total": 0, "supported": 0, "unsupported": 0}}
    try:
        resp = httpx.post(
            f"{base_url}/api/v1/claims/audit/",
            json={"text": text, "source_slugs": source_slugs},
            headers=_auth_headers(api_key),
            timeout=httpx.Timeout(30.0, connect=5.0),
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("Claim audit failed: %s", exc)
        return {"claims": [], "summary": {"total": 0, "supported": 0, "unsupported": 0}}


def extract_entities(text):
    """Proxy entity extraction to Index-API."""
    base_url, api_key = _api_config()
    if not base_url:
        return {"entities": [], "tags": []}
    try:
        resp = httpx.post(
            f"{base_url}/api/v1/entities/extract/",
            json={"text": text},
            headers=_auth_headers(api_key),
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("Entity extraction failed: %s", exc)
        return {"entities": [], "tags": []}

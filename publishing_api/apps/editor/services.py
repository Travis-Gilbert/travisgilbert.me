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

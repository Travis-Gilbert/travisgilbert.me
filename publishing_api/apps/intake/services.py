"""
Services for the Sourcebox intake pipeline.

scrape_og_metadata: Fetch a URL and extract Open Graph metadata.
promote_to_research: Push an accepted RawSource to research_api as a Source.
scrape_og_async: Scrape OG metadata for a RawSource and update the record.
start_scrape_thread: Fire and forget OG scraping in a background thread.
"""

import logging
import threading

import httpx
from bs4 import BeautifulSoup
from django.conf import settings

logger = logging.getLogger(__name__)

# Timeout and user agent for scraping
SCRAPE_TIMEOUT = 10
USER_AGENT = "travisgilbert.me/studio (Sourcebox)"


def scrape_og_metadata(url: str) -> dict:
    """
    Fetch a URL and extract Open Graph metadata.

    Returns a dict with keys: title, description, image, site_name.
    All values default to empty string on failure.
    """
    result = {
        "title": "",
        "description": "",
        "image": "",
        "site_name": "",
    }

    try:
        response = httpx.get(
            url,
            timeout=SCRAPE_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()
    except (httpx.HTTPError, httpx.InvalidURL) as exc:
        logger.warning("OG scrape failed for %s: %s", url, exc)
        return result

    soup = BeautifulSoup(response.text, "html.parser")

    # Extract og: meta tags
    og_map = {
        "og:title": "title",
        "og:description": "description",
        "og:image": "image",
        "og:site_name": "site_name",
    }

    for og_property, key in og_map.items():
        tag = soup.find("meta", property=og_property)
        if tag and tag.get("content"):
            result[key] = tag["content"].strip()

    # Fallback: use <title> if no og:title
    if not result["title"]:
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            result["title"] = title_tag.string.strip()

    # Fallback: use meta description if no og:description
    if not result["description"]:
        desc_tag = soup.find("meta", attrs={"name": "description"})
        if desc_tag and desc_tag.get("content"):
            result["description"] = desc_tag["content"].strip()

    return result


# ---------------------------------------------------------------------------
# Source promotion: Sourcebox -> research_api
# ---------------------------------------------------------------------------

PROMOTE_TIMEOUT = 15


def promote_to_research(raw_source) -> dict:
    """
    Push an accepted RawSource to research_api, creating a Source record.

    Returns a dict with 'slug' on success, or 'error' on failure.
    If the source already exists in research_api, returns the existing slug
    (idempotent: safe to call multiple times for the same URL).

    Requires RESEARCH_API_URL and RESEARCH_API_KEY in Django settings.
    """
    api_url = getattr(settings, "RESEARCH_API_URL", "")
    api_key = getattr(settings, "RESEARCH_API_KEY", "")

    if not api_url or not api_key:
        logger.warning(
            "Promote skipped for RawSource %s: RESEARCH_API_URL or RESEARCH_API_KEY not configured",
            raw_source.pk,
        )
        return {"error": "Research API not configured"}

    endpoint = f"{api_url.rstrip('/')}/api/v1/internal/promote/"
    payload = {
        "url": raw_source.url,
        "title": raw_source.og_title or raw_source.url,
        "description": raw_source.og_description,
        "site_name": raw_source.og_site_name,
        "tags": raw_source.tags if isinstance(raw_source.tags, list) else [],
    }

    try:
        response = httpx.post(
            endpoint,
            json=payload,
            timeout=PROMOTE_TIMEOUT,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
    except httpx.HTTPError as exc:
        logger.error("Promote HTTP error for RawSource %s: %s", raw_source.pk, exc)
        return {"error": f"HTTP error: {exc}"}

    if response.status_code in (200, 201):
        data = response.json()
        logger.info(
            "Promoted RawSource %s -> Source slug=%s", raw_source.pk, data.get("slug")
        )
        return {"slug": data["slug"], "id": data.get("id")}

    if response.status_code == 409:
        # Already exists; treat as success
        data = response.json()
        logger.info(
            "Promote: source already exists for RawSource %s (slug=%s)",
            raw_source.pk,
            data.get("slug"),
        )
        return {"slug": data["slug"], "id": data.get("id"), "existing": True}

    logger.error(
        "Promote failed for RawSource %s: status=%s body=%s",
        raw_source.pk,
        response.status_code,
        response.text[:500],
    )
    return {"error": f"API returned {response.status_code}"}


# ---------------------------------------------------------------------------
# Async OG scraping: background thread for card creation
# ---------------------------------------------------------------------------


def scrape_og_async(source_pk: int) -> None:
    """
    Scrape OG metadata for a RawSource and update the record.

    Designed to run in a background thread. Updates scrape_status
    to 'complete' on success or 'failed' on exception.
    """
    from apps.intake.models import RawSource

    try:
        source = RawSource.objects.get(pk=source_pk)
    except RawSource.DoesNotExist:
        logger.warning("scrape_og_async: RawSource %s not found", source_pk)
        return

    try:
        og = scrape_og_metadata(source.url)
        source.og_title = og["title"][:500]
        source.og_description = og["description"]
        source.og_image = og["image"][:2000]
        source.og_site_name = og["site_name"][:300]
        source.scrape_status = RawSource.ScrapeStatus.COMPLETE
        source.save(update_fields=[
            "og_title", "og_description", "og_image", "og_site_name", "scrape_status",
        ])
    except Exception as exc:
        logger.error("scrape_og_async failed for RawSource %s: %s", source_pk, exc)
        RawSource.objects.filter(pk=source_pk).update(
            scrape_status=RawSource.ScrapeStatus.FAILED
        )


def start_scrape_thread(source_pk: int) -> None:
    """Fire and forget OG scraping in a background thread."""
    thread = threading.Thread(
        target=scrape_og_async,
        args=(source_pk,),
        daemon=True,
    )
    thread.start()

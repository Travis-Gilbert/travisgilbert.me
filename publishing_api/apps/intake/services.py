"""
Services for the Sourcebox intake pipeline.

scrape_og_metadata: Fetch a URL and extract Open Graph metadata.
"""

import logging

import httpx
from bs4 import BeautifulSoup

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

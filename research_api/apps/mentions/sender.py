"""
Outbound Webmention sender.

Given a published content URL:
1. Fetch the rendered HTML
2. Extract all external links
3. For each link, discover the Webmention endpoint (Link header or <link> tag)
4. POST source + target to the discovered endpoint

Follows the W3C Webmention spec:
https://www.w3.org/TR/webmention/#sending-webmentions
"""

import logging
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SITE_DOMAIN = "travisgilbert.me"
TIMEOUT = 10


def discover_webmention_endpoint(target_url: str) -> str | None:
    """
    Discover a Webmention endpoint for the given URL.

    Checks (in order):
    1. HTTP Link header with rel="webmention"
    2. HTML <link rel="webmention"> tag
    3. HTML <a rel="webmention"> tag
    """
    try:
        resp = requests.get(target_url, timeout=TIMEOUT, allow_redirects=True)
        resp.raise_for_status()
    except requests.RequestException:
        logger.debug("Could not fetch %s for endpoint discovery", target_url)
        return None

    # Check Link header
    link_header = resp.headers.get("Link", "")
    if 'rel="webmention"' in link_header or "rel=webmention" in link_header:
        for part in link_header.split(","):
            if "webmention" in part:
                url = part.split(";")[0].strip().strip("<>")
                return urljoin(target_url, url)

    # Check HTML
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag_name in ("link", "a"):
        tag = soup.find(tag_name, rel="webmention")
        if tag and tag.get("href"):
            return urljoin(target_url, tag["href"])

    return None


def send_webmention(source_url: str, target_url: str, endpoint: str) -> bool:
    """POST a Webmention notification to the discovered endpoint."""
    try:
        resp = requests.post(
            endpoint,
            data={"source": source_url, "target": target_url},
            timeout=TIMEOUT,
        )
        accepted = resp.status_code in (200, 201, 202)
        if accepted:
            logger.info("Webmention accepted: %s -> %s", source_url, target_url)
        else:
            logger.warning(
                "Webmention rejected (%d): %s -> %s",
                resp.status_code, source_url, target_url,
            )
        return accepted
    except requests.RequestException as exc:
        logger.error("Webmention send failed: %s -> %s (%s)", source_url, target_url, exc)
        return False


def send_webmentions_for_content(content_url: str) -> dict:
    """
    Fetch the rendered page at content_url, extract external links,
    and send Webmentions to any that support the protocol.

    Returns: { "discovered": int, "sent": int, "failed": int, "details": [...] }
    """
    result = {"discovered": 0, "sent": 0, "failed": 0, "details": []}

    try:
        resp = requests.get(content_url, timeout=TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException:
        logger.error("Could not fetch own content at %s", content_url)
        return result

    soup = BeautifulSoup(resp.text, "html.parser")

    for link in soup.find_all("a", href=True):
        href = link["href"]
        parsed = urlparse(href)

        # Skip internal, anchor, and non-HTTP links
        if not parsed.scheme.startswith("http"):
            continue
        if parsed.netloc == SITE_DOMAIN:
            continue

        endpoint = discover_webmention_endpoint(href)
        if not endpoint:
            continue

        result["discovered"] += 1
        detail = {"target": href, "endpoint": endpoint, "sent": False}

        if send_webmention(content_url, href, endpoint):
            result["sent"] += 1
            detail["sent"] = True
        else:
            result["failed"] += 1

        result["details"].append(detail)

    return result

"""
GitHub API integration for publishing content.

Commits markdown files directly to the repository via the GitHub Contents API.
This is the engine behind the Publish button: model instance goes in,
committed .md file in the repo comes out, Vercel auto-deploys.

Requires two environment variables:
  GITHUB_TOKEN       Personal access token with repo scope
  GITHUB_REPO        Owner/repo format, e.g. "travisgilbert/website"

The Contents API (PUT /repos/{owner}/{repo}/contents/{path}) creates or
updates a single file per request. For updating, it needs the current
file's SHA (the blob SHA, not the commit SHA).
"""

import base64
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

API_BASE = "https://api.github.com"


def _headers():
    return {
        "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _get_file_sha(file_path):
    """
    Get the current blob SHA of a file in the repo.

    Returns None if the file doesn't exist yet (new content).
    Required by the Contents API for updates.
    """
    url = f"{API_BASE}/repos/{settings.GITHUB_REPO}/contents/{file_path}"
    params = {"ref": settings.GITHUB_BRANCH}
    resp = requests.get(url, headers=_headers(), params=params, timeout=10)
    if resp.status_code == 200:
        return resp.json().get("sha")
    return None


def publish_file(file_path, content, commit_message):
    """
    Create or update a file in the GitHub repository.

    Args:
        file_path: Path relative to repo root (e.g. "src/content/essays/my-essay.md")
        content: The file content as a string
        commit_message: Git commit message

    Returns:
        dict with keys: success (bool), commit_sha (str), commit_url (str),
        error (str or None)
    """
    url = f"{API_BASE}/repos/{settings.GITHUB_REPO}/contents/{file_path}"

    # GitHub Contents API requires base64-encoded content
    encoded = base64.b64encode(content.encode("utf-8")).decode("ascii")

    payload = {
        "message": commit_message,
        "content": encoded,
        "branch": settings.GITHUB_BRANCH,
    }

    # If the file already exists, include its SHA for the update
    existing_sha = _get_file_sha(file_path)
    if existing_sha:
        payload["sha"] = existing_sha

    try:
        resp = requests.put(url, headers=_headers(), json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        commit_info = data.get("commit", {})
        return {
            "success": True,
            "commit_sha": commit_info.get("sha", ""),
            "commit_url": commit_info.get("html_url", ""),
            "error": None,
        }
    except requests.exceptions.RequestException as e:
        error_detail = str(e)
        if hasattr(e, "response") and e.response is not None:
            try:
                error_detail = e.response.json().get("message", error_detail)
            except ValueError:
                pass
        logger.error("GitHub publish failed for %s: %s", file_path, error_detail)
        return {
            "success": False,
            "commit_sha": "",
            "commit_url": "",
            "error": error_detail,
        }

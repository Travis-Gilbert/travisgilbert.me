"""
GitHub API client for publishing static JSON to the Next.js repo.

Mirrors the publishing_api pattern: Contents API for single files,
Git Trees API for atomic multi-file commits.

Requires GITHUB_TOKEN and GITHUB_REPO in settings.
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


def _repo_url(path=""):
    base = f"{API_BASE}/repos/{settings.GITHUB_REPO}"
    if path:
        return f"{base}/{path}"
    return base


def _result(success, commit_sha="", commit_url="", error=None):
    return {
        "success": success,
        "commit_sha": commit_sha,
        "commit_url": commit_url,
        "error": error,
    }


def _extract_error(exc):
    detail = str(exc)
    if hasattr(exc, "response") and exc.response is not None:
        try:
            detail = exc.response.json().get("message", detail)
        except ValueError:
            pass
    return detail


def _get_file_sha(file_path):
    url = f"{_repo_url('contents')}/{file_path}"
    params = {"ref": settings.GITHUB_BRANCH}
    resp = requests.get(url, headers=_headers(), params=params, timeout=10)
    if resp.status_code == 200:
        return resp.json().get("sha")
    return None


def publish_file(file_path, content, commit_message):
    """Create or update a single file via the Contents API."""
    url = f"{_repo_url('contents')}/{file_path}"
    encoded = base64.b64encode(content.encode("utf-8")).decode("ascii")

    payload = {
        "message": commit_message,
        "content": encoded,
        "branch": settings.GITHUB_BRANCH,
    }

    existing_sha = _get_file_sha(file_path)
    if existing_sha:
        payload["sha"] = existing_sha

    try:
        resp = requests.put(url, headers=_headers(), json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        commit_info = data.get("commit", {})
        return _result(
            True,
            commit_sha=commit_info.get("sha", ""),
            commit_url=commit_info.get("html_url", ""),
        )
    except requests.exceptions.RequestException as e:
        error_detail = _extract_error(e)
        logger.error("GitHub publish failed for %s: %s", file_path, error_detail)
        return _result(False, error=error_detail)


def publish_files(file_ops, commit_message):
    """
    Atomic multi-file commit via the Git Trees API.

    file_ops: list of dicts with 'path' and 'content' keys.
    """
    headers = _headers()
    branch = settings.GITHUB_BRANCH

    try:
        # Get current branch HEAD
        ref_url = _repo_url(f"git/ref/heads/{branch}")
        ref_resp = requests.get(ref_url, headers=headers, timeout=10)
        ref_resp.raise_for_status()
        base_commit_sha = ref_resp.json()["object"]["sha"]

        # Get the tree of that commit
        commit_url = _repo_url(f"git/commits/{base_commit_sha}")
        commit_resp = requests.get(commit_url, headers=headers, timeout=10)
        commit_resp.raise_for_status()
        base_tree_sha = commit_resp.json()["tree"]["sha"]

        # Create blobs and build tree entries
        tree_entries = []
        for op in file_ops:
            if op.get("content") is None:
                tree_entries.append({
                    "path": op["path"],
                    "mode": "100644",
                    "type": "blob",
                    "sha": None,
                })
            else:
                blob_url = _repo_url("git/blobs")
                blob_resp = requests.post(
                    blob_url, headers=headers,
                    json={"content": op["content"], "encoding": "utf-8"},
                    timeout=30,
                )
                blob_resp.raise_for_status()
                tree_entries.append({
                    "path": op["path"],
                    "mode": "100644",
                    "type": "blob",
                    "sha": blob_resp.json()["sha"],
                })

        # Create new tree
        tree_resp = requests.post(
            _repo_url("git/trees"), headers=headers,
            json={"base_tree": base_tree_sha, "tree": tree_entries},
            timeout=30,
        )
        tree_resp.raise_for_status()

        # Create commit
        new_commit_resp = requests.post(
            _repo_url("git/commits"), headers=headers,
            json={
                "message": commit_message,
                "tree": tree_resp.json()["sha"],
                "parents": [base_commit_sha],
            },
            timeout=30,
        )
        new_commit_resp.raise_for_status()
        new_commit = new_commit_resp.json()

        # Update branch ref
        requests.patch(
            _repo_url(f"git/refs/heads/{branch}"), headers=headers,
            json={"sha": new_commit["sha"]},
            timeout=10,
        ).raise_for_status()

        return _result(
            True,
            commit_sha=new_commit.get("sha", ""),
            commit_url=new_commit.get("html_url", ""),
        )

    except requests.exceptions.RequestException as e:
        error_detail = _extract_error(e)
        logger.error("GitHub multi-file commit failed: %s", error_detail)
        return _result(False, error=error_detail)

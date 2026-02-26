"""
GitHub API integration for publishing content.

Supports three operations:
  1. publish_file()   : Create or update a single file (Contents API PUT)
  2. delete_file()    : Delete a single file (Contents API DELETE)
  3. publish_files()  : Create/update/delete multiple files atomically (Git Trees API)

The Contents API handles one file per request. The Git Trees API bundles
multiple file operations into a single commit, useful when content and
site.json need to update together.

Requires two environment variables:
  GITHUB_TOKEN       Personal access token with repo scope
  GITHUB_REPO        Owner/repo format, e.g. "travisgilbert/website"
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
    """Build a GitHub API URL for the configured repo."""
    base = f"{API_BASE}/repos/{settings.GITHUB_REPO}"
    if path:
        return f"{base}/{path}"
    return base


def _get_file_sha(file_path):
    """
    Get the current blob SHA of a file in the repo.

    Returns None if the file doesn't exist yet (new content).
    Required by the Contents API for updates and deletes.
    """
    url = f"{_repo_url('contents')}/{file_path}"
    params = {"ref": settings.GITHUB_BRANCH}
    resp = requests.get(url, headers=_headers(), params=params, timeout=10)
    if resp.status_code == 200:
        return resp.json().get("sha")
    return None


def _result(success, commit_sha="", commit_url="", error=None):
    """Standard result dict returned by all publish/delete functions."""
    return {
        "success": success,
        "commit_sha": commit_sha,
        "commit_url": commit_url,
        "error": error,
    }


def _extract_error(exc):
    """Pull a human-readable error message from a requests exception."""
    detail = str(exc)
    if hasattr(exc, "response") and exc.response is not None:
        try:
            detail = exc.response.json().get("message", detail)
        except ValueError:
            pass
    return detail


# ---------------------------------------------------------------------------
# Single-file operations (Contents API)
# ---------------------------------------------------------------------------


def publish_file(file_path, content, commit_message):
    """
    Create or update a file in the GitHub repository.

    Args:
        file_path: Path relative to repo root (e.g. "src/content/essays/my-essay.md")
        content: The file content as a string
        commit_message: Git commit message

    Returns:
        dict with keys: success, commit_sha, commit_url, error
    """
    url = f"{_repo_url('contents')}/{file_path}"

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
        return _result(
            True,
            commit_sha=commit_info.get("sha", ""),
            commit_url=commit_info.get("html_url", ""),
        )
    except requests.exceptions.RequestException as e:
        error_detail = _extract_error(e)
        logger.error("GitHub publish failed for %s: %s", file_path, error_detail)
        return _result(False, error=error_detail)


def publish_binary_file(file_path, content_bytes, commit_message):
    """
    Create or update a binary file in the GitHub repository.

    Like publish_file() but accepts raw bytes instead of a string.
    Used for image uploads (PNG, etc.) where UTF-8 encoding would corrupt data.

    Args:
        file_path: Path relative to repo root (e.g. "public/collage/photo.png")
        content_bytes: The file content as bytes
        commit_message: Git commit message

    Returns:
        dict with keys: success, commit_sha, commit_url, error
    """
    url = f"{_repo_url('contents')}/{file_path}"

    encoded = base64.b64encode(content_bytes).decode("ascii")

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
        logger.error("GitHub binary publish failed for %s: %s", file_path, error_detail)
        return _result(False, error=error_detail)


def delete_file(file_path, commit_message):
    """
    Delete a file from the GitHub repository.

    Args:
        file_path: Path relative to repo root
        commit_message: Git commit message

    Returns:
        dict with keys: success, commit_sha, commit_url, error
    """
    existing_sha = _get_file_sha(file_path)
    if not existing_sha:
        return _result(False, error=f"File not found: {file_path}")

    url = f"{_repo_url('contents')}/{file_path}"
    payload = {
        "message": commit_message,
        "sha": existing_sha,
        "branch": settings.GITHUB_BRANCH,
    }

    try:
        resp = requests.delete(url, headers=_headers(), json=payload, timeout=30)
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
        logger.error("GitHub delete failed for %s: %s", file_path, error_detail)
        return _result(False, error=error_detail)


# ---------------------------------------------------------------------------
# Multi-file atomic commit (Git Trees API)
# ---------------------------------------------------------------------------


def publish_files(file_ops, commit_message):
    """
    Create or update multiple files in a single atomic commit.

    Uses the Git Trees API to bundle file operations into one commit.
    This ensures content and site.json stay in sync.

    Args:
        file_ops: list of dicts, each with:
            path: file path relative to repo root
            content: file content string (None to delete)
        commit_message: Git commit message

    Returns:
        dict with keys: success, commit_sha, commit_url, error
    """
    headers = _headers()
    branch = settings.GITHUB_BRANCH

    try:
        # 1. Get the current commit SHA for the branch
        ref_url = _repo_url(f"git/ref/heads/{branch}")
        ref_resp = requests.get(ref_url, headers=headers, timeout=10)
        ref_resp.raise_for_status()
        base_commit_sha = ref_resp.json()["object"]["sha"]

        # 2. Get the tree SHA of that commit
        commit_url = _repo_url(f"git/commits/{base_commit_sha}")
        commit_resp = requests.get(commit_url, headers=headers, timeout=10)
        commit_resp.raise_for_status()
        base_tree_sha = commit_resp.json()["tree"]["sha"]

        # 3. Build the tree entries for the new commit
        tree_entries = []
        for op in file_ops:
            if op.get("content") is None:
                # Delete: set mode to mark file as deleted
                tree_entries.append({
                    "path": op["path"],
                    "mode": "100644",
                    "type": "blob",
                    "sha": None,
                })
            else:
                # Create blob for each file
                blob_url = _repo_url("git/blobs")
                blob_payload = {
                    "content": op["content"],
                    "encoding": "utf-8",
                }
                blob_resp = requests.post(
                    blob_url, headers=headers, json=blob_payload, timeout=30
                )
                blob_resp.raise_for_status()
                blob_sha = blob_resp.json()["sha"]

                tree_entries.append({
                    "path": op["path"],
                    "mode": "100644",
                    "type": "blob",
                    "sha": blob_sha,
                })

        # 4. Create the new tree
        tree_url = _repo_url("git/trees")
        tree_payload = {
            "base_tree": base_tree_sha,
            "tree": tree_entries,
        }
        tree_resp = requests.post(
            tree_url, headers=headers, json=tree_payload, timeout=30
        )
        tree_resp.raise_for_status()
        new_tree_sha = tree_resp.json()["sha"]

        # 5. Create the commit
        new_commit_url = _repo_url("git/commits")
        new_commit_payload = {
            "message": commit_message,
            "tree": new_tree_sha,
            "parents": [base_commit_sha],
        }
        new_commit_resp = requests.post(
            new_commit_url, headers=headers, json=new_commit_payload, timeout=30
        )
        new_commit_resp.raise_for_status()
        new_commit = new_commit_resp.json()

        # 6. Update the branch ref to point to the new commit
        update_ref_url = _repo_url(f"git/refs/heads/{branch}")
        update_payload = {"sha": new_commit["sha"]}
        update_resp = requests.patch(
            update_ref_url, headers=headers, json=update_payload, timeout=10
        )
        update_resp.raise_for_status()

        return _result(
            True,
            commit_sha=new_commit.get("sha", ""),
            commit_url=new_commit.get("html_url", ""),
        )

    except requests.exceptions.RequestException as e:
        error_detail = _extract_error(e)
        logger.error("GitHub multi-file commit failed: %s", error_detail)
        return _result(False, error=error_detail)

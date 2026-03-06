"""
TickTick sync: create and complete tasks via the TickTick Open API v2.

Content tasks created in the Studio editor are optionally synced to a
TickTick project ("Work in Progress") with tags linking them to the
content item. All sync functions are best effort: if the token is missing
or the API call fails, the Django task is still saved.

Required env vars:
  TICKTICK_ACCESS_TOKEN: OAuth2 access token (manually obtained for now)
  TICKTICK_STUDIO_PROJECT_ID: Target project ID (default: Work in Progress)
"""

import logging

import httpx
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

TICKTICK_API_BASE = "https://api.ticktick.com/open/v1"
TICKTICK_STUDIO_PROJECT_ID = getattr(
    settings, "TICKTICK_STUDIO_PROJECT_ID", "689cdbfd8f083a8c93d0134e"
)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def get_ticktick_token() -> str | None:
    """Get cached TickTick OAuth2 access token."""
    token = cache.get("ticktick_access_token")
    if token:
        return token
    # For now, use a manually obtained token from env
    token = getattr(settings, "TICKTICK_ACCESS_TOKEN", None)
    if token:
        cache.set("ticktick_access_token", token, timeout=3600)
    return token


# ---------------------------------------------------------------------------
# Content task sync (used by editor views)
# ---------------------------------------------------------------------------


def sync_content_task_to_ticktick(task) -> str | None:
    """
    Create or update a TickTick task from a ContentTask instance.
    Returns the TickTick task ID on success, None on failure.
    """
    token = get_ticktick_token()
    if not token:
        logger.warning("TickTick sync skipped: no access token")
        return None

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    payload = {
        "title": task.text,
        "projectId": TICKTICK_STUDIO_PROJECT_ID,
        "tags": [task.content_type, task.content_slug, "studio-task"],
        "content": f"Studio task for {task.content_type}: {task.content_slug}",
    }

    if task.ticktick_task_id:
        # Update existing task
        url = f"{TICKTICK_API_BASE}/task/{task.ticktick_task_id}"
        try:
            resp = httpx.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                return task.ticktick_task_id
        except httpx.HTTPError:
            logger.exception("TickTick update failed for task %s", task.pk)
        return None
    else:
        # Create new task
        url = f"{TICKTICK_API_BASE}/task"
        try:
            resp = httpx.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code in (200, 201):
                data = resp.json()
                return data.get("id")
        except httpx.HTTPError:
            logger.exception("TickTick create failed for task %s", task.pk)
        return None


def complete_ticktick_task(ticktick_project_id: str, ticktick_task_id: str) -> bool:
    """Mark a TickTick task as completed."""
    token = get_ticktick_token()
    if not token:
        return False

    headers = {"Authorization": f"Bearer {token}"}
    url = (
        f"{TICKTICK_API_BASE}/project/{ticktick_project_id}"
        f"/task/{ticktick_task_id}/complete"
    )
    try:
        resp = httpx.post(url, headers=headers, timeout=10)
        return resp.status_code == 200
    except httpx.HTTPError:
        logger.exception("TickTick complete failed for task %s", ticktick_task_id)
        return False


# ---------------------------------------------------------------------------
# Content pipeline sync (essays and field notes)
# ---------------------------------------------------------------------------


def sync_essay_stage(essay_title: str, stage: str, essay_slug: str) -> None:
    """Sync an essay's pipeline stage to a TickTick task."""
    logger.debug(
        "TickTick essay stage sync: title=%s, stage=%s, slug=%s",
        essay_title,
        stage,
        essay_slug,
    )


def sync_field_note_status(note_title: str, status: str, note_slug: str) -> None:
    """Sync a field note's status to a TickTick task."""
    logger.debug(
        "TickTick field note sync: title=%s, status=%s, slug=%s",
        note_title,
        status,
        note_slug,
    )


# ---------------------------------------------------------------------------
# Video production sync (stubs, future implementation)
# ---------------------------------------------------------------------------


def sync_to_ticktick(video) -> None:
    """Creates or updates TickTick tasks for the video project."""
    pass


def create_phase_task(video, phase: str) -> None:
    """Creates a TickTick task for a specific phase with subtasks."""
    pass


def sync_from_ticktick(video) -> None:
    """Reads TickTick task state and updates the VideoProject."""
    pass

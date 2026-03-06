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
# Video production sync
# ---------------------------------------------------------------------------

TICKTICK_VIDEO_PROJECT_ID = getattr(
    settings, "TICKTICK_VIDEO_PROJECT_ID", "696d539b8f08e340f3116156"
)

PHASE_DISPLAY = {
    "research": "P0: Research",
    "scripting": "P1: Script Lock",
    "voiceover": "P2: Voiceover",
    "filming": "P3: On-Camera Filming",
    "assembly": "P4: Assembly Edit",
    "polish": "P5: Graphics & Polish",
    "metadata": "P6: Export & Metadata",
    "publish": "P7: Publish",
}

PHASE_ORDER = list(PHASE_DISPLAY.keys())


def _video_headers() -> dict | None:
    """Build auth headers for TickTick API. Returns None if token is unset."""
    token = get_ticktick_token()
    if not token:
        return None
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _subtasks_for_phase(phase_slug: str, scenes) -> list[dict]:
    """Build TickTick checklist items from scenes for a given phase."""
    if phase_slug == "research":
        return [
            {"title": "Identify primary sources", "status": 0},
            {"title": "Write core thesis (1 to 2 sentences)", "status": 0},
            {"title": "List key examples/evidence", "status": 0},
            {"title": "Go/no-go decision", "status": 0},
        ]
    if phase_slug == "scripting":
        return [
            {"title": f"Scene {s.order}: {s.title}", "status": 0}
            for s in scenes
        ]
    if phase_slug == "voiceover":
        vo_scenes = [s for s in scenes if s.scene_type in ("vo", "mixed")]
        return [
            {"title": f"Scene {s.order}: {s.title}", "status": 0}
            for s in vo_scenes
        ]
    if phase_slug == "filming":
        camera_scenes = [
            s for s in scenes if s.scene_type in ("on_camera", "mixed")
        ]
        return [
            {"title": f"Scene {s.order}: {s.title}", "status": 0}
            for s in camera_scenes
        ]
    if phase_slug == "assembly":
        return [
            {"title": "Import VO audio as timeline spine", "status": 0},
            {"title": "Place on-camera footage", "status": 0},
            {"title": "Add placeholder graphic cards", "status": 0},
            {"title": "Verify timeline plays start to finish", "status": 0},
        ]
    if phase_slug == "polish":
        return [
            {"title": "Graphics: Replace all placeholder cards", "status": 0},
            {"title": "Sound: Add music and sound design", "status": 0},
            {"title": "Color: Apply color correction", "status": 0},
        ]
    if phase_slug == "metadata":
        return [
            {"title": "Export final video from Resolve", "status": 0},
            {"title": "Write 5 title options, pick best", "status": 0},
            {"title": "Create 3 thumbnail concepts, pick one", "status": 0},
            {"title": "Write description using template", "status": 0},
            {"title": "Add chapter timestamps", "status": 0},
        ]
    return []


def _phase_content(phase_slug: str) -> str:
    """Generate the task body with phase-specific protocols."""
    protocols = {
        "research": (
            "Research is never \"complete.\" It is \"sufficient to start"
            " writing.\" Question: Do you have enough to draft?"
        ),
        "scripting": (
            "Scripts need to be \"shootable,\" not \"perfect.\" Clunky"
            " lines fix themselves in delivery."
        ),
        "voiceover": (
            "VO does not need to be final. \"Did words come out in"
            " roughly the right order?\" = done."
        ),
        "filming": (
            "You are collecting raw material. \"Good enough to have"
            " options\" is the bar."
        ),
        "assembly": (
            "This is a map, not the final video. Placeholder cards"
            " are required."
        ),
        "polish": (
            "Graphics do not need to be custom. Good storytelling"
            " (already done in script) matters more."
        ),
        "metadata": (
            "Title: 5 options in 5 minutes. Pick most specific."
            " Thumbnail: 45 min max."
        ),
        "publish": "Publishing is one button. Once pressed, video is complete.",
    }
    return protocols.get(phase_slug, "")


def create_video_breakdown(video) -> list[str]:
    """
    Create all phase tasks for a new video project in TickTick.
    Returns list of created TickTick task IDs.

    Task title format: [emoji] [Short Title] - P[#]: [Phase Name]
    Current phase gets priority 5, future phases get 3, past phases get 1.
    Each phase task gets subtasks from the video's scenes.
    """
    headers = _video_headers()
    if not headers:
        logger.info("TickTick video sync skipped: no access token")
        return []

    created_ids = []
    scenes = list(video.scenes.all().order_by("order"))
    current_idx = PHASE_ORDER.index(video.phase) if video.phase in PHASE_ORDER else 0

    for idx, (phase_slug, phase_label) in enumerate(PHASE_DISPLAY.items()):
        is_current = idx == current_idx
        is_past = idx < current_idx

        subtasks = _subtasks_for_phase(phase_slug, scenes)

        payload = {
            "title": f"\U0001f3a5 {video.short_title} - {phase_label}",
            "projectId": TICKTICK_VIDEO_PROJECT_ID,
            "priority": 5 if is_current else (1 if is_past else 3),
            "content": _phase_content(phase_slug),
            "items": subtasks,
        }

        try:
            resp = httpx.post(
                f"{TICKTICK_API_BASE}/task",
                json=payload,
                headers=headers,
                timeout=10,
            )
            if resp.status_code in (200, 201):
                task_id = resp.json().get("id", "")
                created_ids.append(task_id)
                logger.info(
                    "TickTick: created %s for %s", phase_label, video.slug
                )
            else:
                logger.warning(
                    "TickTick create returned %s for %s %s",
                    resp.status_code,
                    video.slug,
                    phase_slug,
                )
        except httpx.HTTPError:
            logger.exception(
                "TickTick create failed for %s %s", video.slug, phase_slug
            )

    return created_ids


def update_phase_priorities(video) -> None:
    """
    After a phase advance, update priorities on all phase tasks.
    Completed = 1 (Low), Current = 5 (High), Future = 3 (Medium).

    Searches for tasks matching the video's short_title in the Video
    Breakdown project, then updates priority on each based on the
    current phase position.
    """
    headers = _video_headers()
    if not headers:
        return

    current_idx = PHASE_ORDER.index(video.phase) if video.phase in PHASE_ORDER else 0

    # Fetch all tasks in the video breakdown project
    try:
        resp = httpx.get(
            f"{TICKTICK_API_BASE}/project/{TICKTICK_VIDEO_PROJECT_ID}/data",
            headers=headers,
            timeout=10,
        )
        if resp.status_code != 200:
            logger.warning(
                "TickTick: could not fetch project data (%s)", resp.status_code
            )
            return
    except httpx.HTTPError:
        logger.exception("TickTick: failed to fetch project data")
        return

    project_data = resp.json()
    tasks = project_data.get("tasks", [])

    # Filter tasks belonging to this video (match short_title in the title)
    prefix = f"\U0001f3a5 {video.short_title} - "
    matching = [t for t in tasks if t.get("title", "").startswith(prefix)]

    for task in matching:
        title = task.get("title", "")
        task_id = task.get("id")
        if not task_id:
            continue

        # Determine which phase this task represents
        phase_idx = None
        for idx, (_, phase_label) in enumerate(PHASE_DISPLAY.items()):
            if title.endswith(f"- {phase_label}"):
                phase_idx = idx
                break

        if phase_idx is None:
            continue

        if phase_idx == current_idx:
            new_priority = 5
        elif phase_idx < current_idx:
            new_priority = 1
        else:
            new_priority = 3

        # Skip update if priority already matches
        if task.get("priority") == new_priority:
            continue

        try:
            resp = httpx.post(
                f"{TICKTICK_API_BASE}/task/{task_id}",
                json={
                    "id": task_id,
                    "projectId": TICKTICK_VIDEO_PROJECT_ID,
                    "priority": new_priority,
                },
                headers=headers,
                timeout=10,
            )
            if resp.status_code == 200:
                logger.info(
                    "TickTick: updated priority for %s to %s",
                    title,
                    new_priority,
                )
        except httpx.HTTPError:
            logger.exception(
                "TickTick: failed to update priority for %s", title
            )

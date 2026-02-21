"""
High-level publish functions that tie models, serializers, and GitHub together.

Each function takes a model instance, serializes it to markdown, commits it
to GitHub, and logs the result. These are what the Publish button calls.
"""

from apps.content.models import (
    Essay,
    FieldNote,
    NowPage,
    Project,
    PublishLog,
    ShelfEntry,
)
from apps.publisher.github import publish_file
from apps.publisher.serializers import (
    serialize_essay,
    serialize_field_note,
    serialize_now_page,
    serialize_project,
    serialize_shelf_entry,
)


# Maps content types to their directory in the Next.js repo
CONTENT_PATHS = {
    "essay": "src/content/essays",
    "field_note": "src/content/field-notes",
    "shelf": "src/content/shelf",
    "project": "src/content/projects",
    "now": "src/content",
}


def _log_result(content_type, slug, title, result):
    """Create a PublishLog entry."""
    return PublishLog.objects.create(
        content_type=content_type,
        content_slug=slug,
        content_title=title,
        commit_sha=result["commit_sha"],
        commit_url=result["commit_url"],
        success=result["success"],
        error_message=result["error"] or "",
    )


def publish_essay(essay: Essay):
    """Serialize and commit an essay to GitHub."""
    markdown = serialize_essay(essay)
    file_path = f"{CONTENT_PATHS['essay']}/{essay.slug}.md"
    commit_msg = f"feat(content): publish essay '{essay.title}'"

    result = publish_file(file_path, markdown, commit_msg)
    log = _log_result("essay", essay.slug, essay.title, result)

    if result["success"]:
        essay.draft = False
        essay.save(update_fields=["draft", "updated_at"])

    return log


def publish_field_note(note: FieldNote):
    """Serialize and commit a field note to GitHub."""
    markdown = serialize_field_note(note)
    file_path = f"{CONTENT_PATHS['field_note']}/{note.slug}.md"
    commit_msg = f"feat(content): publish field note '{note.title}'"

    result = publish_file(file_path, markdown, commit_msg)
    log = _log_result("field_note", note.slug, note.title, result)

    if result["success"]:
        note.draft = False
        note.save(update_fields=["draft", "updated_at"])

    return log


def publish_shelf_entry(entry: ShelfEntry):
    """Serialize and commit a shelf entry to GitHub."""
    markdown = serialize_shelf_entry(entry)
    file_path = f"{CONTENT_PATHS['shelf']}/{entry.slug}.md"
    commit_msg = f"feat(content): publish shelf entry '{entry.title}'"

    result = publish_file(file_path, markdown, commit_msg)
    log = _log_result("shelf", entry.slug, entry.title, result)
    return log


def publish_project(project: Project):
    """Serialize and commit a project to GitHub."""
    markdown = serialize_project(project)
    file_path = f"{CONTENT_PATHS['project']}/{project.slug}.md"
    commit_msg = f"feat(content): publish project '{project.title}'"

    result = publish_file(file_path, markdown, commit_msg)
    log = _log_result("project", project.slug, project.title, result)

    if result["success"]:
        project.draft = False
        project.save(update_fields=["draft", "updated_at"])

    return log


def publish_now_page(now: NowPage):
    """Serialize and commit the Now page to GitHub."""
    markdown = serialize_now_page(now)
    file_path = f"{CONTENT_PATHS['now']}/now.md"
    commit_msg = "feat(content): update Now page"

    result = publish_file(file_path, markdown, commit_msg)
    log = _log_result("now", "now", "Now Page", result)
    return log

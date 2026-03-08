"""
High-level publish functions that tie models, serializers, and GitHub together.

Each function takes a model instance, serializes it to the appropriate format,
commits it to GitHub, and logs the result. These are what the Publish button calls.

Content types publish individual .md files.
Site configuration publishes a single src/config/site.json.
"""

from apps.content.models import (
    Essay,
    FieldNote,
    NowPage,
    Project,
    PublishLog,
    ShelfEntry,
    ToolkitEntry,
)
from apps.publisher.github import delete_file, publish_file, publish_files
from apps.publisher.serializers import (
    serialize_essay,
    serialize_field_note,
    serialize_now_page,
    serialize_project,
    serialize_shelf_entry,
    serialize_site_config,
    serialize_toolkit_entry,
)


# Maps content types to their directory in the Next.js repo
CONTENT_PATHS = {
    "essay": "src/content/essays",
    "field_note": "src/content/field-notes",
    "shelf": "src/content/shelf",
    "project": "src/content/projects",
    "toolkit": "src/content/toolkit",
    "now": "src/content",
}

SITE_CONFIG_PATH = "src/config/site.json"


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


# ---------------------------------------------------------------------------
# Content publish functions
# ---------------------------------------------------------------------------


def publish_essay(essay: Essay):
    """Serialize and commit an essay to GitHub."""
    markdown = serialize_essay(essay)
    file_path = f"{CONTENT_PATHS['essay']}/{essay.slug}.md"
    commit_msg = f"feat(content): publish essay '{essay.title}'"

    result = publish_file(file_path, markdown, commit_msg)
    log = _log_result("essay", essay.slug, essay.title, result)

    if result["success"]:
        essay.draft = False
        essay.stage = "published"
        essay.save(update_fields=["draft", "stage", "updated_at"])

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
        note.stage = "published"
        note.save(update_fields=["draft", "stage", "updated_at"])

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
        project.stage = "published"
        project.save(update_fields=["draft", "stage", "updated_at"])

    return log


def publish_toolkit_entry(entry: ToolkitEntry):
    """Serialize and commit a toolkit entry to GitHub."""
    markdown = serialize_toolkit_entry(entry)
    file_path = f"{CONTENT_PATHS['toolkit']}/{entry.slug}.md"
    commit_msg = f"feat(content): publish toolkit entry '{entry.title}'"

    result = publish_file(file_path, markdown, commit_msg)
    log = _log_result("toolkit", entry.slug, entry.title, result)
    return log


def publish_now_page(now: NowPage):
    """Serialize and commit the Now page to GitHub."""
    markdown = serialize_now_page(now)
    file_path = f"{CONTENT_PATHS['now']}/now.md"
    commit_msg = "feat(content): update Now page"

    result = publish_file(file_path, markdown, commit_msg)
    log = _log_result("now", "now", "Now Page", result)
    return log


# ---------------------------------------------------------------------------
# Site configuration publish
# ---------------------------------------------------------------------------


def publish_site_config():
    """
    Serialize and commit the full site configuration to GitHub.

    Aggregates DesignTokenSet, NavItem, PageComposition, and SiteSettings
    into src/config/site.json.
    """
    config_json = serialize_site_config()
    commit_msg = "feat(config): update site configuration"

    result = publish_file(SITE_CONFIG_PATH, config_json, commit_msg)
    log = _log_result("site_config", "site-config", "Site Configuration", result)
    return log


# ---------------------------------------------------------------------------
# Content deletion
# ---------------------------------------------------------------------------


# Maps model class names to content type keys and path prefixes
_DELETE_REGISTRY = {
    "Essay": ("essay", CONTENT_PATHS["essay"]),
    "FieldNote": ("field_note", CONTENT_PATHS["field_note"]),
    "ShelfEntry": ("shelf", CONTENT_PATHS["shelf"]),
    "Project": ("project", CONTENT_PATHS["project"]),
    "ToolkitEntry": ("toolkit", CONTENT_PATHS["toolkit"]),
}


def delete_content(instance):
    """
    Delete a content file from GitHub and remove the DB record.

    Args:
        instance: A content model instance (Essay, FieldNote, etc.)

    Returns:
        PublishLog entry recording the deletion
    """
    class_name = instance.__class__.__name__
    if class_name not in _DELETE_REGISTRY:
        raise ValueError(f"Cannot delete content type: {class_name}")

    content_type, base_path = _DELETE_REGISTRY[class_name]
    file_path = f"{base_path}/{instance.slug}.md"
    title = str(instance)
    slug = instance.slug
    commit_msg = f"feat(content): delete {content_type.replace('_', ' ')} '{title}'"

    result = delete_file(file_path, commit_msg)
    log = _log_result(content_type, slug, title, result)

    if result["success"]:
        instance.delete()

    return log


# ---------------------------------------------------------------------------
# Multi-file publish (content + config in one commit)
# ---------------------------------------------------------------------------


def publish_content_with_config(content_instance, serialize_fn, content_type, base_path):
    """
    Publish a content file and site.json together in a single atomic commit.

    Used when both content frontmatter and site configuration need to update
    at the same time (e.g., homepage featured content references).

    Args:
        content_instance: The content model instance to publish
        serialize_fn: Serializer function for the content type
        content_type: PublishLog content_type string
        base_path: Base directory path in the repo

    Returns:
        PublishLog entry
    """
    markdown = serialize_fn(content_instance)
    config_json = serialize_site_config()

    file_ops = [
        {"path": f"{base_path}/{content_instance.slug}.md", "content": markdown},
        {"path": SITE_CONFIG_PATH, "content": config_json},
    ]

    title = str(content_instance)
    commit_msg = f"feat(content): publish {content_type.replace('_', ' ')} '{title}' with config"

    result = publish_files(file_ops, commit_msg)
    log = _log_result(content_type, content_instance.slug, title, result)
    return log

"""
Serialize Django model instances into publishable file formats.

Content models serialize to markdown files with YAML frontmatter.
Site configuration models serialize to a single JSON structure (site.json).

Field names in YAML frontmatter must match the Next.js Zod schema property
names exactly (camelCase in YAML, snake_case in Django).
"""

import json

import yaml
from datetime import date


def _date_str(d):
    """Format a date as YYYY-MM-DD for frontmatter."""
    if isinstance(d, date):
        return d.isoformat()
    return str(d)


def _clean_dict(d):
    """Remove empty strings, empty lists, and None values from a dict."""
    cleaned = {}
    for k, v in d.items():
        if v is None:
            continue
        if isinstance(v, str) and v == "":
            continue
        if isinstance(v, list) and len(v) == 0:
            continue
        cleaned[k] = v
    return cleaned


def _to_yaml_frontmatter(data, body=""):
    """Combine a data dict and body into a markdown file string."""
    # PyYAML default_flow_style=False gives block style YAML
    # allow_unicode=True handles special characters
    frontmatter = yaml.dump(
        data,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
    ).strip()
    if body:
        return f"---\n{frontmatter}\n---\n\n{body}\n"
    return f"---\n{frontmatter}\n---\n"


# ---------------------------------------------------------------------------
# Content serializers (markdown with YAML frontmatter)
# ---------------------------------------------------------------------------


def serialize_essay(essay):
    """Serialize an Essay model instance to markdown string."""
    data = {
        "title": essay.title,
        "date": _date_str(essay.date),
        "summary": essay.summary,
        "youtubeId": essay.youtube_id,
        "tags": essay.tags,
        "sources": essay.sources,
        "related": essay.related,
        "stage": essay.stage,
        "draft": essay.draft,
    }
    # Optional fields (only include when set)
    if essay.thumbnail:
        data["thumbnail"] = essay.thumbnail
    if essay.image:
        data["image"] = essay.image
    if essay.callout:
        data["callout"] = essay.callout
    if essay.callouts:
        data["callouts"] = essay.callouts
    if essay.annotations:
        data["annotations"] = essay.annotations
    if essay.composition:
        data["composition"] = essay.composition
    # Process proof fields
    if essay.thesis:
        data["thesis"] = essay.thesis
    if essay.source_count:
        data["sourceCount"] = essay.source_count
    if essay.research_started:
        data["researchStarted"] = _date_str(essay.research_started)
    if essay.revision_count:
        data["revisionCount"] = essay.revision_count
    if essay.research_notes:
        lines = [ln for ln in essay.research_notes.split("\n") if ln.strip()]
        if lines:
            data["researchNotes"] = lines
    if essay.source_summary:
        data["sourceSummary"] = essay.source_summary
    if essay.connected_types:
        data["connectedTypes"] = essay.connected_types
    if essay.connection_notes:
        data["connectionNotes"] = essay.connection_notes

    return _to_yaml_frontmatter(data, essay.body)


def serialize_field_note(note):
    """Serialize a FieldNote model instance to markdown string."""
    data = {
        "title": note.title,
        "date": _date_str(note.date),
        "tags": note.tags,
        "draft": note.draft,
    }
    if note.excerpt:
        data["excerpt"] = note.excerpt
    if note.callout:
        data["callout"] = note.callout
    if note.callouts:
        data["callouts"] = note.callouts
    if note.status:
        data["status"] = note.status
    if note.featured:
        data["featured"] = note.featured
    if note.connected_to:
        data["connectedTo"] = note.connected_to
    if note.composition:
        data["composition"] = note.composition

    return _to_yaml_frontmatter(data, note.body)


def serialize_shelf_entry(entry):
    """Serialize a ShelfEntry model instance to markdown string."""
    data = {
        "title": entry.title,
        "creator": entry.creator,
        "type": entry.type,
        "annotation": entry.annotation,
        "date": _date_str(entry.date),
        "tags": entry.tags,
        "stage": entry.stage,
    }
    if entry.url:
        data["url"] = entry.url
    if entry.connected_essay:
        data["connectedEssay"] = entry.connected_essay
    if entry.composition:
        data["composition"] = entry.composition

    return _to_yaml_frontmatter(data)


def serialize_project(project):
    """Serialize a Project model instance to markdown string."""
    data = {
        "title": project.title,
        "role": project.role,
        "description": project.description,
        "year": project.year,
        "date": _date_str(project.date),
        "tags": project.tags,
        "stage": project.stage,
        "draft": project.draft,
    }
    if project.organization:
        data["organization"] = project.organization
    if project.urls:
        data["urls"] = project.urls
    if project.featured:
        data["featured"] = project.featured
    if project.order:
        data["order"] = project.order
    if project.callout:
        data["callout"] = project.callout
    if project.composition:
        data["composition"] = project.composition

    return _to_yaml_frontmatter(data, project.body)


def serialize_toolkit_entry(entry):
    """Serialize a ToolkitEntry model instance to markdown string."""
    data = {
        "title": entry.title,
        "category": entry.category,
        "order": entry.order,
        "stage": entry.stage,
    }
    if entry.composition:
        data["composition"] = entry.composition

    return _to_yaml_frontmatter(data, entry.body)


def serialize_now_page(now):
    """Serialize a NowPage model instance to markdown string."""
    data = {
        "updated": _date_str(now.updated),
        "researching": now.researching,
        "researching_context": now.researching_context,
        "reading": now.reading,
        "reading_context": now.reading_context,
        "building": now.building,
        "building_context": now.building_context,
        "listening": now.listening,
        "listening_context": now.listening_context,
        "thinking": now.thinking,
    }
    data = _clean_dict(data)
    # Always keep updated even if today
    data["updated"] = _date_str(now.updated)

    return _to_yaml_frontmatter(data)


# ---------------------------------------------------------------------------
# Site configuration serializer (JSON for src/config/site.json)
# ---------------------------------------------------------------------------


def serialize_site_config():
    """
    Aggregate all site configuration models into a single JSON string.

    Reads DesignTokenSet (singleton), NavItem (ordered list),
    PageComposition (per-page settings), and SiteSettings (singleton).
    Returns JSON matching the structure the Next.js site expects.
    """
    from apps.content.models import (
        DesignTokenSet,
        NavItem,
        PageComposition,
        SiteSettings,
    )

    tokens = DesignTokenSet.load()
    site_settings = SiteSettings.load()

    # Build nav array from ordered, visible nav items
    nav_items = NavItem.objects.filter(visible=True).order_by("order")
    nav = [
        {
            "label": item.label,
            "path": item.path,
            "icon": item.icon,
            "visible": item.visible,
        }
        for item in nav_items
    ]

    # Build pages dict from PageComposition rows
    pages = {}
    for comp in PageComposition.objects.all():
        pages[comp.page_key] = comp.settings

    config = {
        "tokens": {
            "colors": tokens.colors,
            "fonts": tokens.fonts,
            "spacing": tokens.spacing,
            "sectionColors": tokens.section_colors,
        },
        "nav": nav,
        "footer": {
            "tagline": site_settings.footer_tagline,
            "links": site_settings.footer_links,
        },
        "seo": {
            "titleTemplate": site_settings.seo_title_template,
            "description": site_settings.seo_description,
            "ogImageFallback": site_settings.seo_og_image_fallback,
        },
        "toggles": site_settings.global_toggles,
        "pages": pages,
    }

    return json.dumps(config, indent=2, ensure_ascii=False)

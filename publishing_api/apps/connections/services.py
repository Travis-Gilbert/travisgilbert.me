import re
from dataclasses import dataclass

from django.utils import timezone

from apps.content.models import (
    Essay,
    FieldNote,
    Project,
    ShelfEntry,
    ToolkitEntry,
    VideoProject,
)

STOPWORDS = {
    "the",
    "and",
    "with",
    "for",
    "from",
    "into",
    "about",
    "that",
    "this",
    "your",
    "their",
    "our",
    "how",
    "what",
    "when",
    "where",
    "while",
}


@dataclass
class ContentSource:
    content_type: str
    model: type
    stage_field: str
    tags_field: str | None


CONTENT_SOURCES: tuple[ContentSource, ...] = (
    ContentSource("essay", Essay, "stage", "tags"),
    ContentSource("field-note", FieldNote, "status", "tags"),
    ContentSource("shelf", ShelfEntry, "stage", "tags"),
    ContentSource("project", Project, "stage", "tags"),
    ContentSource("toolkit", ToolkitEntry, "stage", None),
    ContentSource("video", VideoProject, "phase", "youtube_tags"),
)


def _normalize_tag_list(raw_tags):
    if isinstance(raw_tags, list):
        values = raw_tags
    elif isinstance(raw_tags, str):
        values = [part.strip() for part in raw_tags.split(",")]
    else:
        values = []

    cleaned = {
        str(tag).strip().lower().replace(" ", "-")
        for tag in values
        if str(tag).strip()
    }
    return sorted(cleaned)


def _title_tokens(title: str):
    parts = re.findall(r"[a-z0-9']+", title.lower())
    return {
        token
        for token in parts
        if len(token) > 2 and token not in STOPWORDS
    }


def _content_instances(limit: int):
    records = []

    for source in CONTENT_SOURCES:
        only_fields = ["id", "title", "slug", "updated_at", source.stage_field]
        if source.tags_field:
            only_fields.append(source.tags_field)

        query = source.model.objects.only(*only_fields).order_by("-updated_at")
        for instance in query[:limit]:
            title = getattr(instance, "title", "") or "Untitled"
            slug = getattr(instance, "slug", "") or f"item-{instance.pk}"
            updated_at = getattr(instance, "updated_at", timezone.now())
            stage = getattr(instance, source.stage_field, "") or ""

            tags = _normalize_tag_list(
                getattr(instance, source.tags_field, []) if source.tags_field else []
            )
            tokens = _title_tokens(title)

            records.append(
                {
                    "id": f"{source.content_type}:{slug}",
                    "pk": str(instance.pk),
                    "title": title,
                    "slug": slug,
                    "content_type": source.content_type,
                    "stage": stage,
                    "updated_at": updated_at.isoformat(),
                    "tags": tags,
                    "tokens": tokens,
                }
            )

    records.sort(key=lambda record: record["updated_at"], reverse=True)
    return records[:limit]


def build_connections_graph(limit: int = 80, max_edges: int = 240):
    items = _content_instances(limit=limit)

    nodes = [
        {
            "id": item["id"],
            "pk": item["pk"],
            "title": item["title"],
            "slug": item["slug"],
            "content_type": item["content_type"],
            "stage": item["stage"],
            "updated_at": item["updated_at"],
        }
        for item in items
    ]

    edges = []
    for index, left in enumerate(items):
        for right in items[index + 1 :]:
            shared_tags = sorted(set(left["tags"]) & set(right["tags"]))
            shared_tokens = sorted(left["tokens"] & right["tokens"])

            if not shared_tags and not shared_tokens:
                continue

            weight = (len(shared_tags) * 2) + len(shared_tokens)
            reason_parts = []
            if shared_tags:
                reason_parts.append(
                    f"shared tags: {', '.join(shared_tags[:3])}"
                )
            if shared_tokens:
                reason_parts.append(
                    f"shared terms: {', '.join(shared_tokens[:3])}"
                )

            edges.append(
                {
                    "id": f"{left['id']}--{right['id']}",
                    "source": left["id"],
                    "target": right["id"],
                    "weight": weight,
                    "reason": "; ".join(reason_parts),
                }
            )

    edges.sort(key=lambda edge: edge["weight"], reverse=True)

    return {
        "nodes": nodes,
        "edges": edges[:max_edges],
        "meta": {
            "node_count": len(nodes),
            "edge_count": min(len(edges), max_edges),
            "generated_at": timezone.now().isoformat(),
        },
    }

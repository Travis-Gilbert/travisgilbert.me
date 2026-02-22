"""
Management command to import existing markdown content into Django Studio.

Reads .md files from the Next.js content directories, parses YAML frontmatter,
and creates or updates the corresponding Django model instances. Idempotent:
safe to run multiple times (uses slug as the lookup key).
"""

import datetime
from pathlib import Path

import frontmatter
from django.conf import settings
from django.core.management.base import BaseCommand

from apps.content.models import Essay, FieldNote, NowPage, Project, ShelfEntry


CONTENT_TYPES = ("essays", "field-notes", "shelf", "projects", "now")


def _parse_date(value):
    """Normalize date values that PyYAML may auto-parse."""
    if isinstance(value, datetime.datetime):
        return value.date()
    if isinstance(value, datetime.date):
        return value
    return datetime.date.fromisoformat(str(value))


def _parse_essay(post, slug):
    meta = post.metadata
    return {
        "title": meta["title"],
        "slug": slug,
        "date": _parse_date(meta["date"]),
        "summary": meta.get("summary", ""),
        "body": post.content.strip(),
        "youtube_id": meta.get("youtubeId", ""),
        "thumbnail": meta.get("thumbnail", ""),
        "image": meta.get("image", ""),
        "tags": meta.get("tags", []),
        "sources": meta.get("sources", []),
        "related": meta.get("related", []),
        "draft": meta.get("draft", True),
        "callout": meta.get("callout", ""),
        "callouts": meta.get("callouts", []),
        "stage": meta.get("stage", "research"),
        "annotations": meta.get("annotations", []),
    }


def _parse_field_note(post, slug):
    meta = post.metadata
    return {
        "title": meta["title"],
        "slug": slug,
        "date": _parse_date(meta["date"]),
        "body": post.content.strip(),
        "tags": meta.get("tags", []),
        "excerpt": meta.get("excerpt", ""),
        "draft": meta.get("draft", True),
        "callout": meta.get("callout", ""),
        "callouts": meta.get("callouts", []),
        "status": meta.get("status", ""),
        "featured": meta.get("featured", False),
        "connected_to": meta.get("connectedTo", ""),
    }


def _parse_shelf_entry(post, slug):
    meta = post.metadata
    return {
        "title": meta["title"],
        "slug": slug,
        "creator": meta["creator"],
        "type": meta["type"],
        "annotation": meta.get("annotation", ""),
        "url": meta.get("url", ""),
        "date": _parse_date(meta["date"]),
        "tags": meta.get("tags", []),
        "connected_essay": meta.get("connectedEssay", ""),
    }


def _parse_project(post, slug):
    meta = post.metadata
    return {
        "title": meta["title"],
        "slug": slug,
        "role": meta["role"],
        "description": meta.get("description", ""),
        "year": meta.get("year", 0),
        "date": _parse_date(meta["date"]),
        "organization": meta.get("organization", ""),
        "urls": meta.get("urls", []),
        "tags": meta.get("tags", []),
        "featured": meta.get("featured", False),
        "draft": meta.get("draft", True),
        "order": meta.get("order", 0),
        "callout": meta.get("callout", ""),
        "body": post.content.strip(),
    }


def _parse_now_page(post):
    meta = post.metadata
    return {
        "updated": _parse_date(meta["updated"]),
        "researching": meta.get("researching", ""),
        "researching_context": meta.get("researching_context", ""),
        "reading": meta.get("reading", ""),
        "reading_context": meta.get("reading_context", ""),
        "building": meta.get("building", ""),
        "building_context": meta.get("building_context", ""),
        "listening": meta.get("listening", ""),
        "listening_context": meta.get("listening_context", ""),
        "thinking": meta.get("thinking", ""),
    }


# Maps content type name to (subdirectory, model class, parser function)
TYPE_REGISTRY = {
    "essays": ("essays", Essay, _parse_essay),
    "field-notes": ("field-notes", FieldNote, _parse_field_note),
    "shelf": ("shelf", ShelfEntry, _parse_shelf_entry),
    "projects": ("projects", Project, _parse_project),
}


class Command(BaseCommand):
    help = "Import existing markdown content into Django Studio."

    def add_arguments(self, parser):
        parser.add_argument(
            "--content-root",
            type=str,
            default="",
            help=(
                "Path to the content directory. "
                "Default: ../src/content/ relative to publishing_api/"
            ),
        )
        parser.add_argument(
            "--type",
            type=str,
            choices=CONTENT_TYPES,
            default="",
            help="Import only one content type.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and report without writing to database.",
        )

    def handle(self, *args, **options):
        content_root = self._resolve_content_root(options["content_root"])
        if content_root is None:
            return

        dry_run = options["dry_run"]
        type_filter = options["type"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN: no database writes\n"))

        totals = {"created": 0, "updated": 0, "errors": 0}

        # Standard content types (slug-based)
        for type_name, (subdir, model, parser) in TYPE_REGISTRY.items():
            if type_filter and type_filter != type_name:
                continue
            self._import_type(
                content_root, subdir, model, parser, type_name, dry_run, totals
            )

        # NowPage (singleton, pk=1)
        if not type_filter or type_filter == "now":
            self._import_now(content_root, dry_run, totals)

        self.stdout.write(
            "\n"
            + self.style.SUCCESS(
                f"Done. Created: {totals['created']}, "
                f"Updated: {totals['updated']}, "
                f"Errors: {totals['errors']}"
            )
        )

    def _resolve_content_root(self, arg_path):
        if arg_path:
            root = Path(arg_path)
        else:
            root = settings.BASE_DIR.parent / "src" / "content"

        if not root.is_dir():
            self.stderr.write(
                self.style.ERROR(f"Content root not found: {root}")
            )
            return None
        return root

    def _import_type(self, root, subdir, model, parser, type_name, dry_run, totals):
        directory = root / subdir
        if not directory.is_dir():
            self.stdout.write(
                self.style.WARNING(f"  Skipping {type_name}: {directory} not found")
            )
            return

        md_files = sorted(directory.glob("*.md"))
        if not md_files:
            self.stdout.write(
                self.style.WARNING(f"  Skipping {type_name}: no .md files")
            )
            return

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\n{type_name} ({len(md_files)} files)"
        ))

        for md_file in md_files:
            slug = md_file.stem
            try:
                post = frontmatter.load(str(md_file))
                defaults = parser(post, slug)
            except KeyError as exc:
                self.stdout.write(
                    self.style.ERROR(f"  Error {slug}: missing field {exc}")
                )
                totals["errors"] += 1
                continue
            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(f"  Error {slug}: {exc}")
                )
                totals["errors"] += 1
                continue

            if dry_run:
                self.stdout.write(f"  Would import: {slug}")
                totals["created"] += 1
                continue

            _, created = model.objects.update_or_create(
                slug=slug, defaults=defaults
            )
            verb = "Created" if created else "Updated"
            style = self.style.SUCCESS if created else self.style.NOTICE
            self.stdout.write(style(f"  {verb}: {slug}"))
            totals["created" if created else "updated"] += 1

    def _import_now(self, root, dry_run, totals):
        now_file = root / "now.md"
        if not now_file.is_file():
            self.stdout.write(
                self.style.WARNING("  Skipping now: now.md not found")
            )
            return

        self.stdout.write(self.style.MIGRATE_HEADING("\nnow (1 file)"))

        try:
            post = frontmatter.load(str(now_file))
            defaults = _parse_now_page(post)
        except KeyError as exc:
            self.stdout.write(
                self.style.ERROR(f"  Error now.md: missing field {exc}")
            )
            totals["errors"] += 1
            return
        except Exception as exc:
            self.stdout.write(
                self.style.ERROR(f"  Error now.md: {exc}")
            )
            totals["errors"] += 1
            return

        if dry_run:
            self.stdout.write(f"  Would import: now (pk=1)")
            totals["created"] += 1
            return

        _, created = NowPage.objects.update_or_create(
            pk=1, defaults=defaults
        )
        verb = "Created" if created else "Updated"
        style = self.style.SUCCESS if created else self.style.NOTICE
        self.stdout.write(style(f"  {verb}: now (pk=1)"))
        totals["created" if created else "updated"] += 1

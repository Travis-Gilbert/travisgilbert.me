"""
Management command: match pending RawSources against existing content.

For each pending source, compares tags and keywords against essay and field
note frontmatter. Creates SuggestedConnection records with confidence scores.

Usage:
    python manage.py run_connection_engine
    python manage.py run_connection_engine --dry-run
    python manage.py run_connection_engine --min-confidence 0.3
"""

import os
from pathlib import Path

import yaml
from django.core.management.base import BaseCommand

from apps.intake.models import RawSource, SuggestedConnection


class Command(BaseCommand):
    help = "Match pending RawSources against essay/field note content for suggested connections."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report matches without creating records.",
        )
        parser.add_argument(
            "--min-confidence",
            type=float,
            default=0.2,
            help="Minimum confidence score to create a suggestion (default: 0.2).",
        )
        parser.add_argument(
            "--content-dir",
            type=str,
            default="",
            help="Path to src/content/ directory. Defaults to ../../src/content/ relative to manage.py.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        min_confidence = options["min_confidence"]
        content_dir = options["content_dir"]

        if not content_dir:
            # Default: two levels up from publishing_api/manage.py
            base = Path(__file__).resolve().parent.parent.parent.parent.parent
            content_dir = str(base / "src" / "content")

        content_path = Path(content_dir)
        if not content_path.exists():
            self.stderr.write(self.style.ERROR(f"Content directory not found: {content_path}"))
            return

        # Load all content metadata
        content_items = self._load_content(content_path)
        self.stdout.write(f"Loaded {len(content_items)} content items from {content_path}")

        # Get pending sources
        pending = RawSource.objects.filter(decision=RawSource.Decision.PENDING)
        self.stdout.write(f"Found {pending.count()} pending sources")

        created = 0
        skipped = 0

        for source in pending:
            source_terms = self._extract_terms(source)
            if not source_terms:
                continue

            for item in content_items:
                # Skip if connection already exists
                if SuggestedConnection.objects.filter(
                    raw_source=source,
                    content_slug=item["slug"],
                ).exists():
                    skipped += 1
                    continue

                score = self._compute_similarity(source_terms, item)
                if score < min_confidence:
                    continue

                reason = self._build_reason(source_terms, item)

                if dry_run:
                    self.stdout.write(
                        f"  [DRY RUN] {source.display_title[:40]} -> "
                        f"{item['type']}:{item['slug']} ({score:.0%})"
                    )
                else:
                    SuggestedConnection.objects.create(
                        raw_source=source,
                        content_type=item["type"],
                        content_slug=item["slug"],
                        content_title=item["title"],
                        confidence=score,
                        reason=reason,
                    )
                created += 1

        action = "Would create" if dry_run else "Created"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} {created} connections, skipped {skipped} existing"
            )
        )

    def _load_content(self, content_path: Path) -> list[dict]:
        """Parse frontmatter from all essay and field note markdown files."""
        items = []

        for content_type, subdir in [("essay", "essays"), ("field_note", "field-notes")]:
            dir_path = content_path / subdir
            if not dir_path.exists():
                continue

            for md_file in sorted(dir_path.glob("*.md")):
                text = md_file.read_text(encoding="utf-8")
                if not text.startswith("---"):
                    continue

                # Split frontmatter
                parts = text.split("---", 2)
                if len(parts) < 3:
                    continue

                try:
                    fm = yaml.safe_load(parts[1])
                except yaml.YAMLError:
                    continue

                if not fm or not isinstance(fm, dict):
                    continue

                slug = md_file.stem
                items.append({
                    "type": content_type,
                    "slug": slug,
                    "title": fm.get("title", slug),
                    "tags": [t.lower() for t in fm.get("tags", [])],
                    "summary": (fm.get("summary", "") or fm.get("excerpt", "")).lower(),
                    "body_preview": parts[2][:500].lower() if len(parts) > 2 else "",
                })

        return items

    def _extract_terms(self, source: RawSource) -> set[str]:
        """Build a set of lowercase terms from source metadata and tags."""
        terms = set()

        # Tags
        for tag in (source.tags or []):
            terms.add(str(tag).lower())

        # Words from OG title (longer than 3 chars, skip common words)
        stop_words = {"the", "and", "for", "with", "that", "this", "from", "your", "have", "more"}
        if source.og_title:
            for word in source.og_title.lower().split():
                cleaned = word.strip(".,!?:;()[]\"'")
                if len(cleaned) > 3 and cleaned not in stop_words:
                    terms.add(cleaned)

        # Words from OG description (top keywords only)
        if source.og_description:
            for word in source.og_description.lower().split()[:20]:
                cleaned = word.strip(".,!?:;()[]\"'")
                if len(cleaned) > 4 and cleaned not in stop_words:
                    terms.add(cleaned)

        return terms

    def _compute_similarity(self, source_terms: set[str], item: dict) -> float:
        """Compute a 0.0 to 1.0 confidence score between source terms and content."""
        if not source_terms:
            return 0.0

        item_terms = set(item["tags"])

        # Add significant words from summary
        for word in item["summary"].split():
            cleaned = word.strip(".,!?:;()[]\"'")
            if len(cleaned) > 4:
                item_terms.add(cleaned)

        if not item_terms:
            return 0.0

        # Tag overlap (weighted heavily)
        tag_overlap = source_terms & set(item["tags"])
        tag_score = len(tag_overlap) * 0.3

        # Term overlap
        term_overlap = source_terms & item_terms
        term_score = len(term_overlap) * 0.1

        # Body keyword presence
        body_hits = sum(1 for t in source_terms if t in item["body_preview"])
        body_score = min(body_hits * 0.05, 0.2)

        return min(tag_score + term_score + body_score, 1.0)

    def _build_reason(self, source_terms: set[str], item: dict) -> str:
        """Describe why this connection was suggested."""
        reasons = []

        tag_overlap = source_terms & set(item["tags"])
        if tag_overlap:
            reasons.append(f"Shared tags: {', '.join(sorted(tag_overlap))}")

        # Check title/summary keyword overlap
        item_text = f"{item['title'].lower()} {item['summary']}"
        keyword_hits = [t for t in source_terms if t in item_text]
        if keyword_hits:
            reasons.append(f"Keywords in title/summary: {', '.join(sorted(keyword_hits[:5]))}")

        return "; ".join(reasons) if reasons else "Keyword similarity"

"""
Intake models for the Sourcebox: URL submission, OG scraping, and triage.

RawSource represents a URL or file submitted for research consideration.
The connections JSONField stores engine generated connection suggestions
inline, replacing the former SuggestedConnection model.
"""

from django.db import models

from apps.core.models import TimeStampedModel


class RawSource(TimeStampedModel):
    """A URL or file submitted to the Sourcebox for research triage."""

    class Decision(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"
        DEFERRED = "deferred", "Deferred"

    class Phase(models.TextChoices):
        INBOX = "inbox", "Inbox"
        REVIEW = "review", "Review"
        DECIDED = "decided", "Decided"

    class ScrapeStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETE = "complete", "Complete"
        FAILED = "failed", "Failed"

    class Importance(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    class InputType(models.TextChoices):
        URL = "url", "URL"
        FILE = "file", "File"

    # Input: URL or file (one required)
    url = models.URLField(max_length=2000, blank=True, default="")
    source_file = models.FileField(upload_to="sourcebox/", blank=True)
    input_type = models.CharField(
        max_length=4,
        choices=InputType.choices,
        default=InputType.URL,
    )

    # OG metadata (populated by scrape service)
    og_title = models.CharField(max_length=500, blank=True, default="")
    og_description = models.TextField(blank=True, default="")
    og_image = models.URLField(max_length=2000, blank=True, default="")
    og_site_name = models.CharField(max_length=300, blank=True, default="")
    extracted_content = models.TextField(blank=True, default="", help_text="Readable body text extracted from the page.")

    # Kanban phase (board position, separate from decision outcome)
    phase = models.CharField(
        max_length=7,
        choices=Phase.choices,
        default=Phase.INBOX,
    )

    # Async OG scrape tracking
    scrape_status = models.CharField(
        max_length=8,
        choices=ScrapeStatus.choices,
        default=ScrapeStatus.PENDING,
    )

    # Enrichment
    importance = models.CharField(
        max_length=6,
        choices=Importance.choices,
        default=Importance.MEDIUM,
    )
    tags = models.JSONField(default=list, blank=True)
    connections = models.JSONField(default=list, blank=True)

    # Triage state
    decision = models.CharField(
        max_length=10,
        choices=Decision.choices,
        default=Decision.PENDING,
    )
    decision_note = models.TextField(blank=True, default="")
    decided_at = models.DateTimeField(null=True, blank=True)

    # If accepted, slug of the promoted Source in research_api
    promoted_source_slug = models.SlugField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        label = self.og_title or self.url[:80] or str(self.source_file) or "Untitled"
        return f"[{self.get_decision_display()}] {label}"

    @property
    def display_title(self):
        """OG title with URL or filename fallback."""
        if self.og_title:
            return self.og_title
        if self.url:
            return self.url
        if self.source_file:
            return self.source_file.name.split("/")[-1]
        return "Untitled source"

    @property
    def is_pending(self):
        return self.decision == self.Decision.PENDING

    @property
    def is_scraped(self):
        return self.scrape_status == self.ScrapeStatus.COMPLETE

    @property
    def is_file(self):
        return self.input_type == self.InputType.FILE

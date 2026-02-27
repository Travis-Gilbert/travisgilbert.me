"""
Intake models for the Sourcebox: URL submission, OG scraping, and triage.

RawSource represents a URL submitted for research consideration.
SuggestedConnection links a RawSource to existing content (essay/field note)
with a confidence score from the connection engine.
"""

from django.db import models

from apps.core.models import TimeStampedModel


class RawSource(TimeStampedModel):
    """A URL submitted to the Sourcebox for research triage."""

    class Decision(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"
        DEFERRED = "deferred", "Deferred"

    # Submitted URL
    url = models.URLField(max_length=2000)

    # OG metadata (populated by scrape service)
    og_title = models.CharField(max_length=500, blank=True, default="")
    og_description = models.TextField(blank=True, default="")
    og_image = models.URLField(max_length=2000, blank=True, default="")
    og_site_name = models.CharField(max_length=300, blank=True, default="")

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

    # Tags for quick categorization during triage
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        label = self.og_title or self.url[:80]
        return f"[{self.get_decision_display()}] {label}"

    @property
    def display_title(self):
        """OG title with URL fallback."""
        return self.og_title or self.url

    @property
    def is_pending(self):
        return self.decision == self.Decision.PENDING

    @property
    def is_scraped(self):
        return bool(self.og_title)


class SuggestedConnection(TimeStampedModel):
    """
    Engine-generated suggestion linking a RawSource to existing content.

    Created by the connection engine management command. Confidence scores
    range from 0.0 to 1.0. The accepted field is tri-state: None (pending),
    True (accepted), False (rejected).
    """

    raw_source = models.ForeignKey(
        RawSource,
        on_delete=models.CASCADE,
        related_name="connections",
    )
    content_type = models.CharField(max_length=20)  # essay, field_note
    content_slug = models.SlugField(max_length=300)
    content_title = models.CharField(max_length=500, blank=True, default="")
    confidence = models.FloatField(default=0.0)
    reason = models.TextField(blank=True, default="")
    accepted = models.BooleanField(null=True)  # None=pending, True/False=decided

    class Meta:
        ordering = ["-confidence"]

    def __str__(self):
        status = {None: "?", True: "+", False: "-"}.get(self.accepted, "?")
        return f"[{status}] {self.content_slug} ({self.confidence:.0%})"

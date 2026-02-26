from django.db import models

from apps.core.models import TimeStampedModel


class MentionType(models.TextChoices):
    MENTION = 'mention', 'Mention'
    REPLY = 'reply', 'Reply'
    LIKE = 'like', 'Like'
    REPOST = 'repost', 'Repost'
    BOOKMARK = 'bookmark', 'Bookmark'


class MentionStatus(models.TextChoices):
    PENDING = 'pending', 'Pending Verification'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'
    SPAM = 'spam', 'Spam'


class Webmention(TimeStampedModel):
    """An inbound Webmention from another site.

    Implements the W3C Webmention protocol (https://www.w3.org/TR/webmention/).
    External sites notify us when they link to our content. We verify
    the mention by fetching the source URL and confirming it contains
    a link to our target URL.
    """
    # The two URLs that define a Webmention
    source_url = models.URLField(
        max_length=2000,
        help_text='The URL of the page that mentions our content.',
    )
    target_url = models.URLField(
        max_length=2000,
        help_text='The URL on our site being mentioned.',
        db_index=True,
    )

    # Extracted author info (from microformats h-card if available)
    author_name = models.CharField(max_length=300, blank=True)
    author_url = models.URLField(max_length=2000, blank=True)
    author_photo = models.URLField(max_length=2000, blank=True)

    # Content
    content = models.TextField(
        blank=True,
        help_text='Excerpt or summary extracted from the source page.',
    )
    mention_type = models.CharField(
        max_length=20,
        choices=MentionType.choices,
        default=MentionType.MENTION,
    )

    # Verification
    verified = models.BooleanField(
        default=False,
        help_text='Has the source URL been fetched and confirmed?',
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    # Moderation
    status = models.CharField(
        max_length=20,
        choices=MentionStatus.choices,
        default=MentionStatus.PENDING,
        db_index=True,
    )

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['source_url', 'target_url'],
                name='unique_mention_pair',
            ),
        ]
        indexes = [
            models.Index(
                fields=['status', '-created_at'],
                name='idx_mention_status_date',
            ),
        ]

    def __str__(self):
        return f'{self.source_url} -> {self.target_url}'

    @property
    def target_path(self):
        """Extract the path from target_url for matching to content slugs."""
        from urllib.parse import urlparse
        return urlparse(self.target_url).path

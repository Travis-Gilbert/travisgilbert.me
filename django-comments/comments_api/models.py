import uuid
from django.db import models


CONTENT_TYPE_CHOICES = [
    ("essays", "Essays"),
    ("field-notes", "Field Notes"),
]


class Comment(models.Model):
    """
    A reader comment anchored to a specific paragraph in an article.

    Fields:
    - id: UUID primary key (prevents enumeration, stable for rotation hash)
    - content_type: 'essays' or 'field-notes' (matches Next.js route segments)
    - article_slug: URL slug of the article (matches getCollection() slugs)
    - paragraph_index: 1-based index matching injectAnnotations() convention
    - paragraph_snapshot: first 120 chars of the paragraph text at post time;
      used to detect if editing shifted which paragraph a comment was on
    - author_name: display name (no account required)
    - body: comment text
    - is_flagged: set to True when a reader flags as inappropriate
    - created_at: timestamp
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES)
    article_slug = models.SlugField(max_length=200)
    paragraph_index = models.PositiveSmallIntegerField()
    paragraph_snapshot = models.CharField(max_length=200, blank=True)
    author_name = models.CharField(max_length=80)
    body = models.TextField(max_length=600)
    is_flagged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["content_type", "article_slug"]),
        ]

    def __str__(self):
        return f"{self.author_name} on {self.content_type}/{self.article_slug} para {self.paragraph_index}"

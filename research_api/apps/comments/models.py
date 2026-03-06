import uuid

from django.db import models

from apps.core.models import TimeStampedModel


class Comment(TimeStampedModel):
    """
    Reader comment anchored to a specific paragraph in an essay or field note.

    Content is referenced by slug + type (not ForeignKey) because the content
    lives in the Next.js repo as markdown files, not in this database.
    """

    CONTENT_TYPE_CHOICES = [
        ('essays', 'Essays'),
        ('field-notes', 'Field Notes'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    article_slug = models.SlugField(max_length=300)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES)
    paragraph_index = models.PositiveIntegerField()
    author_name = models.CharField(max_length=80)
    body = models.TextField(max_length=600)
    is_flagged = models.BooleanField(default=False, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    recaptcha_score = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(
                fields=['content_type', 'article_slug', 'created_at'],
                name='comment_article_lookup',
            ),
        ]

    def __str__(self):
        return f'{self.author_name} on {self.article_slug} P{self.paragraph_index}'

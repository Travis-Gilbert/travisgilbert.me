from rest_framework import serializers

from apps.comments.models import Comment


class CommentReadSerializer(serializers.ModelSerializer):
    """Public-facing serializer for reader comments."""

    class Meta:
        model = Comment
        fields = [
            'id',
            'article_slug',
            'content_type',
            'paragraph_index',
            'author_name',
            'body',
            'is_flagged',
            'created_at',
        ]


class CommentCreateSerializer(serializers.ModelSerializer):
    """Validates incoming comment submissions."""

    recaptcha_token = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = Comment
        fields = [
            'article_slug',
            'content_type',
            'paragraph_index',
            'author_name',
            'body',
            'recaptcha_token',
        ]

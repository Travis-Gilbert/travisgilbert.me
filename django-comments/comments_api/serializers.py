from rest_framework import serializers
from .models import Comment


class CommentSerializer(serializers.ModelSerializer):
    """Read serializer: all fields safe to expose publicly."""

    class Meta:
        model = Comment
        fields = [
            "id",
            "content_type",
            "article_slug",
            "paragraph_index",
            "author_name",
            "body",
            "is_flagged",
            "created_at",
        ]
        read_only_fields = ["id", "is_flagged", "created_at"]


class CommentCreateSerializer(serializers.ModelSerializer):
    """
    Write serializer for creating new comments.
    Accepts recaptcha_token as a write-only field (verified in the view,
    not stored in the database).
    """

    recaptcha_token = serializers.CharField(write_only=True, required=False, default="")
    paragraph_snapshot = serializers.CharField(required=False, default="")

    class Meta:
        model = Comment
        fields = [
            "content_type",
            "article_slug",
            "paragraph_index",
            "paragraph_snapshot",
            "author_name",
            "body",
            "recaptcha_token",
        ]

    def validate_body(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Comment is too short.")
        return value.strip()

    def validate_author_name(self, value):
        if len(value.strip()) < 1:
            raise serializers.ValidationError("Name is required.")
        return value.strip()

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Comment
from .serializers import CommentSerializer, CommentCreateSerializer
from .recaptcha import verify_token


class CommentListCreateView(APIView):
    """
    GET  /api/comments/?type=essays&slug=the-sidewalk-tax
         Returns all non-flagged comments for the given article.
         Flagged comments are included so the UI can show the red state.

    POST /api/comments/
         Creates a new comment after reCAPTCHA verification.
    """

    def get(self, request):
        content_type = request.query_params.get("type")
        article_slug = request.query_params.get("slug")

        if not content_type or not article_slug:
            return Response(
                {"error": "Missing type or slug query parameters"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comments = Comment.objects.filter(
            content_type=content_type,
            article_slug=article_slug,
        )
        serializer = CommentSerializer(comments, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CommentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        token = serializer.validated_data.pop("recaptcha_token", "")
        if not verify_token(token):
            return Response(
                {"error": "reCAPTCHA verification failed. Please try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comment = serializer.save()
        return Response(
            CommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )


class CommentFlagView(APIView):
    """
    POST /api/comments/:id/flag/
    Marks the comment as flagged (for admin review).
    Optimistic UI on the frontend updates immediately; this is the server confirm.
    """

    def post(self, request, pk):
        try:
            comment = Comment.objects.get(pk=pk)
        except Comment.DoesNotExist:
            return Response(
                {"error": "Comment not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        comment.is_flagged = True
        comment.save(update_fields=["is_flagged"])
        return Response(CommentSerializer(comment).data)

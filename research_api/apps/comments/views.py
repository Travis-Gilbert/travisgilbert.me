"""
Reader comment endpoints for the Next.js comment system.

The Next.js frontend proxies requests through /api/comments to these
endpoints. The proxy handles CORS and keeps the reCAPTCHA secret key
on the server boundary.
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.comments.models import Comment
from apps.comments.serializers import CommentCreateSerializer, CommentReadSerializer
from apps.research.recaptcha import verify_recaptcha


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def comments_list_create(request):
    """
    GET  /api/comments/?type=essays&slug=the-sidewalk-tax
    POST /api/comments/
    """
    if request.method == 'GET':
        content_type = request.query_params.get('type')
        slug = request.query_params.get('slug')

        if not content_type or not slug:
            return Response(
                {'error': 'Missing type or slug'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comments = Comment.objects.filter(
            content_type=content_type,
            article_slug=slug,
            is_flagged=False,
        )

        data = CommentReadSerializer(comments, many=True).data
        return Response({'comments': data})

    # POST: create a new comment
    serializer = CommentCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    token = serializer.validated_data.pop('recaptcha_token', '')
    passed, score = verify_recaptcha(token)
    if not passed:
        return Response(
            {'error': 'Verification failed. Please try again.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ip = _get_client_ip(request)

    comment = serializer.save(
        ip_address=ip,
        recaptcha_score=score,
        is_flagged=score < 0.3,
    )

    return Response(
        CommentReadSerializer(comment).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def flag_comment(request, comment_id):
    """
    POST /api/comments/<uuid>/flag/

    Marks a comment as flagged. Flagged comments are excluded from GET
    responses and highlighted in the admin for review.
    """
    try:
        comment = Comment.objects.get(pk=comment_id)
    except Comment.DoesNotExist:
        return Response(
            {'error': 'Comment not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    comment.is_flagged = True
    comment.save(update_fields=['is_flagged', 'updated_at'])

    return Response(CommentReadSerializer(comment).data)


def _get_client_ip(request):
    """Extract client IP, respecting proxy headers."""
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')

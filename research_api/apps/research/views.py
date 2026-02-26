"""
Public submission endpoints for community contributions.

These are the only write endpoints in the API (everything else is read-only).
Both POST endpoints require reCAPTCHA v3 verification. Low-scoring submissions
are still accepted but flagged for extra scrutiny in the admin.
"""

from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.research.models import (
    ConnectionSuggestion,
    ReviewStatus,
    Source,
    SourceSuggestion,
)
from apps.research.recaptcha import verify_recaptcha


# ---------------------------------------------------------------------------
# Serializers for public submissions
# ---------------------------------------------------------------------------


class SourceSuggestionCreateSerializer(serializers.ModelSerializer):
    recaptcha_token = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = SourceSuggestion
        fields = [
            'title',
            'url',
            'source_type',
            'relevance_note',
            'target_content_type',
            'target_slug',
            'contributor_name',
            'contributor_url',
            'recaptcha_token',
        ]


class SourceSuggestionReadSerializer(serializers.ModelSerializer):
    """Public-facing serializer for approved suggestions."""

    class Meta:
        model = SourceSuggestion
        fields = [
            'id',
            'title',
            'url',
            'source_type',
            'relevance_note',
            'target_slug',
            'contributor_name',
            'contributor_url',
            'created_at',
        ]


class ConnectionSuggestionCreateSerializer(serializers.ModelSerializer):
    recaptcha_token = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = ConnectionSuggestion
        fields = [
            'from_content_type',
            'from_slug',
            'to_content_type',
            'to_slug',
            'explanation',
            'contributor_name',
            'contributor_url',
            'recaptcha_token',
        ]


# ---------------------------------------------------------------------------
# Public submission endpoints
# ---------------------------------------------------------------------------


@api_view(['POST'])
@permission_classes([AllowAny])
def suggest_source(request):
    """
    Submit a source suggestion for a specific essay or field note.

    POST /api/v1/suggest/source/
    {
        "title": "Flint Water Advisory Task Force Report",
        "url": "https://...",
        "source_type": "report",
        "relevance_note": "This task force report covers the same ...",
        "target_slug": "flint-infrastructure",
        "target_content_type": "essay",
        "contributor_name": "Jane Doe",
        "contributor_url": "https://janedoe.com",
        "recaptcha_token": "..."
    }
    """
    serializer = SourceSuggestionCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    token = serializer.validated_data.pop('recaptcha_token', '')
    passed, score = verify_recaptcha(token)
    if not passed:
        return Response(
            {'error': 'Verification failed. Please try again.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Get IP for rate limiting and audit
    ip = _get_client_ip(request)

    suggestion = serializer.save(
        ip_address=ip,
        is_flagged=score < 0.3,
    )

    return Response(
        {
            'status': 'received',
            'id': suggestion.pk,
            'message': (
                'Thanks for the suggestion! It will appear on the research '
                'trail once reviewed.'
            ),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def suggest_connection(request):
    """
    Suggest a connection between two pieces of content.

    POST /api/v1/suggest/connection/
    {
        "from_slug": "sidewalk-width-observation",
        "from_content_type": "field_note",
        "to_slug": "ada-compliance",
        "to_content_type": "essay",
        "explanation": "The sidewalk width data directly supports ...",
        "contributor_name": "Jane Doe",
        "recaptcha_token": "..."
    }
    """
    serializer = ConnectionSuggestionCreateSerializer(data=request.data)
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

    suggestion = serializer.save(
        ip_address=ip,
        is_flagged=score < 0.3,
    )

    return Response(
        {
            'status': 'received',
            'id': suggestion.pk,
            'message': 'Thanks for suggesting this connection!',
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def approved_suggestions(request, slug):
    """
    Get approved source suggestions for a specific content slug.

    These render in the research trail section with contributor attribution.
    """
    suggestions = SourceSuggestion.objects.filter(
        target_slug=slug,
        status=ReviewStatus.APPROVED,
    ).order_by('-created_at')

    data = SourceSuggestionReadSerializer(suggestions, many=True).data

    return Response({
        'slug': slug,
        'suggestions': data,
    })


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_client_ip(request):
    """Extract client IP, respecting proxy headers."""
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')

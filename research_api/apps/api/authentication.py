"""
DRF authentication class for API key auth.

Bridges the middleware-attached api_key to DRF's authentication
system so views can use request.auth and DRF permissions work
consistently. The middleware does the actual validation; this class
just reads the result.
"""

from rest_framework.authentication import BaseAuthentication


class APIKeyAuthentication(BaseAuthentication):
    """
    DRF authentication backend that reads the api_key
    attached by APIKeyMiddleware.

    Returns (None, api_key) since API keys are not tied
    to Django users. Views access the key via request.auth.
    """

    def authenticate(self, request):
        api_key = getattr(request, 'api_key', None)
        if api_key is None:
            return None
        # (user, auth): no Django user, auth is the APIKey instance
        return (None, api_key)

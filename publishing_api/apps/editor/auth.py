"""
Simple Bearer token authentication for the Studio JSON API.

The token is set via STUDIO_API_TOKEN env var on Railway.
The Next.js frontend sends it in the Authorization header.
"""

import os
from functools import wraps
from django.http import JsonResponse

STUDIO_API_TOKEN = os.environ.get("STUDIO_API_TOKEN", "").strip()


def require_studio_token(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not STUDIO_API_TOKEN:
            return view_func(request, *args, **kwargs)
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return JsonResponse({"detail": "Authentication required."}, status=401)
        provided_token = auth_header[7:].strip()
        if provided_token != STUDIO_API_TOKEN:
            return JsonResponse({"detail": "Invalid token."}, status=403)
        return view_func(request, *args, **kwargs)
    return wrapper

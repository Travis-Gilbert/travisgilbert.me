"""
Server-side reCAPTCHA v3 verification.

The secret key lives here (Django server), never in the frontend.
Tokens are generated in the browser by recaptcha.ts and sent with
each comment POST request.
"""

import requests
from django.conf import settings


VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


def verify_token(token: str) -> bool:
    """
    Sends the token to Google for verification.
    Returns True if the score is above the configured minimum.
    Returns True without checking if no secret key is configured
    (allows local development without reCAPTCHA keys).
    """
    secret = getattr(settings, "RECAPTCHA_SECRET_KEY", "")
    if not secret or not token:
        # Dev mode: skip verification
        return True

    try:
        response = requests.post(
            VERIFY_URL,
            data={"secret": secret, "response": token},
            timeout=5,
        )
        result = response.json()
        score = result.get("score", 0.0)
        return result.get("success", False) and score >= settings.RECAPTCHA_MIN_SCORE
    except Exception:
        # Network failure: fail open (don't block legitimate users)
        return True

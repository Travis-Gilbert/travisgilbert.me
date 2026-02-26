"""
Server-side reCAPTCHA v3 verification.

Same pattern as the comments_api. The secret key stays server-side,
tokens are generated in the browser and sent with each submission.

IMPORTANT: reCAPTCHA v3 tokens are single-use. Google's siteverify
endpoint consumes the token on the first call. A second call with
the same token returns success=false and score=0.0. That's why this
module provides a single verify_recaptcha() function that returns
both the pass/fail decision and the raw score in one HTTP round trip.
"""

import logging

import requests
from django.conf import settings


logger = logging.getLogger(__name__)

VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'


def verify_recaptcha(token: str) -> tuple[bool, float]:
    """
    Verify a reCAPTCHA v3 token in a single HTTP call.

    Returns:
        (passed, score) tuple where:
            passed: True if score >= configured minimum (or if verification
                    is skipped/fails open)
            score:  Raw 0.0..1.0 score from Google, or 1.0 when skipped

    Fail-open behavior:
        Returns (True, 1.0) when no secret key is configured (local dev)
        or when the Google API call fails (network error). Both cases are
        logged so silent failures don't go unnoticed in production.
    """
    secret = getattr(settings, 'RECAPTCHA_SECRET_KEY', '')

    if not secret:
        logger.info('reCAPTCHA skipped: no RECAPTCHA_SECRET_KEY configured')
        return True, 1.0

    if not token:
        logger.warning('reCAPTCHA skipped: empty token received')
        return True, 1.0

    try:
        response = requests.post(
            VERIFY_URL,
            data={'secret': secret, 'response': token},
            timeout=5,
        )
        result = response.json()

        if not result.get('success', False):
            error_codes = result.get('error-codes', [])
            logger.warning(
                'reCAPTCHA verification failed: %s', error_codes,
            )
            return False, 0.0

        score = result.get('score', 0.0)
        min_score = getattr(settings, 'RECAPTCHA_MIN_SCORE', 0.5)
        passed = score >= min_score

        if not passed:
            logger.info(
                'reCAPTCHA score %.2f below threshold %.2f',
                score, min_score,
            )

        return passed, score

    except requests.RequestException as exc:
        logger.error('reCAPTCHA API call failed (failing open): %s', exc)
        return True, 1.0

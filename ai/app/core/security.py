from flask import request

from app.core.exceptions import AuthenticationError
from app.core.logger import get_logger
from app.core.config import settings

logger = get_logger(__name__)


def verify_api_key():
    api_key = request.headers.get("X-API-KEY")

    if not api_key:
        raise AuthenticationError("API key missing")

    if api_key != settings.API_KEY:
        raise AuthenticationError("Invalid API key")


def rate_limit():
    """
    Hook for future Redis-based rate limiting.
    Intentionally minimal.
    """
    return

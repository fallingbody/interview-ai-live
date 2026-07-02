from flask import request, g

from app.core.logger import get_logger
from app.core.exceptions import AuthenticationError
from app.core.config import settings

logger = get_logger(__name__)


def attach_request_context():
    """
    Attach request-scoped metadata for logging, tracing, and debugging.
    This is called via Flask `before_request`.
    """
    g.request_id = request.headers.get("X-Request-ID")
    g.client_ip = request.remote_addr
    g.user_agent = request.headers.get("User-Agent")

    logger.debug(
        "Request context attached",
        extra={
            "request_id": g.request_id,
            "client_ip": g.client_ip,
            "path": request.path,
            "method": request.method,
        },
    )


def require_api_key():
    """
    Validates API key from request headers.
    Can be used as a before_request hook or inside routes.
    """
    api_key = request.headers.get("X-API-KEY")

    logger.debug(f"Checking API key. Received: {api_key}, Expected: {settings.API_KEY}")

    if not api_key:
        raise AuthenticationError("API key is required")

    if api_key != settings.API_KEY:
        raise AuthenticationError(f"Invalid API key. Expected: {settings.API_KEY}, Got: {api_key}")

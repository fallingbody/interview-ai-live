import redis

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

_redis_client = None


def get_redis_client() -> redis.Redis:
    """
    Returns a singleton Redis client.
    """
    global _redis_client

    if _redis_client is None:
        redis_url = (settings.REDIS_URL or "").strip()
        if not redis_url:
            raise RuntimeError("REDIS_URL environment variable is missing or empty")

        _redis_client = redis.Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True,
            health_check_interval=15,
        )

        # Force a connection test to catch errors early
        _redis_client.ping()
        logger.info("Redis client successfully connected")

    return _redis_client

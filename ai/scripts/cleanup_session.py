from app.core.logger import get_logger
from app.persistence.redis.client import get_redis_client
from app.core.constants import REDIS_INTERVIEW_KEY_PREFIX

logger = get_logger(__name__)


def cleanup_sessions():
    redis = get_redis_client()
    pattern = f"{REDIS_INTERVIEW_KEY_PREFIX}:*"

    keys = redis.keys(pattern)
    removed = 0

    for key in keys:
        ttl = redis.ttl(key)
        if ttl == -1:  # no expiration set (should not happen)
            redis.delete(key)
            removed += 1

    logger.info(
        "Redis interview session cleanup completed",
        extra={
            "scanned_keys": len(keys),
            "removed_keys": removed,
        },
    )


if __name__ == "__main__":
    cleanup_sessions()

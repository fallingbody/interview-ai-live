import json
from app.core.logger import get_logger
from app.persistence.redis.client import get_redis_client

logger = get_logger(__name__)

class ResumeDataStore:
    """
    Redis-backed cache for resume text and face verification vectors.
    Speeds up data retrieval during active AI interview sessions.
    """

    def __init__(self):
        self.redis = get_redis_client()
        # Expire cache after 24 hours to prevent stale/orphaned data buildup
        self.TTL_SECONDS = 86400 

    def _key(self, resume_id: str) -> str:
        return f"mockai:resume:{resume_id}"

    def set_resume_data(self, resume_id: str, text: str, face_vector: str = None) -> None:
        try:
            key = self._key(resume_id)
            mapping = {
                "text": text or "",
                "face_vector": face_vector or ""
            }
            self.redis.hset(key, mapping=mapping)
            self.redis.expire(key, self.TTL_SECONDS)
            logger.info(f"Cached resume data in Redis for {resume_id}")
        except Exception as e:
            logger.warning(f"Failed to cache resume data in Redis for {resume_id}: {e}")

    def get_resume_data(self, resume_id: str) -> dict:
        try:
            key = self._key(resume_id)
            data = self.redis.hgetall(key)
            if data:
                # Reset TTL on access
                self.redis.expire(key, self.TTL_SECONDS)
            return data
        except Exception as e:
            logger.warning(f"Failed to retrieve resume data from Redis for {resume_id}: {e}")
            return {}

    def clear_face_vector(self, resume_id: str) -> None:
        try:
            key = self._key(resume_id)
            if self.redis.exists(key):
                self.redis.hset(key, "face_vector", "")
                logger.info(f"Cleared face vector from Redis cache for {resume_id}")
        except Exception as e:
            logger.warning(f"Failed to clear face vector from Redis cache for {resume_id}: {e}")

    def delete_resume_data(self, resume_id: str) -> None:
        try:
            key = self._key(resume_id)
            self.redis.delete(key)
        except Exception as e:
            logger.warning(f"Failed to delete resume data from Redis for {resume_id}: {e}")

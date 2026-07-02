import json
import uuid
from datetime import datetime
from typing import Dict

from app.core.constants import REDIS_INTERVIEW_KEY_PREFIX
from app.core.exceptions import NotFoundError
from app.core.logger import get_logger
from app.persistence.redis.client import get_redis_client

logger = get_logger(__name__)


class InterviewSessionStore:
    """
    Redis-backed interview session store.
    Stores sessions as JSON only (never Python objects).
    """

    def __init__(self):
        self.redis = get_redis_client()

    def _key(self, interview_id: str) -> str:
        return f"{REDIS_INTERVIEW_KEY_PREFIX}:{interview_id}"

    def create_session(
        self,
        candidate_id: str,
        resume_id: str,
        campaign_id: str,
        role: str,
        level: str | None = None,
    ) -> str:
        interview_id = str(uuid.uuid4())

        session = {
            "interview_id": interview_id,
            "candidate_id": candidate_id,
            "resume_id": resume_id,
            "campaign_id": campaign_id,
            "role": role,
            "level": level,
            "question_no":1,
            "data": [],
            "created_at": datetime.utcnow().isoformat(),
        }

        self.redis.set(
            self._key(interview_id),
            json.dumps(session, default=str),
        )

        logger.info(
            "Interview session created",
            extra={"interview_id": interview_id},
        )

        return interview_id

    def get_session(self, interview_id: str) -> Dict:
        raw = self.redis.get(self._key(interview_id))
        if not raw:
            raise NotFoundError("Interview session not found")

        return json.loads(raw)

    def update_session(self, interview_id: str, session: Dict) -> None:
        key = self._key(interview_id)

        if not self.redis.exists(key):
            raise NotFoundError("Interview session not found")

        ttl = self.redis.ttl(key)

        self.redis.set(
            name=key,
            value=json.dumps(session, default=str),
            ex=ttl if ttl and ttl > 0 else None,
        )

        logger.info(
            "Interview session updated",
            extra={"interview_id": interview_id},
        )

    def delete_session(self, interview_id: str) -> None:
        self.redis.delete(self._key(interview_id))

        logger.info(
            "Interview session deleted",
            extra={"interview_id": interview_id},
        )

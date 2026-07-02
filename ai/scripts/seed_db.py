from uuid import uuid4

from app.core.logger import get_logger
from app.persistence.database.session import get_db_session
from app.persistence.database.models.user_model import UserModel

logger = get_logger(__name__)


def seed_users():
    db = get_db_session()
    try:
        if db.query(UserModel).count() > 0:
            logger.info("Users already exist, skipping seed")
            return

        users = [
            UserModel(
                id=uuid4(),
                name="Test Candidate",
                email="test.candidate@example.com",
            )
        ]

        db.add_all(users)
        db.commit()

        logger.info("Database seeded successfully")

    finally:
        db.close()


if __name__ == "__main__":
    seed_users()

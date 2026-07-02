
import sys
import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

    
import pytest
from unittest.mock import patch

from app.main import create_app
from app.persistence.database.session import get_db_session
from app.persistence.redis.client import get_redis_client


@pytest.fixture(scope="session")
def app():
    app = create_app(testing=True)
    return app


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()


@pytest.fixture(scope="function")
def db_session():
    db = get_db_session()
    yield db
    db.rollback()
    db.close()


@pytest.fixture(scope="function")
def redis_client():
    redis = get_redis_client()
    redis.flushdb()
    yield redis
    redis.flushdb()


@pytest.fixture(scope="function")
def mock_llm():
    with patch("app.llm.client.LLMClient.generate") as mock_gen, patch(
        "app.llm.client.LLMClient.generate_json"
    ) as mock_json:
        mock_gen.return_value = "What is Python?"
        mock_json.return_value = {
            "overall_score": 7.5,
            "strengths": ["Good fundamentals"],
            "weaknesses": ["Needs deeper system design"],
            "recommendations": ["Practice scalable systems"],
            "detailed_feedback": {
                "communication": "Clear",
                "technical_depth": "Moderate",
                "problem_solving": "Good",
                "culture_fit": "Strong",
            },
        }
        yield

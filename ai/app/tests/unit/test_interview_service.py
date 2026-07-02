from uuid import uuid4
from app.services.interview_service import InterviewService


def test_start_interview(redis_client, mock_llm):
    service = InterviewService()

    payload = {
        "candidate_id": uuid4(),
        "resume_id": uuid4(),
        "campaign_id": uuid4(),
        "role": "Backend Engineer",
        "campaign_id": "unit-test-campaign",
    }

    result = service.start_interview_session(payload)

    assert "interview_id" in result
    assert "question" in result
    assert result["question_no"] == 1

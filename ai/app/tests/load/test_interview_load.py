from uuid import uuid4


def test_multiple_interview_sessions(client, mock_llm):
    for _ in range(10):
        response = client.post(
            "/api/interviews/start",
            json={
                "candidate_id": str(uuid4()),
                "resume_id": str(uuid4()),
                "campaign_id": str(uuid4()),
                "role": "Backend Engineer",
                "campaign_id": "load-test-campaign",
            },
        )
        assert response.status_code == 201

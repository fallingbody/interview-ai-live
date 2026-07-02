from uuid import uuid4


def test_interview_flow(client, mock_llm):
    start_payload = {
        "candidate_id": str(uuid4()),
        "resume_id": str(uuid4()),
        "campaign_id": str(uuid4()),
        "role": "Backend Engineer",
        "campaign_id": "test-campaign-1",
    }

    start = client.post("/api/interviews/start", json=start_payload)
    assert start.status_code == 201

    interview_id = start.get_json()["interview_id"]

    handle = client.post(
        "/api/interviews/handle",
        json={
            "interview_id": interview_id,
            "answer": "Python is a programming language",
        },
    )

    assert handle.status_code == 200

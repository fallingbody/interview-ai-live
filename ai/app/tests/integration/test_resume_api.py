def test_resume_upload(client):
    data = {
        "candidate_name": "Jane Doe",
        "email": "jane@example.com",
    }

    response = client.post(
        "/api/resumes/upload",
        data={**data, "file": (open(__file__, "rb"), "resume.pdf")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert "candidate_id" in payload

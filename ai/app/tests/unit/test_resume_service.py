from app.services.resume_service import ResumeService


def test_create_resume(db_session):
    service = ResumeService()

    data = {
        "candidate_name": "John Doe",
        "email": "john@example.com",
        "file": type("File", (), {"filename": "resume.pdf"})(),
    }

    result = service.create_resume(data)

    assert "candidate_id" in result
    assert "resume_id" in result

from app.services.question_service import QuestionService


def test_generate_question(mock_llm):
    service = QuestionService()

    question = service.generate_question(
        resume_id=None,
        role="Backend Engineer",
        previous_questions=[],
    )

    assert isinstance(question, str)

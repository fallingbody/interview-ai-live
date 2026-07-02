from app.persistence.redis.interview_session import InterviewSessionStore
from app.services.resume_service import ResumeService
from app.core.exceptions import NotFoundError
from app.services.report_service import ReportService
from app.services.face_analysis_service import face_analysis_service
from app.services.ai_service import ai_service
from app.core.exceptions import ApplicationError
from app.core.logger import get_logger
from app.core.config import settings
from app.persistence.database.session import get_db_session
from app.persistence.database.models.report_model import ReportModel
import os


logger = get_logger(__name__)


class InterviewService:
    def __init__(self):
        self.session_store = InterviewSessionStore()
        self.ai_service = ai_service
        self.resume_service = ResumeService()
        self.report_service = ReportService()
        self.face_analysis_service = face_analysis_service
        configured_question_count = os.getenv("NUMBER_OF_QUESTIONS", str(settings.MAX_QUESTIONS))
        try:
            self.NUMBER_OF_QUESTIONS = max(1, int(configured_question_count))
        except (TypeError, ValueError):
            logger.warning(
                "Invalid NUMBER_OF_QUESTIONS value. Falling back to default.",
                extra={"value": configured_question_count},
            )
            self.NUMBER_OF_QUESTIONS = 10

    def start_interview_session(self, payload: dict) -> dict:
        # Normalize UUID inputs to strings for database and prompt compatibility.
        candidate_id = str(payload["candidate_id"])
        resume_id = str(payload["resume_id"])
        campaign_id = str(payload["campaign_id"])
        role = str(payload["role"])

        # Block re-attempts only within the same candidate+role+campaign.
        db = get_db_session()
        try:
            existing_report = (
                db.query(ReportModel)
                .filter(
                    ReportModel.candidate_id == candidate_id,
                    ReportModel.role == role,
                    ReportModel.campaign_id == campaign_id,
                )
                .first()
            )
        finally:
            db.close()

        if existing_report:
            raise ApplicationError("Interview already completed for this role.")

        resume_text = self.resume_service.get_resume_text(resume_id)

        # Determine candidate level
        level = payload.get("level")
        if not level:
            from app.utils.classifier import classify_candidate
            level = classify_candidate(resume_text)
        level = level.strip().lower()

        # Get face image path for verification
        face_image_path = self.resume_service.get_resume_face_image(resume_id)

        try:
            response_payload = self.ai_service.generate_next_dynamic_question(
                role=role,
                resume_text=resume_text,
                previous_interactions="No previous interactions.",
                level=level,
            )
            first_question = response_payload.get("question")
            if not first_question:
                raise ApplicationError("LLM failed to return a valid first question.")
        except Exception as e:
            logger.exception(
                "First question generation failed",
                extra={"error": str(e)},
            )
            raise ApplicationError("Failed to generate first question")

        interview_id = self.session_store.create_session(
            candidate_id=candidate_id,
            resume_id=resume_id,
            campaign_id=campaign_id,
            role=role,
            level=level,
        )
        session = self.session_store.get_session(interview_id)
        session["data"].append({"question": first_question, "answer": None})
        session["question_no"] = 1
        self.session_store.update_session(interview_id, session)

        # Start face analysis session with reference image
        self.face_analysis_service.start_session(interview_id, face_image_path)

        # Pre-generation is handled by interview_routes.py

        return {
            "interview_id": interview_id,
            "question": first_question,
            "question_no": 1,
            "total_questions": self.NUMBER_OF_QUESTIONS,
        }

    def handle_interview_session(self, payload: dict) -> dict:
        interview_id = payload["interview_id"]
        answer = payload["answer"]

        session = self.session_store.get_session(interview_id)
        current_question = session["question_no"]
        if len(session["data"]) < current_question:
            raise ApplicationError("Interview session is missing the current question")
        session["data"][current_question - 1]["answer"] = answer
        self.session_store.update_session(interview_id, session)

        resume_text = self.resume_service.get_resume_text(session["resume_id"])
        level = session.get("level", "intermediate")

        try:
            previous_interactions = "\n\n".join(
                f"AI: {item['question']}\nCandidate: {item['answer'] or 'No answer provided.'}"
                for item in session["data"]
            )
        except Exception as e:
            logger.exception(
                "Error formatting previous interactions",
                extra={"error": str(e)},
            )
            raise ApplicationError("Internal Error while formatting context")

        if session["question_no"] >= self.NUMBER_OF_QUESTIONS:
            # End face analysis and store results
            face_analysis_result = self.face_analysis_service.end_session(interview_id)
            session["face_analysis"] = face_analysis_result
            self.session_store.update_session(interview_id, session)
            # Privacy: wipe biometric reference vector after interview concludes
            try:
                self.resume_service.clear_face_vector(session["resume_id"])
            except Exception as e:
                logger.warning(f"Face vector cleanup failed: {e}")
            return {
                "next_question": None,
                "question_no": session["question_no"],
                "total_questions": self.NUMBER_OF_QUESTIONS,
                "stop": True,
            }

        try:
            response_payload = self.ai_service.generate_next_dynamic_question(
                role=session["role"],
                resume_text=resume_text,
                previous_interactions=previous_interactions,
                level=level,
                question_no=current_question + 1,
                total_questions=self.NUMBER_OF_QUESTIONS,
            )
            next_question = response_payload.get("question")

            if not next_question:
                next_question = self.ai_service.fallback_question(
                    session["role"],
                    current_question + 1,
                    self.NUMBER_OF_QUESTIONS,
                )
        except Exception as e:
            logger.exception(
                "Question generation failed in interview_service",
                extra={"error": str(e)},
            )
            next_question = self.ai_service.fallback_question(
                session["role"],
                current_question + 1,
                self.NUMBER_OF_QUESTIONS,
            )

        session["data"].append({"question": next_question, "answer": None})
        session["question_no"] = current_question + 1
        self.session_store.update_session(interview_id, session)

        # Pre-generation is handled by interview_routes.py

        return {
            "next_question": next_question,
            "question_no": session["question_no"],
            "total_questions": self.NUMBER_OF_QUESTIONS,
            "stop": False,
        }

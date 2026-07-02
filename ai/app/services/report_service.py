from typing import Dict

from app.core.logger import get_logger
from app.core.exceptions import ApplicationError, NotFoundError
from app.services.scoring_service import ScoringService
from app.persistence.database.session import get_db_session
from app.persistence.database.models.report_model import ReportModel
from app.persistence.database.models.user_model import UserModel
import json
import re
from app.utils.json import to_dict, safe_json_loads

logger = get_logger(__name__)


class ReportService:
    def __init__(self):
        self.scoring_service = ScoringService()

    def create_report(self, interview_session: Dict) -> None:
        db = get_db_session()

        try:
            # Pad unanswered questions if they terminated early to ensure proper scoring
            import os
            from app.core.config import settings
            configured_question_count = os.getenv("NUMBER_OF_QUESTIONS", str(settings.MAX_QUESTIONS))
            try:
                total_expected = max(1, int(configured_question_count))
            except (TypeError, ValueError):
                total_expected = 6

            session_data = interview_session.get("data", [])
            
            # Pad remaining expected questions up to total_expected
            while len(session_data) < total_expected:
                session_data.append({
                    "question": f"Question {len(session_data) + 1}",
                    "answer": "Candidate did not answer (Interview terminated early)."
                })

            # Ensure any existing questions that have None or empty answers are marked as unanswered
            for item in session_data:
                if not item.get("answer") or str(item.get("answer")).strip() == "":
                    item["answer"] = "Candidate did not answer (Interview terminated early)."

            interview_session["data"] = session_data

            scored = self.scoring_service.score_interview(interview_session)

            # If scored is a string (JSON parsing failed upstream), attempt to parse it
            if isinstance(scored, str):
                try:
                    import json as _json
                    scored = _json.loads(scored)
                except Exception:
                    pass  # Keep as string if unparseable

            if isinstance(scored, dict):
                face_analysis = interview_session.get("face_analysis")
                if isinstance(face_analysis, dict) and face_analysis:
                    scored["face_analysis"] = {
                        **(scored.get("face_analysis") or {}),
                        **face_analysis,
                    }
                scored = self.scoring_service._normalize_recommendation(scored)

            # Always inject the real candidate name and email from the users table.
            # The LLM cannot extract these from the Q&A transcript, so they are always N/A
            # unless we inject them here from the database.
            if isinstance(scored, dict):
                try:
                    candidate_id = interview_session.get("candidate_id")
                    if candidate_id:
                        user = db.query(UserModel).filter(UserModel.id == candidate_id).first()
                        if user:
                            overview = scored.setdefault("candidate_overview", {})
                            overview["name"] = user.name
                            overview["email"] = user.email
                            logger.info(f"Injected candidate name/email into report for candidate_id={candidate_id}")
                except Exception as e:
                    logger.warning(f"Failed to inject candidate name/email into report: {e}")

            campaign_id = interview_session.get("campaign_id")
            if not campaign_id or campaign_id == "None":
                import uuid
                campaign_id = str(uuid.uuid4())
                logger.warning("Interview session is missing campaign_id, using fallback UUID.")

            report = ReportModel(
                interview_id=interview_session["interview_id"],
                candidate_id=interview_session["candidate_id"],
                campaign_id=campaign_id,
                role=interview_session["role"],
                report_data=scored,
            )

            db.add(report)
            db.commit()

            logger.info(
                "Interview report stored",
                extra={"interview_id": interview_session["interview_id"]},
            )

            # Security/Privacy: Delete the face vector from the database once the interview is permanently over
            try:
                from app.persistence.database.models.resume_model import Resume
                resume_id = interview_session.get("resume_id")
                if resume_id:
                    resume = db.query(Resume).filter(Resume.id == resume_id).first()
                    if resume and resume.face_image_path:
                        resume.face_image_path = None
                        db.commit()
                        logger.info("Securely deleted candidate face vector from PostgreSQL for privacy compliance.", extra={"resume_id": resume_id})
            except Exception as e:
                logger.warning(f"Failed to delete candidate face vector: {e}")
        finally:
            db.close()

    def get_report(self, interview_id) -> Dict:
        db = get_db_session()

        try:
            report = db.query(ReportModel).filter(ReportModel.interview_id == interview_id).first()
            if not report:
                # Try generating fallback report from Redis session (early termination or crash)
                try:
                    from app.persistence.redis.interview_session import InterviewSessionStore
                    session_store = InterviewSessionStore()
                    session = session_store.get_session(interview_id)
                    if session:
                        logger.info(
                            "Generating fallback report on-the-fly",
                            extra={"interview_id": interview_id},
                        )
                        self.create_report(session)
                        report = db.query(ReportModel).filter(ReportModel.interview_id == interview_id).first()
                except Exception as e:
                    logger.warning(
                        "Failed to generate fallback report",
                        extra={"interview_id": interview_id, "error": str(e)},
                    )

            if not report:
                raise NotFoundError("Report not found")

            parsed_report = to_dict(report)
            raw_report_data = parsed_report["report_data"]

            if isinstance(raw_report_data, dict):
                return raw_report_data

            parsed_json_report = str(raw_report_data).strip("` \n")
            parsed_json_report = re.sub(r"^```json\s*", "", parsed_json_report, flags=re.IGNORECASE)
            parsed_json_report = re.sub(r"^```\s*", "", parsed_json_report, flags=re.IGNORECASE)
            parsed_json_report = re.sub(
                r"\s*```$", "", parsed_json_report, flags=re.IGNORECASE
            ).strip()

            start = parsed_json_report.find("{")
            end = parsed_json_report.rfind("}")
            if start != -1 and end != -1 and end > start:
                parsed_json_report = parsed_json_report[start : end + 1].strip()

            try:
                data = safe_json_loads(parsed_json_report)
                return data
            except Exception as e:
                logger.exception(
                    "Json loading error",
                    extra={"error": str(e)},
                )
            return parsed_json_report
        finally:
            db.close()

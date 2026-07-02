from flask import Blueprint, request, jsonify

from app.core.logger import get_logger
from app.api.schemas.interview_schema import (
    StartInterviewSchema,
    HandleInterviewSchema,
)
from app.services.interview_service import InterviewService
from app.persistence.redis.interview_session import InterviewSessionStore
from app.core.exceptions import CustomException

logger = get_logger(__name__)

from flask import Blueprint, request, jsonify
import sys

from app.services.interview_service import InterviewService
from app.api.schemas.interview_schema import StartInterviewSchema
from app.api.dependencies import require_api_key
from app.services.report_service import ReportService
import json

interview_bp = Blueprint("interviews", __name__, url_prefix="/api/interviews")

@interview_bp.route("/start", methods=["POST"])
def start_interview():
    require_api_key()

    payload = request.get_json()
    data = StartInterviewSchema().load(payload)

    service = InterviewService()
    
    result = service.start_interview_session(data)

    interview_id = result["interview_id"]
    question = result["question"]
    question_no = result["question_no"]
    
    if question and interview_id:
        try:
            from app.api.routes.tts_routes import _pregenerate_audio_background, _pregeneration_threads, _pregeneration_lock
            cache_key = f"{interview_id}:{question_no}"
            
            with _pregeneration_lock:
                if cache_key not in _pregeneration_threads:
                    import threading
                    thread = threading.Thread(
                        target=_pregenerate_audio_background,
                        args=(interview_id, question, question_no),
                        daemon=True
                    )
                    _pregeneration_threads[cache_key] = thread
                    thread.start()
        except Exception as e:
            logger.warning(f"Failed to start pre-generation thread: {e}")

    return jsonify(
        {
            "interview_id": interview_id,
            "question": question,
            "question_index": question_no,
            "total_questions": result["total_questions"],
        }
    ), 201



@interview_bp.route("/handle", methods=["POST"])
def submit_answer():
    try:
        data = HandleInterviewSchema().load(request.json)

        service = InterviewService()
        
        response = service.handle_interview_session(data)

        if response.get("stop"):
            session_store = InterviewSessionStore()
            session=session_store.get_session(data["interview_id"])
            if session:
                report_service=ReportService()
                report_service.create_report(session)
            return jsonify({
                "message": "Interview Finished!.Thank you for joining",
                "stop":True
            })

        next_question = response.get("next_question")
        question_no = response.get("question_no")
        interview_id = data.get("interview_id")
        
        if next_question and interview_id:
            try:
                from app.api.routes.tts_routes import _pregenerate_audio_background, _pregeneration_threads, _pregeneration_lock
                cache_key = f"{interview_id}:{question_no}"
                
                with _pregeneration_lock:
                    if cache_key not in _pregeneration_threads:
                        import threading
                        thread = threading.Thread(
                            target=_pregenerate_audio_background,
                            args=(interview_id, next_question, question_no),
                            daemon=True
                        )
                        _pregeneration_threads[cache_key] = thread
                        thread.start()
            except Exception as e:
                logger.warning(f"Failed to start pre-generation thread: {e}")

        return jsonify(response)

    except Exception as e:
        raise CustomException(e,sys) 

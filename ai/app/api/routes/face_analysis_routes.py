from flask import Blueprint, jsonify, request

from app.api.dependencies import require_api_key
from app.services.face_analysis_service import face_analysis_service

face_analysis_bp = Blueprint(
    "face_analysis_routes",
    __name__,
    url_prefix="/api/face-analysis",
)


@face_analysis_bp.route("/start", methods=["POST"])
def start_face_analysis():
    require_api_key()

    payload = request.get_json(silent=True) or {}
    interview_id = payload.get("interview_id")
    if not interview_id:
        return jsonify({"error": "interview_id is required"}), 400

    face_analysis_service.start_session(interview_id)
    return jsonify({"message": "Face analysis started"}), 200


@face_analysis_bp.route("/frame", methods=["POST"])
def analyze_face_frame():
    require_api_key()

    payload = request.get_json(silent=True) or {}
    interview_id = payload.get("interview_id")
    vector = payload.get("vector")
    cheating_details = payload.get("cheating_details")

    if not interview_id:
        return jsonify({"error": "interview_id is required"}), 400
    if not vector:
        return jsonify({"error": "vector is required"}), 400

    try:
        result = face_analysis_service.analyze_vector(interview_id, vector, cheating_details)
        return jsonify(result), 200
    except Exception as e:
        # Avoid crashing the endpoint completely on transient Redis timeouts
        return jsonify({"warning": "Transient error during face analysis processing", "details": str(e)}), 200


@face_analysis_bp.route("/end", methods=["POST"])
def end_face_analysis():
    require_api_key()

    payload = request.get_json(silent=True) or {}
    interview_id = payload.get("interview_id")
    if not interview_id:
        return jsonify({"error": "interview_id is required"}), 400

    result = face_analysis_service.end_session(interview_id)
    return jsonify(result), 200
from flask import Blueprint, request, jsonify

from app.api.schemas.resume_schema import ResumeUploadSchema
from app.api.dependencies import require_api_key
from app.services.resume_service import ResumeService
from app.core.logger import get_logger

logger = get_logger(__name__)

resume_bp = Blueprint("resumes", __name__, url_prefix="/api/resumes")


@resume_bp.route("/upload", methods=["POST"], strict_slashes=False)
def upload_resume():
    require_api_key()

    logger.info(f"Resume upload request received. Files: {request.files.keys()}, Form: {request.form.keys()}")

    import urllib.parse
    name_header = request.headers.get("X-Candidate-Name")
    email_header = request.headers.get("X-Candidate-Email")
    
    data = {
        "file": request.files.get("file"),
        "candidate_image": request.files.get("candidate_image"),
        "candidate_image_vector": request.form.get("candidate_image_vector"),
        "name": urllib.parse.unquote(name_header) if name_header else request.form.get("name") or request.form.get("username"),
        "email": urllib.parse.unquote(email_header) if email_header else request.form.get("email"),
    }

    logger.info(f"Extracted data for validation: file={data['file'] is not None}, name={data['name']}, email={data['email']}")

    validated = ResumeUploadSchema().load(data)

    service = ResumeService()
    result = service.create_resume_from_file(
        file=validated["file"],
        name=validated["name"],
        email=validated["email"],
        candidate_image_file=data["candidate_image"],
        candidate_image_vector=validated.get("candidate_image_vector"),
    )

    return jsonify(result), 201


@resume_bp.route("/check", methods=["GET"], strict_slashes=False)
def check_existing_resume():
    """Check if a resume already exists for the given email."""
    require_api_key()

    email = request.args.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "email is required"}), 400

    service = ResumeService()
    result = service.check_existing_resume(email)
    return jsonify(result), 200


@resume_bp.route("/scan-face", methods=["POST"])
def scan_resume_face():
    require_api_key()

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "file is required"}), 400

    service = ResumeService()
    result = service.scan_resume_for_face(file)
    return jsonify(result), 200


@resume_bp.route("/<resume_id>/reference-image", methods=["POST"])
def upload_resume_reference_image(resume_id):
    require_api_key()

    image = request.files.get("image")
    if not image:
        return jsonify({"error": "image is required"}), 400

    service = ResumeService()
    result = service.attach_reference_image(resume_id=resume_id, image_file=image)
    return jsonify(result), 200

@resume_bp.route("/<resume_id>/face-vector", methods=["POST"])
def update_resume_face_vector(resume_id):
    require_api_key()

    vector = request.json.get("candidate_image_vector")
    if not vector:
        return jsonify({"error": "candidate_image_vector is required"}), 400

    from app.persistence.database.session import get_db_session
    db = get_db_session()
    try:
        from app.persistence.database.models.resume_model import Resume
        from app.persistence.redis.resume_store import ResumeDataStore
        from datetime import datetime

        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            return jsonify({"error": "Resume not found"}), 404

        resume.face_image_path = str(vector)
        resume.updated_at = datetime.utcnow()
        db.commit()

        # Update Redis cache
        ResumeDataStore().set_resume_data(
            resume_id=resume_id,
            text=resume.extracted_text,
            face_vector=str(vector)
        )

        return jsonify({"success": True}), 200
    finally:
        db.close()

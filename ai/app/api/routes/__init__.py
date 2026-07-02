from flask import Blueprint

from app.api.routes.resume_routes import resume_bp
from app.api.routes.interview_routes import interview_bp
from app.api.routes.report_routes import report_bp
from app.api.routes.face_analysis_routes import face_analysis_bp
from app.api.routes.tts_routes import tts_bp


def register_routes(app):
    from app.api.routes.resume_routes import resume_bp
    from app.api.routes.interview_routes import interview_bp
    from app.api.routes.report_routes import report_bp
    from app.api.routes.face_analysis_routes import face_analysis_bp
    from app.api.routes.tts_routes import tts_bp

    app.register_blueprint(resume_bp)
    app.register_blueprint(interview_bp)
    app.register_blueprint(report_bp)
    app.register_blueprint(face_analysis_bp)
    app.register_blueprint(tts_bp)
    
    # 🔍 Root check for user and cloud healthchecks
    @app.route("/")
    def index(): return {"status": "ok", "message": "API Engine is running perfectly!"}

    @app.route("/api/ping")
    def ping(): return {"status": "ok", "message": "API Engine is ALIVE"}

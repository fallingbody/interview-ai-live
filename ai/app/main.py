import sys
from pathlib import Path

from flask import Flask, request

# Allow `python app/main.py` to resolve the sibling `app` package reliably.
APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import settings
from app.core.logger import get_logger
from app.persistence.database.base import Base
from app.persistence.database.session import engine

from app.core.error_handlers import register_error_handlers
from app.api.routes import register_routes
from app.api.dependencies import attach_request_context
from flask_cors import CORS
from app.observability import (
    init_tracing,
    init_metrics,
    register_healthcheck,
)

logger = get_logger(__name__)


def create_app(testing: bool = False) -> Flask:
    app = Flask(settings.APP_NAME)
    
    CORS(app)

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    app.config["ENV"] = settings.ENV
    app.config["DEBUG"] = settings.DEBUG
    app.config["TESTING"] = testing

    # Ensure database tables exist on startup to simplify PostgreSQL deployment
    with app.app_context():
        try:
            from app.persistence.database.models.user_model import UserModel
            from app.persistence.database.models.resume_model import Resume
            from app.persistence.database.models.report_model import ReportModel
            Base.metadata.create_all(bind=engine)
            logger.info("Successfully bootstrapped database tables")
        except Exception as e:
            logger.error(f"Failed to bootstrap database tables: {e}")

    app.before_request(attach_request_context)

    @app.before_request
    def log_request_info():
        logger.info(f"Incoming Request: {request.method} {request.url}")

    register_routes(app)
    register_error_handlers(app)

    if not testing:
        # init_tracing(app)
        # init_metrics(app)
        register_healthcheck(app)

    logger.info(
        "Flask application initialized",
        extra={
            "env": settings.ENV,
            "testing": testing,
        },
    )

    if not testing:
        with app.app_context():
            try:
                from app.api.routes.tts_routes import get_tts_model
                logger.info("Pre-loading and warming up TTS speech engine on startup...")
                get_tts_model()
            except Exception as e:
                logger.error(f"Failed to pre-load TTS model on startup: {e}")

    return app

app = create_app()
if __name__ == "__main__":
    '''
    This is for the development mode 
    '''
    # app.run(
    #     host="0.0.0.0",
    #     port=8000, 
    #     debug=settings.DEBUG,
    # )
    app.run()

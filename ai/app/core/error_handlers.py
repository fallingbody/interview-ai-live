from flask import jsonify
from marshmallow import ValidationError as MarshmallowValidationError

from app.core.exceptions import BaseAppException
from app.core.logger import get_logger

logger = get_logger(__name__)


def register_error_handlers(app):
    @app.errorhandler(BaseAppException)
    def handle_app_exception(error: BaseAppException):
        logger.error(
            "Application error",
            extra={"error": str(error)},
        )
        return (
            jsonify(
                {
                    "error": error.message,
                    "status_code": error.status_code,
                }
            ),
            error.status_code,
        )

    @app.errorhandler(404)
    def handle_404(error):
        from flask import request
        logger.warning(
            f"404 Not Found: {request.method} {request.url}",
            extra={"path": request.path}
        )
        return (
            jsonify(
                {
                    "error": "Not Found",
                    "detail": f"The requested URL {request.path} was not found."
                }
            ),
            404,
        )

    @app.errorhandler(MarshmallowValidationError)
    def handle_marshmallow_error(error: MarshmallowValidationError):
        logger.error(
            "Validation error",
            extra={"error_details": error.messages},
        )
        return (
            jsonify(
                {
                    "error": "Invalid request payload",
                    "details": error.messages,
                }
            ),
            400,
        )

    @app.errorhandler(Exception)
    def handle_unhandled_exception(error: Exception):
        import traceback
        tb = traceback.format_exc()
        print("\n" + "="*80)
        print("UNHANDLED EXCEPTION:")
        print(tb)
        print("="*80 + "\n")

        logger.error(
            "Unhandled exception",
            extra={"error": str(error), "traceback": tb},
        )
        return (
            jsonify(
                {
                    "error": "Internal server error",
                    "detail": str(error),
                }
            ),
            500,
        )

from flask import Blueprint, jsonify

from app.core.logger import get_logger
from app.services.report_service import ReportService

logger = get_logger(__name__)
report_bp = Blueprint("report_routes", __name__, url_prefix="/api/reports")


@report_bp.route("/<string:interview_id>", methods=["GET"])
def get_report(interview_id: str):

    service = ReportService()
    report = service.get_report(interview_id)

    logger.info(
        "Interview report fetched",
        extra={"interview_id": interview_id},
    )

    return jsonify(report), 200

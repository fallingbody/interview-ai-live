from app.core.logger import get_logger
from app.core.exceptions import ServiceError
from app.persistence.database.session import get_db_session
from app.persistence.database.models.report_model import ReportModel
from app.services.scoring_service import ScoringService

logger = get_logger(__name__)


def backfill_reports():
    db = get_db_session()
    scoring_service = ScoringService()

    try:
        reports = (
            db.query(ReportModel)
            .filter(ReportModel.report_data == None)  # noqa: E711
            .all()
        )

        logger.info(
            "Backfill started",
            extra={"missing_reports": len(reports)},
        )

        for report in reports:
            try:
    
                scored = scoring_service.score_interview(
                    {
                        "interview_id": report.interview_id,
                        "candidate_id": report.candidate_id,
                        "role": report.role,
                        "qa": [],
                    }
                )

                report.report_data = scored
                db.add(report)

            except Exception as exc:
                logger.error(
                    "Failed to backfill report",
                    extra={"interview_id": report.interview_id},
                )
                continue

        db.commit()
        logger.info("Backfill completed")

    except Exception as exc:
        db.rollback()
        raise ServiceError("Backfill failed") from exc

    finally:
        db.close()


if __name__ == "__main__":
    backfill_reports()

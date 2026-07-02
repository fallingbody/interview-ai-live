from flask import Blueprint, jsonify

from app.core.logger import get_logger
from app.persistence.database.session import get_db_session
from app.persistence.redis.client import get_redis_client

logger = get_logger(__name__)

health_bp = Blueprint("healthcheck", __name__)


@health_bp.route("/health/live", methods=["GET"])
def liveness():
    return jsonify({"status": "alive"}), 200


@health_bp.route("/health/ready", methods=["GET"])
def readiness():
    try:
        db = get_db_session()
        db.execute("SELECT 1")
        db.close()

        redis = get_redis_client()
        redis.ping()

        return jsonify({"status": "ready"}), 200

    except Exception as exc:
        logger.exception("Readiness check failed")
        return jsonify({"status": "unhealthy"}), 503


def register_healthcheck(app):
    app.register_blueprint(health_bp)
